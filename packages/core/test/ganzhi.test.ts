import { describe, expect, it } from 'vitest';
import { clashes, combines, influence, parseGanZhi, relationOf, sexagenaryIndex, xunKong } from '../src/ganzhi';

describe('六亲', () => {
  it('以金为我', () => {
    expect(relationOf('金', '金')).toBe('兄弟');
    expect(relationOf('金', '土')).toBe('父母');
    expect(relationOf('金', '水')).toBe('子孙');
    expect(relationOf('金', '火')).toBe('官鬼');
    expect(relationOf('金', '木')).toBe('妻财');
  });
  it('以木为我', () => {
    expect(relationOf('木', '水')).toBe('父母');
    expect(relationOf('木', '火')).toBe('子孙');
    expect(relationOf('木', '金')).toBe('官鬼');
    expect(relationOf('木', '土')).toBe('妻财');
  });
});

describe('生克作用', () => {
  it('月建对爻', () => {
    expect(influence('水', '木')).toBe('生');
    expect(influence('金', '木')).toBe('克');
    expect(influence('木', '木')).toBe('比');
    expect(influence('火', '木')).toBe('泄');
    expect(influence('土', '木')).toBe('耗');
  });
});

describe('冲合', () => {
  it('六冲', () => {
    expect(clashes('子', '午')).toBe(true);
    expect(clashes('辰', '戌')).toBe(true);
    expect(clashes('子', '丑')).toBe(false);
  });
  it('六合', () => {
    expect(combines('子', '丑')).toBe(true);
    expect(combines('巳', '申')).toBe(true);
    expect(combines('子', '午')).toBe(false);
  });
});

describe('旬空', () => {
  it('各旬', () => {
    expect(xunKong(parseGanZhi('甲子'))).toEqual(['戌', '亥']);
    expect(xunKong(parseGanZhi('癸酉'))).toEqual(['戌', '亥']);
    expect(xunKong(parseGanZhi('甲戌'))).toEqual(['申', '酉']);
    expect(xunKong(parseGanZhi('丙申'))).toEqual(['辰', '巳']);
    expect(xunKong(parseGanZhi('壬辰'))).toEqual(['午', '未']);
    expect(xunKong(parseGanZhi('甲寅'))).toEqual(['子', '丑']);
  });
});

describe('六十甲子', () => {
  it('序号', () => {
    expect(sexagenaryIndex(parseGanZhi('甲子'))).toBe(0);
    expect(sexagenaryIndex(parseGanZhi('癸亥'))).toBe(59);
    expect(sexagenaryIndex(parseGanZhi('甲丑'))).toBe(-1);
  });
});
