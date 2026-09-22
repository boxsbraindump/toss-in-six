#!/usr/bin/env python3
"""
从 coins-src/*.jpg（正反面并排的钱币照片，深色布底）切出正面、背面两个圆，
方孔透明，统一尺寸，导出到 public/coins/<名字>-{obverse,reverse}.webp。

运行：uv run --with pillow python scripts/coin-cut.py
"""
import math
import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageOps

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "..", "coins-src")
OUT = os.path.join(HERE, "..", "public", "coins")
SIZE = 512
COINS = {"q364": "a", "q368": "b", "q376": "c"}
# 自动检测不准的手动修正：(圆心 x 偏移, y 偏移, 半径倍率)，偏移以半径为单位
OVERRIDES = {"c-obverse": (0.05, 0.0, 0.95), "c-reverse": (0.04, -0.03, 0.94)}


def find_circle(gray, box):
    """在 box 区域里找亮于布底的团块，返回 (cx, cy, r)（原图坐标）"""
    x0, y0, x1, y1 = box
    region = gray.crop(box)
    # 布底很暗，钱币明显亮：以区域中位数偏上为阈值
    hist = region.histogram()
    total = sum(hist)
    acc = 0
    median = 0
    for v, n in enumerate(hist):
        acc += n
        if acc >= total / 2:
            median = v
            break
    th = median + 30
    mask = region.point(lambda p: 255 if p > th else 0)
    # 闭运算填平钱面上的暗斑和方孔，开运算去掉布纹的细高光
    mask = mask.filter(ImageFilter.MaxFilter(25)).filter(ImageFilter.MinFilter(25))
    mask = mask.filter(ImageFilter.MinFilter(11)).filter(ImageFilter.MaxFilter(11))
    w, h = mask.size
    data = mask.getdata()
    n = sx = sy = 0
    for i, v in enumerate(data):
        if v:
            n += 1
            sx += i % w
            sy += i // w
    if not n:
        raise SystemExit("找不到钱币")
    cx = sx / n
    cy = sy / n
    r0 = math.sqrt(n / math.pi)
    # 射线法：从粗圆心向 72 个方向走到遮罩边缘，取偏低分位数当半径（布纹凸起不算），
    # 再用对向射线之差修正圆心；迭代两次
    px = mask.load()
    for _ in range(2):
        rs = []
        for k in range(72):
            a = 2 * math.pi * k / 72
            rr = 0
            miss = 0
            for d in range(int(r0 * 0.6), int(r0 * 1.3)):
                x = int(cx + d * math.cos(a))
                y = int(cy + d * math.sin(a))
                if 0 <= x < w and 0 <= y < h and px[x, y]:
                    rr = d
                    miss = 0
                else:
                    miss += 1
                    if miss > 6:
                        break
            rs.append(rr)
        srt = sorted(rs)
        r_med = srt[len(srt) // 2]
        # 对向射线差 → 圆心偏移
        dx = sum((rs[k] - rs[(k + 36) % 72]) * math.cos(2 * math.pi * k / 72) for k in range(36)) / 36
        dy = sum((rs[k] - rs[(k + 36) % 72]) * math.sin(2 * math.pi * k / 72) for k in range(36)) / 36
        cx += dx / 2
        cy += dy / 2
        r0 = r_med
    r = srt[int(len(srt) * 0.3)] * 0.985  # 取 30 分位，宁可略小
    return x0 + cx, y0 + cy, r


def cut(img, cx, cy, r):
    r *= 1.0
    box = (int(cx - r), int(cy - r), int(cx + r), int(cy + r))
    face = img.crop(box).resize((SIZE, SIZE), Image.LANCZOS)

    # 圆形遮罩（放大画再缩小 = 抗锯齿）
    big = SIZE * 4
    m = Image.new("L", (big, big), 0)
    ImageDraw.Draw(m).ellipse((6, 6, big - 6, big - 6), fill=255)
    alpha = m.resize((SIZE, SIZE), Image.LANCZOS)

    # 方孔：从中心泛洪，取整块相连的暗区（透过方孔看到的布），做成透明
    g = ImageOps.grayscale(face).filter(ImageFilter.GaussianBlur(1.6))
    c = SIZE // 2
    # 钱面亮度中位数（取中心外的环带）减去一截作为"暗"的阈值
    ring_px = [g.getpixel((int(c + 0.36 * SIZE * math.cos(a)), int(c + 0.36 * SIZE * math.sin(a)))) for a in [i * math.pi / 30 for i in range(60)]]
    ring_med = sorted(ring_px)[30]
    th = max(40, ring_med - 55)
    binary = Image.new("L", (SIZE, SIZE), 255)
    b0 = int(SIZE * 0.30)
    b1 = int(SIZE * 0.70)
    binary.paste(g.crop((b0, b0, b1, b1)).point(lambda p: 0 if p < th else 255), (b0, b0))
    # 从中心附近最暗的点泛洪
    best = None
    for dx in range(-24, 25, 4):
        for dy in range(-24, 25, 4):
            v = g.getpixel((c + dx, c + dy))
            if best is None or v < best[0]:
                best = (v, c + dx, c + dy)
    if binary.getpixel((best[1], best[2])) == 0:
        ImageDraw.floodfill(binary, (best[1], best[2]), 128)
    hole = binary.point(lambda p: 0 if p == 128 else 255)
    # 开运算切断漏到孔外锈蚀暗区的细连接，再闭运算填平孔里的亮线
    hole = hole.filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.MinFilter(9))
    hole = hole.filter(ImageFilter.MinFilter(9)).filter(ImageFilter.MaxFilter(9))
    # 孔不可能超出中心 34% 的方框
    lim = Image.new("L", (SIZE, SIZE), 255)
    q0 = int(SIZE * 0.33)
    q1 = int(SIZE * 0.67)
    lim.paste(hole.crop((q0, q0, q1, q1)), (q0, q0))
    # 方孔就是方的：用泛洪区域的外接矩形填一个干净的方孔（孔里的布纹亮线一并盖掉）
    inv = lim.point(lambda p: 255 - p)
    bb = inv.getbbox()
    hole = Image.new("L", (SIZE, SIZE), 255)
    if bb:
        ImageDraw.Draw(hole).rounded_rectangle((bb[0] + 1, bb[1] + 1, bb[2] - 1, bb[3] - 1), radius=3, fill=0)
    hole = hole.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(0.7))
    alpha = Image.composite(alpha, Image.new("L", (SIZE, SIZE), 0), hole)

    face = grade(face)

    face.putalpha(alpha)
    return face


def grade(face):
    """
    出土钱表面钙化发白，和暖色桌面不搭。先用 gamma 把整体亮度压下去，再把亮度映射到
    传世包浆的色谱（深褐底、浮雕高点金褐），原色只留两成；浮雕锐化；边缘一圈渐暗显得圆润。
    """
    lum = ImageOps.autocontrast(ImageOps.grayscale(face), cutoff=1)
    lum = lum.point(lambda p: int(255 * (p / 255) ** 1.7))
    lum = lum.filter(ImageFilter.UnsharpMask(radius=3, percent=110, threshold=2))
    stops = [(0, (28, 18, 9)), (70, (72, 48, 24)), (150, (128, 92, 48)), (215, (180, 140, 82)), (255, (214, 180, 118))]

    def channel(i):
        lut = []
        for v in range(256):
            for (a, ca), (b, cb) in zip(stops, stops[1:]):
                if a <= v <= b:
                    t = (v - a) / (b - a)
                    lut.append(int(ca[i] + (cb[i] - ca[i]) * t))
                    break
        return lum.point(lut)

    bronze = Image.merge("RGB", (channel(0), channel(1), channel(2)))
    orig = ImageOps.autocontrast(face, cutoff=1).point(lambda p: int(p * 0.75))
    out = Image.blend(orig, bronze, 0.8)

    # 边缘渐暗（圆润感）
    big = SIZE * 2
    rim = Image.new("L", (big, big), 255)
    d = ImageDraw.Draw(rim)
    for k in range(40):
        t = k / 40
        r = big / 2 * (0.86 + 0.14 * t)
        d.ellipse((big / 2 - r, big / 2 - r, big / 2 + r, big / 2 + r), outline=int(255 * (1 - 0.55 * t)), width=int(big * 0.14 / 40) + 2)
    rim = rim.resize((SIZE, SIZE), Image.LANCZOS).filter(ImageFilter.GaussianBlur(3))
    dark = Image.new("RGB", (SIZE, SIZE), (0, 0, 0))
    out = Image.composite(out, dark, rim)

    # 很轻的左上高光，和桌面光一致
    hl = Image.new("L", (SIZE, SIZE), 0)
    ImageDraw.Draw(hl).ellipse((SIZE * 0.08, SIZE * 0.04, SIZE * 0.6, SIZE * 0.5), fill=255)
    hl = hl.filter(ImageFilter.GaussianBlur(SIZE * 0.14)).point(lambda p: int(p * 0.14))
    light = Image.new("RGB", (SIZE, SIZE), (255, 226, 170))
    out = Image.composite(light, out, hl)
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, tag in COINS.items():
        path = os.path.join(SRC, name + ".jpg")
        if not os.path.exists(path):
            print("缺", path, file=sys.stderr)
            continue
        img = Image.open(path).convert("RGB")
        w, h = img.size
        gray = ImageOps.grayscale(img).resize((w // 4, h // 4))
        halves = [(0, 0, w // 8, h // 4), (w // 8, 0, w // 4, h // 4)]
        for side, box in zip(("obverse", "reverse"), halves):
            cx, cy, r = find_circle(gray, box)
            ox, oy, k = OVERRIDES.get(f"{tag}-{side}", (0, 0, 1))
            cx, cy, r = cx + ox * r, cy + oy * r, r * k
            face = cut(img, cx * 4, cy * 4, r * 4)
            out = os.path.join(OUT, f"{tag}-{side}.webp")
            face.save(out, "WEBP", quality=86, method=6)
            print(f"{name} {side}: 圆心 ({cx*4:.0f},{cy*4:.0f}) 半径 {r*4:.0f} → {out} {os.path.getsize(out)//1024}KB")


if __name__ == "__main__":
    main()
