"use client";

import { Check, FolderOpen, MonitorUp, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { AGENT_OPTIONS, agentLabel } from "@/lib/bridge/agents";
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
  onSelect,
}: {
  activeAgent: string;
  status: Record<string, TabStatus>;
  /** Log turns per agent — a small count beside the label. */
  turns: Record<string, number>;
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

/**
 * The active tab's project controls — one honest sequence: the folder,
 * its check, this agent's per-run trust toggle, its permanent trust, and
 * its interactive terminal. Each success turns its icon green; a verdict
 * is bound to the folder it described, so editing the path retires it.
 * Rendered with `key={agent}` so verdicts never leak between tabs.
 */
export function AgentWorkspacePanel({
  agent,
  workspace,
  bridge,
  openedCount,
  terminalBusy,
  terminalNote,
  autoTrust,
  onWorkspaceChange,
  onAutoTrustChange,
  onOpenTerminal,
}: {
  agent: string;
  workspace: string | undefined;
  bridge: BridgeConfig;
  /** Terminal windows opened for this agent this session. */
  openedCount: number;
  terminalBusy: boolean;
  terminalNote: TerminalNote | null;
  /** This agent's «ثقة لكل تشغيلة» switch. */
  autoTrust: boolean;
  onWorkspaceChange: (path: string) => void;
  onAutoTrustChange: (on: boolean) => void;
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
  // Green state per step, bound to the folder it was earned on.
  const [done, setDone] = useState<{ path: string; step: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const shown = note && note.path === path ? note : null;
  const termNote = terminalNote?.agent === agent ? terminalNote : null;
  const checked = done.some((d) => d.path === path && d.step === "check");
  const trusted = done.some((d) => d.path === path && d.step === "trust");
  const greenBtn = "border-emerald-500 bg-emerald-50 text-emerald-700";

  async function act(
    step: string,
    run: () => ReturnType<typeof checkWorkspace>,
    okText: (r: Awaited<ReturnType<typeof checkWorkspace>>) => string,
  ) {
    if (!path || busy) return;
    setBusy(true);
    try {
      const result = await run();
      const ok = result.state === "ok";
      setNote({
        path,
        ok,
        text: ok ? okText(result) : describeBridgeAction(result),
      });
      if (ok) {
        setDone((all) => [
          ...all.filter((d) => !(d.path === path && d.step === step)),
          { path, step },
        ]);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-x border-b border-ink bg-white p-4">
      <div className="flex items-end gap-2">
        <label className="block flex-1 text-sm font-semibold">
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
        <button
          type="button"
          disabled={!path || busy}
          title="يفحص أن المجلد موجود على جهازك قبل التشغيل"
          onClick={() =>
            void act(
              "check",
              () => checkWorkspace(bridge, path),
              (r) =>
                `المجلد موجود — ${label} سيعمل داخل: ${r.state === "ok" ? (r.path ?? path) : path}`,
            )
          }
          className={`flex shrink-0 items-center gap-1.5 border px-4 py-2.5 text-sm font-bold transition disabled:opacity-50 ${
            checked
              ? greenBtn
              : "border-slate-300 bg-white text-slate-600 hover:border-ink hover:text-ink"
          }`}
        >
          {busy ? "…" : checked ? <Check size={14} /> : null}
          {checked ? "مفحوص" : "فحص"}
        </button>
        <button
          type="button"
          disabled={!path || busy || !option?.trustPersistent}
          onClick={() =>
            void act(
              "trust",
              () => trustWorkspace(bridge, agent, path),
              (r) =>
                r.state === "ok" && r.already
                  ? `المجلد موثوق مسبقاً لدى ${label} — لم يتغير شيء.`
                  : `سُجّل المجلد موثوقاً دائماً في ${r.state === "ok" ? (r.file ?? "ملف ثقة الوكيل") : ""}.`,
            )
          }
          title={
            option?.trustPersistent
              ? "يكتب في ملف إعدادات الوكيل نفسه — أثره يشمل جلساتك اليدوية خارج TOSO أيضاً"
              : "هذا الوكيل لا يملك ملف ثقة معروفاً — ثقته تُدار من داخله"
          }
          className={`flex shrink-0 items-center gap-1.5 border px-3 py-2.5 text-sm font-bold transition disabled:opacity-50 ${
            trusted
              ? greenBtn
              : "border-slate-300 bg-white text-slate-600 hover:border-ink hover:text-ink"
          }`}
        >
          <ShieldCheck size={14} />
          {trusted
            ? "موثوق دائماً"
            : option?.trustPersistent
              ? "ثقة دائمة بالمجلد"
              : "ثقة دائمة — غير مدعومة"}
        </button>
      </div>
      <p className="mt-1.5 text-xs leading-5 text-slate-500">
        {path
          ? "كل تشغيل وكل طرفية لهذا الوكيل تبدأ داخل هذا المجلد — ولا تتأثر بمشاريع الوكلاء الآخرين."
          : "إلزامي: لن يعمل هذا الوكيل قبل تحديد مجلد المشروع المستهدف هنا."}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {option?.trustPerRun ? (
          <label
            className="flex cursor-pointer items-center gap-1.5 border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-ink hover:text-ink"
            title="مفتاح مؤقت يُزرع في عملية الوكيل ويموت معها — لا يُكتب أي ملف"
          >
            <input
              type="checkbox"
              checked={autoTrust}
              onChange={(event) => onAutoTrustChange(event.target.checked)}
              className="h-3.5 w-3.5 accent-violet-700"
            />
            ثقة لكل تشغيلة
          </label>
        ) : (
          <span
            className="cursor-not-allowed border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-400"
            title="لا يملك هذا الوكيل متغير ثقة موثقاً لكل تشغيلة"
          >
            ثقة لكل تشغيلة — غير مدعومة
          </span>
        )}
        <button
          type="button"
          disabled={terminalBusy}
          onClick={onOpenTerminal}
          title="نافذة PowerShell خارجية منفصلة — جلسة أخرى لا تشارك سياق الطرفية المدمجة، ولا يقرؤها TOSO"
          className="flex items-center gap-1.5 border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-ink hover:text-ink disabled:opacity-50"
        >
          <MonitorUp size={14} />
          {terminalBusy ? "يفتح…" : "نافذة خارجية"}
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
