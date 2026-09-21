"use client";

import type { CoinToss } from "@liuyao/core";
import { forwardRef, useImperativeHandle, useRef } from "react";

export interface CoinTrayHandle {
  /** 掷出三枚铜钱，逐枚落定时回调，全部落定后 resolve */
  throwCoins(faces: CoinToss, onLand?: (index: number) => void): Promise<void>;
  /** 在手里晃，intensity 0..1 */
  shake(intensity: number): void;
  /** 老阳老阴的朱砂光环 */
  burst(): void;
}

interface CoinState {
  x: number;
  y: number;
  z: number;
  rx: number;
}

const HOME_X = [-92, 0, 92];

function tf(s: CoinState): string {
  return `translate(${s.x}px, ${s.y}px) rotate(${s.z}deg) rotateX(${s.rx}deg)`;
}

function rand(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

export const CoinTray = forwardRef<CoinTrayHandle, { className?: string }>(function CoinTray({ className = "" }, ref) {
  const coins = useRef<(HTMLDivElement | null)[]>([]);
  const ring = useRef<HTMLDivElement>(null);
  const state = useRef<CoinState[]>(HOME_X.map((x) => ({ x, y: 0, z: 0, rx: 0 })));

  useImperativeHandle(ref, () => ({
    shake(intensity) {
      coins.current.forEach((el, i) => {
        if (!el) return;
        const s = state.current[i]!;
        el.style.transform = tf({
          x: s.x + rand(-1, 1) * 9 * intensity,
          y: s.y + rand(-1, 1) * 7 * intensity,
          z: s.z + rand(-1, 1) * 12 * intensity,
          rx: s.rx,
        });
      });
    },

    throwCoins(faces, onLand) {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      return Promise.all(
        faces.map(
          (back, i) =>
            new Promise<void>((resolve) => {
              const el = coins.current[i];
              const s = state.current[i]!;
              if (!el) return resolve();
              const target = back ? 180 : 0;
              const spins = 2 + Math.floor(Math.random() * 3);
              const finalRx = s.rx + spins * 360 + ((target - (((s.rx % 360) + 360) % 360) + 360) % 360);
              const landed: CoinState = { x: HOME_X[i]! + rand(-28, 28), y: rand(-16, 16), z: rand(-50, 50), rx: finalRx };
              const peak: CoinState = { x: (s.x + landed.x) / 2, y: -150 - i * 12, z: (s.z + landed.z) / 2, rx: s.rx + (finalRx - s.rx) * 0.45 };
              const dur = reduced ? 1 : 820 + i * 110 + Math.random() * 220;
              const anim = el.animate(
                [
                  { transform: tf(s), easing: "cubic-bezier(.2,.7,.3,1)" },
                  { transform: tf(peak), offset: 0.4, easing: "cubic-bezier(.45,0,.85,.45)" },
                  { transform: tf(landed), offset: 0.76, easing: "ease-out" },
                  { transform: tf({ ...landed, y: landed.y - 12 }), offset: 0.87, easing: "ease-in" },
                  { transform: tf(landed) },
                ],
                { duration: dur, fill: "forwards" },
              );
              anim.onfinish = () => {
                state.current[i] = landed;
                el.style.transform = tf(landed);
                anim.cancel();
                onLand?.(i);
                resolve();
              };
            }),
        ),
      ).then(() => undefined);
    },

    burst() {
      ring.current?.animate(
        [
          { transform: "translate(-50%, -50%) scale(0.3)", opacity: 0.95 },
          { transform: "translate(-50%, -50%) scale(2.6)", opacity: 0 },
        ],
        { duration: 750, easing: "cubic-bezier(.1,.7,.3,1)" },
      );
      coins.current.forEach((el) => {
        el?.classList.add("coin-glow");
        window.setTimeout(() => el?.classList.remove("coin-glow"), 1100);
      });
    },
  }));

  return (
    <div className={`coin-scene relative h-44 w-[320px] ${className}`}>
      <div
        ref={ring}
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-40 w-40 rounded-full border-2 border-cinnabar opacity-0"
        style={{ transform: "translate(-50%, -50%) scale(0.3)" }}
      />
      {HOME_X.map((x, i) => (
        <div
          key={i}
          ref={(el) => {
            coins.current[i] = el;
          }}
          className="coin absolute left-1/2 top-1/2 -ml-10 -mt-10 h-20 w-20 will-change-transform"
          style={{ transform: tf({ x, y: 0, z: 0, rx: 0 }) }}
        >
          <div className="coin-face">
            <CoinFace inscribed />
          </div>
          <div className="coin-face back">
            <CoinFace />
          </div>
        </div>
      ))}
    </div>
  );
});

function CoinFace({ inscribed = false }: { inscribed?: boolean }) {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full drop-shadow-[0_6px_10px_rgba(0,0,0,0.5)]" aria-hidden>
      <defs>
        <radialGradient id="brass" cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#e6d3a3" />
          <stop offset="55%" stopColor="#c9a86a" />
          <stop offset="100%" stopColor="#7d6232" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill="url(#brass)" />
      <circle cx="50" cy="50" r="42" fill="none" stroke="#8c6f3a" strokeWidth="1.2" opacity="0.7" />
      <rect x="40" y="40" width="20" height="20" fill="#0f1516" />
      <rect x="38" y="38" width="24" height="24" fill="none" stroke="#8c6f3a" strokeWidth="1" opacity="0.8" />
      {inscribed && (
        <g fill="#3d2f14" fontFamily="var(--font-display)" fontSize="17" fontWeight="700" textAnchor="middle">
          <text x="50" y="32">赛</text>
          <text x="50" y="82">博</text>
          <text x="77" y="57">通</text>
          <text x="23" y="57">宝</text>
        </g>
      )}
    </svg>
  );
}
