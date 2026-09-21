"use client";

import { cast, tossLine, type CastResult, type CoinToss, type LineValue } from "@liuyao/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { Coin } from "./Coin";
import { HexagramChart } from "./HexagramChart";
import { LineBar } from "./LineBar";

type Stage = "ask" | "toss" | "result";

interface HistoryItem {
  id: string;
  question: string;
  values: LineValue[];
  at: string;
}

const HISTORY_KEY = "liuyao:history";
const VALUE_NAME: Record<LineValue, string> = { 6: "老阴", 7: "少阳", 8: "少阴", 9: "老阳" };
const TOSS_MS = 1000;

function loadHistory(): HistoryItem[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveHistory(items: HistoryItem[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 30)));
  } catch {
    /* 隐私模式等情况下忽略 */
  }
}

export function Divination() {
  const [stage, setStage] = useState<Stage>("ask");
  const [question, setQuestion] = useState("");
  const [values, setValues] = useState<LineValue[]>([]);
  const [coins, setCoins] = useState<CoinToss>([false, false, false]);
  const [spin, setSpin] = useState(0);
  const [busy, setBusy] = useState(false);
  const [castAt, setCastAt] = useState<Date | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  const result: CastResult | null = useMemo(() => {
    if (values.length !== 6 || !castAt) return null;
    return cast(values, castAt, { question: question.trim() || undefined });
  }, [values, castAt, question]);

  useEffect(() => {
    if (stage !== "toss" || !result) return;
    const id = window.setTimeout(() => {
      setStage("result");
      const item: HistoryItem = {
        id: castAt!.getTime().toString(36),
        question: question.trim(),
        values,
        at: castAt!.toISOString(),
      };
      setHistory((h) => {
        const next = [item, ...h.filter((x) => x.id !== item.id)];
        saveHistory(next);
        return next;
      });
    }, 700);
    return () => window.clearTimeout(id);
  }, [stage, result, castAt, question, values]);

  function begin() {
    setValues([]);
    setSpin(0);
    setCastAt(new Date());
    setStage("toss");
  }

  function toss() {
    if (busy || values.length >= 6) return;
    const { coins: faces, value } = tossLine();
    setBusy(true);
    setCoins(faces);
    setSpin((s) => s + 1);
    timer.current = window.setTimeout(() => {
      setValues((v) => [...v, value]);
      setBusy(false);
    }, TOSS_MS);
  }

  function reopen(item: HistoryItem) {
    setQuestion(item.question);
    setValues(item.values);
    setCastAt(new Date(item.at));
    setStage("result");
  }

  function reset() {
    setQuestion("");
    setValues([]);
    setCastAt(null);
    setStage("ask");
  }

  return (
    <div className="flex flex-1 flex-col gap-8">
      <header className="flex items-baseline justify-between">
        <h1 className="font-display text-xl font-bold tracking-[0.3em] text-brass">赛博六爻</h1>
        {stage !== "ask" && (
          <button onClick={reset} className="text-sm text-bone-dim hover:text-bone">
            再问一卦
          </button>
        )}
      </header>

      {stage === "ask" && (
        <AskStage question={question} setQuestion={setQuestion} onBegin={begin} history={history} onReopen={reopen} />
      )}

      {stage === "toss" && (
        <TossStage question={question} values={values} coins={coins} spin={spin} busy={busy} onToss={toss} />
      )}

      {stage === "result" && result && <HexagramChart result={result} />}
    </div>
  );
}

function AskStage({
  question,
  setQuestion,
  onBegin,
  history,
  onReopen,
}: {
  question: string;
  setQuestion: (q: string) => void;
  onBegin: () => void;
  history: HistoryItem[];
  onReopen: (item: HistoryItem) => void;
}) {
  return (
    <div className="flex flex-col gap-10">
      <form
        className="flex flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          onBegin();
        }}
      >
        <div className="flex flex-col gap-2">
          <h2 className="font-display text-3xl font-medium leading-snug">
            心中默念所问之事，
            <br />
            一事一问。
          </h2>
          <p className="text-sm text-bone-dim">写下来也可以，不写也行。问题会和卦一起留在这台设备上。</p>
        </div>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="例：下个月换工作，顺利吗？"
          rows={3}
          className="w-full resize-none rounded-lg border border-ink-3 bg-ink-2 px-4 py-3 text-base leading-relaxed placeholder:text-bone-dim/60"
        />
        <button
          type="submit"
          className="self-start rounded-md bg-brass px-6 py-3 font-display text-base font-bold text-ink transition hover:bg-brass-pale"
        >
          开始摇卦
        </button>
      </form>

      {history.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="text-xs tracking-[0.2em] text-bone-dim">之前的卦</h3>
          <ul className="flex flex-col divide-y divide-ink-3 border-y border-ink-3">
            {history.slice(0, 8).map((item) => {
              const r = cast(item.values, new Date(item.at));
              return (
                <li key={item.id}>
                  <button onClick={() => onReopen(item)} className="flex w-full items-baseline justify-between gap-4 py-3 text-left hover:text-brass">
                    <span className="truncate text-sm">{item.question || <span className="text-bone-dim">（未写问题）</span>}</span>
                    <span className="shrink-0 font-display text-sm">
                      {r.original.info.name}
                      {r.changed && <span className="text-bone-dim"> 之 {r.changed.info.name}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

function TossStage({
  question,
  values,
  coins,
  spin,
  busy,
  onToss,
}: {
  question: string;
  values: LineValue[];
  coins: CoinToss;
  spin: number;
  busy: boolean;
  onToss: () => void;
}) {
  const done = values.length >= 6;
  const n = values.length + 1;
  return (
    <div className="flex flex-1 flex-col items-center gap-10">
      {question.trim() && <p className="max-w-prose text-center text-sm text-bone-dim">{question}</p>}

      <button
        onClick={onToss}
        disabled={busy || done}
        aria-label={done ? "已摇满六爻" : `摇第${n}次`}
        className="group flex flex-col items-center gap-6 rounded-xl px-6 py-4 disabled:cursor-default"
      >
        <div className="flex items-end gap-4 sm:gap-6">
          {coins.map((back, i) => (
            <Coin key={i} back={back} spin={spin} delay={i * 90} hopping={busy} />
          ))}
        </div>
        <span className="font-display text-lg text-brass transition group-enabled:group-hover:text-brass-pale">
          {done ? "六爻已成" : busy ? "…" : `摇第${"一二三四五六"[n - 1]}次`}
        </span>
      </button>

      <ol className="flex flex-col-reverse gap-3" aria-label="已成之爻">
        {Array.from({ length: 6 }, (_, i) => {
          const v = values[i];
          return (
            <li key={i} className="flex h-6 items-center gap-4">
              <span className="w-8 text-right font-mono text-xs text-bone-dim">{"初二三四五上"[i]}</span>
              {v ? (
                <span className="line-enter flex items-center gap-3">
                  <LineBar yang={v === 7 || v === 9} moving={v === 6 || v === 9} />
                  <span className="text-xs text-bone-dim">
                    {VALUE_NAME[v]}
                    {(v === 6 || v === 9) && <span className="ml-1 text-cinnabar">{v === 9 ? "○" : "×"}</span>}
                  </span>
                </span>
              ) : (
                <span className="h-px w-20 bg-ink-3" />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
