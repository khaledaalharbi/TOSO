"use client";

import { FolderOpen, MonitorUp, ShieldCheck } from "lucide-react";
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
 * The active tab's project controls: its folder, a check, permanent trust
 * for that folder, and its interactive terminal. Rendered with
 * `key={agent}` so the check/trust verdicts never leak between tabs.
 */
export function AgentWorkspacePanel({
  agent,
  workspace,
  bridge,
  openedCount,
  terminalBusy,
  terminalNote,
  onWorkspaceChange,
  onOpenTerminal,
}: {
  agent: string;
  workspace: string | undefined;
  bridge: BridgeConfig;
  /** Terminal windows opened for this agent this session. */
  openedCount: number;
  terminalBusy: boolean;
  terminalNote: TerminalNote | null;
  onWorkspaceChange: (path: string) => void;
  onOpenTerminal: () => void;
}) {
  const label = agentLabel(agent);
  const path = workspace?.trim() ?? "";
  // Verdicts are bound to the folder they described — editing the path
  // silently retires the old one.
  const [note, setNote] = useState<{
    path: string;
    ok: boolean;
    text: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const shown = note && note.path === path ? note : null;
  const termNote = terminalNote?.agent === agent ? terminalNote : null;

  async function act(
    run: () => ReturnType<typeof checkWorkspace>,
    okText: (r: Awaited<ReturnType<typeof checkWorkspace>>) => string,
  ) {
    if (!path || busy) return;
    setBusy(true);
    try {
      const result = await run();
      setNote({
        path,
        ok: result.state === "ok",
        text:
          result.state === "ok" ? okText(result) : describeBridgeAction(result),
      });
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
          onClick={() =>
            void act(
              () => checkWorkspace(bridge, path),
              (r) =>
                `المجلد موجود — ${label} سيعمل داخل: ${r.state === "ok" ? (r.path ?? path) : path}`,
            )
          }
          className="shrink-0 border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:border-ink hover:text-ink disabled:opacity-50"
        >
          {busy ? "…" : "فحص"}
        </button>
      </div>
      <p className="mt-1.5 text-xs leading-5 text-slate-500">
        {path
          ? "كل تشغيل وكل طرفية لهذا الوكيل تبدأ داخل هذا المجلد — ولا تتأثر بمشاريع الوكلاء الآخرين."
          : "فارغ: يعمل هذا الوكيل في مجلد تشغيل الجسر — وتوسم بطاقة النتيجة بذلك."}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!path || busy}
          onClick={() =>
            void act(
              () => trustWorkspace(bridge, agent, path),
              (r) =>
                r.state === "ok" && r.already
                  ? `المجلد موثوق مسبقاً لدى ${label} — لم يتغير شيء.`
                  : `سُجّل المجلد موثوقاً دائماً في ${r.state === "ok" ? (r.file ?? "ملف ثقة الوكيل") : ""}.`,
            )
          }
          title="يكتب في ملف إعدادات الوكيل نفسه — أثره يشمل جلساتك اليدوية خارج TOSO أيضاً"
          className="flex items-center gap-1.5 border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-ink hover:text-ink disabled:opacity-50"
        >
          <ShieldCheck size={14} />
          ثقة دائمة بالمجلد
        </button>
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
