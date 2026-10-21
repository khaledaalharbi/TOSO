"use client";

import { Eye, EyeOff, Send, Undo2, Wand2 } from "lucide-react";
import { useState } from "react";
import { agentLabel } from "@/lib/bridge/agents";
import type { OptimizationReport } from "@/lib/types";

type Phase = "draft" | "processing" | "ready";

/** "38 → 24" from a report, or null when either count is missing. */
export function tokenDelta(report: OptimizationReport): string | null {
  const before = report.originalMeasurement?.tokens ?? report.original?.tokens;
  const after = report.english?.analysis.tokens;
  return before !== undefined && after !== undefined
    ? `${before} → ${after}`
    : null;
}

/**
 * One agent's own prompt box, under its terminal — what is written in an
 * agent's tab goes to that agent, so there is no target to pick wrongly.
 *
 * Draft (the user's language) → «معالجة» replaces the draft in place with
 * the concise English polish → «إرسال». The original stays reachable
 * («عرض الأصل», «تراجع») until the text is sent; on send both enter the
 * IN/OUT log. The per-agent «إرسال مباشرة بعد المعالجة» switch makes it a
 * single step. A refused send keeps the text in the box.
 */
export function AgentComposer({
  agent,
  disabled,
  busy,
  agentBusy,
  progress,
  autoSend,
  onAutoSendChange,
  onProcess,
  onSend,
}: {
  agent: string;
  /** Settings not hydrated yet. */
  disabled: boolean;
  /** An analysis is already running (one at a time, any tab). */
  busy: boolean;
  /** This agent is still working on a previous turn. */
  agentBusy: boolean;
  /** Live label of the running analysis step. */
  progress: string | null;
  autoSend: boolean;
  onAutoSendChange: (on: boolean) => void;
  onProcess: (text: string) => Promise<OptimizationReport | null>;
  /** Fires the send; false = refused (the reason is shown in the tab). */
  onSend: (english: string, original: string) => boolean;
}) {
  const label = agentLabel(agent);
  const [phase, setPhase] = useState<Phase>("draft");
  const [text, setText] = useState("");
  const [original, setOriginal] = useState("");
  const [showOriginal, setShowOriginal] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  function clear(message: string) {
    setPhase("draft");
    setText("");
    setOriginal("");
    setShowOriginal(false);
    setStatus(message);
  }

  async function process() {
    const draft = text.trim();
    if (!draft || busy || disabled) return;
    setPhase("processing");
    setStatus(null);
    const report = await onProcess(draft);
    if (!report) {
      setPhase("draft");
      setStatus("تعذّرت المعالجة — النص كما هو، أعد المحاولة.");
      return;
    }
    const english = report.english?.text.trim();
    const delta = tokenDelta(report);
    if (!english) {
      setPhase("draft");
      setStatus(
        "لا توجد نسخة إنجليزية لهذا التحليل (الوضع المحلي أو حجبها فحص السلامة) — الوكلاء يستقبلون الإنجليزية فقط.",
      );
      return;
    }
    if (autoSend) {
      if (onSend(english, draft)) {
        clear(
          `عولج وأُرسل مباشرة إلى ${label}${delta ? ` — ${delta} توكن` : ""}.`,
        );
        return;
      }
      // Refused (e.g. folder not checked): fall through to the ready state
      // so nothing typed or paid for is lost.
    }
    setOriginal(draft);
    setText(english);
    setPhase("ready");
    setStatus(
      `جاهز${delta ? `: ${delta} توكن` : ""}. راجع الإنجليزية أو عدّلها ثم أرسل.`,
    );
  }

  function send() {
    const english = text.trim();
    if (!english || agentBusy) return;
    if (onSend(english, original || english)) {
      clear(`أُرسل إلى ${label} — الأصل والإنجليزية في سجل IN / OUT.`);
    }
  }

  function undo() {
    setText(original);
    setOriginal("");
    setShowOriginal(false);
    setPhase("draft");
    setStatus("عاد نصك الأصلي — عدّله ثم عالجه من جديد.");
  }

  const ready = phase === "ready";
  const processing = phase === "processing";
  const statusLine = processing ? (progress ?? "يعالج…") : status;
  return (
    <section
      aria-label={`مدخل ${label}`}
      className="border-x border-b border-ink bg-white p-4"
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="bg-ink px-2 py-0.5 text-xs font-bold text-white">
          مدخل {label}
        </span>
        <span
          className={`border px-2 py-0.5 text-[11px] font-bold ${
            ready
              ? "border-emerald-500 bg-emerald-50 text-emerald-800"
              : "border-amber-400 bg-amber-50 text-amber-800"
          }`}
        >
          {ready ? "جاهز — English" : "مسودة — بلغتك"}
        </span>
        <label className="ms-auto flex cursor-pointer items-center gap-1.5 text-xs font-bold text-slate-700">
          <input
            type="checkbox"
            checked={autoSend}
            disabled={phase !== "draft"}
            onChange={(event) => onAutoSendChange(event.target.checked)}
            className="h-3.5 w-3.5 accent-brand-600"
          />
          إرسال مباشرة بعد المعالجة
        </label>
      </div>
      <textarea
        id={`composer-${agent}`}
        name={`composer-${agent}`}
        aria-label={`تلقينة ${label}`}
        dir={ready ? "ltr" : "auto"}
        value={text}
        disabled={disabled || processing}
        onChange={(event) => setText(event.target.value)}
        placeholder={`اكتب تلقينتك لـ ${label} بلغتك هنا`}
        className="min-h-28 w-full resize-y border border-slate-300 bg-slate-50/60 p-3 text-sm leading-7 outline-none transition placeholder:text-slate-400 focus:border-brand-500 disabled:opacity-60"
      />
      {showOriginal && original ? (
        <p className="mt-1.5 border border-slate-300 bg-slate-50 p-2 text-xs leading-6 text-slate-600">
          <b>الأصل:</b> {original}
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {ready ? (
          <>
            <button
              type="button"
              onClick={send}
              disabled={agentBusy || !text.trim()}
              title={
                agentBusy ? `${label} ما زال يعمل على دورة سابقة` : undefined
              }
              className="flex items-center gap-1.5 border border-ink bg-brand-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send size={15} /> إرسال إلى {label}
            </button>
            <button
              type="button"
              onClick={() => setShowOriginal((v) => !v)}
              className="flex items-center gap-1.5 border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-ink"
            >
              {showOriginal ? <EyeOff size={14} /> : <Eye size={14} />}
              {showOriginal ? "إخفاء الأصل" : "عرض الأصل"}
            </button>
            <button
              type="button"
              onClick={undo}
              className="flex items-center gap-1.5 border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-ink"
            >
              <Undo2 size={14} /> تراجع
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => void process()}
            disabled={disabled || busy || processing || !text.trim()}
            className="flex items-center gap-1.5 border border-ink bg-brand-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Wand2 size={15} />
            {processing
              ? "يعالج…"
              : autoSend
                ? `معالجة وإرسال إلى ${label}`
                : "معالجة"}
          </button>
        )}
      </div>
      {statusLine ? (
        <p
          role="status"
          className="mt-2 border-t border-slate-200 pt-1.5 text-xs text-slate-600"
        >
          {statusLine}
        </p>
      ) : null}
    </section>
  );
}
