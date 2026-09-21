"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  chime,
  ensureAudio,
  excludedList,
  getManifest,
  isExcluded,
  land,
  loadedCount,
  playFile,
  preloadSamples,
  rare,
  setExcluded,
  settle,
  startShake,
  type Category,
  type Manifest,
} from "@/lib/audio";

const CATS: { key: Category; label: string; note: string }[] = [
  { key: "shake", label: "手里晃", note: "循环播放，音量跟手的动作走" },
  { key: "land", label: "落桌", note: "每枚铜钱落定随机挑一段" },
  { key: "spin", label: "转着落定", note: "落定时偶尔接一段" },
];

/** 采样库审听：逐段试听，不好的剔掉（存在这台设备上），再把剔除清单发我删文件 */
export default function SoundPage() {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [count, setCount] = useState(0);
  const [, bump] = useState(0);
  const [copied, setCopied] = useState(false);

  async function load() {
    ensureAudio();
    await preloadSamples();
    setManifest(getManifest());
    setCount(loadedCount());
  }

  useEffect(() => {
    const id = window.setInterval(() => {
      if (getManifest()) {
        setManifest(getManifest());
        setCount(loadedCount());
      }
    }, 500);
    return () => window.clearInterval(id);
  }, []);

  function toggle(file: string) {
    setExcluded(file, !isExcluded(file));
    bump((n) => n + 1);
  }

  async function copyExcluded() {
    try {
      await navigator.clipboard.writeText(excludedList().join("\n"));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  function shakeDemo() {
    ensureAudio();
    const h = startShake();
    let t = 0;
    const id = window.setInterval(() => {
      t += 0.05;
      h.setIntensity(0.5 + 0.5 * Math.sin(t * 6));
    }, 50);
    window.setTimeout(() => {
      window.clearInterval(id);
      h.stop();
    }, 1500);
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-8">
      <header className="flex items-baseline justify-between">
        <h1 className="font-display text-xl font-bold tracking-[0.3em] text-brass">采样库</h1>
        <Link href="/" className="text-sm text-bone-dim hover:text-bone">
          回去摇卦
        </Link>
      </header>

      {!manifest ? (
        <button onClick={load} className="self-start rounded-md bg-brass px-5 py-2.5 font-display text-sm font-bold text-ink hover:bg-brass-pale">
          加载采样（约 1.3 MB）
        </button>
      ) : (
        <p className="text-sm text-bone-dim">已加载 {count} 段。点一段试听；「×」剔除，剔掉的不会再在摇卦里用。</p>
      )}

      <section className="flex flex-wrap gap-2">
        {[
          ["手里晃 1.5 秒", shakeDemo],
          ["落定", () => (ensureAudio(), land(1))],
          ["老阳老阴", () => (ensureAudio(), rare())],
          ["转着落定", () => (ensureAudio(), settle())],
          ["卦成磬声", () => (ensureAudio(), chime())],
        ].map(([label, fn]) => (
          <button
            key={label as string}
            onClick={fn as () => void}
            className="rounded-md border border-ink-3 bg-ink-2 px-4 py-2 font-display text-sm hover:border-brass"
          >
            {label as string}
          </button>
        ))}
      </section>

      {manifest &&
        CATS.map((cat) => (
          <section key={cat.key} className="flex flex-col gap-3">
            <h2 className="flex items-baseline gap-3">
              <span className="font-display text-lg font-bold">{cat.label}</span>
              <span className="text-xs text-bone-dim">{cat.note} · {manifest[cat.key].length} 段</span>
            </h2>
            <ul className="flex flex-wrap gap-2">
              {manifest[cat.key].map((s, i) => {
                const off = isExcluded(s.file);
                return (
                  <li key={s.file} className={`flex items-stretch overflow-hidden rounded-md border text-xs ${off ? "border-ink-3 opacity-40" : "border-ink-3"}`}>
                    <button onClick={() => playFile(s.file)} className="flex flex-col items-start gap-0.5 bg-ink-2 px-2.5 py-1.5 text-left hover:bg-ink-3" title={s.file}>
                      <span className="font-mono">{String(i + 1).padStart(2, "0")} · {s.ms}ms</span>
                      <span className="text-[10px] text-bone-dim">{s.source.replace(/^(fs|oga|bsb)-/, "")}</span>
                    </button>
                    <button onClick={() => toggle(s.file)} aria-pressed={off} aria-label={off ? "恢复" : "剔除"} className="px-2 text-bone-dim hover:bg-cinnabar/30 hover:text-bone">
                      {off ? "↺" : "×"}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

      {manifest && (
        <section className="flex items-center gap-3 border-t border-ink-3 pt-6 text-sm">
          <button onClick={copyExcluded} className="rounded-md border border-ink-3 bg-ink-2 px-4 py-2 hover:border-brass">
            复制剔除清单（{excludedList().length}）
          </button>
          <span className="text-bone-dim">{copied ? "已复制，发给我就行。" : "审完把清单发我，我把文件删掉。"}</span>
        </section>
      )}
    </main>
  );
}
