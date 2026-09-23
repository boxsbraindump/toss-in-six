/**
 * 铜钱声音：优先用真实录音采样（public/sounds/lib，来源见 sounds-src/SOURCES.md），
 * 采样没加载到时退回按物理过程合成的兜底。
 *
 * 采样分三类：
 *   shake — 手里晃：循环播放，音量跟着晃动强度走
 *   land  — 落桌：每枚铜钱落定随机挑一段，音高微调避免重复感
 *   spin  — 转着落定的哗啦
 */

import { asset } from "./base";

const MUTE_KEY = "liuyao:muted";
const EXCLUDE_KEY = "liuyao:sound:excluded";

export type Category = "shake" | "land" | "spin";
export interface Sample {
  file: string;
  ms: number;
  source: string;
  /** 切片内的撞击时刻（ms）与相对强度，落桌/转停类才有 */
  hits?: { t: number; a: number }[];
}
export type Manifest = Record<Category, Sample[]>;

// ---------- 静音 / 上下文 ----------

let ctx: AudioContext | null = null;
let muted = false;
let loaded = false;

function loadPref() {
  if (loaded) return;
  loaded = true;
  try {
    muted = localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    /* ignore */
  }
}

export function isMuted(): boolean {
  loadPref();
  return muted;
}

export function setMuted(v: boolean) {
  muted = v;
  try {
    localStorage.setItem(MUTE_KEY, v ? "1" : "0");
  } catch {
    /* ignore */
  }
}

/** 必须在用户手势里调用一次，浏览器才允许出声；顺便开始加载采样 */
export function ensureAudio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") void ctx.resume();
  void preloadSamples();
  return ctx;
}

function rand(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

// ---------- 输出链 ----------

const masters = new WeakMap<BaseAudioContext, GainNode>();

function master(c: BaseAudioContext): GainNode {
  let m = masters.get(c);
  if (m) return m;
  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 3;
  comp.attack.value = 0.001;
  comp.release.value = 0.08;
  m = c.createGain();
  m.gain.value = 0.9;
  m.connect(comp).connect(c.destination);
  masters.set(c, m);
  return m;
}

// ---------- 采样库 ----------

let manifest: Manifest | null = null;
const buffers = new Map<string, AudioBuffer>();
let preloading: Promise<void> | null = null;
const lastPick: Partial<Record<Category, string>> = {};
let excluded: Set<string> | null = null;

function loadExcluded(): Set<string> {
  if (excluded) return excluded;
  try {
    excluded = new Set<string>(JSON.parse(localStorage.getItem(EXCLUDE_KEY) ?? "[]"));
  } catch {
    excluded = new Set();
  }
  return excluded;
}

export function isExcluded(file: string): boolean {
  return loadExcluded().has(file);
}

export function setExcluded(file: string, v: boolean) {
  const s = loadExcluded();
  if (v) s.add(file);
  else s.delete(file);
  try {
    localStorage.setItem(EXCLUDE_KEY, JSON.stringify([...s]));
  } catch {
    /* ignore */
  }
}

export function excludedList(): string[] {
  return [...loadExcluded()];
}

export function getManifest(): Manifest | null {
  return manifest;
}

export function loadedCount(): number {
  return buffers.size;
}

export function preloadSamples(): Promise<void> {
  if (preloading) return preloading;
  preloading = (async () => {
    const c = ctx;
    if (!c) return;
    const res = await fetch(asset("/sounds/lib/manifest.json"));
    if (!res.ok) throw new Error(`manifest ${res.status}`);
    manifest = (await res.json()) as Manifest;
    const all = (["shake", "land", "spin"] as Category[]).flatMap((k) => manifest![k]);
    await Promise.all(
      all.map(async (s) => {
        try {
          const r = await fetch(asset(`/sounds/lib/${s.file}`));
          const buf = await c.decodeAudioData(await r.arrayBuffer());
          buffers.set(s.file, buf);
        } catch {
          /* 单个坏文件不影响其它 */
        }
      }),
    );
  })().catch(() => {
    preloading = null; // 下次再试
  });
  return preloading;
}

function pick(cat: Category): { file: string; buffer: AudioBuffer } | null {
  if (!manifest) return null;
  const ex = loadExcluded();
  const pool = manifest[cat].filter((s) => buffers.has(s.file) && !ex.has(s.file));
  if (pool.length === 0) return null;
  let s = pool[Math.floor(Math.random() * pool.length)]!;
  if (pool.length > 1 && s.file === lastPick[cat]) s = pool[(pool.indexOf(s) + 1) % pool.length]!;
  lastPick[cat] = s.file;
  return { file: s.file, buffer: buffers.get(s.file)! };
}

export function playSample(c: BaseAudioContext, buffer: AudioBuffer, at: number, gain = 1, rate = 1): AudioBufferSourceNode {
  const src = c.createBufferSource();
  src.buffer = buffer;
  src.playbackRate.value = rate;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(g).connect(master(c));
  src.start(at);
  return src;
}

/** 试音页用：播放指定文件 */
export function playFile(file: string) {
  const c = live();
  const b = buffers.get(file);
  if (c && b) playSample(c, b, c.currentTime, 1, 1);
}

// ---------- 合成兜底（木桌） ----------

const noises = new WeakMap<BaseAudioContext, AudioBuffer>();

function noiseBuffer(c: BaseAudioContext): AudioBuffer {
  let b = noises.get(c);
  if (b) return b;
  b = c.createBuffer(1, c.sampleRate, c.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  noises.set(c, b);
  return b;
}

interface Tick {
  gain: number;
  center: number;
  q?: number;
  decay: number;
  ring?: number;
  ringDecay?: number;
}

/** 一次接触：带通噪声瞬态 + 几个不成比例的高频余振 */
function tick(c: BaseAudioContext, at: number, t: Tick) {
  const out = master(c);
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  src.loop = true;
  src.loopEnd = 1;
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = t.center;
  bp.Q.value = t.q ?? 1.1;
  const g = c.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(t.gain, at + 0.0012);
  g.gain.exponentialRampToValueAtTime(0.0008, at + t.decay);
  src.connect(bp).connect(g).connect(out);
  src.start(at, Math.random() * 0.9);
  src.stop(at + t.decay + 0.02);

  const ring = t.ring ?? 0;
  if (ring > 0) {
    const base = t.center * rand(1.15, 1.45);
    const rd = t.ringDecay ?? 0.05;
    [1, 1.47, 1.92].forEach((r, i) => {
      const osc = c.createOscillator();
      osc.frequency.value = Math.min(base * r, 11000);
      const rg = c.createGain();
      rg.gain.setValueAtTime(0, at);
      rg.gain.linearRampToValueAtTime(t.gain * ring * [1, 0.45, 0.22][i]!, at + 0.002);
      rg.gain.exponentialRampToValueAtTime(0.0005, at + rd * (1 - i * 0.2));
      osc.connect(rg).connect(out);
      osc.start(at);
      osc.stop(at + rd + 0.02);
    });
  }
}

/** 桌面的闷响：很低、很短 */
function thump(c: BaseAudioContext, at: number, gain: number, from = 150, to = 70, dur = 0.05) {
  const osc = c.createOscillator();
  osc.frequency.setValueAtTime(from, at);
  osc.frequency.exponentialRampToValueAtTime(to, at + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(gain, at + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0008, at + dur + 0.03);
  osc.connect(g).connect(master(c));
  osc.start(at);
  osc.stop(at + dur + 0.05);
}

function synthClink(c: BaseAudioContext, at: number, intensity: number) {
  const n = 1 + (Math.random() < intensity ? 1 : 0);
  for (let k = 0; k < n; k++) {
    tick(c, at + k * rand(0.004, 0.02), {
      gain: (0.06 + 0.16 * intensity) * rand(0.5, 1),
      center: rand(3200, 7500),
      q: rand(0.8, 1.6),
      decay: rand(0.006, 0.018),
      ring: rand(0.15, 0.4),
      ringDecay: rand(0.025, 0.06),
    });
  }
}

function synthLand(c: BaseAudioContext, at: number, index: number) {
  let t = at;
  thump(c, t, 0.22, 170 - index * 15, 70, 0.045);
  tick(c, t, { gain: 0.42, center: rand(2400, 3400), q: 0.7, decay: 0.03, ring: 0.5, ringDecay: 0.1 });
  let dt = rand(0.075, 0.115);
  let g = 0.24;
  const bounces = 2 + Math.floor(Math.random() * 3);
  for (let b = 0; b < bounces; b++) {
    t += dt;
    thump(c, t, g * 0.5, 150, 70, 0.035);
    tick(c, t, { gain: g, center: rand(2800, 4200), q: 0.9, decay: 0.016, ring: 0.4, ringDecay: 0.06 });
    dt *= rand(0.55, 0.68);
    g *= 0.62;
  }
  if (Math.random() < 0.6) {
    let iv = rand(0.032, 0.048);
    g = 0.11;
    for (let k = 0; k < 26 && iv > 0.0045; k++) {
      t += iv;
      tick(c, t, { gain: g * rand(0.7, 1), center: rand(2600, 4800), q: 1.2, decay: 0.007, ring: 0.2, ringDecay: 0.025 });
      iv *= rand(0.86, 0.9);
      g *= 0.94;
    }
  }
}

// ---------- 对外事件 ----------

function live(): AudioContext | null {
  if (isMuted()) return null;
  return ensureAudio();
}

export interface ShakeHandle {
  setIntensity(v: number): void;
  stop(): void;
}

/**
 * 开始在手里晃：循环一段摇钱录音，音量跟 intensity 走。
 * 没采样时退回合成的碰撞声。
 */
export function startShake(): ShakeHandle {
  const c = live();
  const s = c ? pick("shake") : null;
  if (!c || !s) {
    let lastAt = 0;
    return {
      setIntensity(v) {
        if (!c || v < 0.3) return;
        const now = performance.now();
        if (now - lastAt < 70) return;
        lastAt = now;
        synthClink(c, c.currentTime, v);
      },
      stop() {},
    };
  }
  const src = c.createBufferSource();
  src.buffer = s.buffer;
  src.loop = true;
  src.playbackRate.value = rand(0.96, 1.04);
  const g = c.createGain();
  g.gain.value = 0;
  src.connect(g).connect(master(c));
  src.start(c.currentTime, Math.random() * s.buffer.duration);
  let stopped = false;
  return {
    setIntensity(v) {
      if (stopped) return;
      // 动得越快越响；静止时几乎无声（硬币在手里不动就没声）
      const target = Math.max(0, Math.min(1, (v - 0.08) * 1.4)) ** 1.5;
      g.gain.setTargetAtTime(target, c.currentTime, 0.03);
      src.playbackRate.setTargetAtTime(0.9 + v * 0.25, c.currentTime, 0.05);
    },
    stop() {
      if (stopped) return;
      stopped = true;
      g.gain.setTargetAtTime(0, c.currentTime, 0.02);
      src.stop(c.currentTime + 0.15);
    },
  };
}

/** 单次碰撞（试音、兜底用） */
export function clink(intensity = 0.6) {
  const c = live();
  if (c) synthClink(c, c.currentTime, intensity);
}

export interface Hit {
  t: number;
  a: number;
}

/**
 * 预约一次落桌：delaySec 后播放随机挑的落桌录音，返回录音里的撞击时刻（按播放速率换算），
 * 画面用它来安排弹跳。没有采样时返回 null。
 */
export function scheduleLand(delaySec: number, opts: { rate?: number; gain?: number } = {}): { hits: Hit[]; ms: number } | null {
  const c = live();
  if (!c || !manifest) return null;
  const s = pick("land");
  if (!s) return null;
  const rate = opts.rate ?? 1;
  playSample(c, s.buffer, c.currentTime + delaySec, opts.gain ?? 0.9, rate);
  const meta = manifest.land.find((m) => m.file === s.file);
  const hits = (meta?.hits ?? [{ t: 0, a: 1 }]).map((h) => ({ t: h.t / rate, a: h.a }));
  return { hits, ms: (meta?.ms ?? 300) / rate };
}

/** 铜钱落定（没有预约时的即时版本） */
export function land(index: number) {
  const c = live();
  if (!c) return;
  const s = pick("land");
  if (s) playSample(c, s.buffer, c.currentTime, rand(0.8, 1), rand(0.95, 1.05));
  else synthLand(c, c.currentTime, index);
}

/** 转着落定的哗啦 */
export function settle() {
  const c = live();
  if (!c) return;
  const s = pick("spin");
  if (s) playSample(c, s.buffer, c.currentTime, 0.8, rand(0.95, 1.05));
}

/** 老阳 / 老阴：落桌录音已经在放（放慢了），这里只补一记桌面的闷响 */
export function rare() {
  const c = live();
  if (!c) return;
  thump(c, c.currentTime + 0.02, 0.45, 120, 45, 0.09);
}

/** 卦成，轻磬一声 */
export function chime() {
  const c = live();
  if (!c) return;
  const at = c.currentTime + 0.05;
  const out = master(c);
  [1, 2.76, 5.4].forEach((r, i) => {
    const osc = c.createOscillator();
    osc.frequency.value = 528 * r;
    const g = c.createGain();
    const peak = [0.1, 0.045, 0.018][i]!;
    const dec = [1.8, 1.1, 0.6][i]!;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(peak, at + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0005, at + dec);
    osc.connect(g).connect(out);
    osc.start(at);
    osc.stop(at + dec + 0.05);
  });
}

export function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* ignore */
  }
}
