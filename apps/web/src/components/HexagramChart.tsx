import type { CastResult, ChartLine } from "@liuyao/core";
import { castTimeText, formatChart, summarize } from "@liuyao/core";
import { LineBar } from "./LineBar";

const POS = ["初", "二", "三", "四", "五", "上"];

export function HexagramChart({ result }: { result: CastResult }) {
  const { original, changed, time } = result;
  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        {result.question && <p className="text-sm text-bone-dim">所问 · {result.question}</p>}
        <h2 className="font-display text-4xl font-bold leading-tight tracking-wide">
          {original.info.name}
          {changed && (
            <>
              <span className="mx-2 text-2xl font-medium text-bone-dim">之</span>
              {changed.info.name}
            </>
          )}
        </h2>
        <p className="text-sm text-bone-dim">
          {original.info.palace}宫 · {original.info.kind}
          {changed && ` · ${summarize(result).replace(/^.*（|）$/g, "")}`}
        </p>
        <p className="font-mono text-xs leading-relaxed text-verdigris">
          {castTimeText(time)}
          <br />
          旬空 {time.xunKong.join("")}
          {time.lunarText && ` · 农历${time.lunarText.replace(/^.*?年/, "")}`}
        </p>
      </header>

      <ol className="flex flex-col-reverse gap-3 rounded-lg border border-ink-3 bg-ink-2 p-4">
        {original.lines.map((line) => (
          <Row key={line.position} line={line} changedName={changed?.info.name} />
        ))}
      </ol>

      {result.fuShen.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm text-bone-dim">
          {result.fuShen.map((f) => (
            <li key={f.position}>
              伏神 <span className="text-bone">{f.relation} {f.stem}{f.branch}{f.element}</span> 伏于{POS[f.position - 1]}爻 {f.flying.relation}{f.flying.branch} 之下
              {f.tags.length > 0 && <span className="ml-2 font-mono text-xs text-verdigris">{f.tags.join(" ")}</span>}
            </li>
          ))}
        </ul>
      )}

      <details className="group text-sm">
        <summary className="cursor-pointer text-bone-dim hover:text-bone">文字卦盘</summary>
        <pre className="mt-3 overflow-x-auto rounded-lg border border-ink-3 bg-ink p-4 font-mono text-xs leading-relaxed text-bone">{formatChart(result)}</pre>
      </details>
    </section>
  );
}

function Row({ line, changedName }: { line: ChartLine; changedName?: string }) {
  return (
    <li className="grid min-h-10 grid-cols-[2.5rem_1fr] items-center gap-x-3 sm:grid-cols-[2.5rem_1fr_auto]">
      <span className="text-xs text-bone-dim">{line.beast}</span>
      <div className="flex items-center gap-3">
        <span className="flex w-24 shrink-0 flex-col text-sm leading-tight">
          <span>
            <span className="text-bone-dim">{line.relation}</span> {line.stem}{line.branch}
            <span className="text-bone-dim">{line.element}</span>
          </span>
          <span className="font-mono text-[10px] text-verdigris">{line.tags.join(" ") || " "}</span>
        </span>
        <LineBar yang={line.yang} moving={line.moving} />
        <span className="flex w-10 items-center gap-1 text-xs">
          {line.moving && <span className="text-cinnabar">{line.yang ? "○" : "×"}</span>}
          {line.isShi && <Seal>世</Seal>}
          {line.isYing && <Seal muted>应</Seal>}
        </span>
      </div>
      {line.change && (
        <span
          className="col-start-2 flex items-center gap-2 text-sm text-bone-dim sm:col-start-3 sm:justify-end"
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
