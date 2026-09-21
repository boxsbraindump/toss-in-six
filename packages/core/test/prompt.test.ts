import { describe, expect, it } from 'vitest';
import { castTimeFromPillars } from '../src/calendar';
import { cast } from '../src/cast';
import { buildReadingPrompt } from '../src/prompt';

describe('解卦提示词', () => {
  const r = cast([8, 9, 7, 7, 7, 7], castTimeFromPillars({ year: '甲辰', month: '丙寅', day: '戊申' }), { question: '下个月换工作顺利吗' });
  const p = buildReadingPrompt(r);

  it('包含问题、卦盘、方法论', () => {
    expect(p).toContain('下个月换工作顺利吗');
    expect(p).toContain('乾宫：天风姤（一世）');
    expect(p).toContain('定用神');
    expect(p).toContain('应期');
  });

  it('逐爻写明月日生克与动变', () => {
    // 二爻子孙亥水，寅月：亥水生寅木 → 被泄；申日：申金生亥水 → 生之
    expect(p).toContain('二爻 子孙辛亥水（动）：水生月建寅木，被泄；日辰申金生之');
    expect(p).toContain('变出 官鬼丙午火');
    expect(p).toContain('伏神 妻财甲寅木 伏于二爻 子孙亥 之下：月建寅木比和');
  });

  it('没写问题时给出兜底说明', () => {
    const q = buildReadingPrompt(cast([7, 7, 7, 7, 7, 7], castTimeFromPillars({ year: '甲辰', month: '丙寅', day: '甲子' })));
    expect(q).toContain('未写明所问之事');
  });
});
