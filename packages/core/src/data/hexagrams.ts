import type { Element } from '../ganzhi';
import { TRIGRAM_BY_NAME, trigramFromLines, trigramKey, type Trigram, type TrigramName } from './trigrams';

export type HexagramKind = '本宫' | '一世' | '二世' | '三世' | '四世' | '五世' | '游魂' | '归魂';

export interface HexagramInfo {
  /** 全名，如 天风姤 */
  name: string;
  /** 周易卦名，如 姤 */
  shortName: string;
  /** 周易（文王）卦序 1..64 */
  kingWen: number;
  /** 六爻，自下而上，true = 阳 */
  lines: readonly boolean[];
  upper: Trigram;
  lower: Trigram;
  /** 所属八宫 */
  palace: TrigramName;
  palaceElement: Element;
  kind: HexagramKind;
  /** 世爻位置 1..6 */
  shi: number;
  /** 应爻位置 1..6 */
  ying: number;
}

/**
 * 八宫卦序表（京房）。每宫八卦顺序：本宫、一世、二世、三世、四世、五世、游魂、归魂。
 * 卦的爻象由算法从本宫卦推出，表里只存名字和周易序号，测试会校验名字与爻象一致。
 */
const PALACE_TABLE: ReadonlyArray<{ palace: TrigramName; hexagrams: ReadonlyArray<readonly [string, string, number]> }> = [
  { palace: '乾', hexagrams: [['乾为天', '乾', 1], ['天风姤', '姤', 44], ['天山遁', '遁', 33], ['天地否', '否', 12], ['风地观', '观', 20], ['山地剥', '剥', 23], ['火地晋', '晋', 35], ['火天大有', '大有', 14]] },
  { palace: '坎', hexagrams: [['坎为水', '坎', 29], ['水泽节', '节', 60], ['水雷屯', '屯', 3], ['水火既济', '既济', 63], ['泽火革', '革', 49], ['雷火丰', '丰', 55], ['地火明夷', '明夷', 36], ['地水师', '师', 7]] },
  { palace: '艮', hexagrams: [['艮为山', '艮', 52], ['山火贲', '贲', 22], ['山天大畜', '大畜', 26], ['山泽损', '损', 41], ['火泽睽', '睽', 38], ['天泽履', '履', 10], ['风泽中孚', '中孚', 61], ['风山渐', '渐', 53]] },
  { palace: '震', hexagrams: [['震为雷', '震', 51], ['雷地豫', '豫', 16], ['雷水解', '解', 40], ['雷风恒', '恒', 32], ['地风升', '升', 46], ['水风井', '井', 48], ['泽风大过', '大过', 28], ['泽雷随', '随', 17]] },
  { palace: '巽', hexagrams: [['巽为风', '巽', 57], ['风天小畜', '小畜', 9], ['风火家人', '家人', 37], ['风雷益', '益', 42], ['天雷无妄', '无妄', 25], ['火雷噬嗑', '噬嗑', 21], ['山雷颐', '颐', 27], ['山风蛊', '蛊', 18]] },
  { palace: '离', hexagrams: [['离为火', '离', 30], ['火山旅', '旅', 56], ['火风鼎', '鼎', 50], ['火水未济', '未济', 64], ['山水蒙', '蒙', 4], ['风水涣', '涣', 59], ['天水讼', '讼', 6], ['天火同人', '同人', 13]] },
  { palace: '坤', hexagrams: [['坤为地', '坤', 2], ['地雷复', '复', 24], ['地泽临', '临', 19], ['地天泰', '泰', 11], ['雷天大壮', '大壮', 34], ['泽天夬', '夬', 43], ['水天需', '需', 5], ['水地比', '比', 8]] },
  { palace: '兑', hexagrams: [['兑为泽', '兑', 58], ['泽水困', '困', 47], ['泽地萃', '萃', 45], ['泽山咸', '咸', 31], ['水山蹇', '蹇', 39], ['地山谦', '谦', 15], ['雷山小过', '小过', 62], ['雷泽归妹', '归妹', 54]] },
];

/** 从本宫卦推出各世卦时需要翻转的爻（下标 0 = 初爻） */
const FLIP_PATTERNS: readonly (readonly number[])[] = [
  [],              // 本宫
  [0],             // 一世
  [0, 1],          // 二世
  [0, 1, 2],       // 三世
  [0, 1, 2, 3],    // 四世
  [0, 1, 2, 3, 4], // 五世
  [0, 1, 2, 4],    // 游魂：五世卦再把四爻变回来
  [4],             // 归魂：游魂卦内卦全部变回本宫
];
const KINDS: readonly HexagramKind[] = ['本宫', '一世', '二世', '三世', '四世', '五世', '游魂', '归魂'];
const SHI_POSITIONS: readonly number[] = [6, 1, 2, 3, 4, 5, 4, 3];

function build(): HexagramInfo[] {
  const result: HexagramInfo[] = [];
  for (const { palace, hexagrams } of PALACE_TABLE) {
    const t = TRIGRAM_BY_NAME[palace];
    const pure = [...t.lines, ...t.lines];
    hexagrams.forEach(([name, shortName, kingWen], i) => {
      const lines = pure.map((v, idx) => (FLIP_PATTERNS[i]!.includes(idx) ? !v : v));
      const shi = SHI_POSITIONS[i]!;
      result.push({
        name,
        shortName,
        kingWen,
        lines,
        lower: trigramFromLines(lines.slice(0, 3)),
        upper: trigramFromLines(lines.slice(3, 6)),
        palace,
        palaceElement: t.element,
        kind: KINDS[i]!,
        shi,
        ying: shi > 3 ? shi - 3 : shi + 3,
      });
    });
  }
  return result;
}

export const HEXAGRAMS: readonly HexagramInfo[] = build();

const BY_KEY = new Map(HEXAGRAMS.map((h) => [trigramKey(h.lines), h]));

export function hexagramFromLines(lines: readonly boolean[]): HexagramInfo {
  if (lines.length !== 6) throw new Error('六爻才能成一卦');
  const h = BY_KEY.get(trigramKey(lines));
  if (!h) throw new Error(`未知卦象: ${trigramKey(lines)}`);
  return h;
}

/** 某宫的本宫卦（首卦），伏神从这里取 */
export function pureHexagramOf(palace: TrigramName): HexagramInfo {
  const t = TRIGRAM_BY_NAME[palace];
  return hexagramFromLines([...t.lines, ...t.lines]);
}
