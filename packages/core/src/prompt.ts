import type { CastResult, LineBasics } from './cast';
import { castTimeText } from './calendar';
import { BRANCH_ELEMENT, type Influence } from './ganzhi';
import { formatChart } from './format';

const POS = ['初', '二', '三', '四', '五', '上'];

function influenceText(who: string, branch: string, inf: Influence, line: LineBasics): string {
  const el = BRANCH_ELEMENT[branch as keyof typeof BRANCH_ELEMENT];
  switch (inf) {
    case '生': return `${who}${branch}${el}生之`;
    case '克': return `${who}${branch}${el}克之`;
    case '比': return `${who}${branch}${el}比和`;
    case '泄': return `${line.element}生${who}${branch}${el}，被泄`;
    case '耗': return `${line.element}克${who}${branch}${el}，耗力`;
  }
}

/** 逐爻列出月建、日辰对它的作用，卦盘上只有标签，这里说全 */
function lineRelations(r: CastResult): string {
  const { month, day } = r.time;
  const rows = r.original.lines.map((l) => {
    const parts = [
      influenceText('月建', month.branch, l.fromMonth, l),
      influenceText('日辰', day.branch, l.fromDay, l),
    ];
    if (l.tags.length) parts.push(l.tags.join('、'));
    const head = `${POS[l.position - 1]}爻 ${l.relation}${l.stem}${l.branch}${l.element}${l.moving ? '（动）' : ''}${l.isShi ? '（世）' : ''}${l.isYing ? '（应）' : ''}`;
    let text = `- ${head}：${parts.join('；')}`;
    if (l.change) {
      const c = l.change;
      text += `\n  - 变出 ${c.relation}${c.stem}${c.branch}${c.element}${c.tags.length ? `（${c.tags.join('、')}）` : ''}`;
    }
    return text;
  });
  for (const f of r.fuShen) {
    rows.push(
      `- 伏神 ${f.relation}${f.stem}${f.branch}${f.element} 伏于${POS[f.position - 1]}爻 ${f.flying.relation}${f.flying.branch} 之下：` +
        [influenceText('月建', month.branch, f.fromMonth, f), influenceText('日辰', day.branch, f.fromDay, f), ...(f.tags.length ? [f.tags.join('、')] : [])].join('；'),
    );
  }
  return rows.join('\n');
}

export const READING_METHOD = `## 断卦方法（依《增删卜易》《卜筮正宗》之法）

1. **定用神**：先按所问之事取用神，明确指出用神是哪一爻。
   - 求财、买卖、投资、工资 → 妻财；问妻子、女友、下属亦看妻财
   - 事业、升职、官司、疾病之病症、女问夫 → 官鬼
   - 考试、文书、合同、房产、车辆、长辈、消息 → 父母
   - 子女、晚辈、宠物、医药、解忧、男问情人 → 子孙
   - 兄弟姐妹、朋友、同事、竞争者 → 兄弟
   - 问自身吉凶看世爻；问他人以对应六亲为用，无明确对应者看应爻
   - 用神不上卦则取伏神，看伏神能否出伏（飞神空破、日月冲飞神、伏神得日月动爻生扶则可出）
   - 用神两现，取临世应、动爻、月破旬空者（有病者）为用

2. **断用神旺衰**：月建日辰为纲。临月建日辰、得月日生扶为旺；月破、日冲静爻（旺者暗动，衰者日破）、月日克伤为衰。旬空分真空假空：旺相之爻空为假空，出空之日可用；休囚受克又空为真空。动爻生克用神、变爻回头生克、进神退神、动化空破，皆要看。三合、六合、六冲、反吟伏吟若有则论。

3. **看世应与动爻**：世爻为求测人本身，应爻为对方或事情的另一方。动爻是事情的变数，仔细看动爻生克世爻和用神。原神（生用神者）旺则用神有根，忌神（克用神者）动则事有阻。

4. **给出结论与应期**：吉凶要明确说程度（顺利／小有波折／难成）。应期以用神旺相之月日、逢值逢合、空者出空、破者填实、合者逢冲、动者逢合等推之，给出具体的月份或日子（用地支即可，如"辰月""申日"）。

5. **写法**：先说结论，再说理由。用白话解释，术语第一次出现时顺带说明。不要泛泛而谈卦辞，纳甲六爻以六亲生克为主，卦名、卦辞只作辅助。不要为了讨好而报喜不报忧。如果卦象信息不足以判断，如实说明。涉及健康、法律、重大财务决定，提醒以专业意见为准。

请按以下结构输出：**用神与旺衰 → 关键爻象 → 结论 → 应期 → 建议**，总长度五百字左右。`;

/**
 * 生成可直接粘贴给大模型的解卦提示词。
 * 内容：角色与方法论 + 卦盘 + 逐爻月日关系 + 所问之事。
 */
export function buildReadingPrompt(r: CastResult): string {
  const question = r.question?.trim() || '（求测人未写明所问之事，请先据卦象判断最可能所问的方向，并说明以自身吉凶（世爻）为主来断）';
  return [
    '你是一位精通纳甲六爻的占卜师。下面是一个用三枚铜钱摇出的卦，请为求测人断卦。',
    '',
    `## 所问之事`,
    question,
    '',
    `## 起卦时间`,
    `${castTimeText(r.time)}，旬空 ${r.time.xunKong.join('')}。以此月建、日辰断卦。`,
    '',
    `## 卦盘`,
    '```',
    formatChart(r),
    '```',
    '',
    `## 各爻与月建日辰的关系`,
    lineRelations(r),
    '',
    READING_METHOD,
  ].join('\n');
}
