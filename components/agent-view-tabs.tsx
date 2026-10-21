"use client";

import { ScrollText, SquareTerminal } from "lucide-react";

export type AgentView = "terminal" | "in" | "out";

const tabs: { id: AgentView; label: string; title: string }[] = [
  { id: "terminal", label: "التيرمينال", title: "الطرفية الحيّة للوكيل" },
  {
    id: "in",
    label: "سجل IN",
    title: "ما أُرسل إلى الوكيل — بلغتك وبالإنجليزية",
  },
  {
    id: "out",
    label: "سجل OUT",
    title: "ما ردّ به الوكيل — بالإنجليزية وبلغتك",
  },
];

/**
 * The three views inside one agent: its terminal, what was sent (IN) and
 * what came back (OUT). The prompt box under them stays put across all
 * three. OUT carries a dot when a reply landed while you were elsewhere —
 * the view never switches by itself.
 */
export function AgentViewTabs({
  agent,
  view,
  turns,
  unseenReply,
  onChange,
}: {
  agent: string;
  view: AgentView;
  turns: number;
  unseenReply: boolean;
  onChange: (view: AgentView) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="عروض الوكيل"
      className="flex flex-wrap gap-1.5 border-x border-b border-ink bg-white px-3 py-2"
    >
      {tabs.map((tab) => {
        const selected = tab.id === view;
        return (
          <button
            key={tab.id}
            id={`agent-view-${agent}-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={selected}
            title={tab.title}
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-1.5 border px-3 py-1.5 text-xs font-bold transition ${
              selected
                ? "border-ink bg-ink text-white"
                : "border-slate-300 bg-white text-slate-600 hover:border-ink hover:text-ink"
            }`}
          >
            {tab.id === "terminal" ? (
              <SquareTerminal size={13} />
            ) : (
              <ScrollText size={13} />
            )}
            {tab.label}
            {tab.id !== "terminal" && turns > 0 ? (
              <span
                className={`px-1 font-mono text-[10px] ${selected ? "bg-white/20" : "bg-slate-200 text-slate-700"}`}
              >
                {turns}
              </span>
            ) : null}
            {tab.id === "out" && unseenReply && !selected ? (
              <span
                role="img"
                aria-label="رد جديد لم تقرأه"
                className="h-2 w-2 rounded-full bg-amber-500"
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
