/**
 * 铜钱声音全部用 WebAudio 现场合成，不依赖音频文件。
 * 金属声 = 几个不成整数比的正弦分音 + 快速指数衰减 + 一点噪声。
 */

const MUTE_KEY = "liuyao:muted";
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

function partial(c: AudioContext, freq: number, gain: number, decay: number, at: number, type: OscillatorType = "sine") {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(gain, at + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0005, at + decay);
  osc.connect(g).connect(c.destination);
  osc.start(at);
  osc.stop(at + decay + 0.05);
}

function noise(c: AudioContext, gain: number, decay: number, at: number, hp = 3000) {
  const len = Math.ceil(c.sampleRate * decay);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = "highpass";
  f.frequency.value = hp;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(c.destination);
  src.start(at);
}

/** 手里晃铜钱的碰撞声，intensity 0..1 */
export function clink(intensity = 0.6) {
  if (isMuted()) return;
  const c = ensureAudio();
  if (!c) return;
  const t = c.currentTime;
  const base = 2600 + Math.random() * 900;
  const v = 0.03 + intensity * 0.08;
  partial(c, base, v, 0.05 + Math.random() * 0.04, t);
  partial(c, base * 1.62, v * 0.5, 0.04, t);
  noise(c, v * 0.6, 0.03, t, 4000);
}

/** 铜钱落定 */
export function land(index: number) {
  if (isMuted()) return;
  const c = ensureAudio();
  if (!c) return;
  const t = c.currentTime;
  const base = 1750 + index * 90 + Math.random() * 120;
  partial(c, base, 0.16, 0.32, t);
  partial(c, base * 1.48, 0.09, 0.22, t);
  partial(c, base * 2.31, 0.05, 0.14, t);
  noise(c, 0.08, 0.04, t, 2500);
  // 第二次小弹跳
  partial(c, base * 1.02, 0.06, 0.16, t + 0.13);
}

/** 老阳 / 老阴：低沉的一记 */
export function rare() {
  if (isMuted()) return;
  const c = ensureAudio();
  if (!c) return;
  const t = c.currentTime + 0.02;
  partial(c, 110, 0.5, 0.9, t, "triangle");
  partial(c, 165, 0.25, 0.7, t);
  partial(c, 1320, 0.12, 0.5, t);
  partial(c, 2640, 0.05, 0.9, t + 0.05);
}

/** 卦成，轻磬一声 */
export function chime() {
  if (isMuted()) return;
  const c = ensureAudio();
  if (!c) return;
  const t = c.currentTime + 0.05;
  partial(c, 660, 0.12, 1.4, t);
  partial(c, 1320, 0.06, 1.1, t);
  partial(c, 1980, 0.03, 0.8, t);
}

export function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* ignore */
  }
}
