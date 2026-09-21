"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PROFILES, ensureAudio, getProfile, play, renderPreview, setProfile, type SoundName, type SoundProfile } from "@/lib/audio";

const EVENTS: { name: SoundName; label: string }[] = [
  { name: "clink", label: "手里碰撞" },
  { name: "land", label: "落定" },
  { name: "rare", label: "老阳老阴" },
  { name: "chime", label: "卦成磬声" },
];

/** 试音页：并排听各套音色，选中的直接用在摇卦里 */
export default function SoundPage() {
  const [profile, setProfileState] = useState<SoundProfile>(PROFILES[0]!);
  const [event, setEvent] = useState<SoundName>("land");
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProfileState(getProfile());
  }, []);

  useEffect(() => {
    let cancelled = false;
    void renderPreview(event, profile).then((buf) => {
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
  }, [event, profile]);

  function choose(p: SoundProfile) {
    ensureAudio();
    setProfile(p.id);
    setProfileState(p);
    play(event, p);
  }

  function trigger(name: SoundName) {
    ensureAudio();
    setEvent(name);
    play(name, profile);
  }

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-8 px-4 py-8">
      <header className="flex items-baseline justify-between">
        <h1 className="font-display text-xl font-bold tracking-[0.3em] text-brass">试音</h1>
        <Link href="/" className="text-sm text-bone-dim hover:text-bone">
          回去摇卦
        </Link>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs tracking-[0.2em] text-bone-dim">音色方案 · 点一下试听，选中的会用在摇卦里</h2>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {PROFILES.map((p) => {
            const on = p.id === profile.id;
            return (
              <li key={p.id}>
                <button
                  onClick={() => choose(p)}
                  aria-pressed={on}
                  className={`flex h-full w-full flex-col gap-1 rounded-lg border p-3 text-left transition ${
                    on ? "border-brass bg-ink-3" : "border-ink-3 bg-ink-2 hover:border-brass/60"
                  }`}
                >
                  <span className={`font-display text-base font-bold ${on ? "text-brass" : ""}`}>{p.label}</span>
                  <span className="text-xs leading-relaxed text-bone-dim">{p.note}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs tracking-[0.2em] text-bone-dim">事件</h2>
        <div className="flex flex-wrap gap-2">
          {EVENTS.map((e) => (
            <button
              key={e.name}
              onClick={() => trigger(e.name)}
              className={`rounded-md border px-4 py-2 font-display text-sm ${
                event === e.name ? "border-brass bg-brass text-ink" : "border-ink-3 bg-ink-2 hover:border-brass"
              }`}
            >
              {e.label}
            </button>
          ))}
        </div>
        <canvas ref={canvas} width={560} height={140} className="w-full rounded-lg border border-ink-3 bg-ink-2" />
        <p className="text-sm text-bone-dim">每次播放都有随机变化，多点几下。波形是离线渲染的一次样本（1.2 秒）。</p>
      </section>
    </main>
  );
}
