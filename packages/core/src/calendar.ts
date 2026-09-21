import { Solar } from 'lunar-typescript';
import { ganZhiText, parseGanZhi, xunKong, type Branch, type GanZhi } from './ganzhi.js';

/** 起卦时刻的干支信息 */
export interface CastTime {
  /** 公历，本地时间 */
  solar: { year: number; month: number; day: number; hour: number; minute: number };
  /** 农历文字，如 二〇二六年八月初十 */
  lunarText: string;
  year: GanZhi;
  /** 月建：以节气（立春、惊蛰…）分界，不按农历初一 */
  month: GanZhi;
  /** 日辰 */
  day: GanZhi;
  hour: GanZhi;
  /** 日旬空 */
  xunKong: [Branch, Branch];
}

export interface CalendarOptions {
  /**
   * 晚子时（23:00 之后）是否算作次日。默认 true。
   * 六爻实践中两种用法都有，这里默认遵循"夜子时归次日"。
   */
  lateZiNextDay?: boolean;
}

export function castTimeOf(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0,
  options: CalendarOptions = {},
): CastTime {
  const lateZiNextDay = options.lateZiNextDay ?? true;
  const solar = Solar.fromYmdHms(year, month, day, hour, minute, 0);
  const lunar = solar.getLunar();
  const dayGz = parseGanZhi(lateZiNextDay ? lunar.getDayInGanZhiExact() : lunar.getDayInGanZhi());
  return {
    solar: { year, month, day, hour, minute },
    lunarText: lunar.toString(),
    year: parseGanZhi(lunar.getYearInGanZhiExact()),
    month: parseGanZhi(lunar.getMonthInGanZhiExact()),
    day: dayGz,
    hour: parseGanZhi(lunar.getTimeInGanZhi()),
    xunKong: xunKong(dayGz),
  };
}

export function castTimeFromDate(date: Date, options: CalendarOptions = {}): CastTime {
  return castTimeOf(date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes(), options);
}

/**
 * 直接用四柱构造起卦时间，主要给测试和"手动输入干支"用。
 */
export function castTimeFromPillars(p: { year: string; month: string; day: string; hour?: string }): CastTime {
  const day = parseGanZhi(p.day);
  return {
    solar: { year: 0, month: 0, day: 0, hour: 0, minute: 0 },
    lunarText: '',
    year: parseGanZhi(p.year),
    month: parseGanZhi(p.month),
    day,
    hour: parseGanZhi(p.hour ?? '甲子'),
    xunKong: xunKong(day),
  };
}

export function castTimeText(t: CastTime): string {
  const { year, month, day, hour } = t;
  return `${ganZhiText(year)}年 ${ganZhiText(month)}月 ${ganZhiText(day)}日 ${ganZhiText(hour)}时`;
}
