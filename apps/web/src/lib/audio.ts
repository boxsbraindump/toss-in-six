/**
 * 铜钱声音全部用 WebAudio 现场合成，不依赖音频文件。
 *
 * 硬币的声音几乎没有音高：主体是几毫秒的宽频"嗒"（带通噪声），
 * 加上很短的金属高频余振。落在桌上则是：撞击 → 几次间隔渐短的弹跳 → 越转越快的落定"哗啦"。
 * 每一次接触建模成一次 tick，再按物理过程排布时间；不同"音色方案"只是参数不同。
 */

const MUTE_KEY = "liuyao:muted";
const PROFILE_KEY = "liuyao:sound";

// ---------- 音色方案 ----------

type Range = [number, number];

export interface SoundProfile {
  id: string;
  label: string;
  note: string;
  /** 输出低通，去掉数字味 */
  lowpass: number;
  clink: { center: Range; decay: Range; ring: Range; ringDecay: Range; gain: number };
  land: {
    center: Range;
    q: number;
    ring: number;
    ringDecay: number;
    thump: number;
    thumpFrom: number;
    bounces: Range;
    /** 出现"转着落定"哗啦的概率 */
    wobble: number;
    wobbleCenter: Range;
  };
  /** 空腔共鸣（龟壳） */
  body?: { freq: number; q: number; mix: number };
}

export const PROFILES: readonly SoundProfile[] = [
  {
    id: "wood",
    label: "木桌",
    note: "铜钱落在木桌上，干脆，带一点桌面的闷响",
    lowpass: 11000,
    clink: { center: [3200, 7500], decay: [0.006, 0.018], ring: [0.15, 0.4], ringDecay: [0.025, 0.06], gain: 1 },
    land: { center: [2400, 3400], q: 0.7, ring: 0.5, ringDecay: 0.1, thump: 0.22, thumpFrom: 170, bounces: [2, 4], wobble: 0.6, wobbleCenter: [2600, 4800] },
  },
  {
    id: "shell",
    label: "龟壳",
    note: "在龟壳里摇，有空腔共鸣，倒出来才清脆",
    lowpass: 8500,
    clink: { center: [1800, 4500], decay: [0.01, 0.03], ring: [0.1, 0.25], ringDecay: [0.02, 0.04], gain: 0.9 },
    land: { center: [2000, 3000], q: 0.8, ring: 0.45, ringDecay: 0.09, thump: 0.26, thumpFrom: 160, bounces: [2, 4], wobble: 0.7, wobbleCenter: [2400, 4200] },
    body: { freq: 950, q: 6, mix: 0.7 },
  },
  {
    id: "stone",
    label: "石案",
    note: "落在石面或瓷盘上，亮、脆、余振长、弹得多",
    lowpass: 14000,
    clink: { center: [4500, 9000], decay: [0.005, 0.012], ring: [0.4, 0.7], ringDecay: [0.05, 0.12], gain: 1 },
    land: { center: [3500, 5200], q: 0.9, ring: 0.9, ringDecay: 0.22, thump: 0.1, thumpFrom: 220, bounces: [3, 5], wobble: 0.85, wobbleCenter: [3500, 6000] },
  },
  {
    id: "cloth",
    label: "绒布",
    note: "落在布面上，几乎没有余振，闷闷一下",
    lowpass: 6000,
    clink: { center: [2000, 4000], decay: [0.008, 0.02], ring: [0.05, 0.15], ringDecay: [0.015, 0.03], gain: 0.8 },
    land: { center: [1200, 2200], q: 0.5, ring: 0.1, ringDecay: 0.04, thump: 0.35, thumpFrom: 130, bounces: [0, 1], wobble: 0.1, wobbleCenter: [1500, 2500] },
  },
  {
    id: "heavy",
    label: "厚重古钱",
    note: "更大更厚的钱，声音低沉，落地有分量",
    lowpass: 9000,
    clink: { center: [2200, 5000], decay: [0.01, 0.025], ring: [0.3, 0.5], ringDecay: [0.05, 0.1], gain: 1.1 },
    land: { center: [1500, 2600], q: 0.7, ring: 0.7, ringDecay: 0.18, thump: 0.4, thumpFrom: 120, bounces: [2, 3], wobble: 0.5, wobbleCenter: [1800, 3200] },
  },
];

let profileId: string | null = null;

export function getProfile(): SoundProfile {
  if (profileId === null) {
    try {
      profileId = localStorage.getItem(PROFILE_KEY) ?? "wood";
    } catch {
      profileId = "wood";
    }
  }
  return PROFILES.find((p) => p.id === profileId) ?? PROFILES[0]!;
}

export function setProfile(id: string) {
  profileId = id;
  try {
    localStorage.setItem(PROFILE_KEY, id);
  } catch {
    /* ignore */
  }
}

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

/** 必须在用户手势里调用一次，浏览器才允许出声 */
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
  return ctx;
}

// ---------- 底层：输出链、噪声源、单次敲击 ----------

interface Chain {
  input: GainNode;
  lowpass: BiquadFilterNode;
}
const chains = new WeakMap<BaseAudioContext, Chain>();
const noises = new WeakMap<BaseAudioContext, AudioBuffer>();

function chain(c: BaseAudioContext, p: SoundProfile): GainNode {
  let ch = chains.get(c);
  if (!ch) {
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 4;
    comp.attack.value = 0.001;
    comp.release.value = 0.06;
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    const input = c.createGain();
    input.gain.value = 0.9;
    input.connect(comp).connect(lp).connect(c.destination);
    ch = { input, lowpass: lp };
    chains.set(c, ch);
  }
  ch.lowpass.frequency.value = p.lowpass;
  return ch.input;
}

function noiseBuffer(c: BaseAudioContext): AudioBuffer {
  let b = noises.get(c);
  if (b) return b;
  b = c.createBuffer(1, c.sampleRate, c.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  noises.set(c, b);
  return b;
}

function rand(a: number, b: number): number {
  return a + Math.random() * (b - a);
}
function pick(r: Range): number {
  return rand(r[0], r[1]);
}

interface Tick {
  gain: number;
  center: number;
  q?: number;
  decay: number;
  ring?: number;
  ringDecay?: number;
}

/** 一次接触：带通噪声瞬态 + 几个不成比例的高频余振（可经空腔共鸣） */
function tick(c: BaseAudioContext, p: SoundProfile, at: number, t: Tick) {
  const out = chain(c, p);
  let dest: AudioNode = out;
  if (p.body) {
    const mix = c.createGain();
    const dry = c.createGain();
    dry.gain.value = 1 - p.body.mix;
    const res = c.createBiquadFilter();
    res.type = "bandpass";
    res.frequency.value = p.body.freq;
    res.Q.value = p.body.q;
    const wet = c.createGain();
    wet.gain.value = p.body.mix * 2.2;
    mix.connect(dry).connect(out);
    mix.connect(res).connect(wet).connect(out);
    dest = mix;
  }

  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  src.loop = true;
  src.loopStart = 0;
  src.loopEnd = 1;
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = t.center;
  bp.Q.value = t.q ?? 1.1;
  const g = c.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(t.gain, at + 0.0012);
  g.gain.exponentialRampToValueAtTime(0.0008, at + t.decay);
  src.connect(bp).connect(g).connect(dest);
  src.start(at, Math.random() * 0.9);
  src.stop(at + t.decay + 0.02);

  const ring = t.ring ?? 0;
  if (ring > 0) {
    const base = t.center * rand(1.15, 1.45);
    const ratios = [1, 1.47, 1.92];
    const gains = [1, 0.45, 0.22];
    const rd = t.ringDecay ?? 0.05;
    ratios.forEach((r, i) => {
      const osc = c.createOscillator();
      osc.type = "sine";
      osc.frequency.value = Math.min(base * r, 11000);
      const rg = c.createGain();
      rg.gain.setValueAtTime(0, at);
      rg.gain.linearRampToValueAtTime(t.gain * ring * gains[i]!, at + 0.002);
      rg.gain.exponentialRampToValueAtTime(0.0005, at + rd * (1 - i * 0.2));
      osc.connect(rg).connect(dest);
      osc.start(at);
      osc.stop(at + rd + 0.02);
    });
  }
}

/** 桌面的闷响：很低、很短 */
function thump(c: BaseAudioContext, p: SoundProfile, at: number, gain: number, from = 150, to = 70, dur = 0.05) {
  if (gain <= 0) return;
  const osc = c.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(from, at);
  osc.frequency.exponentialRampToValueAtTime(to, at + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(gain, at + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0008, at + dur + 0.03);
  osc.connect(g).connect(chain(c, p));
  osc.start(at);
  osc.stop(at + dur + 0.05);
}

// ---------- 各种事件 ----------

/** 手里晃铜钱：几枚硬币互相磕碰，干、脆、短 */
export function coinClink(c: BaseAudioContext, at: number, intensity: number, p: SoundProfile = getProfile()) {
  const n = 1 + (Math.random() < intensity ? 1 : 0) + (Math.random() < intensity * 0.5 ? 1 : 0);
  for (let k = 0; k < n; k++) {
    const t = at + k * rand(0.004, 0.022);
    tick(c, p, t, {
      gain: (0.06 + 0.16 * intensity) * rand(0.5, 1) * p.clink.gain,
      center: pick(p.clink.center),
      q: rand(0.8, 1.6),
      decay: pick(p.clink.decay),
      ring: pick(p.clink.ring),
      ringDecay: pick(p.clink.ringDecay),
    });
  }
}

/** 铜钱落到桌上：撞击 → 弹跳 → 转着落定 */
export function coinLand(c: BaseAudioContext, at: number, index: number, p: SoundProfile = getProfile()) {
  const L = p.land;
  let t = at;
  thump(c, p, t, L.thump, L.thumpFrom - index * 15, 70, 0.045);
  tick(c, p, t, { gain: 0.42, center: pick(L.center), q: L.q, decay: 0.03, ring: L.ring, ringDecay: L.ringDecay });

  // 弹跳：间隔按 0.6 递减，音量随之变小
  let dt = rand(0.075, 0.115);
  let g = 0.24;
  const bounces = Math.round(pick(L.bounces));
  for (let b = 0; b < bounces; b++) {
    t += dt;
    thump(c, p, t, g * 0.5 * (L.thump / 0.22), 150, 70, 0.035);
    tick(c, p, t, { gain: g, center: pick(L.center) * 1.2, q: L.q + 0.2, decay: 0.016, ring: L.ring * 0.8, ringDecay: L.ringDecay * 0.6 });
    dt *= rand(0.55, 0.68);
    g *= 0.62;
  }

  // 落定：转着越来越快的"哗啦"
  if (Math.random() < L.wobble) {
    let iv = rand(0.032, 0.048);
    g = 0.11;
    for (let k = 0; k < 26 && iv > 0.0045; k++) {
      t += iv;
      tick(c, p, t, { gain: g * rand(0.7, 1), center: pick(L.wobbleCenter), q: 1.2, decay: 0.007, ring: L.ring * 0.4, ringDecay: 0.025 });
      iv *= rand(0.86, 0.9);
      g *= 0.94;
    }
  }
}

/** 老阳 / 老阴：更重的一落，桌面闷响更深、金属余音更长 */
export function coinHeavy(c: BaseAudioContext, at: number, p: SoundProfile = getProfile()) {
  thump(c, p, at, Math.max(0.3, p.land.thump * 1.6), 120, 45, 0.09);
  tick(c, p, at, { gain: 0.3, center: pick(p.land.center) * 0.7, q: 0.6, decay: 0.05, ring: 0.9, ringDecay: p.land.ringDecay * 3 });
  tick(c, p, at + 0.012, { gain: 0.2, center: pick(p.land.center), q: 0.8, decay: 0.03, ring: 0.6, ringDecay: p.land.ringDecay * 2.5 });
}

/** 卦成，轻磬一声：磬是另一件器物，允许有音高，但放轻 */
export function bowlChime(c: BaseAudioContext, at: number, p: SoundProfile = getProfile()) {
  const out = chain(c, p);
  const f0 = 528;
  [1, 2.76, 5.4].forEach((r, i) => {
    const osc = c.createOscillator();
    osc.frequency.value = f0 * r;
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
  tick(c, p, at, { gain: 0.05, center: 3000, q: 0.5, decay: 0.01 });
}

// ---------- 对外接口（带静音判断） ----------

function live(): AudioContext | null {
  if (isMuted()) return null;
  return ensureAudio();
}

export function clink(intensity = 0.6) {
  const c = live();
  if (c) coinClink(c, c.currentTime, intensity);
}

export function land(index: number) {
  const c = live();
  if (c) coinLand(c, c.currentTime, index);
}

export function rare() {
  const c = live();
  if (c) coinHeavy(c, c.currentTime + 0.02);
}

export function chime() {
  const c = live();
  if (c) bowlChime(c, c.currentTime + 0.05);
}

export function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* ignore */
  }
}

export type SoundName = "clink" | "land" | "rare" | "chime";

/** 试音页用：按指定方案播放 */
export function play(name: SoundName, p: SoundProfile) {
  const c = live();
  if (!c) return;
  const at = c.currentTime + 0.02;
  if (name === "clink") coinClink(c, at, 0.8, p);
  if (name === "land") coinLand(c, at, 1, p);
  if (name === "rare") coinHeavy(c, at, p);
  if (name === "chime") bowlChime(c, at, p);
}

/** 离线渲染某个声音，用来在没有喇叭的环境里检查波形 */
export async function renderPreview(name: SoundName, p: SoundProfile, seconds = 1.2): Promise<AudioBuffer> {
  const c = new OfflineAudioContext(1, Math.ceil(44100 * seconds), 44100);
  const at = 0.02;
  if (name === "clink") coinClink(c, at, 0.8, p);
  if (name === "land") coinLand(c, at, 1, p);
  if (name === "rare") coinHeavy(c, at, p);
  if (name === "chime") bowlChime(c, at, p);
  return c.startRendering();
}
