import type { CastTime } from './calendar.js';
import { castTimeFromDate } from './calendar.js';
import {
  BRANCH_ELEMENT,
  clashes,
  combines,
  influence,
  relationOf,
  type Branch,
  type Element,
  type GanZhi,
  type Influence,
  type Relation,
  type Stem,
} from './ganzhi.js';
import { hexagramFromLines, pureHexagramOf, type HexagramInfo } from './data/hexagrams.js';
import { assertSixValues, isMoving, isYang, type LineValue } from './toss.js';

export const SIX_BEASTS = ['青龙', '朱雀', '勾陈', '螣蛇', '白虎', '玄武'] as const;
export type SixBeast = (typeof SIX_BEASTS)[number];

/** 爻与月建、日辰的关系标签 */
export type LineTag = '旬空' | '月破' | '临月建' | '月合' | '日冲' | '临日辰' | '日合';

export interface LineBasics {
  yang: boolean;
  stem: Stem;
  branch: Branch;
  element: Element;
  relation: Relation;
  tags: LineTag[];
  /** 月建对此爻的作用 */
  fromMonth: Influence;
  /** 日辰对此爻的作用 */
  fromDay: Influence;
}

export interface ChartLine extends LineBasics {
  /** 1 初爻 … 6 上爻 */
  position: number;
  value: LineValue;
  moving: boolean;
  beast: SixBeast;
  isShi: boolean;
  isYing: boolean;
  /** 动爻变出的爻（变爻） */
  change?: LineBasics;
}

export interface ChangedLine extends LineBasics {
  position: number;
  isShi: boolean;
  isYing: boolean;
}

/** 伏神：本卦缺某六亲时，从本宫首卦借来的爻 */
export interface FuShen extends LineBasics {
  position: number;
  /** 飞神：本卦同位置的爻 */
  flying: { stem: Stem; branch: Branch; element: Element; relation: Relation };
}

export interface Hexagram<L> {
  info: HexagramInfo;
  lines: L[];
}

export interface CastResult {
  question?: string;
  time: CastTime;
  values: LineValue[];
  original: Hexagram<ChartLine>;
  /** 无动爻时为 null */
  changed: Hexagram<ChangedLine> | null;
  /** 动爻位置 1..6 */
  moving: number[];
  fuShen: FuShen[];
}

export interface CastOptions {
  question?: string;
}

/** 六神起例：甲乙起青龙，丙丁起朱雀，戊起勾陈，己起螣蛇，庚辛起白虎，壬癸起玄武 */
function beastStartIndex(dayStem: Stem): number {
  return { 甲: 0, 乙: 0, 丙: 1, 丁: 1, 戊: 2, 己: 3, 庚: 4, 辛: 4, 壬: 5, 癸: 5 }[dayStem];
}

function ganZhiAt(info: HexagramInfo, position: number): GanZhi {
  return position <= 3 ? info.lower.inner[position - 1]! : info.upper.outer[position - 4]!;
}

function tagsFor(branch: Branch, time: CastTime): LineTag[] {
  const tags: LineTag[] = [];
  if (time.xunKong.includes(branch)) tags.push('旬空');
  if (branch === time.month.branch) tags.push('临月建');
  if (clashes(branch, time.month.branch)) tags.push('月破');
  if (combines(branch, time.month.branch)) tags.push('月合');
  if (branch === time.day.branch) tags.push('临日辰');
  if (clashes(branch, time.day.branch)) tags.push('日冲');
  if (combines(branch, time.day.branch)) tags.push('日合');
  return tags;
}

function basicsOf(info: HexagramInfo, position: number, yang: boolean, palaceElement: Element, time: CastTime): LineBasics {
  const gz = ganZhiAt(info, position);
  const element = BRANCH_ELEMENT[gz.branch];
  return {
    yang,
    stem: gz.stem,
    branch: gz.branch,
    element,
    relation: relationOf(palaceElement, element),
    tags: tagsFor(gz.branch, time),
    fromMonth: influence(BRANCH_ELEMENT[time.month.branch], element),
    fromDay: influence(BRANCH_ELEMENT[time.day.branch], element),
  };
}

/**
 * 排盘主函数。
 * @param values 六个爻值（6/7/8/9），顺序为初爻到上爻
 * @param time 起卦时刻；传 Date 会按本地时间换算干支
 */
export function cast(values: readonly number[], time: CastTime | Date = new Date(), options: CastOptions = {}): CastResult {
  assertSixValues(values);
  const t = time instanceof Date ? castTimeFromDate(time) : time;

  const originalLines = values.map(isYang);
  const info = hexagramFromLines(originalLines);
  const palaceElement = info.palaceElement;
  const moving = values.flatMap((v, i) => (isMoving(v) ? [i + 1] : []));

  // 变卦：动爻翻转。变爻的六亲仍以本卦宫五行为"我"。
  let changed: Hexagram<ChangedLine> | null = null;
  if (moving.length > 0) {
    const changedLines = originalLines.map((y, i) => (moving.includes(i + 1) ? !y : y));
    const cinfo = hexagramFromLines(changedLines);
    changed = {
      info: cinfo,
      lines: changedLines.map((yang, i) => ({
        position: i + 1,
        ...basicsOf(cinfo, i + 1, yang, palaceElement, t),
        isShi: cinfo.shi === i + 1,
        isYing: cinfo.ying === i + 1,
      })),
    };
  }

  const beastStart = beastStartIndex(t.day.stem);
  const lines: ChartLine[] = values.map((value, i) => {
    const position = i + 1;
    const line: ChartLine = {
      position,
      value,
      moving: isMoving(value),
      beast: SIX_BEASTS[(beastStart + i) % 6]!,
      isShi: info.shi === position,
      isYing: info.ying === position,
      ...basicsOf(info, position, isYang(value), palaceElement, t),
    };
    if (line.moving && changed) {
      const { position: _p, isShi: _s, isYing: _y, ...basics } = changed.lines[i]!;
      line.change = basics;
    }
    return line;
  });

  // 伏神：本卦六亲不全时，到本宫首卦里找缺的六亲，伏在本卦同位置的爻（飞神）之下
  const present = new Set(lines.map((l) => l.relation));
  const pure = pureHexagramOf(info.palace);
  const fuShen: FuShen[] = [];
  for (let i = 0; i < 6; i++) {
    const position = i + 1;
    const basics = basicsOf(pure, position, pure.lines[i]!, palaceElement, t);
    if (present.has(basics.relation)) continue;
    const fly = lines[i]!;
    fuShen.push({
      position,
      ...basics,
      flying: { stem: fly.stem, branch: fly.branch, element: fly.element, relation: fly.relation },
    });
  }

  return {
    question: options.question,
    time: t,
    values: [...values],
    original: { info, lines },
    changed,
    moving,
    fuShen,
  };
}
