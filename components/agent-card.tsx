"use client";

import {
  FolderOpen,
  Languages,
  Send,
  ShieldCheck,
  TerminalSquare,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { agentLabel } from "@/lib/bridge/agents";
import type { AgentJob } from "@/lib/services/agent-service";
import { useI18n } from "@/components/i18n-provider";
import { tx } from "@/lib/i18n";

export type AgentRunPhase =
  "connecting" | "running" | "done" | "error" | "offline";

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
  connecting: tx("يفحص الجسر…"),
  running: tx("الوكيل يعمل…"),
  done: tx("اكتمل"),
  error: tx("فشل"),
  offline: tx("الجسر غير متصل"),
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
  const { t, lang } = useI18n();
  const output = run.job?.output ?? "";
  const showTranslate =
    lang === "ar" &&
    run.phase === "done" &&
    output.trim() !== "" &&
    translation === null;
  const live = run.phase === "running";
  const outputBox = useRef<HTMLDivElement>(null);
  // While the agent runs, keep the newest output in view (the bridge's
  // buffer grows on every poll).
  useEffect(() => {
    const el = outputBox.current;
    if (live && el) el.scrollTop = el.scrollHeight;
  }, [live, output.length]);
  return (
    <section className="border border-ink bg-white">
      <div className="h-1 bg-sky-500" />
      <div className="p-5">
        <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
          <span className="flex items-center gap-1.5 bg-sky-100 px-2.5 py-1 text-xs font-bold text-sky-700">
            <TerminalSquare size={14} />
            {agentLabel(run.agent)}
          </span>
          <h3 className="font-bold">{t("نتيجة الوكيل")}</h3>
          <span
            className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold ${phaseTone[run.phase]}`}
          >
            {live && (
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-600" />
            )}
            {t(phaseLabel[run.phase])}
            {live ? t(" · مباشر") : ""}
          </span>
          {run.phase === "done" && run.job?.exitCode !== null && (
            <span
              dir="ltr"
              className="font-mono text-[11px] text-slate-400"
              title={t("رمز خروج العملية")}
            >
              exit {run.job?.exitCode}
            </span>
          )}
        </div>
        {run.job && (
          <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            <span className="flex min-w-0 items-center gap-1.5">
              <FolderOpen size={13} className="shrink-0 text-amber-600" />
              {run.job.cwd ? (
                <code dir="ltr" className="truncate font-mono text-slate-700">
                  {run.job.cwd}
                </code>
              ) : (
                <span>
                  {t("مجلد تشغيل الجسر — لم تُحدَّد مساحة عمل في الإعدادات")}
                </span>
              )}
            </span>
            {run.job.trusted && (
              <span className="flex items-center gap-1 bg-emerald-50 px-1.5 py-0.5 font-bold text-emerald-700">
                <ShieldCheck size={12} /> {t("ثقة لهذه التشغيلة")}
              </span>
            )}
          </div>
        )}

        {run.phase === "offline" || (run.phase === "error" && !run.job) ? (
          <div className="border border-slate-300 bg-slate-50 p-4 text-sm">
            <p className="font-semibold text-slate-700">
              {run.message ?? t("تعذّر الوصول إلى الجسر المحلي.")}
            </p>
            {run.phase === "offline" && (
              <p className="mt-1 text-xs text-slate-500" dir="auto">
                {t("شغّل الجسر بأمر")}{" "}
                <code dir="ltr" className="font-mono">
                  npm run bridge
                </code>{" "}
                {t(
                  "ثم أدخل العنوان والتوكن في الإعدادات — أو انسخ الأمر الجاهز:",
                )}
              </p>
            )}
            <button
              type="button"
              onClick={onCopyFallback}
              className="mt-3 flex items-center gap-1.5 border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-ink hover:text-ink"
            >
              <Send size={13} /> {t("نسخ أمر التشغيل للصقه في الطرفية")}
            </button>
          </div>
        ) : (
          <>
            <div
              ref={outputBox}
              dir="ltr"
              className="max-h-80 min-h-32 overflow-x-hidden overflow-y-auto border border-slate-200 bg-slate-50/60 p-4 text-left text-sm leading-7 whitespace-pre-wrap break-words text-slate-700"
            >
              {output ||
                (run.phase === "done"
                  ? t("أنهى الوكيل دون مخرجات نصية.")
                  : t("تظهر مخرجات الوكيل هنا…"))}
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
                {translating ? t("تُترجم…") : t("ترجمة النتيجة إلى العربية")}
              </button>
            )}

            {translation && (
              <div className="mt-4 border border-emerald-300 bg-emerald-50/50">
                <div className="flex items-center justify-between border-b border-emerald-200 px-4 py-2.5">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                    <Languages size={14} /> {t("الترجمة العربية")}
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
                    {t(
                      "تعذّرت الترجمة عبر Gemini{reason}؛ النتيجة الإنجليزية معروضة أعلاه كما هي — جرّب مفتاحك في الإعدادات.",
                      {
                        reason: translation.fallbackReason
                          ? ` (${translation.fallbackReason})`
                          : "",
                      },
                    )}
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
