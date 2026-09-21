#!/usr/bin/env python3
"""
把 sounds-src/work/*.wav（44.1k 单声道 16bit）切成单次事件的采样，
写到 sounds-src/work/slices/，再转成 AAC 放进 public/sounds/lib/，并输出清单 manifest.json。

准备 work 目录：for f in sounds-src/raw/*; do afconvert -f WAVE -d LEI16@44100 -c 1 "$f" "sounds-src/work/$(basename "${f%.*}").wav"; done

只用标准库：wave + array。
- onsets 模式：按包络找起音，每个起音切一段，直到衰减到底或下一个起音
- whole 模式：整段（去掉首尾静音）
- tail 模式：只要结尾前的一段（硬币转到停的那段）
"""
import array
import json
import math
import os
import sys
import subprocess
import wave

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "..", "sounds-src")
WORK = os.path.join(SRC, "work")
OUT = os.path.join(SRC, "work", "slices")
LIB = os.path.join(HERE, "..", "public", "sounds", "lib")

# 来源 → (类别, 模式)
PLAN = {
    "shake-1": ("shake", "whole"),
    "shake-2": ("shake", "whole"),
    "shake-3": ("shake", "whole"),
    "shake-4": ("shake", "whole"),
    "oga-coin_drop": ("land", "onsets"),
    "fs-coin-drop": ("land", "onsets"),
    "fs-coin-fall-on-table": ("land", "onsets"),
    "fs-flip-coin-wood-table": ("land", "onsets"),
    "fs-coins-fall-on-table": ("land", "onsets"),
    "fs-couple-coins-wood-top": ("land", "onsets"),
    "oga-coinsounds011015": ("land", "onsets"),
    "bsb-2697-spin": ("spin", "tail"),
    "fs-spinning-coin-drop": ("spin", "whole"),
}

SR = 44100


def read(path):
    with wave.open(path, "rb") as w:
        assert w.getnchannels() == 1 and w.getsampwidth() == 2 and w.getframerate() == SR, path
        data = array.array("h")
        data.frombytes(w.readframes(w.getnframes()))
    return [s / 32768.0 for s in data]


def write(path, samples):
    peak = max(1e-9, max(abs(s) for s in samples))
    gain = 0.7 / peak  # 归一到 -3dB
    n = len(samples)
    fade = min(int(0.003 * SR), n // 4)  # 3ms 淡入
    tail = min(int(0.02 * SR), n // 4)  # 20ms 淡出
    out = array.array("h")
    for i, s in enumerate(samples):
        g = gain
        if i < fade:
            g *= i / fade
        if i >= n - tail:
            g *= (n - i) / tail
        v = max(-1.0, min(1.0, s * g))
        out.append(int(v * 32767))
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(out.tobytes())


def envelope(x, win_ms=2.0):
    """每 win_ms 一个点的峰值包络"""
    win = int(SR * win_ms / 1000)
    return [max(abs(v) for v in x[i : i + win]) or 1e-9 for i in range(0, len(x), win)], win


def trim(x, thresh_db=-45):
    env, win = envelope(x)
    peak = max(env)
    th = peak * 10 ** (thresh_db / 20)
    idx = [i for i, e in enumerate(env) if e > th]
    if not idx:
        return x
    a = max(0, idx[0] * win - int(0.005 * SR))
    b = min(len(x), (idx[-1] + 1) * win + int(0.05 * SR))
    return x[a:b]


def onsets(x, min_gap_ms=120, rel=0.12):
    """起音：包络超过 rel*峰值，且之前 30ms 明显更低"""
    env, win = envelope(x)
    peak = max(env)
    th = peak * rel
    back = int(30 / 2)
    found = []
    last = -10**9
    for i in range(back, len(env)):
        if env[i] > th and env[i] > 3 * max(env[i - back : i]) and (i - last) * 2 >= min_gap_ms:
            found.append(i)
            last = i
    return [i * win for i in found], env, win


def segment_end(env, win, start_i, next_i, floor_db=-42, hold_ms=60, max_ms=1500):
    peak = max(env[start_i : start_i + 5]) if start_i + 5 <= len(env) else env[start_i]
    floor = peak * 10 ** (floor_db / 20)
    hold = int(hold_ms / 2)
    limit = min(len(env), start_i + int(max_ms / 2), next_i if next_i else len(env))
    quiet = 0
    for i in range(start_i, limit):
        quiet = quiet + 1 if env[i] < floor else 0
        if quiet >= hold:
            return (i - hold + 1) * win
    return limit * win


def main():
    os.makedirs(OUT, exist_ok=True)
    for f in os.listdir(OUT):
        os.remove(os.path.join(OUT, f))
    manifest = {"shake": [], "land": [], "spin": []}
    for name, (cat, mode) in PLAN.items():
        path = os.path.join(WORK, name + ".wav")
        if not os.path.exists(path):
            print("缺文件", path, file=sys.stderr)
            continue
        x = read(path)
        pieces = []
        if mode == "whole":
            pieces = [trim(x)]
        elif mode == "tail":
            t = trim(x)
            pieces = [t[max(0, len(t) - int(1.1 * SR)) :]]
        else:
            starts, env, win = onsets(x)
            for k, s in enumerate(starts):
                nxt = starts[k + 1] // win if k + 1 < len(starts) else None
                e = segment_end(env, win, s // win, nxt)
                a = max(0, s - int(0.004 * SR))
                seg = x[a:e]
                if len(seg) < int(0.04 * SR):
                    continue
                pieces.append(seg)
        for k, seg in enumerate(pieces):
            fn = f"{cat}-{name}-{k + 1:02d}.wav"
            write(os.path.join(OUT, fn), seg)
            manifest[cat].append({"file": fn, "ms": round(len(seg) * 1000 / SR), "source": name})
        print(f"{name:28s} {cat:5s} {mode:6s} → {len(pieces)} 段")
    # 转 AAC 到 public/sounds/lib，清单里记 m4a 文件名
    os.makedirs(LIB, exist_ok=True)
    for f in os.listdir(LIB):
        os.remove(os.path.join(LIB, f))
    for cat, items in manifest.items():
        for it in items:
            m4a = it["file"][:-4] + ".m4a"
            subprocess.run(["afconvert", "-f", "m4af", "-d", "aac", "-b", "96000", os.path.join(OUT, it["file"]), os.path.join(LIB, m4a)], check=True)
            it["file"] = m4a
    with open(os.path.join(LIB, "manifest.json"), "w") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)
    print({k: len(v) for k, v in manifest.items()})


if __name__ == "__main__":
    main()
