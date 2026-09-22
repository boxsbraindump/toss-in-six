"use client";

import { cast, tossLine, type CastResult, type CoinToss, type LineValue } from "@liuyao/core";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { buzz, chime, ensureAudio, isMuted, rare, setMuted, settle, startShake, type ShakeHandle } from "@/lib/audio";
import { CoinTray, type CoinTrayHandle, type Wood } from "./CoinTray";
import { HexagramChart } from "./HexagramChart";

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
  const [wood, setWood] = useState<Wood>("worn");

  // 服务端渲染没有 localStorage，挂载后再读，避免 hydration 不一致
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHistory(loadHistory());
    setMutedState(isMuted());
    try {
      if (localStorage.getItem("liuyao:wood") === "dark") setWood("dark");
    } catch {
      /* ignore */
    }
  }, []);

  function toggleWood() {
    const next: Wood = wood === "worn" ? "dark" : "worn";
    setWood(next);
    try {
      localStorage.setItem("liuyao:wood", next);
    } catch {
      /* ignore */
    }
  }

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
      {/* 摇卦时头部退到后面，别和仪式抢 */}
      <header className={`relative z-10 flex items-baseline justify-between transition-opacity ${stage === "toss" ? "opacity-40 hover:opacity-100" : ""}`}>
        <h1 className="flex items-baseline gap-3">
          <span className="font-display text-xl font-bold tracking-[0.3em] text-brass">摇六爻</span>
          <span className="hidden font-mono text-[11px] tracking-[0.2em] text-bone-dim sm:inline">TOSS IN SIX</span>
        </h1>
        {stage !== "ask" && (
          <button onClick={reset} className="text-sm text-bone-dim hover:text-bone">
            再问一卦
          </button>
        )}
      </header>

      {stage === "ask" && (
        <AskStage
          question={question}
          setQuestion={setQuestion}
          onBegin={begin}
          history={history}
          onReopen={reopen}
          settings={{ muted, toggleMute, wood, toggleWood }}
        />
      )}

      {stage === "toss" && (
        <TossStage question={question} values={values} wood={wood} onLine={(v) => setValues((prev) => [...prev, v])} />
      )}

      {stage === "result" && result && (
        <>
          {/* 桌子还在：结果页底下压一层很暗的木纹 */}
          <div className="wood-bg pointer-events-none fixed inset-0 -z-10" data-wood={wood} aria-hidden />
          <HexagramChart key={castAt?.getTime()} result={result} />
        </>
      )}
    </div>
  );
}

function whenText(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function AskStage({
  question,
  setQuestion,
  onBegin,
  history,
  onReopen,
  settings,
}: {
  question: string;
  setQuestion: (q: string) => void;
  onBegin: () => void;
  history: HistoryItem[];
  onReopen: (item: HistoryItem) => void;
  settings: { muted: boolean; toggleMute: () => void; wood: Wood; toggleWood: () => void };
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
            {history.slice(0, 5).map((item) => {
              const r = cast(item.values, new Date(item.at));
              return (
                <li key={item.id}>
                  <button onClick={() => onReopen(item)} className="flex w-full items-baseline justify-between gap-4 py-3 text-left hover:text-brass">
                    <span className="shrink-0 font-display text-sm">
                      {r.original.info.name}
                      {r.changed && <span className="text-bone-dim"> 之 {r.changed.info.name}</span>}
                    </span>
                    <span className="truncate text-sm text-bone-dim">{item.question || whenText(item.at)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <footer className="flex flex-wrap items-baseline gap-x-4 gap-y-1 pt-6 text-xs text-bone-dim">
        <button onClick={settings.toggleMute} aria-pressed={settings.muted} className="hover:text-bone">
          声音 {settings.muted ? "关" : "开"}
        </button>
        <button onClick={settings.toggleWood} className="hover:text-bone">
          桌面 {settings.wood === "worn" ? "老桌" : "深纹"}
        </button>
        <Link href="/sound" className="hover:text-bone">
          采样库
        </Link>
      </footer>
    </div>
  );
}

type Phase = "idle" | "holding" | "flying" | "landed";

function TossStage({ question, values, wood, onLine }: { question: string; values: LineValue[]; wood: Wood; onLine: (v: LineValue) => void }) {
  const tray = useRef<CoinTrayHandle>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [last, setLast] = useState<{ coins: CoinToss; value: LineValue } | null>(null);

  const holding = useRef(false);
  const intensity = useRef(0);
  const lastPointer = useRef({ x: 0, y: 0, t: 0 });
  const lastBuzz = useRef(0);
  const shake = useRef<ShakeHandle | null>(null);
  const raf = useRef<number | null>(null);

  const done = values.length >= 6;
  const n = values.length + 1;

  useEffect(() => () => {
    if (raf.current) cancelAnimationFrame(raf.current);
  }, []);

  function loop() {
    tray.current?.shake(intensity.current);
    shake.current?.setIntensity(intensity.current);
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
    tray.current?.pickUp();
    shake.current = startShake();
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
    if (intensity.current > 0.3 && now - lastBuzz.current > 70) {
      buzz(8);
      lastBuzz.current = now;
    }
  }

  function onPointerUp() {
    if (!holding.current) return;
    holding.current = false;
    shake.current?.stop();
    shake.current = null;
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
    const moving = toss.value === 6 || toss.value === 9;
    await tray.current?.throwCoins(toss.coins, {
      rate: moving ? 0.88 : undefined,
      onLand: (i) => {
        buzz(12);
        // 最后一枚偶尔转着落定
        if (i === 2 && Math.random() < 0.3) settle();
      },
    });
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
    if (phase === "landed" && last) return `第${ORDINAL[n - 1]}次`;
    return values.length === 0 ? "按住铜钱晃一晃，松手掷出" : `第${ORDINAL[n - 1]}次`;
  })();

  return (
    <>
      {/* 沉浸式：整块屏幕就是桌面，按住任何地方都能晃 */}
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
        className={`fixed inset-0 z-0 select-none outline-none touch-none ${
          done || phase === "flying" ? "cursor-default" : "cursor-grab active:cursor-grabbing"
        }`}
      >
        <CoinTray ref={tray} fill wood={wood} />
      </div>

      {/* 落定后桌面中央浮出这一爻，停一下再淡出 */}
      {last && phase === "landed" && (
        <div key={values.length} className="yao-pop pointer-events-none fixed inset-0 z-10 flex flex-col items-center justify-center gap-4 pb-[28vh]" aria-hidden>
          <span className={`font-display text-6xl font-bold tracking-[0.4em] pl-[0.4em] drop-shadow-[0_2px_18px_rgba(0,0,0,0.9)] ${
            last.value === 6 || last.value === 9 ? "text-cinnabar" : "text-brass-pale"
          }`}>
            {VALUE_NAME[last.value]}
          </span>
          <span className={`flex h-2.5 w-24 gap-[18%] ${last.value === 6 || last.value === 9 ? "[&>span]:bg-cinnabar" : "[&>span]:bg-brass"}`}>
            {last.value === 7 || last.value === 9 ? <span className="flex-1 rounded-[1px]" /> : (
              <>
                <span className="flex-1 rounded-[1px]" />
                <span className="flex-1 rounded-[1px]" />
              </>
            )}
          </span>
        </div>
      )}

      {/* 底部只留一行字和六个点 */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-10 flex flex-col items-center gap-3 px-6 pb-10 pt-16 bg-gradient-to-t from-ink/90 to-transparent">
        {question.trim() && <p className="max-w-prose text-center text-xs text-bone-dim/80">{question}</p>}
        <div className="flex h-7 items-center">
          {last && phase === "landed" ? (
            <span className="line-enter font-mono text-sm tracking-widest text-brass">
              {last.coins.map((b) => (b ? "背" : "字")).join(" · ")}
              <span className="text-bone-dim"> → </span>
              <span className={last.value === 6 || last.value === 9 ? "text-cinnabar" : ""}>{VALUE_NAME[last.value]}</span>
            </span>
          ) : (
            <span className="text-sm text-bone-dim">{hint}</span>
          )}
        </div>
        {/* 六个记号：未摇的是点，摇出的变成小爻符（一横 = 阳，两短横 = 阴，动爻朱砂） */}
        <ol className="flex items-center gap-3" aria-label="已成之爻">
          {Array.from({ length: 6 }, (_, i) => {
            const v = values[i];
            const moving = v === 6 || v === 9;
            const yang = v === 7 || v === 9;
            const color = moving ? "bg-cinnabar shadow-[0_0_6px_rgba(210,74,50,0.9)]" : "bg-brass";
            return (
              <li key={i} className="flex h-2 w-4 items-center justify-center gap-[3px]" aria-label={v ? VALUE_NAME[v] : "未摇"}>
                {!v ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-bone-dim/30" />
                ) : yang ? (
                  <span className={`line-enter h-[3px] w-4 rounded-[1px] ${color}`} />
                ) : (
                  <>
                    <span className={`line-enter h-[3px] flex-1 rounded-[1px] ${color}`} />
                    <span className={`line-enter h-[3px] flex-1 rounded-[1px] ${color}`} />
                  </>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </>
  );
}
