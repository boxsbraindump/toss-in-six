import { describe, expect, it } from 'vitest';
import { HEXAGRAMS, hexagramFromLines, pureHexagramOf } from '../src/data/hexagrams';

describe('六十四卦表', () => {
  it('共 64 卦，周易序号 1..64 各出现一次', () => {
    expect(HEXAGRAMS).toHaveLength(64);
    const kw = HEXAGRAMS.map((h) => h.kingWen).sort((a, b) => a - b);
    expect(kw).toEqual(Array.from({ length: 64 }, (_, i) => i + 1));
    expect(new Set(HEXAGRAMS.map((h) => h.name)).size).toBe(64);
  });

  it('卦名里的上下象与算法推出的上下卦一致', () => {
    for (const h of HEXAGRAMS) {
      if (h.kind === '本宫') {
        expect(h.name).toBe(`${h.palace}为${h.upper.nature}`);
        expect(h.upper.name).toBe(h.lower.name);
      } else {
        expect(h.name.startsWith(h.upper.nature + h.lower.nature)).toBe(true);
      }
    }
  });

  it('世应位置', () => {
    const byName = Object.fromEntries(HEXAGRAMS.map((h) => [h.name, h]));
    expect(byName['乾为天']).toMatchObject({ shi: 6, ying: 3, kind: '本宫' });
    expect(byName['天风姤']).toMatchObject({ shi: 1, ying: 4, kind: '一世' });
    expect(byName['天山遁']).toMatchObject({ shi: 2, ying: 5, kind: '二世' });
    expect(byName['天地否']).toMatchObject({ shi: 3, ying: 6, kind: '三世' });
    expect(byName['风地观']).toMatchObject({ shi: 4, ying: 1, kind: '四世' });
    expect(byName['山地剥']).toMatchObject({ shi: 5, ying: 2, kind: '五世' });
    expect(byName['火地晋']).toMatchObject({ shi: 4, ying: 1, kind: '游魂' });
    expect(byName['火天大有']).toMatchObject({ shi: 3, ying: 6, kind: '归魂' });
    expect(byName['地水师']).toMatchObject({ palace: '坎', kind: '归魂', shi: 3 });
    expect(byName['雷泽归妹']).toMatchObject({ palace: '兑', kind: '归魂' });
  });

  it('按爻查卦', () => {
    expect(hexagramFromLines([true, true, true, true, true, true]).name).toBe('乾为天');
    expect(hexagramFromLines([false, false, false, false, false, false]).name).toBe('坤为地');
    // 水火既济：下离 101，上坎 010
    expect(hexagramFromLines([true, false, true, false, true, false]).name).toBe('水火既济');
    expect(pureHexagramOf('兑').name).toBe('兑为泽');
  });
});
