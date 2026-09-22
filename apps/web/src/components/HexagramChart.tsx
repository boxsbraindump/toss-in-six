import type { CastResult, ChartLine } from "@liuyao/core";
import { castTimeText, formatChart } from "@liuyao/core";
import type { CSSProperties } from "react";
import { LineBar } from "./LineBar";
import { ReadingPrompt } from "./ReadingPrompt";

const POS = ["初", "二", "三", "四", "五", "上"];
const CHAR_MS = 150;

function delay(ms: number): CSSProperties {
  return { "--d": `${ms}ms` } as CSSProperties;
}

/** 卦名逐字落下 */
function Chars({ text, from, className = "" }: { text: string; from: number; className?: string }) {
  return (
    <span className={className}>
      {Array.from(text).map((ch, i) => (
        <span key={i} className="rv inline-block" style={delay(from + i * CHAR_MS)}>
          {ch}
        </span>
      ))}
    </span>
  );
}

export function HexagramChart({ result }: { result: CastResult }) {
  const { original, changed, time } = result;

  const nameStart = 250;
  const n1 = Array.from(original.info.name).length;
  const zhiAt = nameStart + n1 * CHAR_MS + 200;
  const n2 = changed ? Array.from(changed.info.name).length : 0;
  const titleEnd = changed ? zhiAt + (1 + n2) * CHAR_MS : nameStart + n1 * CHAR_MS;
  const chartAt = titleEnd + 350;
  const flashAt = chartAt + 450;
  const restAt = chartAt + 300;

  const allMoving = result.moving.length === 6;
  const allStill = result.moving.length === 0;

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        {result.question && (
          <p className="rv text-sm text-bone-dim" style={delay(0)}>
            所问 · {result.question}
          </p>
        )}
        <h2 className="font-display text-4xl font-bold leading-tight tracking-wide">
          <Chars text={original.info.name} from={nameStart} />
          {changed && (
            <>
              <span className="rv mx-2 inline-block text-2xl font-medium text-bone-dim" style={delay(zhiAt)}>
                之
              </span>
              <Chars text={changed.info.name} from={zhiAt + CHAR_MS} />
            </>
          )}
        </h2>
        <p className="rv text-sm text-bone-dim" style={delay(titleEnd + 100)}>
          {original.info.palace}宫 · {original.info.kind}
          {changed && ` · ${result.moving.map((p) => POS[p - 1]).join("、")}爻动`}
          {allStill && " · 六爻安静"}
          {allMoving && <span className="text-cinnabar"> · 六爻全动，四千零九十六卦里才有一卦</span>}
        </p>
        <p className="rv font-display text-xs leading-relaxed tracking-wider text-verdigris" style={delay(titleEnd + 200)}>
          {castTimeText(time)}
          <br />
          旬空 {time.xunKong.join("")}
          {time.lunarText && ` · 农历${time.lunarText.replace(/^.*?年/, "")}`}
        </p>
      </header>

      <ol className="rv flex flex-col-reverse gap-3 rounded-lg border border-ink-3 bg-ink-2 p-4" style={delay(chartAt)}>
        {original.lines.map((line) => (
          <Row key={line.position} line={line} changedName={changed?.info.name} flashAt={flashAt} />
        ))}
      </ol>

      <div className="rv flex flex-col gap-6" style={delay(restAt)}>
        {result.fuShen.length > 0 && (
          <ul className="flex flex-col gap-1 text-sm text-bone-dim">
            {result.fuShen.map((f) => (
              <li key={f.position}>
                伏神 <span className="text-bone">{f.relation} {f.stem}{f.branch}{f.element}</span> 伏于{POS[f.position - 1]}爻 {f.flying.relation}{f.flying.branch} 之下
                {f.tags.length > 0 && <span className="ml-2 font-display text-[11px] text-verdigris">{f.tags.join(" ")}</span>}
              </li>
            ))}
          </ul>
        )}

        <ReadingPrompt result={result} />

        <details className="group text-sm">
          <summary className="cursor-pointer text-bone-dim hover:text-bone">文字卦盘</summary>
          <pre className="mt-3 overflow-x-auto rounded-lg border border-ink-3 bg-ink p-4 font-mono text-xs leading-relaxed text-bone">{formatChart(result)}</pre>
        </details>
      </div>
    </section>
  );
}

function Row({ line, changedName, flashAt }: { line: ChartLine; changedName?: string; flashAt: number }) {
  return (
    <li className="grid min-h-10 grid-cols-[2.5rem_1fr] items-center gap-x-3 gap-y-0.5">
      <span className="text-xs text-bone-dim">{line.beast}</span>
      <div className="flex items-center gap-3">
        <span className="flex min-w-24 shrink-0 items-baseline gap-2 text-sm leading-tight">
          <span>
            <span className="text-bone-dim">{line.relation}</span> {line.stem}{line.branch}
            <span className="text-bone-dim">{line.element}</span>
          </span>
          {line.tags.length > 0 && <span className="font-display text-[11px] text-verdigris">{line.tags.join(" ")}</span>}
        </span>
        <span className={line.moving ? "rv-flash rounded-sm" : ""} style={line.moving ? delay(flashAt) : undefined}>
          <LineBar yang={line.yang} moving={line.moving} />
        </span>
        <span className="flex w-10 items-center gap-1 text-xs">
          {line.moving && <span className="text-cinnabar">{line.yang ? "○" : "×"}</span>}
          {line.isShi && <Seal>世</Seal>}
          {line.isYing && <Seal muted>应</Seal>}
        </span>
      </div>
      {line.change && (
        <span
          className="rv col-start-2 flex items-center gap-2 pl-0.5 text-sm text-bone-dim"
          style={delay(flashAt + 500)}
          title={`变卦 ${changedName ?? ""}`}
        >
          <span aria-hidden>→</span>
          <span>
            {line.change.relation} <span className="text-bone">{line.change.stem}{line.change.branch}</span>{line.change.element}
          </span>
          <LineBar yang={line.change.yang} size="sm" />
        </span>
      )}
    </li>
  );
}

function Seal({ children, muted = false }: { children: string; muted?: boolean }) {
  return (
    <span
      className={`inline-flex h-4 w-4 items-center justify-center rounded-[2px] font-display text-[11px] font-bold leading-none ${
        muted ? "border border-bone-dim text-bone-dim" : "bg-cinnabar text-bone"
      }`}
    >
      {children}
    </span>
  );
}
