"use client";

import { ChevronDown, Link2, Play, Power } from "lucide-react";
import { useState } from "react";
import { agentLabel } from "@/lib/bridge/agents";
import type {
  BridgeSessionView,
  ClosedSession,
  SessionPanels,
} from "@/lib/bridge/session-history";

export type SessionsState =
  "loading" | "ok" | "outdated" | "offline" | "bad_token";

const time = (ms?: number | null) =>
  ms
    ? new Date(ms).toLocaleString("ar", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

function Row({
  agent,
  cwd,
  when,
  children,
}: {
  agent: string;
  cwd: string;
  when: string | null;
  children: React.ReactNode;
}) {
  return (
    <li className="border border-slate-200 bg-white px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="text-sm font-bold">{agentLabel(agent)}</span>
        {when ? (
          <span className="text-[11px] text-slate-400">{when}</span>
        ) : null}
        <div className="ms-auto flex gap-1.5">{children}</div>
      </div>
      {/* The folder gets its own line — it is what tells sessions apart. */}
      <code
        dir="ltr"
        title={cwd}
        className="mt-1 block text-start font-mono text-xs break-all text-slate-600"
      >
        {cwd}
      </code>
    </li>
  );
}

const btn =
  "flex items-center gap-1 border px-2.5 py-1 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Sessions live on the bridge, not in the page: they survive closing the
 * browser and restarting the app. This panel makes them visible again —
 * live ones to reconnect or end, recently closed ones to reopen — at most
 * three each.
 */
export function BridgeSessions({
  state,
  panels,
  max,
  attached,
  pending,
  onConnect,
  onEnd,
  onOpen,
}: {
  state: SessionsState;
  panels: SessionPanels;
  max: number;
  /** Session ids currently shown in an agent tab. */
  attached: ReadonlySet<string>;
  /** A session or project being acted on (its buttons wait). */
  pending: string | null;
  onConnect: (session: BridgeSessionView) => void;
  onEnd: (session: BridgeSessionView) => void;
  onOpen: (closed: ClosedSession) => void;
}) {
  const full = panels.liveCount >= max;
  const detached = panels.live.some((s) => !attached.has(s.id));
  // Opens by itself when something needs attention (full, or a session no
  // tab shows) but closes only when the user closes it — it must not fold
  // away under the hand that just pressed one of its buttons (seen live).
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  if ((full || detached) && !open && !dismissed) setOpen(true);
  return (
    <details
      open={open}
      onToggle={(event) => {
        const next = event.currentTarget.open;
        if (next === open) return;
        setOpen(next);
        setDismissed(!next);
      }}
      className="group mb-3 border border-ink bg-slate-50"
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 [&::-webkit-details-marker]:hidden">
        <span className="bg-ink px-2 py-0.5 text-xs font-bold text-white">
          جلسات الجسر
        </span>
        {state === "ok" ? (
          <span
            className={`text-xs font-bold ${full ? "text-rose-700" : "text-slate-600"}`}
          >
            حيّة {panels.liveCount}/{max}
            {full ? " — ممتلئ" : ""}
          </span>
        ) : null}
        <span className="text-[11px] text-slate-500">
          {state === "outdated"
            ? "الجسر الحالي بإصدار أقدم لا يعرض جلساته — أعد تشغيله (npm run dev:all بعد إيقاف الجسر القديم)."
            : state === "offline"
              ? "الجسر غير متصل."
              : state === "bad_token"
                ? "توكن الجسر مرفوض — راجع الإعدادات."
                : "تبقى بعد إغلاق الصفحة وإعادة تشغيل المشروع"}
        </span>
        <ChevronDown
          size={16}
          className="ms-auto text-slate-500 transition group-open:rotate-180"
        />
      </summary>
      {state === "ok" ? (
        <div className="grid gap-3 border-t border-slate-200 p-3 lg:grid-cols-2">
          <section aria-label="الجلسات الحية">
            <h3 className="mb-1.5 text-xs font-bold text-emerald-800">
              الجلسات الحية
            </h3>
            <ul className="space-y-1.5">
              {panels.live.length === 0 ? (
                <li className="border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-400">
                  لا جلسات حيّة على الجسر.
                </li>
              ) : (
                panels.live.map((s) => {
                  const shown = attached.has(s.id);
                  return (
                    <Row
                      key={s.id}
                      agent={s.agent}
                      cwd={s.cwd}
                      when={time(s.startedAt)}
                    >
                      <button
                        type="button"
                        disabled={shown || pending !== null}
                        onClick={() => onConnect(s)}
                        className={`${btn} border-emerald-500 bg-emerald-50 text-emerald-800 hover:bg-emerald-100`}
                      >
                        <Link2 size={12} />
                        {shown ? "متصلة" : "الاتصال بالجلسة"}
                      </button>
                      <button
                        type="button"
                        disabled={pending !== null}
                        onClick={() => onEnd(s)}
                        title="يُغلق الوكيل في هذه الجلسة"
                        className={`${btn} border-slate-300 bg-white text-rose-700 hover:border-rose-500`}
                      >
                        <Power size={12} /> إنهاء الجلسة
                      </button>
                    </Row>
                  );
                })
              )}
            </ul>
            {panels.moreLive ? (
              <p className="mt-1 text-[11px] text-slate-500">
                و{panels.moreLive} جلسات حيّة أخرى لا تُعرض.
              </p>
            ) : null}
          </section>
          <section aria-label="الجلسات المغلقة">
            <h3 className="mb-1.5 text-xs font-bold text-slate-600">
              الجلسات المغلقة
            </h3>
            <ul className="space-y-1.5">
              {panels.closed.length === 0 ? (
                <li className="border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-400">
                  لا جلسات مغلقة مؤخراً.
                </li>
              ) : (
                panels.closed.map((c) => (
                  <Row
                    key={`${c.agent}:${c.cwd}`}
                    agent={c.agent}
                    cwd={c.cwd}
                    when={time(c.endedAt)}
                  >
                    <button
                      type="button"
                      disabled={pending !== null}
                      onClick={() => onOpen(c)}
                      title="يبدأ جلسة جديدة للوكيل في المجلد نفسه — محادثة الجلسة السابقة لا تُستعاد"
                      className={`${btn} border-slate-300 bg-white text-slate-700 hover:border-ink`}
                    >
                      <Play size={12} /> فتح الجلسة
                    </button>
                  </Row>
                ))
              )}
            </ul>
            {panels.moreClosed ? (
              <p className="mt-1 text-[11px] text-slate-500">
                و{panels.moreClosed} جلسات مغلقة أقدم.
              </p>
            ) : null}
          </section>
        </div>
      ) : null}
    </details>
  );
}
