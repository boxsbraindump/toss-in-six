import type { Element, GanZhi } from '../ganzhi.js';
import { parseGanZhi } from '../ganzhi.js';

export type TrigramName = '乾' | '兑' | '离' | '震' | '巽' | '坎' | '艮' | '坤';

export interface Trigram {
  name: TrigramName;
  /** 自然象：天泽火雷风水山地 */
  nature: string;
  /** 三爻，自下而上，true = 阳 */
  lines: readonly [boolean, boolean, boolean];
  element: Element;
  /** 纳甲：作为内卦（初二三爻）时的干支 */
  inner: readonly [GanZhi, GanZhi, GanZhi];
  /** 纳甲：作为外卦（四五上爻）时的干支 */
  outer: readonly [GanZhi, GanZhi, GanZhi];
}

function gz3(a: string, b: string, c: string): [GanZhi, GanZhi, GanZhi] {
  return [parseGanZhi(a), parseGanZhi(b), parseGanZhi(c)];
}

/**
 * 京房纳甲：
 * 乾纳甲壬，坤纳乙癸，震纳庚，巽纳辛，坎纳戊，离纳己，艮纳丙，兑纳丁。
 * 阳卦（乾震坎艮）地支顺行，阴卦（坤巽离兑）地支逆行。
 */
export const TRIGRAMS: readonly Trigram[] = [
  { name: '乾', nature: '天', lines: [true, true, true], element: '金', inner: gz3('甲子', '甲寅', '甲辰'), outer: gz3('壬午', '壬申', '壬戌') },
  { name: '兑', nature: '泽', lines: [true, true, false], element: '金', inner: gz3('丁巳', '丁卯', '丁丑'), outer: gz3('丁亥', '丁酉', '丁未') },
  { name: '离', nature: '火', lines: [true, false, true], element: '火', inner: gz3('己卯', '己丑', '己亥'), outer: gz3('己酉', '己未', '己巳') },
  { name: '震', nature: '雷', lines: [true, false, false], element: '木', inner: gz3('庚子', '庚寅', '庚辰'), outer: gz3('庚午', '庚申', '庚戌') },
  { name: '巽', nature: '风', lines: [false, true, true], element: '木', inner: gz3('辛丑', '辛亥', '辛酉'), outer: gz3('辛未', '辛巳', '辛卯') },
  { name: '坎', nature: '水', lines: [false, true, false], element: '水', inner: gz3('戊寅', '戊辰', '戊午'), outer: gz3('戊申', '戊戌', '戊子') },
  { name: '艮', nature: '山', lines: [false, false, true], element: '土', inner: gz3('丙辰', '丙午', '丙申'), outer: gz3('丙戌', '丙子', '丙寅') },
  { name: '坤', nature: '地', lines: [false, false, false], element: '土', inner: gz3('乙未', '乙巳', '乙卯'), outer: gz3('癸丑', '癸亥', '癸酉') },
];

export const TRIGRAM_BY_NAME: Record<TrigramName, Trigram> = Object.fromEntries(
  TRIGRAMS.map((t) => [t.name, t]),
) as Record<TrigramName, Trigram>;

export function trigramKey(lines: readonly boolean[]): string {
  return lines.map((l) => (l ? '1' : '0')).join('');
}

const TRIGRAM_BY_KEY = new Map(TRIGRAMS.map((t) => [trigramKey(t.lines), t]));

export function trigramFromLines(lines: readonly boolean[]): Trigram {
  if (lines.length !== 3) throw new Error('三爻才能成一卦');
  const t = TRIGRAM_BY_KEY.get(trigramKey(lines));
  if (!t) throw new Error(`未知的三爻组合: ${trigramKey(lines)}`);
  return t;
}
