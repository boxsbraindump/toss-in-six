/**
 * 摇卦：三枚铜钱，摇六次，自初爻至上爻。
 *
 * 约定：背面为阳（3），字面为阴（2），三枚相加：
 *   三背 = 9 老阳（动爻，阳变阴）
 *   三字 = 6 老阴（动爻，阴变阳）
 *   一背 = 7 少阳（静）
 *   二背 = 8 少阴（静）
 */

/** 6 老阴 / 7 少阳 / 8 少阴 / 9 老阳 */
export type LineValue = 6 | 7 | 8 | 9;

/** 三枚硬币，true = 背 */
export type CoinToss = readonly [boolean, boolean, boolean];

export function coinsToValue(coins: CoinToss): LineValue {
  const backs = coins.filter(Boolean).length;
  return ([6, 7, 8, 9] as const)[backs]!;
}

export function isYang(v: LineValue): boolean {
  return v === 7 || v === 9;
}
export function isMoving(v: LineValue): boolean {
  return v === 6 || v === 9;
}

export type Rng = () => number;

/** 加密级随机数，[0, 1)。Node 19+ 和浏览器都有 globalThis.crypto */
export const secureRandom: Rng = () => {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return buf[0]! / 0x1_0000_0000;
};

export function tossCoins(rng: Rng = secureRandom): CoinToss {
  return [rng() < 0.5, rng() < 0.5, rng() < 0.5];
}

export function tossLine(rng: Rng = secureRandom): { coins: CoinToss; value: LineValue } {
  const coins = tossCoins(rng);
  return { coins, value: coinsToValue(coins) };
}

/** 一次摇满六爻，返回顺序为初爻到上爻 */
export function tossHexagram(rng: Rng = secureRandom): LineValue[] {
  return Array.from({ length: 6 }, () => tossLine(rng).value);
}

export function assertSixValues(values: readonly number[]): asserts values is LineValue[] {
  if (values.length !== 6 || values.some((v) => ![6, 7, 8, 9].includes(v))) {
    throw new Error(`需要六个 6/7/8/9 的爻值，收到: ${JSON.stringify(values)}`);
  }
}
