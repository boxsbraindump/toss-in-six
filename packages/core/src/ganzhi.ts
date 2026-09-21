/**
 * 天干地支、五行、六亲、冲合、旬空等基础规则。
 * 全部是确定性查表 / 计算，不依赖任何外部库。
 */

export const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const;
export type Stem = (typeof STEMS)[number];

export const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const;
export type Branch = (typeof BRANCHES)[number];

export const ELEMENTS = ['金', '木', '水', '火', '土'] as const;
export type Element = (typeof ELEMENTS)[number];

export interface GanZhi {
  stem: Stem;
  branch: Branch;
}

export const STEM_ELEMENT: Record<Stem, Element> = {
  甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水',
};

export const BRANCH_ELEMENT: Record<Branch, Element> = {
  子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火',
  午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水',
};

/** 五行相生：木→火→土→金→水→木 */
const GENERATES: Record<Element, Element> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
/** 五行相克：木克土、土克水、水克火、火克金、金克木 */
const OVERCOMES: Record<Element, Element> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };

export function generates(a: Element, b: Element): boolean {
  return GENERATES[a] === b;
}
export function overcomes(a: Element, b: Element): boolean {
  return OVERCOMES[a] === b;
}

export const RELATIONS = ['父母', '兄弟', '子孙', '妻财', '官鬼'] as const;
export type Relation = (typeof RELATIONS)[number];

/**
 * 以 self（卦宫五行）为"我"，求 other（爻的五行）对我的六亲。
 * 同我者兄弟，生我者父母，我生者子孙，克我者官鬼，我克者妻财。
 */
export function relationOf(self: Element, other: Element): Relation {
  if (self === other) return '兄弟';
  if (GENERATES[other] === self) return '父母';
  if (GENERATES[self] === other) return '子孙';
  if (OVERCOMES[other] === self) return '官鬼';
  return '妻财';
}

/**
 * from 对 to 的五行作用（站在 to 的角度描述）：
 * 生 = from 生 to；克 = from 克 to；比 = 同五行；
 * 泄 = to 生 from（to 被泄气）；耗 = to 克 from（to 耗力）。
 */
export type Influence = '生' | '克' | '比' | '泄' | '耗';
export function influence(from: Element, to: Element): Influence {
  if (from === to) return '比';
  if (GENERATES[from] === to) return '生';
  if (OVERCOMES[from] === to) return '克';
  if (GENERATES[to] === from) return '泄';
  return '耗';
}

export function branchIndex(b: Branch): number {
  return BRANCHES.indexOf(b);
}
export function stemIndex(s: Stem): number {
  return STEMS.indexOf(s);
}

/** 六冲：子午、丑未、寅申、卯酉、辰戌、巳亥 */
export function clashes(a: Branch, b: Branch): boolean {
  return (branchIndex(a) + 6) % 12 === branchIndex(b);
}
export function clashOf(b: Branch): Branch {
  return BRANCHES[(branchIndex(b) + 6) % 12]!;
}

/** 六合：子丑、寅亥、卯戌、辰酉、巳申、午未 */
const SIX_HARMONY: Record<Branch, Branch> = {
  子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯',
  辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午',
};
export function combines(a: Branch, b: Branch): boolean {
  return SIX_HARMONY[a] === b;
}
export function harmonyOf(b: Branch): Branch {
  return SIX_HARMONY[b];
}

/** 三合局：申子辰水、亥卯未木、寅午戌火、巳酉丑金 */
export const TRIPLE_HARMONY: ReadonlyArray<{ branches: readonly [Branch, Branch, Branch]; element: Element }> = [
  { branches: ['申', '子', '辰'], element: '水' },
  { branches: ['亥', '卯', '未'], element: '木' },
  { branches: ['寅', '午', '戌'], element: '火' },
  { branches: ['巳', '酉', '丑'], element: '金' },
];

/** 六十甲子序号（甲子=0 … 癸亥=59），非法组合返回 -1 */
export function sexagenaryIndex(gz: GanZhi): number {
  const s = stemIndex(gz.stem);
  const b = branchIndex(gz.branch);
  if ((s - b) % 2 !== 0) return -1;
  for (let i = 0; i < 60; i++) {
    if (i % 10 === s && i % 12 === b) return i;
  }
  return -1;
}

/**
 * 旬空：日柱所在旬中没有被天干配到的两个地支。
 * 例：甲子旬（甲子…癸酉）空戌亥。
 */
export function xunKong(day: GanZhi): [Branch, Branch] {
  const start = (branchIndex(day.branch) - stemIndex(day.stem) + 12) % 12; // 旬首（甲 x）的地支序号
  return [BRANCHES[(start + 10) % 12]!, BRANCHES[(start + 11) % 12]!];
}

export function parseGanZhi(text: string): GanZhi {
  const stem = text[0] as Stem;
  const branch = text[1] as Branch;
  if (!STEMS.includes(stem) || !BRANCHES.includes(branch)) {
    throw new Error(`非法干支: ${text}`);
  }
  return { stem, branch };
}

export function ganZhiText(gz: GanZhi): string {
  return gz.stem + gz.branch;
}
