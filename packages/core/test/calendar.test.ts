import { describe, expect, it } from 'vitest';
import { castTimeOf } from '../src/calendar';
import { ganZhiText } from '../src/ganzhi';

describe('干支历', () => {
  it('2000-01-01 日柱戊午', () => {
    const t = castTimeOf(2000, 1, 1, 12);
    expect(ganZhiText(t.day)).toBe('戊午');
    expect(ganZhiText(t.year)).toBe('己卯');
    expect(ganZhiText(t.month)).toBe('丙子');
    expect(t.xunKong).toEqual(['子', '丑']);
  });

  it('月建以立春为界（2024-02-04 16:27 立春）', () => {
    const before = castTimeOf(2024, 2, 4, 10);
    const after = castTimeOf(2024, 2, 4, 17);
    expect(ganZhiText(before.month)).toBe('乙丑');
    expect(ganZhiText(before.year)).toBe('癸卯');
    expect(ganZhiText(after.month)).toBe('丙寅');
    expect(ganZhiText(after.year)).toBe('甲辰');
  });

  it('晚子时归次日可关闭', () => {
    const next = castTimeOf(2000, 1, 1, 23, 30);
    const same = castTimeOf(2000, 1, 1, 23, 30, { lateZiNextDay: false });
    expect(ganZhiText(next.day)).toBe('己未');
    expect(ganZhiText(same.day)).toBe('戊午');
  });
});
