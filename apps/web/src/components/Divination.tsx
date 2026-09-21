"use client";

import { cast, tossLine, type CastResult, type CoinToss, type LineValue } from "@liuyao/core";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { buzz, chime, clink, ensureAudio, isMuted, land, rare, setMuted } from "@/lib/audio";
import { CoinTray, type CoinTrayHandle } from "./CoinTray";
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
const ORDINAL = "一二三四五六";

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
  const [castAt, setCastAt] = useState<Date | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [muted, setMutedState] = useState(false);

  // 服务端渲染没有 localStorage，挂载后再读，避免 hydration 不一致
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHistory(loadHistory());
    setMutedState(isMuted());
  }, []);

  const result: CastResult | null = useMemo(() => {
    if (values.length !== 6 || !castAt) return null;
    return cast(values, castAt, { question: question.trim() || undefined });
  }, [values, castAt, question]);

  // 第六爻落定后停一拍，再揭示
  useEffect(() => {
    if (stage !== "toss" || !result) return;
    const id = window.setTimeout(() => {
      chime();
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
    }, 1100);
    return () => window.clearTimeout(id);
  }, [stage, result, castAt, question, values]);

  function begin() {
    setValues([]);
    setCastAt(new Date());
    setStage("toss");
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

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
    if (!next) ensureAudio();
  }

  return (
    <div className="flex flex-1 flex-col gap-8">
      <header className="flex items-baseline justify-between">
        <h1 className="font-display text-xl font-bold tracking-[0.3em] text-brass">赛博六爻</h1>
        <div className="flex items-baseline gap-4 text-sm text-bone-dim">
          <button onClick={toggleMute} aria-pressed={muted} className="hover:text-bone">
            {muted ? "声音 关" : "声音 开"}
          </button>
          <Link href="/sound" className="hover:text-bone">
            音色
          </Link>
          {stage !== "ask" && (
            <button onClick={reset} className="hover:text-bone">
              再问一卦
            </button>
          )}
        </div>
      </header>

      {stage === "ask" && (
        <AskStage question={question} setQuestion={setQuestion} onBegin={begin} history={history} onReopen={reopen} />
      )}

      {stage === "toss" && (
        <TossStage question={question} values={values} onLine={(v) => setValues((prev) => [...prev, v])} />
      )}

      {stage === "result" && result && <HexagramChart key={castAt?.getTime()} result={result} />}
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
          ensureAudio();
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

type Phase = "idle" | "holding" | "flying" | "landed";

function TossStage({ question, values, onLine }: { question: string; values: LineValue[]; onLine: (v: LineValue) => void }) {
  const tray = useRef<CoinTrayHandle>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [last, setLast] = useState<{ coins: CoinToss; value: LineValue } | null>(null);

  const holding = useRef(false);
  const intensity = useRef(0);
  const lastPointer = useRef({ x: 0, y: 0, t: 0 });
  const lastClink = useRef(0);
  const raf = useRef<number | null>(null);

  const done = values.length >= 6;
  const n = values.length + 1;

  useEffect(() => () => {
    if (raf.current) cancelAnimationFrame(raf.current);
  }, []);

  function loop() {
    tray.current?.shake(intensity.current);
    intensity.current *= 0.9;
    raf.current = requestAnimationFrame(loop);
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (phase === "flying" || done) return;
    ensureAudio();
    holding.current = true;
    intensity.current = 0;
    lastPointer.current = { x: e.clientX, y: e.clientY, t: performance.now() };
    e.currentTarget.setPointerCapture(e.pointerId);
    setPhase("holding");
    if (!raf.current) raf.current = requestAnimationFrame(loop);
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!holding.current) return;
    const now = performance.now();
    const { x, y, t } = lastPointer.current;
    const dt = Math.max(1, now - t);
    const speed = Math.hypot(e.clientX - x, e.clientY - y) / dt; // px/ms
    intensity.current = Math.min(1, intensity.current * 0.7 + speed * 0.45);
    lastPointer.current = { x: e.clientX, y: e.clientY, t: now };
    if (intensity.current > 0.3 && now - lastClink.current > 70) {
      clink(intensity.current);
      buzz(8);
      lastClink.current = now;
    }
  }

  function onPointerUp() {
    if (!holding.current) return;
    holding.current = false;
    if (raf.current) {
      cancelAnimationFrame(raf.current);
      raf.current = null;
    }
    void throwCoins();
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if ((e.key === "Enter" || e.key === " ") && phase !== "flying" && !done) {
      e.preventDefault();
      ensureAudio();
      void throwCoins();
    }
  }

  async function throwCoins() {
    setPhase("flying");
    setLast(null);
    const toss = tossLine();
    await tray.current?.throwCoins(toss.coins, (i) => {
      land(i);
      buzz(12);
    });
    const moving = toss.value === 6 || toss.value === 9;
    if (moving) {
      tray.current?.burst();
      rare();
      buzz([40, 50, 90]);
    }
    setLast(toss);
    setPhase("landed");
    onLine(toss.value);
  }

  const hint = (() => {
    if (done) return "六爻已成";
    if (phase === "holding") return "……";
    if (phase === "flying") return "";
    if (phase === "landed" && last) return `第${ORDINAL[n - 2]}爻已定，再摇第${ORDINAL[n - 1]}次`;
    return `按住铜钱晃一晃，松手掷出 · 第${ORDINAL[n - 1]}次`;
  })();

  return (
    <div className="flex flex-1 flex-col items-center gap-8">
      {question.trim() && <p className="max-w-prose text-center text-sm text-bone-dim">{question}</p>}

      <div
        role="button"
        tabIndex={0}
        aria-label={done ? "六爻已成" : `摇第${ORDINAL[n - 1]}次，按住晃动后松开`}
        aria-disabled={done || phase === "flying"}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        className={`flex select-none flex-col items-center gap-2 rounded-xl px-4 py-2 outline-none touch-none ${
          done || phase === "flying" ? "cursor-default" : "cursor-grab active:cursor-grabbing"
        }`}
      >
        <CoinTray ref={tray} />
        <div className="flex h-12 flex-col items-center justify-center gap-1">
          {last && phase === "landed" && (
            <span className="line-enter font-mono text-sm tracking-widest text-brass">
              {last.coins.map((b) => (b ? "背" : "字")).join(" · ")}
              <span className="text-bone-dim"> → </span>
              <span className={last.value === 6 || last.value === 9 ? "text-cinnabar" : ""}>{VALUE_NAME[last.value]}</span>
            </span>
          )}
          <span className="text-sm text-bone-dim">{hint}</span>
        </div>
      </div>

      <ol className="flex flex-col-reverse gap-3" aria-label="已成之爻">
        {Array.from({ length: 6 }, (_, i) => {
          const v = values[i];
          const moving = v === 6 || v === 9;
          return (
            <li key={i} className="flex h-6 items-center gap-4">
              <span className="w-8 text-right font-mono text-xs text-bone-dim">{"初二三四五上"[i]}</span>
              {v ? (
                <span className={`line-enter flex items-center gap-3 ${moving ? "line-rare" : ""}`}>
                  <LineBar yang={v === 7 || v === 9} moving={moving} />
                  <span className="text-xs text-bone-dim">
                    {VALUE_NAME[v]}
                    {moving && <span className="ml-1 text-cinnabar">{v === 9 ? "○" : "×"}</span>}
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
