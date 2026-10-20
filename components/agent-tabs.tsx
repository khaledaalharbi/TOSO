"use client";

import { Check, FolderOpen, MonitorUp, Play, ShieldCheck } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { TerminalStatus } from "@/components/agent-terminal";
import {
  AGENT_OPTIONS,
  agentLabel,
  type TrustCapability,
} from "@/lib/bridge/agents";
import {
  checkWorkspace,
  describeBridgeAction,
  trustWorkspace,
  type BridgeConfig,
} from "@/lib/services/agent-service";

/** What a tab's dot says about that agent's latest run. */
export type TabStatus = "idle" | "running" | "done" | "error";

const dotTone: Record<TabStatus, string> = {
  idle: "bg-slate-300",
  running: "bg-amber-500 animate-pulse",
  done: "bg-emerald-500",
  error: "bg-rose-500",
};

const dotLabel: Record<TabStatus, string> = {
  idle: "لم يعمل بعد",
  running: "يعمل الآن",
  done: "اكتمل",
  error: "فشل",
};

/**
 * One tab per agent. Each tab owns its own project folder, run, translation
 * and log, so Claude can work on one project while Gemini works on another —
 * the dot keeps showing a background run while you look at a different tab.
 */
export function AgentTabStrip({
  activeAgent,
  status,
  turns,
  defaultAgent,
  onSelect,
}: {
  activeAgent: string;
  status: Record<string, TabStatus>;
  /** Log turns per agent — a small count beside the label. */
  turns: Record<string, number>;
  /** The agent chosen as default in settings — its tab carries a badge. */
  defaultAgent?: string;
  onSelect: (agentId: string) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="وكلاء CLI"
      dir="ltr"
      className="flex flex-wrap gap-1 border-b border-ink"
    >
      {AGENT_OPTIONS.map((opt) => {
        const state = status[opt.id] ?? "idle";
        const selected = opt.id === activeAgent;
        return (
          <button
            key={opt.id}
            id={`agent-tab-${opt.id}`}
            role="tab"
            type="button"
            aria-selected={selected}
            aria-controls="agent-tabpanel"
            onClick={() => onSelect(opt.id)}
            className={`flex items-center gap-2 border border-b-0 px-3.5 py-2 font-mono text-xs font-bold transition ${
              selected
                ? "border-ink bg-ink text-white"
                : "border-slate-300 bg-white text-slate-600 hover:border-ink hover:text-ink"
            }`}
          >
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${dotTone[state]}`}
              title={dotLabel[state]}
              role="img"
              aria-label={dotLabel[state]}
            />
            {opt.label}
            {opt.id === defaultAgent ? (
              <span
                dir="rtl"
                title="الوكيل الافتراضي — يُحدَّد من الإعدادات"
                className={`border px-1.5 py-px text-[10px] leading-4 font-bold ${
                  selected
                    ? "border-white/40 text-white"
                    : "border-emerald-400 text-emerald-700"
                }`}
              >
                الافتراضي
              </span>
            ) : null}
            {turns[opt.id] ? (
              <span
                className={`px-1 text-[10px] ${selected ? "bg-white/20" : "bg-violet-600 text-white"}`}
              >
                {turns[opt.id]}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** A terminal-launch outcome, bound to the agent it was for. */
export interface TerminalNote {
  agent: string;
  ok: boolean;
  text: string;
}

type StepState = "done" | "open" | "locked" | "unsupported";

const stepTone: Record<StepState, string> = {
  done: "border-emerald-500 bg-emerald-50 text-emerald-800",
  open: "border-slate-300 bg-white text-slate-700 hover:border-ink hover:text-ink",
  locked: "border-slate-200 bg-slate-50 text-slate-400",
  unsupported: "border-dashed border-slate-200 bg-slate-50 text-slate-400",
};

/** The named capability badge on a trust step — the user-facing vocabulary. */
const capabilityBadge: Record<TrustCapability, { text: string; tone: string }> =
  {
    supported: { text: "مدعوم", tone: "border-violet-300 text-violet-700" },
    auto: {
      text: "مدعوم تلقائياً",
      tone: "border-emerald-400 bg-white text-emerald-700",
    },
    unwired: { text: "غير مربوط", tone: "border-amber-300 text-amber-700" },
    unsupported: { text: "غير مدعوم", tone: "border-slate-300 text-slate-500" },
  };

/**
 * A trust step's whole presentation from its capability: `auto` needs no
 * action and reads green from the start; `supported` waits for the folder
 * check, then for the user; the other two explain why nothing can be done.
 */
function trustStep(
  capability: TrustCapability,
  done: boolean,
  checked: boolean,
  copy: {
    title: string;
    doneTitle: string;
    openTag: string;
    hint: string;
    unsupportedHint: string;
    unsupportedTag: string;
  },
): {
  state: StepState;
  title: string;
  tag: string;
  hint: string;
  settled?: boolean;
} {
  switch (capability) {
    case "auto":
      return {
        state: "done",
        title: copy.title,
        tag: "لا يحتاج تفعيلاً",
        hint: "لا يسأل هذا الوكيل عن ثقة المجلد أصلاً — لا شيء لتفعيله",
        settled: true,
      };
    case "unwired":
      return {
        state: "unsupported",
        title: copy.title,
        tag: "الوكيل يملك الآلية ولم تُربط بـTOSO بعد",
        hint: "آلية الثقة موجودة لدى الوكيل لكنها غير مربوطة بـTOSO بعد",
      };
    case "unsupported":
      return {
        state: "unsupported",
        title: copy.title,
        tag: copy.unsupportedTag,
        hint: copy.unsupportedHint,
      };
    case "supported":
      return {
        state: !checked ? "locked" : done ? "done" : "open",
        title: done ? copy.doneTitle : copy.title,
        tag: !checked
          ? "اختياري — يُفتح بعد فحص المجلد"
          : done
            ? "اختياري — مُفعّل"
            : copy.openTag,
        hint: copy.hint,
      };
  }
}

/**
 * One tile of the setup sequence: its number, what it does, and whether
 * it is required. The tile itself is the action (button semantics).
 */
function Step({
  n,
  state,
  title,
  hint,
  tag,
  icon,
  busy,
  pressed,
  settled,
  badge,
  onClick,
}: {
  n: number;
  state: StepState;
  title: string;
  hint: string;
  tag: string;
  icon: ReactNode;
  /** Named capability (مدعوم / مدعوم تلقائياً / غير مربوط / غير مدعوم). */
  badge?: { text: string; tone: string };
  busy?: boolean;
  /** Toggle steps report their on/off state to assistive tech. */
  pressed?: boolean;
  /** A finished step with nothing left to do (e.g. a running session). */
  settled?: boolean;
  onClick: () => void;
}) {
  const disabled =
    state === "locked" || state === "unsupported" || busy || settled;
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={pressed}
      title={hint}
      onClick={onClick}
      className={`flex min-w-0 flex-1 basis-40 items-center gap-2.5 border px-3 py-2 text-start transition disabled:cursor-not-allowed ${stepTone[state]}`}
    >
      <span
        className={`grid h-6 w-6 shrink-0 place-items-center rounded-full font-mono text-xs font-bold ${
          state === "done"
            ? "bg-emerald-600 text-white"
            : state === "open"
              ? "bg-ink text-white"
              : "bg-slate-200 text-slate-500"
        }`}
      >
        {state === "done" ? <Check size={13} strokeWidth={3} /> : n}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5 text-sm font-bold">
          {icon}
          {busy ? "…" : title}
          {badge ? (
            <span
              className={`border px-1.5 py-px text-[10px] leading-4 font-bold ${badge.tone}`}
            >
              {badge.text}
            </span>
          ) : null}
        </span>
        <span className="block text-[11px] font-semibold opacity-75">
          {tag}
        </span>
      </span>
    </button>
  );
}

/**
 * The active tab's setup, as one sequence the user drives step by step:
 * ① check the folder (required — it unlocks the rest) → ② permanent trust
 * (optional) → ③ per-run trust (optional) → ④ start the session. Each
 * success turns its tile green; checks/trust are bound to the folder they
 * were earned on, so editing the path re-locks the sequence.
 */
export function AgentWorkspacePanel({
  agent,
  workspace,
  bridge,
  checked,
  trusted,
  autoTrust,
  sessionStatus,
  openedCount,
  terminalBusy,
  terminalNote,
  onWorkspaceChange,
  onStepDone,
  onAutoTrustChange,
  onStart,
  onOpenTerminal,
}: {
  agent: string;
  workspace: string | undefined;
  bridge: BridgeConfig;
  /** Step ① passed for the current folder. */
  checked: boolean;
  /** Step ② passed for the current folder. */
  trusted: boolean;
  /** Step ③ — this agent's per-run trust switch. */
  autoTrust: boolean;
  /** The embedded session's status — drives step ④. */
  sessionStatus: TerminalStatus | undefined;
  /** Terminal windows opened for this agent this session. */
  openedCount: number;
  terminalBusy: boolean;
  terminalNote: TerminalNote | null;
  onWorkspaceChange: (path: string) => void;
  onStepDone: (step: "checked" | "trusted", path: string) => void;
  onAutoTrustChange: (on: boolean) => void;
  onStart: () => void;
  onOpenTerminal: () => void;
}) {
  const label = agentLabel(agent);
  const option = AGENT_OPTIONS.find((opt) => opt.id === agent);
  const path = workspace?.trim() ?? "";
  const [note, setNote] = useState<{
    path: string;
    ok: boolean;
    text: string;
  } | null>(null);
  const [busy, setBusy] = useState<"checked" | "trusted" | null>(null);
  const shown = note && note.path === path ? note : null;
  const termNote = terminalNote?.agent === agent ? terminalNote : null;
  const live = sessionStatus === "live" || sessionStatus === "starting";

  async function act(
    step: "checked" | "trusted",
    run: () => ReturnType<typeof checkWorkspace>,
    okText: (r: Awaited<ReturnType<typeof checkWorkspace>>) => string,
  ) {
    if (!path || busy) return;
    setBusy(step);
    try {
      const result = await run();
      const ok = result.state === "ok";
      setNote({
        path,
        ok,
        text: ok ? okText(result) : describeBridgeAction(result),
      });
      if (ok) onStepDone(step, path);
    } finally {
      setBusy(null);
    }
  }

  const caps = option?.trust ?? {
    persistent: "unsupported" as const,
    perRun: "unsupported" as const,
  };
  const persistent = trustStep(caps.persistent, trusted, checked, {
    title: "ثقة دائمة",
    doneTitle: "موثوق دائماً",
    openTag: "اختياري — اضغط للتفعيل",
    hint: "يكتب في ملف إعدادات الوكيل نفسه — أثره يشمل جلساتك اليدوية خارج TOSO أيضاً",
    unsupportedHint: "هذا الوكيل لا يملك ملف ثقة معروفاً — ثقته تُدار من داخله",
    unsupportedTag: "لا ملف ثقة لديه — أجب سؤال الثقة داخل الطرفية",
  });
  const perRun = trustStep(caps.perRun, autoTrust, checked, {
    title: "ثقة لكل تشغيلة",
    doneTitle: "ثقة لكل تشغيلة: مفعّلة",
    openTag: live
      ? "اختياري — يسري عند إعادة التشغيل"
      : "اختياري — اضغط للتبديل",
    hint: "مفتاح مؤقت يُزرع في عملية الوكيل ويموت معها — لا يُكتب أي ملف",
    unsupportedHint: "لا يملك هذا الوكيل متغير ثقة موثقاً لكل تشغيلة",
    unsupportedTag: "لا متغير مؤقت لديه — استخدم ② أو أجب داخل الطرفية",
  });

  return (
    <div className="border-x border-b border-ink bg-white p-4">
      <label className="block text-sm font-semibold">
        <span className="flex items-center gap-1.5">
          <FolderOpen size={14} className="text-amber-600" />
          مشروع {label}
        </span>
        <input
          id={`agent-workspace-${agent}`}
          name={`agent-workspace-${agent}`}
          type="text"
          dir="ltr"
          autoComplete="off"
          value={workspace ?? ""}
          onChange={(event) => onWorkspaceChange(event.target.value)}
          placeholder="C:\MyProject\TargetApp"
          className="mt-2 w-full border border-slate-300 bg-white p-2.5 font-mono text-sm outline-none focus:border-ink"
        />
      </label>
      <p className="mt-1.5 text-xs leading-5 text-slate-500">
        {!path
          ? "اكتب مسار مجلد المشروع المستهدف، ثم ابدأ بالخطوة ①."
          : checked
            ? "كل تشغيل وكل طرفية لهذا الوكيل تبدأ داخل هذا المجلد — ولا تتأثر بمشاريع الوكلاء الآخرين."
            : "افحص المجلد أولاً — الفحص يفتح بقية الخطوات."}
      </p>
      <div
        className="mt-3 flex flex-wrap gap-2"
        role="group"
        aria-label={`إعداد ${label}`}
      >
        <Step
          n={1}
          state={!path ? "locked" : checked ? "done" : "open"}
          title={checked ? "مفحوص" : "فحص المجلد"}
          tag="إلزامي"
          hint="يفحص أن المجلد موجود على جهازك قبل التشغيل"
          icon={<FolderOpen size={14} />}
          busy={busy === "checked"}
          onClick={() =>
            void act(
              "checked",
              () => checkWorkspace(bridge, path),
              (r) =>
                `المجلد موجود — ${label} سيعمل داخل: ${r.state === "ok" ? (r.path ?? path) : path}`,
            )
          }
        />
        <Step
          n={2}
          {...persistent}
          badge={capabilityBadge[caps.persistent]}
          icon={<ShieldCheck size={14} />}
          busy={busy === "trusted"}
          onClick={() =>
            void act(
              "trusted",
              () => trustWorkspace(bridge, agent, path),
              (r) =>
                r.state === "ok" && r.already
                  ? `المجلد موثوق مسبقاً لدى ${label} — لم يتغير شيء.`
                  : `سُجّل المجلد موثوقاً دائماً في ${r.state === "ok" ? (r.file ?? "ملف ثقة الوكيل") : ""}.`,
            )
          }
        />
        <Step
          n={3}
          {...perRun}
          badge={capabilityBadge[caps.perRun]}
          icon={<ShieldCheck size={14} />}
          pressed={caps.perRun === "supported" ? autoTrust : undefined}
          onClick={() => onAutoTrustChange(!autoTrust)}
        />
        <Step
          n={4}
          state={
            sessionStatus === "unavailable"
              ? "unsupported"
              : !checked
                ? "locked"
                : live
                  ? "done"
                  : "open"
          }
          title={
            sessionStatus === "live"
              ? "الجلسة تعمل"
              : sessionStatus === "starting"
                ? "تبدأ…"
                : "تشغيل الجلسة"
          }
          tag={
            sessionStatus === "unavailable"
              ? "طرفية مدمجة غير متاحة — تشغيل أحادي"
              : live
                ? "إيقاف وإعادة التشغيل من رأس الطرفية"
                : "الخطوة الأخيرة"
          }
          hint="يشغّل واجهة الوكيل التفاعلية داخل المجلد المفحوص"
          icon={<Play size={14} />}
          settled={live}
          onClick={onStart}
        />
      </div>
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          disabled={terminalBusy || !checked}
          onClick={onOpenTerminal}
          title="نافذة PowerShell خارجية منفصلة — جلسة أخرى لا تشارك سياق الطرفية المدمجة، ولا يقرؤها TOSO"
          className="flex items-center gap-1.5 px-1 py-1 text-xs font-bold text-slate-500 underline-offset-2 transition hover:text-ink hover:underline disabled:opacity-40"
        >
          <MonitorUp size={13} />
          {terminalBusy ? "يفتح…" : "أو افتح نافذة خارجية منفصلة"}
          {openedCount ? (
            <span className="bg-violet-600 px-1 font-mono text-[10px] text-white">
              {openedCount}
            </span>
          ) : null}
        </button>
      </div>
      {[shown, termNote].map((entry, i) =>
        entry ? (
          <p
            key={i}
            role="status"
            dir="auto"
            className={`mt-2 border px-3 py-2 text-xs break-words ${
              entry.ok
                ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                : "border-amber-300 bg-amber-50 text-amber-800"
            }`}
          >
            {entry.text}
          </p>
        ) : null,
      )}
    </div>
  );
}
