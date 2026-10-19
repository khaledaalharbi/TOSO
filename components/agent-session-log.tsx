"use client";

import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ChevronsLeftRight,
  ChevronsRightLeft,
  Languages,
  Trash2,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { agentLabel } from "@/lib/bridge/agents";

/** One numbered round trip: what crossed the wire, and its user-language side. */
export interface AgentTurn {
  n: number;
  jobId: string;
  /** The user's own text (their language) that produced this send. */
  inputUser: string;
  /** What actually reached the agent (the polished, usually English, text). */
  inputWire: string;
  /** The agent's reply after cleanup (or its failure message). */
  outputWire: string;
  /** Everything the turn changed on screen — kept for inspection. */
  outputRaw?: string;
  /** Who produced `outputWire` from the capture. */
  cleanedBy?: "local" | "gemini" | "headless";
  /** Arabic translation of `outputWire`, once available. */
  outputUser?: string;
  /** Why a translation attempt failed — shown instead of inventing one. */
  translateError?: string;
  /** running → still capturing; done; error. */
  status: string;
}

export type AgentLog = Record<string, AgentTurn[]>;

/** Appends a turn to one agent's log with the next number for that agent. */
export function appendTurn(
  log: AgentLog,
  agent: string,
  turn: Omit<AgentTurn, "n">,
): AgentLog {
  const turns = log[agent] ?? [];
  return { ...log, [agent]: [...turns, { ...turn, n: turns.length + 1 }] };
}

/** Tab-scoped storage key: survives reloads, dies with the tab/browser. */
export const AGENT_LOG_SESSION = "toso.agentLog";

/**
 * Restores a log saved in sessionStorage. Malformed data becomes `{}`; a turn
 * that was still capturing when the page reloaded can never finish (its
 * capture loop died with the page), so it is marked as an honest error.
 */
export function restoreLog(raw: string | null): AgentLog {
  if (!raw) return {};
  try {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object" || Array.isArray(data)) return {};
    const log: AgentLog = {};
    for (const [agent, turns] of Object.entries(data)) {
      if (!Array.isArray(turns)) continue;
      const valid = turns.filter(
        (t): t is AgentTurn =>
          t &&
          typeof t === "object" &&
          typeof t.n === "number" &&
          typeof t.jobId === "string" &&
          typeof t.inputUser === "string" &&
          typeof t.inputWire === "string" &&
          typeof t.outputWire === "string" &&
          typeof t.status === "string",
      );
      if (valid.length) {
        log[agent] = valid.map((t) =>
          t.status === "running"
            ? {
                ...t,
                status: "error",
                outputWire:
                  "انقطع الالتقاط بتحديث الصفحة — الرد في الطرفية أعلاه.",
              }
            : t,
        );
      }
    }
    return log;
  } catch {
    return {};
  }
}

export function patchTurn(
  log: AgentLog,
  agent: string,
  jobId: string,
  patch: Partial<AgentTurn>,
): AgentLog {
  const turns = log[agent];
  if (!turns?.some((t) => t.jobId === jobId)) return log;
  return {
    ...log,
    [agent]: turns.map((t) => (t.jobId === jobId ? { ...t, ...patch } : t)),
  };
}

/** One numbered rectangle per turn — lavender for English, green for Arabic. */
function Entry({
  n,
  lang,
  muted,
  children,
}: {
  n: number;
  lang: "en" | "ar";
  muted?: boolean;
  children: ReactNode;
}) {
  return (
    <li
      dir={lang === "en" ? "ltr" : "rtl"}
      className={`flex gap-2 rounded-lg border px-3 py-2 leading-7 ${
        lang === "en"
          ? "border-[#9673a6]/50 bg-[#e1d5e7] text-left font-mono text-[12.5px]"
          : "border-[#82b366]/60 bg-[#d5e8d4] text-right text-sm"
      } ${muted ? "opacity-60" : ""}`}
    >
      <span className="shrink-0 font-bold tabular-nums text-slate-600">
        {n}.
      </span>
      <div className="min-w-0 flex-1 whitespace-pre-wrap break-words">
        {children}
      </div>
    </li>
  );
}

/** A language column: title on top, scrolling entries, direction at the foot. */
function LangBox({
  lang,
  orderClass,
  empty,
  expanded,
  onToggleExpand,
  fill,
  children,
}: {
  lang: "en" | "ar";
  orderClass: string;
  empty: boolean;
  /** True when this box currently covers the sibling (fold icon shown). */
  expanded?: boolean;
  /** Expand/fold toggle — its button sits at the corner facing the sibling. */
  onToggleExpand?: () => void;
  /** Fill the overlay's height instead of the fixed column height. */
  fill?: boolean;
  children: ReactNode;
}) {
  const en = lang === "en";
  return (
    <div
      dir={en ? "ltr" : "rtl"}
      className={`flex ${fill ? "h-full" : "h-96"} min-w-0 flex-col rounded-2xl border border-slate-400 bg-white ${orderClass}`}
    >
      <div className="relative border-b border-slate-200">
        <p className="py-2 text-center text-sm font-bold text-slate-700">
          {en ? "English" : "العربية"}
        </p>
        {onToggleExpand ? (
          <button
            type="button"
            onClick={onToggleExpand}
            aria-label={
              expanded
                ? "اطوِ إلى عرض العمودين"
                : `وسّع النص ${en ? "الإنجليزي" : "العربي"}`
            }
            title={
              expanded
                ? "اطوِ إلى عرض العمودين"
                : `وسّع هذا الصندوق فوق ${en ? "العربية" : "الإنجليزية"}`
            }
            className={`absolute top-1/2 -translate-y-1/2 rounded p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-ink ${en ? "right-2" : "left-2"}`}
          >
            {expanded ? (
              <ChevronsRightLeft size={16} />
            ) : (
              <ChevronsLeftRight size={16} />
            )}
          </button>
        ) : null}
      </div>
      <ol className="flex flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden p-3">
        {empty ? (
          <li className="rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-xs text-slate-400">
            {en ? "Turns appear here, numbered." : "تظهر الدورات هنا مرقّمة."}
          </li>
        ) : (
          children
        )}
      </ol>
      <p className="border-t border-slate-200 py-1.5 text-center text-[11px] text-slate-500">
        {en ? "Left-to-Right" : "من اليمين إلى اليسار"}
      </p>
    </div>
  );
}

/**
 * The tab's conversation below its terminal: IN (what you sent) and OUT
 * (what the agent answered). English sits left, Arabic right, and the arrow
 * between them shows which way the translation went — Arabic → English on
 * IN, English → Arabic on OUT. Every turn is its own numbered rectangle.
 * Kept in sessionStorage — survives a reload (like the live terminal), gone
 * when the tab or browser closes.
 */
export function AgentTranscript({
  agent,
  turns,
  translatingJobs,
  autoTranslate,
  onTranslate,
  onClear,
  onClearAll,
}: {
  agent: string;
  turns: AgentTurn[];
  translatingJobs: ReadonlySet<string>;
  /** Auto mode notes that a translation is on its way instead of nagging. */
  autoTranslate?: boolean;
  onTranslate: (jobId: string) => void;
  onClear: () => void;
  /** Offered only when other agents also have turns to clear. */
  onClearAll?: () => void;
}) {
  const [side, setSide] = useState<"in" | "out">("in");
  /** Which language box currently covers its sibling (null = split view). */
  const [expanded, setExpanded] = useState<"en" | "ar" | null>(null);
  const isIn = side === "in";
  const empty = turns.length === 0;

  const enEntries = turns.map((t) =>
    isIn ? (
      <Entry key={t.jobId} n={t.n} lang="en">
        {t.inputWire}
      </Entry>
    ) : t.status === "running" ? (
      <Entry key={t.jobId} n={t.n} lang="en" muted>
        waiting for the agent…
      </Entry>
    ) : (
      <Entry key={t.jobId} n={t.n} lang="en">
        <span className={t.status === "done" ? "" : "text-amber-800"}>
          {t.outputWire || "—"}
        </span>
        {t.cleanedBy && (
          <span className="block font-sans text-[10px] text-slate-500">
            {t.cleanedBy === "gemini"
              ? "cleaned by Gemini"
              : t.cleanedBy === "local"
                ? "extracted from the terminal"
                : "one-shot run"}
          </span>
        )}
        {t.outputRaw && t.outputRaw !== t.outputWire && (
          <details className="font-sans text-[11px] text-slate-600">
            <summary className="cursor-pointer">raw capture</summary>
            <pre className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap rounded bg-white/70 p-2 font-mono text-[11px]">
              {t.outputRaw}
            </pre>
          </details>
        )}
      </Entry>
    ),
  );
  const arEntries = turns.map((t) =>
    isIn ? (
      <Entry key={t.jobId} n={t.n} lang="ar">
        {t.inputUser}
      </Entry>
    ) : t.outputUser ? (
      <Entry key={t.jobId} n={t.n} lang="ar">
        {t.outputUser}
      </Entry>
    ) : t.status === "running" ? (
      <Entry key={t.jobId} n={t.n} lang="ar" muted>
        بانتظار رد الوكيل…
      </Entry>
    ) : t.status === "done" && t.outputWire.trim() ? (
      <Entry
        key={t.jobId}
        n={t.n}
        lang="ar"
        muted={translatingJobs.has(t.jobId)}
      >
        {translatingJobs.has(t.jobId) ? (
          "تُترجم…"
        ) : (
          <>
            <button
              type="button"
              onClick={() => onTranslate(t.jobId)}
              className="inline-flex items-center gap-1 rounded border border-[#82b366] bg-white px-2 py-0.5 text-[11px] font-bold text-emerald-800 hover:bg-emerald-50"
            >
              <Languages size={12} />
              {t.translateError ? "أعد الترجمة" : "ترجمة"}
            </button>
            {t.translateError ? (
              <span className="ms-1.5 text-[11px] text-amber-800">
                تعذّرت الترجمة ({t.translateError})
              </span>
            ) : autoTranslate ? (
              <span className="ms-1.5 text-[11px] text-slate-500">
                الترجمة التلقائية في الطريق
              </span>
            ) : null}
          </>
        )}
      </Entry>
    ) : (
      <Entry key={t.jobId} n={t.n} lang="ar" muted>
        —
      </Entry>
    ),
  );

  return (
    <section className="mt-4" dir="ltr">
      <div className="flex flex-wrap items-end gap-1.5">
        {(["in", "out"] as const).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={side === key}
            onClick={() => setSide(key)}
            title={key === "in" ? "ما أرسلته إلى الوكيل" : "ما ردّ به الوكيل"}
            className={`rounded-t-lg border border-b-0 px-6 py-2 text-xs font-bold ${
              side === key
                ? "border-amber-300 bg-amber-100 text-amber-900"
                : "border-slate-300 bg-slate-100 text-slate-500 hover:text-slate-800"
            }`}
          >
            {key === "in" ? "IN" : "OUT"}
          </button>
        ))}
        <span dir="rtl" className="ms-3 pb-2 text-[11px] text-slate-500">
          {empty
            ? `لا دورات بعد مع ${agentLabel(agent)}`
            : `${turns.length} ${turns.length === 1 ? "دورة" : "دورات"} مع ${agentLabel(agent)} — تُمحى بإغلاق المتصفح`}
        </span>
        {!empty && (
          <div dir="rtl" className="ms-auto flex gap-1.5 pb-1.5">
            <button
              type="button"
              onClick={onClear}
              className="flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-bold text-slate-600 hover:border-ink"
            >
              <Trash2 size={12} /> مسح {agentLabel(agent)}
            </button>
            {onClearAll && (
              <button
                type="button"
                onClick={onClearAll}
                className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-bold text-rose-600 hover:border-rose-500"
              >
                مسح الكل
              </button>
            )}
          </div>
        )}
      </div>
      <div className="relative flex flex-col gap-3 rounded-b-lg rounded-tr-lg border border-amber-300 bg-amber-50 p-4 md:grid md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center">
        <LangBox
          lang="en"
          empty={empty}
          orderClass={isIn ? "order-3 md:order-1" : "order-1"}
          expanded={expanded === "en"}
          onToggleExpand={() => setExpanded((v) => (v === "en" ? null : "en"))}
        >
          {enEntries}
        </LangBox>

        <div
          className="order-2 flex justify-center text-slate-700"
          role="img"
          aria-label={
            isIn
              ? "ترجمة من العربية إلى الإنجليزية"
              : "ترجمة من الإنجليزية إلى العربية"
          }
          title={isIn ? "العربية ← الإنجليزية" : "الإنجليزية ← العربية"}
        >
          {/* Stacked (mobile): flow runs top → bottom. Side by side: the arrow
              points from the source column to the target column. */}
          <ArrowDown size={22} className="md:hidden" />
          {isIn ? (
            <ArrowLeft size={22} className="hidden md:block" />
          ) : (
            <ArrowRight size={22} className="hidden md:block" />
          )}
        </div>

        <LangBox
          lang="ar"
          empty={empty}
          orderClass={isIn ? "order-1 md:order-3" : "order-3"}
          expanded={expanded === "ar"}
          onToggleExpand={() => setExpanded((v) => (v === "ar" ? null : "ar"))}
        >
          {arEntries}
        </LangBox>

        {expanded ? (
          <div className="absolute inset-0 z-10 p-4" dir="ltr">
            <LangBox
              lang={expanded}
              empty={empty}
              orderClass=""
              expanded
              fill
              onToggleExpand={() => setExpanded(null)}
            >
              {expanded === "en" ? enEntries : arEntries}
            </LangBox>
          </div>
        ) : null}
      </div>
    </section>
  );
}
