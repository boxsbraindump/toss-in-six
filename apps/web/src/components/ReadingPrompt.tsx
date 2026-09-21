"use client";

import { buildReadingPrompt, type CastResult } from "@liuyao/core";
import { useEffect, useMemo, useState } from "react";

type CopyState = "idle" | "copied" | "failed";

/**
 * 复制粘贴版解卦：把提示词复制出去，贴到任意大模型里。
 */
export function ReadingPrompt({ result }: { result: CastResult }) {
  const prompt = useMemo(() => buildReadingPrompt(result), [result]);
  const [state, setState] = useState<CopyState>("idle");

  useEffect(() => {
    if (state === "idle") return;
    const id = window.setTimeout(() => setState("idle"), 4000);
    return () => window.clearTimeout(id);
  }, [state]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setState("copied");
      return;
    } catch {
      /* 没有剪贴板权限时退回 execCommand */
    }
    const ta = document.createElement("textarea");
    ta.value = prompt;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } finally {
      ta.remove();
    }
    setState(ok ? "copied" : "failed");
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-ink-3 bg-ink-2 p-4">
      <div className="flex flex-col gap-1">
        <h3 className="font-display text-lg font-bold">解卦</h3>
        <p className="text-sm text-bone-dim">
          把卦盘和断卦方法一起复制出去，贴给 Claude 或任何大模型，让它按纳甲六爻的路数来断。
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={copy}
          className="rounded-md bg-brass px-5 py-2.5 font-display text-sm font-bold text-ink transition hover:bg-brass-pale"
        >
          复制解卦提示词
        </button>
        <a
          href="https://claude.ai/new"
          target="_blank"
          rel="noreferrer"
          className="text-sm text-verdigris underline-offset-4 hover:underline"
        >
          打开 Claude ↗
        </a>
        <span className="text-sm text-bone-dim" role="status" aria-live="polite">
          {state === "copied" && "已复制，去粘贴就行。"}
          {state === "failed" && "复制不了，请展开下面的文字手动选中复制。"}
        </span>
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-bone-dim hover:text-bone">看看提示词写了什么</summary>
        <textarea
          readOnly
          value={prompt}
          rows={18}
          onFocus={(e) => e.currentTarget.select()}
          className="mt-3 w-full resize-y rounded-lg border border-ink-3 bg-ink p-4 font-mono text-xs leading-relaxed text-bone"
        />
      </details>
    </section>
  );
}
