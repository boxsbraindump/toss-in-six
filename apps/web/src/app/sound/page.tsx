"use client";

import { useEffect, useRef, useState } from "react";
import { chime, clink, ensureAudio, land, rare, renderPreview } from "@/lib/audio";

type Name = "clink" | "land" | "rare" | "chime";
const SOUNDS: { name: Name; label: string; play: () => void }[] = [
  { name: "clink", label: "手里碰撞", play: () => clink(0.8) },
  { name: "land", label: "落定", play: () => land(1) },
  { name: "rare", label: "老阳老阴", play: () => rare() },
  { name: "chime", label: "卦成磬声", play: () => chime() },
];

/** 试音页：不用摇卦也能反复听每个声音，顺便画出波形 */
export default function SoundPage() {
  const [current, setCurrent] = useState<Name>("land");
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    void renderPreview(current).then((buf) => {
      if (cancelled || !canvas.current) return;
      const el = canvas.current;
      const g = el.getContext("2d")!;
      const data = buf.getChannelData(0);
      const w = el.width;
      const h = el.height;
      g.clearRect(0, 0, w, h);
      g.strokeStyle = "#c9a86a";
      g.beginPath();
      const step = Math.floor(data.length / w);
      for (let x = 0; x < w; x++) {
        let max = 0;
        for (let i = x * step; i < (x + 1) * step; i++) max = Math.max(max, Math.abs(data[i] ?? 0));
        g.moveTo(x, h / 2 - max * h * 0.48);
        g.lineTo(x, h / 2 + max * h * 0.48);
      }
      g.stroke();
    });
    return () => {
      cancelled = true;
    };
  }, [current]);

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-8">
      <h1 className="font-display text-xl font-bold tracking-[0.3em] text-brass">试音</h1>
      <div className="flex flex-wrap gap-3">
        {SOUNDS.map((s) => (
          <button
            key={s.name}
            onClick={() => {
              ensureAudio();
              setCurrent(s.name);
              s.play();
            }}
            className={`rounded-md border px-4 py-2 font-display text-sm ${
              current === s.name ? "border-brass bg-brass text-ink" : "border-ink-3 bg-ink-2 hover:border-brass"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      <canvas ref={canvas} width={560} height={140} className="w-full rounded-lg border border-ink-3 bg-ink-2" />
      <p className="text-sm text-bone-dim">每次播放都有随机变化，多点几下。波形是离线渲染的一次样本（1.2 秒）。</p>
    </main>
  );
}
