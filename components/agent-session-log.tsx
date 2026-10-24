"use client";

import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ChevronsLeftRight,
  ChevronsRightLeft,
  Languages,
  Send,
  Trash2,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { agentLabel } from "@/lib/bridge/agents";
import {
  samePath,
  sendAlsoCheck,
  type SendAlsoCheck,
  type SendAlsoTarget,
} from "@/lib/bridge/workspaces";
import { useI18n } from "@/components/i18n-provider";
import { t as tNow } from "@/lib/i18n";

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
  /** The project folder this turn ran in — «إرسال أيضاً» compares against it. */
  cwd?: string;
}

/**
 * The one project the selected turns ran in, or undefined when they span
 * several (or predate recording) — undefined makes any target "another
 * project", so the user is asked rather than assumed to agree.
 */
export function turnsProject(
  turns: AgentTurn[],
  fallback?: string,
): string | undefined {
  const folders = turns.map((t) => t.cwd?.trim() || fallback?.trim() || "");
  const first = folders[0];
  return first && folders.every((f) => samePath(f, first)) ? first : undefined;
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
                outputWire: tNow(
                  "انقطع الالتقاط بتحديث الصفحة — الرد في الطرفية أعلاه.",
                ),
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

/** The tail of a path, for a compact "→ TargetApp" label. */
const folderName = (path?: string) =>
  path
    ?.trim()
    .replace(/[\\/]+$/, "")
    .split(/[\\/]/)
    .pop() || path;

/**
 * What will happen if «إرسال» is pressed — shown before it is pressed:
 * a blocked target, a different project to confirm, a session that will
 * start, or texts that will wait for the current turn.
 */
function SendAlsoStatus({
  target,
  folder,
  sourceFolder,
  check,
  confirmed,
  onConfirm,
  onOpenTab,
}: {
  target: string;
  folder?: string;
  sourceFolder?: string;
  check: SendAlsoCheck;
  confirmed: boolean;
  onConfirm: (on: boolean) => void;
  onOpenTab?: (agent: string) => void;
}) {
  const { t } = useI18n();
  const label = agentLabel(target);
  if (check.kind === "unchecked") {
    return (
      <div className="flex basis-full flex-wrap items-center gap-2 border border-amber-300 bg-amber-50 px-2 py-1.5 font-normal text-amber-900">
        <span>
          {folder?.trim()
            ? t("مجلد {label} غير مفحوص بعد", { label })
            : t("لم يُحدَّد مجلد مشروع لـ {label}", { label })}{" "}
          {t("— لا يُرسل إليه شيء قبل الخطوة ①.")}
        </span>
        {onOpenTab ? (
          <button
            type="button"
            onClick={() => onOpenTab(target)}
            className="border border-amber-400 bg-white px-2 py-0.5 font-bold text-amber-900 hover:border-amber-600"
          >
            {t("افتح تبويب {label}", { label })}
          </button>
        ) : null}
      </div>
    );
  }
  return (
    <div className="basis-full space-y-1 font-normal">
      {check.otherProject ? (
        <div className="border border-amber-300 bg-amber-50 px-2 py-1.5 text-amber-900">
          <p className="font-bold">
            {sourceFolder?.trim()
              ? t("مشروع مختلف — النص سيُنفَّذ في مشروع {label}:", { label })
              : t(
                  "النصوص المحددة أُرسلت في أكثر من مشروع — ستُنفَّذ كلها في مشروع {label}:",
                  { label },
                )}
          </p>
          <p dir="ltr" className="text-start font-mono text-[11px] break-all">
            {sourceFolder?.trim() || "…"} → {folder}
          </p>
          <label className="mt-1 flex cursor-pointer items-center gap-1.5 font-bold">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => onConfirm(event.target.checked)}
              className="h-3.5 w-3.5 accent-amber-600"
            />
            {t("أعلم أن النص سيُنفَّذ في مشروع {label}", { label })}
          </label>
        </div>
      ) : (
        <p className="text-slate-600">
          {label} ← <bdi className="font-mono">{folderName(folder)}</bdi>{" "}
          {t("— المشروع نفسه.")}
        </p>
      )}
      {check.willStart ? (
        <p className="text-slate-600">
          {t("ستبدأ جلسة {label} تلقائياً عند الإرسال.", { label })}
        </p>
      ) : null}
      {check.willQueue ? (
        <p className="text-slate-600">
          {t(
            "{label} يعمل على دورة الآن — تُرسل النصوص بعد انتهائها، بالترتيب.",
            { label },
          )}
        </p>
      ) : null}
    </div>
  );
}

/** One numbered rectangle per turn — lavender for English, green for Arabic. */
function Entry({
  n,
  lang,
  muted,
  select,
  children,
}: {
  n: number;
  lang: "en" | "ar";
  muted?: boolean;
  /** «إرسال أيضاً» mode: a checkbox beside the text. */
  select?: { checked: boolean; onToggle: () => void };
  children: ReactNode;
}) {
  const { t, lang: ui } = useI18n();
  return (
    <li
      dir={lang === "en" ? "ltr" : ui === "ar" ? "rtl" : "auto"}
      className={`flex gap-2 rounded-lg border px-3 py-2 leading-7 ${
        lang === "en"
          ? "border-[#9673a6]/50 bg-[#e1d5e7] text-left font-mono text-[12.5px]"
          : `border-[#82b366]/60 bg-[#d5e8d4] text-sm ${ui === "ar" ? "text-right" : "text-start"}`
      } ${muted ? "opacity-60" : ""} ${select?.checked ? "ring-2 ring-brand-500" : ""}`}
    >
      {select ? (
        <input
          type="checkbox"
          checked={select.checked}
          onChange={select.onToggle}
          aria-label={t("حدّد الدورة {n} لإعادة إرسالها", { n })}
          className="mt-1.5 h-4 w-4 shrink-0 accent-brand-600"
        />
      ) : null}
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
  children,
}: {
  lang: "en" | "ar";
  orderClass: string;
  empty: boolean;
  /** True when this box currently covers the sibling (fold icon shown). */
  expanded?: boolean;
  /** Expand/fold toggle — its button sits at the corner facing the sibling. */
  onToggleExpand?: () => void;
  children: ReactNode;
}) {
  const { t, lang: ui, dir } = useI18n();
  const en = lang === "en";
  return (
    <div
      dir={en ? "ltr" : dir}
      className={`flex h-full max-md:h-72 max-md:shrink-0 min-w-0 flex-col rounded-2xl border border-slate-400 bg-white ${orderClass}`}
    >
      <div className="relative border-b border-slate-200">
        <p className="py-2 text-center text-sm font-bold text-slate-700">
          {en ? "English" : ui === "ar" ? t("العربية") : t("نصك الأصلي")}
        </p>
        {onToggleExpand ? (
          <button
            type="button"
            onClick={onToggleExpand}
            aria-label={
              expanded
                ? t("اطوِ إلى عرض العمودين")
                : en
                  ? t("وسّع النص الإنجليزي")
                  : t("وسّع النص العربي")
            }
            title={
              expanded
                ? t("اطوِ إلى عرض العمودين")
                : en
                  ? t("وسّع هذا الصندوق فوق العربية")
                  : t("وسّع هذا الصندوق فوق الإنجليزية")
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
          <li className="rounded-lg border border-slate-300 px-3 py-6 text-center text-xs text-slate-400">
            {en
              ? "Turns appear here, numbered."
              : t("تظهر الدورات هنا مرقّمة.")}
          </li>
        ) : (
          children
        )}
      </ol>
      <p className="border-t border-slate-200 py-1.5 text-center text-[11px] text-slate-500">
        {en
          ? "Left-to-Right"
          : ui === "ar"
            ? t("من اليمين إلى اليسار")
            : t("كما كتبته")}
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
  side,
  turns,
  translatingJobs,
  autoTranslate,
  onTranslate,
  onClear,
  onClearAll,
  sendTargets = [],
  onSendAlso,
  sourceFolder,
  targetState,
  onOpenTab,
}: {
  agent: string;
  /** Which log the agent view shows: what was sent, or what came back. */
  side: "in" | "out";
  turns: AgentTurn[];
  translatingJobs: ReadonlySet<string>;
  /** Auto mode notes that a translation is on its way instead of nagging. */
  autoTranslate?: boolean;
  onTranslate: (jobId: string) => void;
  onClear: () => void;
  /** Offered only when other agents also have turns to clear. */
  onClearAll?: () => void;
  /** Agents the selected texts can be re-sent to (all but this one). */
  sendTargets?: string[];
  /** Re-send already-processed English texts — no new processing needed. */
  onSendAlso?: (jobIds: string[], target: string) => void;
  /** This agent's folder — stands in for turns recorded without a `cwd`. */
  sourceFolder?: string;
  /** Live state of a receiving agent — judged before the button is pressed. */
  targetState?: (agent: string) => SendAlsoTarget;
  /** Opens the receiving agent's tab (to check its folder). */
  onOpenTab?: (agent: string) => void;
}) {
  const { t, lang: ui, dir } = useI18n();
  /** Which language box currently covers its sibling (null = split view). */
  const [expanded, setExpanded] = useState<"en" | "ar" | null>(null);
  /** «إرسال أيضاً» mode: null = off, else the picked turns. */
  const [picked, setPicked] = useState<ReadonlySet<string> | null>(null);
  const [target, setTarget] = useState(sendTargets[0] ?? "");
  /** Explicit "yes, run it in the other project" — reset on every change. */
  const [confirmOther, setConfirmOther] = useState(false);
  // Selecting texts to re-send only makes sense on IN — leaving IN ends it.
  if (side !== "in" && picked !== null) setPicked(null);
  const selecting = picked !== null && side === "in";
  const isIn = side === "in";
  /** English UI: replies are already in the user's language — one column, no translate-back. */
  const single = ui === "en" && !isIn;
  const empty = turns.length === 0;
  const canSendAlso = Boolean(onSendAlso) && sendTargets.length > 0 && !empty;
  const toggle = (jobId: string) =>
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  const sendTarget = sendTargets.includes(target) ? target : sendTargets[0];
  const targetInfo = targetState?.(sendTarget) ?? {
    checked: false,
    live: false,
    busy: false,
  };
  const projectOfPicked = turnsProject(
    turns.filter((turn) => picked?.has(turn.jobId)),
    sourceFolder,
  );
  const check = sendAlsoCheck(projectOfPicked, targetInfo);
  const canSend =
    check.kind === "ready" && (!check.otherProject || confirmOther);

  const enEntries = turns.map((turn) =>
    isIn ? (
      <Entry
        key={turn.jobId}
        n={turn.n}
        lang="en"
        select={
          selecting && turn.inputWire.trim()
            ? {
                checked: picked.has(turn.jobId),
                onToggle: () => toggle(turn.jobId),
              }
            : undefined
        }
      >
        {turn.inputWire}
      </Entry>
    ) : turn.status === "running" ? (
      <Entry key={turn.jobId} n={turn.n} lang="en" muted>
        waiting for the agent…
      </Entry>
    ) : (
      <Entry key={turn.jobId} n={turn.n} lang="en">
        <span className={turn.status === "done" ? "" : "text-amber-800"}>
          {turn.outputWire || "—"}
        </span>
        {turn.cleanedBy && (
          <span className="block font-sans text-[10px] text-slate-500">
            {turn.cleanedBy === "gemini"
              ? "cleaned by Gemini"
              : turn.cleanedBy === "local"
                ? "extracted from the terminal"
                : "one-shot run"}
          </span>
        )}
        {turn.outputRaw && turn.outputRaw !== turn.outputWire && (
          <details className="font-sans text-[11px] text-slate-600">
            <summary className="cursor-pointer">raw capture</summary>
            <pre className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap rounded bg-white/70 p-2 font-mono text-[11px]">
              {turn.outputRaw}
            </pre>
          </details>
        )}
      </Entry>
    ),
  );
  const arEntries = turns.map((turn) =>
    isIn ? (
      <Entry key={turn.jobId} n={turn.n} lang="ar">
        {turn.inputUser}
      </Entry>
    ) : turn.outputUser ? (
      <Entry key={turn.jobId} n={turn.n} lang="ar">
        {turn.outputUser}
      </Entry>
    ) : turn.status === "running" ? (
      <Entry key={turn.jobId} n={turn.n} lang="ar" muted>
        {t("بانتظار رد الوكيل…")}
      </Entry>
    ) : turn.status === "done" && turn.outputWire.trim() ? (
      <Entry
        key={turn.jobId}
        n={turn.n}
        lang="ar"
        muted={translatingJobs.has(turn.jobId)}
      >
        {translatingJobs.has(turn.jobId) ? (
          t("تُترجم…")
        ) : (
          <>
            <button
              type="button"
              onClick={() => onTranslate(turn.jobId)}
              className="inline-flex items-center gap-1 rounded border border-[#82b366] bg-white px-2 py-0.5 text-[11px] font-bold text-emerald-800 hover:bg-emerald-50"
            >
              <Languages size={12} />
              {turn.translateError ? t("أعد الترجمة") : t("ترجمة")}
            </button>
            {turn.translateError ? (
              <span className="ms-1.5 text-[11px] text-amber-800">
                {t("تعذّرت الترجمة ({error})", { error: turn.translateError })}
              </span>
            ) : autoTranslate ? (
              <span className="ms-1.5 text-[11px] text-slate-500">
                {t("الترجمة التلقائية في الطريق")}
              </span>
            ) : null}
          </>
        )}
      </Entry>
    ) : (
      <Entry key={turn.jobId} n={turn.n} lang="ar" muted>
        —
      </Entry>
    ),
  );

  return (
    <section className="flex h-full min-h-0 flex-col" dir="ltr">
      <div className="flex flex-wrap items-center gap-1.5 pb-2">
        <span dir={dir} className="text-[11px] text-slate-500">
          {empty
            ? t("لا دورات بعد مع {label}", { label: agentLabel(agent) })
            : t(
                turns.length === 1
                  ? "{n} دورة مع {label} — تُمحى بإغلاق المتصفح"
                  : "{n} دورات مع {label} — تُمحى بإغلاق المتصفح",
                { n: turns.length, label: agentLabel(agent) },
              )}
        </span>
        {!empty && (
          <div dir={dir} className="ms-auto flex gap-1.5">
            {canSendAlso && side === "in" ? (
              <button
                type="button"
                aria-pressed={selecting}
                onClick={() => {
                  setPicked(selecting ? null : new Set());
                  setConfirmOther(false);
                }}
                title={t(
                  "أعد إرسال نصوص سبق إرسالها إلى وكيل آخر — بلا معالجة جديدة",
                )}
                className={`flex items-center gap-1 rounded border px-2 py-1 text-[11px] font-bold ${
                  selecting
                    ? "border-brand-600 bg-brand-500 text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:border-ink"
                }`}
              >
                <Send size={12} />{" "}
                {selecting ? t("إلغاء الإرسال") : t("إرسال أيضاً")}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClear}
              className="flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-bold text-slate-600 hover:border-ink"
            >
              <Trash2 size={12} />{" "}
              {t("مسح {label}", { label: agentLabel(agent) })}
            </button>
            {onClearAll && (
              <button
                type="button"
                onClick={onClearAll}
                className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-bold text-rose-600 hover:border-rose-500"
              >
                {t("مسح الكل")}
              </button>
            )}
          </div>
        )}
      </div>
      {selecting ? (
        <div
          dir={dir}
          role="region"
          aria-label={t("إرسال أيضاً")}
          className="flex flex-wrap items-center gap-2 border border-b-0 border-brand-500 bg-brand-500/10 px-3 py-2 text-xs font-bold text-slate-700"
        >
          {picked.size === 0 ? (
            <span>
              {t("حدّد النصوص الإنجليزية التي تريد إرسالها إلى وكيل آخر.")}
            </span>
          ) : (
            <>
              <span>
                {picked.size}{" "}
                {picked.size === 1 ? t("نص محدد") : t("نصوص محددة")}{" "}
                {t("— إلى")}
              </span>
              <select
                aria-label={t("الوكيل المستلم")}
                value={sendTarget}
                onChange={(event) => {
                  setTarget(event.target.value);
                  setConfirmOther(false);
                }}
                className="border border-slate-300 bg-white px-2 py-1 font-mono text-xs"
              >
                {sendTargets.map((id) => (
                  <option key={id} value={id}>
                    {agentLabel(id)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!canSend}
                onClick={() => {
                  const ids = turns
                    .filter((t) => picked.has(t.jobId))
                    .map((t) => t.jobId);
                  setPicked(null);
                  setConfirmOther(false);
                  onSendAlso?.(ids, sendTarget);
                }}
                className="flex items-center gap-1 border border-ink bg-brand-500 px-3 py-1 text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send size={12} />{" "}
                {t("إرسال إلى {label}", { label: agentLabel(sendTarget) })}
              </button>
              <SendAlsoStatus
                target={sendTarget}
                folder={targetInfo.folder}
                sourceFolder={projectOfPicked}
                check={check}
                confirmed={confirmOther}
                onConfirm={setConfirmOther}
                onOpenTab={onOpenTab}
              />
            </>
          )}
        </div>
      ) : null}
      <div
        className={`relative flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto rounded-lg border border-amber-300 bg-amber-50 p-4 md:grid ${single ? "md:grid-cols-1" : "md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]"} md:grid-rows-[minmax(0,1fr)] md:items-stretch md:overflow-visible`}
      >
        <LangBox
          lang="en"
          empty={empty}
          orderClass={isIn ? "order-3 md:order-1" : "order-1"}
          expanded={expanded === "en"}
          onToggleExpand={
            single
              ? undefined
              : () => setExpanded((v) => (v === "en" ? null : "en"))
          }
        >
          {enEntries}
        </LangBox>

        {single ? null : (
          <div
            className="order-2 flex items-center justify-center text-slate-700"
            role="img"
            aria-label={
              isIn
                ? t("ترجمة من العربية إلى الإنجليزية")
                : t("ترجمة من الإنجليزية إلى العربية")
            }
            title={isIn ? t("العربية ← الإنجليزية") : t("الإنجليزية ← العربية")}
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
        )}

        {single ? null : (
          <LangBox
            lang="ar"
            empty={empty}
            orderClass={isIn ? "order-1 md:order-3" : "order-3"}
            expanded={expanded === "ar"}
            onToggleExpand={() =>
              setExpanded((v) => (v === "ar" ? null : "ar"))
            }
          >
            {arEntries}
          </LangBox>
        )}

        {expanded && !single ? (
          <div className="absolute inset-0 z-10 p-4" dir="ltr">
            <LangBox
              lang={expanded}
              empty={empty}
              orderClass=""
              expanded
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
