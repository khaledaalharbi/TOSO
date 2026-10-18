"use client";

import { Languages, Send, TerminalSquare } from "lucide-react";
import { useState } from "react";
import { agentLabel } from "@/lib/bridge/agents";
import type { AgentJob } from "@/lib/services/agent-service";

export type AgentRunPhase =
  | "connecting"
  | "running"
  | "done"
  | "error"
  | "offline";

export interface AgentRunState {
  agent: string;
  prompt: string;
  phase: AgentRunPhase;
  job?: AgentJob | null;
  /** Human-readable failure — bridge offline, bad token, agent crash… */
  message?: string;
}

export interface AgentTranslation {
  arabic: string | null;
  model?: string;
  fallbackReason?: string;
}

const phaseLabel: Record<AgentRunPhase, string> = {
  connecting: "يفحص الجسر…",
  running: "الوكيل يعمل…",
  done: "اكتمل",
  error: "فشل",
  offline: "الجسر غير متصل",
};

const phaseTone: Record<AgentRunPhase, string> = {
  connecting: "bg-sky-100 text-sky-700",
  running: "bg-amber-100 text-amber-700",
  done: "bg-emerald-100 text-emerald-700",
  error: "bg-rose-100 text-rose-700",
  offline: "bg-slate-200 text-slate-600",
};

/**
 * The CLI-agent leg of the pipeline: shows what was sent, the agent's raw
 * output, and an optional Arabic translation fetched on demand.
 */
export function AgentCard({
  run,
  translation,
  translating,
  onTranslate,
  onCopyFallback,
}: {
  run: AgentRunState;
  translation: AgentTranslation | null;
  translating: boolean;
  onTranslate: () => void;
  /** Copies a ready shell command when the bridge is unreachable. */
  onCopyFallback: () => void;
}) {
  const output = run.job?.output ?? "";
  const showTranslate =
    run.phase === "done" && output.trim() !== "" && translation === null;
  return (
    <section className="border border-ink bg-white">
      <div className="h-1 bg-violet-500" />
      <div className="p-5">
        <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
          <span className="flex items-center gap-1.5 bg-violet-100 px-2.5 py-1 text-xs font-bold text-violet-700">
            <TerminalSquare size={14} />
            {agentLabel(run.agent)}
          </span>
          <h3 className="font-bold">نتيجة الوكيل</h3>
          <span
            className={`px-2.5 py-1 text-[11px] font-bold ${phaseTone[run.phase]}`}
          >
            {phaseLabel[run.phase]}
          </span>
          {run.phase === "done" && run.job?.exitCode !== null && (
            <span
              dir="ltr"
              className="font-mono text-[11px] text-slate-400"
              title="رمز خروج العملية"
            >
              exit {run.job?.exitCode}
            </span>
          )}
        </div>

        {run.phase === "offline" || (run.phase === "error" && !run.job) ? (
          <div className="border border-slate-300 bg-slate-50 p-4 text-sm">
            <p className="font-semibold text-slate-700">
              {run.message ?? "تعذّر الوصول إلى الجسر المحلي."}
            </p>
            {run.phase === "offline" && (
              <p className="mt-1 text-xs text-slate-500" dir="auto">
                شغّل الجسر بأمر{" "}
                <code dir="ltr" className="font-mono">
                  npm run bridge
                </code>{" "}
                ثم أدخل العنوان والتوكن في الإعدادات — أو انسخ الأمر الجاهز:
              </p>
            )}
            <button
              type="button"
              onClick={onCopyFallback}
              className="mt-3 flex items-center gap-1.5 border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-ink hover:text-ink"
            >
              <Send size={13} /> نسخ أمر التشغيل للصقه في الطرفية
            </button>
          </div>
        ) : (
          <>
            <div
              dir="ltr"
              className="max-h-80 min-h-32 overflow-y-auto border border-slate-200 bg-slate-50/60 p-4 text-left text-sm leading-7 whitespace-pre-wrap break-words text-slate-700"
            >
              {output ||
                (run.phase === "done"
                  ? "أنهى الوكيل دون مخرجات نصية."
                  : "تظهر مخرجات الوكيل هنا…")}
            </div>
            {run.job?.error && (
              <p
                role="status"
                className="mt-2 border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800"
                dir="auto"
              >
                {run.job.error}
              </p>
            )}

            {showTranslate && (
              <button
                type="button"
                onClick={onTranslate}
                disabled={translating}
                className="mt-3 flex items-center gap-2 border border-ink bg-brand-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50"
              >
                <Languages size={15} />
                {translating ? "تُترجم…" : "ترجمة النتيجة إلى العربية"}
              </button>
            )}

            {translation && (
              <div className="mt-4 border border-emerald-300 bg-emerald-50/50">
                <div className="flex items-center justify-between border-b border-emerald-200 px-4 py-2.5">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                    <Languages size={14} /> الترجمة العربية
                    {translation.model ? ` · ${translation.model}` : ""}
                  </span>
                </div>
                {translation.arabic ? (
                  <div
                    dir="rtl"
                    className="max-h-72 overflow-y-auto p-4 text-right text-sm leading-8 whitespace-pre-wrap break-words text-slate-700"
                  >
                    {translation.arabic}
                  </div>
                ) : (
                  <p className="p-4 text-xs text-slate-500">
                    تعذّرت الترجمة عبر Gemini
                    {translation.fallbackReason
                      ? ` (${translation.fallbackReason})`
                      : ""}
                    ؛ النتيجة الإنجليزية معروضة أعلاه كما هي — جرّب مفتاحك في
                    الإعدادات.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
