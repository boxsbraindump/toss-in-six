import { describe, expect, it } from 'vitest';
import { castTimeFromPillars } from '../src/calendar';
import { cast } from '../src/cast';
import { formatChart, summarize } from '../src/format';

const jiaZiDay = castTimeFromPillars({ year: '甲辰', month: '丙寅', day: '甲子' });

describe('乾为天', () => {
  const r = cast([7, 7, 7, 7, 7, 7], jiaZiDay);
  it('纳甲与六亲', () => {
    expect(r.original.info.name).toBe('乾为天');
    expect(r.original.lines.map((l) => `${l.relation}${l.stem}${l.branch}${l.element}`)).toEqual([
      '子孙甲子水', '妻财甲寅木', '父母甲辰土', '官鬼壬午火', '兄弟壬申金', '父母壬戌土',
    ]);
  });
  it('世应', () => {
    expect(r.original.lines[5]!.isShi).toBe(true);
    expect(r.original.lines[2]!.isYing).toBe(true);
  });
  it('甲日六神从青龙起', () => {
    expect(r.original.lines.map((l) => l.beast)).toEqual(['青龙', '朱雀', '勾陈', '螣蛇', '白虎', '玄武']);
  });
  it('六亲齐全无伏神，无动爻无变卦', () => {
    expect(r.fuShen).toEqual([]);
    expect(r.changed).toBeNull();
    expect(r.moving).toEqual([]);
    expect(summarize(r)).toBe('乾为天（六爻安静）');
  });
  it('旬空与临日辰标记', () => {
    // 甲子日：戌亥空；初爻甲子临日辰；四爻午火日冲
    expect(r.original.lines[5]!.tags).toContain('旬空');
    expect(r.original.lines[0]!.tags).toContain('临日辰');
    expect(r.original.lines[3]!.tags).toContain('日冲');
    // 丙寅月：二爻寅木临月建，五爻申金月破
    expect(r.original.lines[1]!.tags).toContain('临月建');
    expect(r.original.lines[4]!.tags).toContain('月破');
  });
});

describe('天风姤 二爻动', () => {
  // 下巽 011，上乾 111；二爻老阳 9
  const r = cast([8, 9, 7, 7, 7, 7], castTimeFromPillars({ year: '甲辰', month: '丙寅', day: '戊申' }));
  it('本卦与变卦', () => {
    expect(r.original.info).toMatchObject({ name: '天风姤', palace: '乾', kind: '一世', shi: 1, ying: 4 });
    expect(r.changed?.info).toMatchObject({ name: '天山遁', palace: '乾', kind: '二世' });
    expect(r.moving).toEqual([2]);
    expect(summarize(r)).toBe('天风姤 之 天山遁（二爻动）');
  });
  it('本卦六亲', () => {
    expect(r.original.lines.map((l) => `${l.relation}${l.branch}`)).toEqual([
      '父母丑', '子孙亥', '兄弟酉', '官鬼午', '兄弟申', '父母戌',
    ]);
  });
  it('变爻按本卦宫定六亲：艮二爻丙午火为乾宫官鬼', () => {
    expect(r.original.lines[1]!.change).toMatchObject({ stem: '丙', branch: '午', element: '火', relation: '官鬼', yang: false });
    expect(r.original.lines[0]!.change).toBeUndefined();
  });
  it('妻财不上卦，伏神寅木伏于二爻亥水之下', () => {
    expect(r.fuShen).toHaveLength(1);
    expect(r.fuShen[0]).toMatchObject({ relation: '妻财', branch: '寅', position: 2, flying: { relation: '子孙', branch: '亥' } });
  });
  it('戊日六神从勾陈起', () => {
    expect(r.original.lines.map((l) => l.beast)).toEqual(['勾陈', '螣蛇', '白虎', '玄武', '青龙', '朱雀']);
  });
  it('文字卦盘可渲染', () => {
    const text = formatChart(r);
    expect(text).toContain('乾宫：天风姤（一世）');
    expect(text).toContain('伏神：妻财甲寅木 伏于二爻 子孙亥 之下');
  });
});

describe('多爻动与六冲卦', () => {
  it('坤为地 六爻全动变乾为天', () => {
    const r = cast([6, 6, 6, 6, 6, 6], jiaZiDay);
    expect(r.original.info.name).toBe('坤为地');
    expect(r.changed?.info.name).toBe('乾为天');
    expect(r.moving).toEqual([1, 2, 3, 4, 5, 6]);
    // 坤宫土：变爻甲子水为妻财
    expect(r.original.lines[0]!.change?.relation).toBe('妻财');
  });

  it('非法爻值报错', () => {
    expect(() => cast([1, 2, 3, 4, 5, 6], jiaZiDay)).toThrow();
    expect(() => cast([7, 7, 7], jiaZiDay)).toThrow();
  });
});
