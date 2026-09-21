/**
 * 铜钱掷出后的运动时间线。坐标系是桌面平面：x 左右，y 前后（正 = 靠近观者），z 离桌高度。
 * 弹跳时刻来自这枚铜钱选中的录音（hits），所以画面上的每一下都对应录音里的一下。
 */

export interface Hit {
  /** 相对落地的毫秒 */
  t: number;
  /** 相对强度 0..1 */
  a: number;
}

export interface Pose {
  x: number;
  y: number;
  z: number;
  /** 翻面角（绕 X），0 = 字面朝上，180 = 背面朝上 */
  rx: number;
  /** 绕 Y 的翻滚，落定时是 360 的整数倍 */
  ry: number;
  /** 平面内旋转 */
  rz: number;
  /** 落定摇晃：倾角与倾斜轴方向 */
  tilt: number;
  axis: number;
}

export interface TossPlan {
  /** 落地时刻（ms，相对掷出） */
  landAt: number;
  /** 完全静止时刻（ms，相对掷出） */
  endAt: number;
  pose(tMs: number): Pose;
  final: Pose;
}

/** 屏幕用的"重力"，比真实的小很多，不然一切快得看不清 */
export const G = 6000; // px/s²

function rand(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

function mod360(v: number): number {
  return ((v % 360) + 360) % 360;
}

export function planToss(opts: {
  from: Pose;
  to: { x: number; y: number };
  back: boolean;
  flightMs: number;
  hits: Hit[];
  sampleMs: number;
}): TossPlan {
  const { from, to, back, flightMs, sampleMs } = opts;
  const F = flightMs / 1000;
  // 竖直：z(F) = 0
  const vz = (G * F * F * 0.5 - from.z) / F;
  // 翻面：落地时 rx ≡ 目标面（mod 360），中途多翻几圈
  const targetFace = back ? 180 : 0;
  const spinsX = 2 + Math.floor(Math.random() * 2);
  const rxEnd = from.rx + spinsX * 360 + mod360(targetFace - mod360(from.rx));
  const spinsY = Math.floor(Math.random() * 2);
  const ryEnd = from.ry - mod360(from.ry) + spinsY * 360 * (Math.random() < 0.5 ? 1 : -1);
  const rzEnd = from.rz + rand(-100, 100);

  // 弹跳：录音里的每两次撞击之间是一段抛物线，间隔越长弹得越高
  const hits = opts.hits.length ? [...opts.hits].sort((a, b) => a.t - b.t) : [{ t: 0, a: 1 }];
  interface Bounce {
    t0: number;
    t1: number;
    h: number;
    dx: number;
    dy: number;
    drz: number;
  }
  const bounces: Bounce[] = [];
  let wobbleFrom: number | null = null; // 进入"转着落定"的撞击序号
  const dir = rand(0, Math.PI * 2);
  let drift = rand(10, 18);
  for (let k = 0; k < hits.length - 1; k++) {
    const d = hits[k + 1]!.t - hits[k]!.t;
    if (d <= 60) {
      wobbleFrom = k;
      break;
    }
    const sec = d / 1000;
    const h = Math.min(42, (G * sec * sec) / 8) * (0.6 + 0.4 * hits[k]!.a);
    bounces.push({ t0: hits[k]!.t, t1: hits[k + 1]!.t, h, dx: Math.cos(dir) * drift, dy: Math.sin(dir) * drift * 0.6, drz: rand(-25, 25) });
    drift *= 0.5;
  }

  // 落定位置：落点 + 弹跳位移
  const restX = to.x + bounces.reduce((s, b) => s + b.dx, 0);
  const restY = to.y + bounces.reduce((s, b) => s + b.dy, 0);
  const restRz = rzEnd + bounces.reduce((s, b) => s + b.drz, 0);

  const lastBounceEnd = bounces.length ? bounces[bounces.length - 1]!.t1 : 0;
  const wobbleStart = wobbleFrom !== null ? hits[wobbleFrom]!.t : lastBounceEnd;
  const wobbleEnd = wobbleFrom !== null ? Math.max(sampleMs, wobbleStart + 200) : wobbleStart;
  const endAt = flightMs + Math.max(wobbleEnd, lastBounceEnd) + 40;

  const final: Pose = { x: restX, y: restY, z: 0, rx: rxEnd, ry: ryEnd, rz: restRz, tilt: 0, axis: 0 };

  function pose(tMs: number): Pose {
    if (tMs <= 0) return { ...from };
    if (tMs < flightMs) {
      const t = tMs / 1000;
      const u = tMs / flightMs;
      const ease = u; // 水平匀速
      return {
        x: from.x + (to.x - from.x) * ease,
        y: from.y + (to.y - from.y) * ease,
        z: Math.max(0, from.z + vz * t - 0.5 * G * t * t),
        rx: from.rx + (rxEnd - from.rx) * u,
        ry: from.ry + (ryEnd - from.ry) * u,
        rz: from.rz + (rzEnd - from.rz) * u,
        tilt: 0,
        axis: 0,
      };
    }
    const s = tMs - flightMs; // 落地后
    let x = to.x;
    let y = to.y;
    let rz = rzEnd;
    let z = 0;
    for (const b of bounces) {
      if (s >= b.t1) {
        x += b.dx;
        y += b.dy;
        rz += b.drz;
        continue;
      }
      if (s >= b.t0) {
        const u = (s - b.t0) / (b.t1 - b.t0);
        x += b.dx * u;
        y += b.dy * u;
        rz += b.drz * u;
        z = 4 * b.h * u * (1 - u);
      }
      break;
    }
    let tilt = 0;
    let axis = 0;
    if (wobbleFrom !== null && s >= wobbleStart && s < wobbleEnd) {
      // 倾角指数衰减，倾斜轴越转越快
      const u = (s - wobbleStart) / (wobbleEnd - wobbleStart);
      tilt = 20 * Math.exp(-3.2 * u) * (1 - u);
      axis = 360 * (2 * u + 9 * u * u);
    }
    return { x, y, z, rx: rxEnd, ry: ryEnd, rz, tilt, axis };
  }

  return { landAt: flightMs, endAt, pose, final };
}

/** 没有录音时用的默认撞击序列：一下、两次弹跳、短暂哗啦 */
export function fallbackHits(): Hit[] {
  const out: Hit[] = [{ t: 0, a: 1 }];
  let t = 0;
  let d = rand(85, 115);
  for (let k = 0; k < 3; k++) {
    t += d;
    out.push({ t: Math.round(t), a: 0.6 * 0.6 ** k });
    d *= 0.6;
  }
  return out;
}

export function poseTransform(p: Pose): string {
  return `translate3d(${p.x}px, ${p.y}px, ${p.z}px) rotateZ(${p.rz}deg) rotateZ(${p.axis}deg) rotateX(${p.tilt}deg) rotateZ(${-p.axis}deg) rotateX(${p.rx}deg) rotateY(${p.ry}deg)`;
}
