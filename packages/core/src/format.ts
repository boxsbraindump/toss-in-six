import type { CastResult, ChartLine, ChangedLine, LineBasics } from './cast';
import { castTimeText } from './calendar';
import { ganZhiText } from './ganzhi';

const YANG = '▅▅▅▅▅';
const YIN = '▅▅ ▅▅';

function glyph(yang: boolean): string {
  return yang ? YANG : YIN;
}

function lineLabel(l: LineBasics): string {
  return `${l.relation}${l.stem}${l.branch}${l.element}`;
}

function marks(l: ChartLine): string {
  const m: string[] = [];
  if (l.moving) m.push(l.yang ? '○' : '×');
  if (l.isShi) m.push('世');
  if (l.isYing) m.push('应');
  return m.join('');
}

function shiYing(l: ChangedLine): string {
  return l.isShi ? '世' : l.isYing ? '应' : '';
}

/**
 * 把排盘结果渲染成传统的文字卦盘，方便人眼核对，也可直接喂给大模型。
 */
export function formatChart(r: CastResult): string {
  const out: string[] = [];
  if (r.question) out.push(`所问：${r.question}`);

  const { solar } = r.time;
  const solarText = solar.year
    ? `公历 ${solar.year}-${String(solar.month).padStart(2, '0')}-${String(solar.day).padStart(2, '0')} ${String(solar.hour).padStart(2, '0')}:${String(solar.minute).padStart(2, '0')}`
    : '';
  out.push([solarText, r.time.lunarText ? `农历 ${r.time.lunarText}` : ''].filter(Boolean).join('  '));
  out.push(`${castTimeText(r.time)}  旬空：${r.time.xunKong.join('')}`);

  const o = r.original.info;
  const head = `${o.palace}宫：${o.name}（${o.kind}）`;
  const c = r.changed?.info;
  out.push(c ? `${head}  →  变卦：${c.name}（${c.palace}宫${c.kind}）` : head);
  out.push('');

  out.push(`六神    本卦 ${o.name}${c ? `                变卦 ${c.name}` : ''}`);
  for (let i = 5; i >= 0; i--) {
    const l = r.original.lines[i]!;
    const left = `${l.beast}    ${lineLabel(l)} ${glyph(l.yang)} ${marks(l).padEnd(3, '　')}`;
    const tagText = l.tags.length ? `[${l.tags.join(' ')}]` : '';
    let right = '';
    if (r.changed) {
      const cl = r.changed.lines[i]!;
      right = l.moving
        ? `→ ${lineLabel(cl)} ${glyph(cl.yang)} ${shiYing(cl)}`
        : `  ${lineLabel(cl)} ${glyph(cl.yang)} ${shiYing(cl)}`;
    }
    out.push([left, right, tagText].filter(Boolean).join(' '));
  }

  if (r.fuShen.length) {
    out.push('');
    for (const f of r.fuShen) {
      const tagText = f.tags.length ? ` [${f.tags.join(' ')}]` : '';
      out.push(`伏神：${lineLabel(f)} 伏于${['初', '二', '三', '四', '五', '上'][f.position - 1]}爻 ${f.flying.relation}${f.flying.branch} 之下${tagText}`);
    }
  }

  return out.join('\n');
}

/** 单行摘要，如 "天风姤 之 天山遁（二爻动）" */
export function summarize(r: CastResult): string {
  const o = r.original.info.name;
  if (!r.changed) return `${o}（六爻安静）`;
  const pos = r.moving.map((p) => ['初', '二', '三', '四', '五', '上'][p - 1]).join('、');
  return `${o} 之 ${r.changed.info.name}（${pos}爻动）`;
}

export { ganZhiText };
