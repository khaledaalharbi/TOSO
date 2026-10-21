"use client";

import type { SessionsState } from "@/components/bridge-sessions";

const hostOf = (url: string) =>
  url.replace(/^https?:\/\//, "").replace(/\/$/, "");

const look: Record<
  SessionsState,
  { dot: string; frame: string; label: (host: string) => string; hint: string }
> = {
  loading: {
    dot: "bg-slate-400",
    frame: "border-slate-300 bg-white text-slate-600",
    label: (host) => `bridge ${host}`,
    hint: "يفحص الجسر…",
  },
  ok: {
    dot: "bg-emerald-500",
    frame: "border-emerald-300 bg-emerald-50 text-emerald-900",
    label: (host) => `bridge ${host}`,
    hint: "الجسر المحلي متصل — اضغط لعرض جلساته",
  },
  outdated: {
    dot: "bg-amber-500",
    frame: "border-amber-300 bg-amber-50 text-amber-900",
    label: (host) => `bridge ${host} · قديم`,
    hint: "الجسر يعمل لكنه أقدم من ميزة عرض الجلسات — أعد تشغيله",
  },
  bad_token: {
    dot: "bg-rose-500",
    frame: "border-rose-300 bg-rose-50 text-rose-900",
    label: (host) => `bridge ${host} · توكن مرفوض`,
    hint: "توكن الجسر مرفوض — راجع الإعدادات",
  },
  offline: {
    dot: "bg-rose-500",
    frame: "border-rose-300 bg-rose-50 text-rose-900",
    label: (host) => `bridge ${host} · غير متصل`,
    hint: "الجسر غير متصل — شغّله بـ npm run bridge",
  },
};

/**
 * The bridge at a glance, top of the page: its real address (the one the
 * page is paired with) and whether it answers. Pressing it opens the
 * «جلسات الجسر» panel.
 */
export function BridgeBadge({
  state,
  url,
  onClick,
}: {
  state: SessionsState;
  url: string;
  onClick: () => void;
}) {
  const view = look[state];
  return (
    <button
      type="button"
      onClick={onClick}
      title={view.hint}
      className={`flex items-center gap-2 border px-3 py-2 text-[12px] font-bold transition hover:brightness-95 ${view.frame}`}
    >
      <span
        aria-hidden
        className={`h-2 w-2 rounded-full ${view.dot} ${state === "ok" ? "animate-pulse motion-reduce:animate-none" : ""}`}
      />
      <span dir="ltr" className="font-mono">
        {view.label(hostOf(url))}
      </span>
    </button>
  );
}
