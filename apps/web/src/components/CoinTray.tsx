"use client";

import type { CoinToss } from "@liuyao/core";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { land as landFallback, scheduleLand } from "@/lib/audio";
import { fallbackHits, planToss, poseTransform, type Pose, type TossPlan } from "@/lib/coinSim";

export interface CoinTrayHandle {
  /** 从桌上拿起，聚到手里 */
  pickUp(): void;
  /** 在手里晃，intensity 0..1 */
  shake(intensity: number): void;
  /** 掷到桌上；每枚第一次触桌时回调；全部触桌并稳住后 resolve */
  throwCoins(faces: CoinToss, opts?: { rate?: number; onLand?: (index: number) => void }): Promise<void>;
  /** 老阳老阴的朱砂光环 */
  burst(): void;
}

/** 桌面平面尺寸（平面坐标，未透视） */
const TABLE_W = 340;
const TABLE_H = 250;
const COIN = 62;
const HAND: Pose[] = [
  { x: -30, y: 62, z: 34, rx: 0, ry: 0, rz: -20, tilt: 0, axis: 0 },
  { x: 4, y: 54, z: 40, rx: 0, ry: 0, rz: 15, tilt: 0, axis: 0 },
  { x: 38, y: 64, z: 32, rx: 0, ry: 0, rz: -5, tilt: 0, axis: 0 },
];
const REST: Pose[] = [
  { x: -80, y: 20, z: 0, rx: 0, ry: 0, rz: -30, tilt: 0, axis: 0 },
  { x: 6, y: -10, z: 0, rx: 0, ry: 0, rz: 40, tilt: 0, axis: 0 },
  { x: 86, y: 26, z: 0, rx: 0, ry: 0, rz: 10, tilt: 0, axis: 0 },
];

function rand(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

function lerpPose(a: Pose, b: Pose, u: number): Pose {
  const e = 1 - (1 - u) ** 3;
  const k = (p: number, q: number) => p + (q - p) * e;
  return { x: k(a.x, b.x), y: k(a.y, b.y), z: k(a.z, b.z), rx: k(a.rx, b.rx), ry: k(a.ry, b.ry), rz: k(a.rz, b.rz), tilt: k(a.tilt, 0), axis: a.axis };
}

/** 三个不重叠的落点 */
function landingSpots(): { x: number; y: number }[] {
  const spots: { x: number; y: number }[] = [];
  for (let tries = 0; spots.length < 3 && tries < 200; tries++) {
    const p = { x: rand(-105, 105), y: rand(-70, 40) };
    if (spots.every((q) => Math.hypot(p.x - q.x, p.y - q.y) > 78)) spots.push(p);
  }
  while (spots.length < 3) spots.push({ x: rand(-105, 105), y: rand(-70, 40) });
  return spots;
}

type Mode =
  | { kind: "rest" }
  | { kind: "pickup"; from: Pose[]; start: number }
  | { kind: "hand"; intensity: number; jitter: Pose[] }
  | { kind: "toss"; plans: TossPlan[]; start: number; landed: boolean[]; onLand?: (i: number) => void; resolve: () => void };

export type Wood = "worn" | "dark";

export const CoinTray = forwardRef<CoinTrayHandle, { className?: string; fill?: boolean; wood?: Wood }>(function CoinTray(
  { className = "", fill = false, wood = "worn" },
  ref,
) {
  const scene = useRef<HTMLDivElement>(null);
  const plane = useRef<HTMLDivElement>(null);
  const coins = useRef<(HTMLDivElement | null)[]>([]);
  const shadows = useRef<(HTMLDivElement | null)[]>([]);
  const ring = useRef<HTMLDivElement>(null);
  const pose = useRef<Pose[]>(REST.map((p) => ({ ...p })));
  const mode = useRef<Mode>({ kind: "rest" });
  const raf = useRef<number | null>(null);

  function render() {
    pose.current.forEach((p, i) => {
      const el = coins.current[i];
      const sh = shadows.current[i];
      if (el) el.style.transform = poseTransform(p);
      if (sh) {
        const k = 1.15 + p.z / 90;
        sh.style.transform = `translate3d(${p.x + 4 + p.z * 0.15}px, ${p.y + 6 + p.z * 0.12}px, 0.5px) rotateZ(${p.rz}deg) scale(${k})`;
        sh.style.opacity = String(0.7 / (1 + p.z / 40));
      }
    });
  }

  function tick(now: number) {
    const m = mode.current;
    if (m.kind === "pickup") {
      const u = Math.min(1, (now - m.start) / 260);
      pose.current = m.from.map((f, i) => lerpPose(f, HAND[i]!, u));
      if (u >= 1) mode.current = { kind: "hand", intensity: 0, jitter: HAND.map((h) => ({ ...h })) };
    } else if (m.kind === "hand") {
      const s = m.intensity;
      pose.current = HAND.map((h, i) => {
        const j = m.jitter[i]!;
        // 手抖：目标点随机游走，铜钱追着走，晃得越快幅度越大
        j.x += (h.x + rand(-1, 1) * 14 * s - j.x) * 0.5;
        j.y += (h.y + rand(-1, 1) * 8 * s - j.y) * 0.5;
        j.z += (h.z + rand(-1, 1) * 16 * s - j.z) * 0.5;
        j.rz += (h.rz + rand(-1, 1) * 30 * s - j.rz) * 0.4;
        j.tilt += (rand(-1, 1) * 25 * s - j.tilt) * 0.5;
        j.axis = (j.axis + 40 * s) % 360;
        return { ...j, rx: pose.current[i]!.rx, ry: pose.current[i]!.ry };
      });
    } else if (m.kind === "toss") {
      const t = now - m.start;
      let allDone = true;
      m.plans.forEach((plan, i) => {
        pose.current[i] = plan.pose(t);
        if (!m.landed[i] && t >= plan.landAt) {
          m.landed[i] = true;
          m.onLand?.(i);
        }
        if (t < plan.endAt) allDone = false;
      });
      if (m.landed.every(Boolean) && t >= Math.max(...m.plans.map((p) => p.landAt)) + 320) m.resolve();
      if (allDone) {
        pose.current = m.plans.map((p) => ({ ...p.final }));
        mode.current = { kind: "rest" };
        m.resolve(); // 录音很短时会先于上面的判定结束，这里兜底
      }
    }
    render();
    raf.current = mode.current.kind === "rest" ? null : requestAnimationFrame(tick);
  }

  function ensureLoop() {
    if (raf.current === null) raf.current = requestAnimationFrame(tick);
  }

  useEffect(() => {
    render();
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, []);

  // fill 模式：桌面比容器还宽一些，边缘出画，像坐在桌前
  useEffect(() => {
    if (!fill || !scene.current) return;
    const el = scene.current;
    const apply = () => {
      const w = el.clientWidth;
      const k = Math.min((w * 1.25) / TABLE_W, 2.1);
      if (plane.current) plane.current.style.transform = `translateX(-50%) rotateX(56deg) scale(${k})`;
      el.style.perspective = `${820 * k}px`;
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fill]);

  useImperativeHandle(ref, () => ({
    pickUp() {
      mode.current = { kind: "pickup", from: pose.current.map((p) => ({ ...p, tilt: 0 })), start: performance.now() };
      ensureLoop();
    },

    shake(intensity) {
      const m = mode.current;
      if (m.kind === "hand") m.intensity = intensity;
    },

    throwCoins(faces, opts = {}) {
      const spots = landingSpots();
      let resolved = false;
      return new Promise<void>((resolve) => {
        const plans = faces.map((back, i) => {
          const flightMs = 290 + i * 50 + rand(0, 90);
          const from = { ...pose.current[i]!, tilt: 0, axis: 0 };
          const s = scheduleLand(flightMs / 1000, { rate: opts.rate ?? rand(0.95, 1.05), gain: rand(0.8, 1) });
          let hits = s?.hits;
          let sampleMs = s?.ms ?? 0;
          if (!hits) {
            hits = fallbackHits();
            sampleMs = hits[hits.length - 1]!.t + 120;
            window.setTimeout(() => landFallback(i), flightMs);
          }
          return planToss({ from, to: spots[i]!, back, flightMs, hits, sampleMs });
        });
        mode.current = {
          kind: "toss",
          plans,
          start: performance.now(),
          landed: [false, false, false],
          onLand: opts.onLand,
          resolve: () => {
            if (resolved) return;
            resolved = true;
            resolve();
          },
        };
        ensureLoop();
      });
    },

    burst() {
      const cx = pose.current.reduce((s, p) => s + p.x, 0) / 3;
      const cy = pose.current.reduce((s, p) => s + p.y, 0) / 3;
      const el = ring.current;
      if (!el) return;
      el.animate(
        [
          { transform: `translate3d(${cx}px, ${cy}px, 1px) scale(0.3)`, opacity: 0.95 },
          { transform: `translate3d(${cx}px, ${cy}px, 1px) scale(2.2)`, opacity: 0 },
        ],
        { duration: 800, easing: "cubic-bezier(.1,.7,.3,1)" },
      );
      coins.current.forEach((c) => {
        c?.classList.add("coin-glow");
        window.setTimeout(() => c?.classList.remove("coin-glow"), 1100);
      });
    },
  }));

  return (
    <div
      ref={scene}
      className={`table-scene ${fill ? "table-scene-fill" : ""} ${className}`}
      data-wood={wood}
      style={fill ? undefined : { width: TABLE_W, height: TABLE_H * 0.62 + 90 }}
    >
      <div ref={plane} className="table-plane" style={{ width: TABLE_W, height: TABLE_H }}>
        <div className="table-top" />
        <div className="table-fog" aria-hidden />
        <div ref={ring} aria-hidden className="table-ring" />
        {REST.map((_, i) => (
          <div
            key={`s${i}`}
            ref={(el) => {
              shadows.current[i] = el;
            }}
            className="coin-shadow"
            style={{ width: COIN, height: COIN, marginLeft: -COIN / 2, marginTop: -COIN / 2 }}
          />
        ))}
        {["a", "b", "c"].map((tag, i) => (
          <div
            key={`c${i}`}
            ref={(el) => {
              coins.current[i] = el;
            }}
            className="coin"
            style={{ width: COIN, height: COIN, marginLeft: -COIN / 2, marginTop: -COIN / 2 }}
          >
            {/* 厚度：用照片本身压暗叠几层，方孔也就跟着透 */}
            {[-1.4, -0.5, 0.4, 1.3].map((z) => (
              <img key={z} src={`/coins/${tag}-obverse.webp`} alt="" draggable={false} className="coin-edge" style={{ transform: `translateZ(${z}px)` }} />
            ))}
            <img src={`/coins/${tag}-obverse.webp`} alt="字面" draggable={false} className="coin-face" style={{ transform: "translateZ(2px)" }} />
            <img src={`/coins/${tag}-reverse.webp`} alt="背面" draggable={false} className="coin-face" style={{ transform: "rotateX(180deg) translateZ(2px)" }} />
          </div>
        ))}
      </div>
    </div>
  );
});
