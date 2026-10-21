"use client";

import "@xterm/xterm/css/xterm.css";
import type { FitAddon } from "@xterm/addon-fit";
import type { Terminal } from "@xterm/xterm";
import { Play, RotateCcw, ScanText, Square } from "lucide-react";
import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from "react";
import { agentLabel } from "@/lib/bridge/agents";
import { createQuietTracker } from "@/lib/bridge/quiet-tracker";
import {
  extractReply,
  isAgentBusy,
  pendingDecision,
  promptStuckInInput,
  turnRegion,
} from "@/lib/bridge/terminal-clean";
import {
  followPty,
  getPtySession,
  resizePty,
  resolveBridgeConfig,
  sendPtyInput,
  startPtySession,
  stopPtySession,
  type BridgeConfig,
  type PtySession,
} from "@/lib/services/agent-service";

export type TerminalStatus =
  | "idle"
  | "starting"
  | "live"
  | "exited"
  | "unavailable"
  | "error";

/** One captured turn: the deterministic reply and the raw changed region. */
export interface TurnCapture {
  reply: string;
  region: string;
  timedOut: boolean;
}

export interface AgentTerminalHandle {
  /**
   * Types `text` into the live agent (starting it if needed), waits for the
   * turn to settle and returns what it printed. Rejects when the session
   * cannot run (unavailable / failed start / exited mid-turn).
   */
  send: (text: string) => Promise<TurnCapture>;
  /** Starts the session — the last step of the tab's setup sequence. */
  start: () => Promise<void>;
  /** Current status, read synchronously (no render lag). */
  status: () => TerminalStatus;
  /** True while a turn is in flight — a new send would be refused. */
  busy: () => boolean;
  /** The bridge session this pane shows, if any. */
  sessionId: () => string | null;
  /**
   * Shows an existing live session in this pane (one found on the bridge).
   * False when it is gone/exited, or a turn is in flight here.
   */
  connect: (id: string) => Promise<boolean>;
  /** Lets go of the session WITHOUT ending it — it keeps running. */
  detach: () => boolean;
  /** Ends this pane's session (closes the agent) — same as «إنهاء الجلسة». */
  end: () => Promise<void>;
}

// Timings measured against the real Gemini CLI TUI (see terminal-clean.ts).
const QUIET_MS = 1500;
const MIN_TURN_MS = 8_000;
/** Text still in the input box this long after Enter → press Enter once more. */
const RESUBMIT_AFTER_MS = 4_000;
const NO_REPLY_MAX_MS = 90_000;
const TURN_MAX_MS = 15 * 60_000;
const READY_MAX_MS = 90_000;
const READY_FALLBACK_QUIET_MS = 6_000;
const sessionKey = (agent: string) => `toso.pty.${agent}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const samePath = (a: string, b: string) =>
  a.replace(/[\\/]+$/, "").toLowerCase() ===
  b.replace(/[\\/]+$/, "").toLowerCase();

/** Rendered buffer as logical lines (soft-wrapped rows joined back). */
function bufferLines(term: Terminal): string[] {
  const buffer = term.buffer.active;
  const lines: string[] = [];
  for (let i = 0; i < buffer.length; i++) {
    const line = buffer.getLine(i);
    if (!line) continue;
    const text = line.translateToString(true);
    if (line.isWrapped && lines.length) lines[lines.length - 1] += text;
    else lines.push(text);
  }
  return lines;
}

function viewport(term: Terminal): string {
  const buffer = term.buffer.active;
  const rows: string[] = [];
  for (let i = buffer.baseY; i < buffer.baseY + term.rows; i++) {
    rows.push(buffer.getLine(i)?.translateToString(true) ?? "");
  }
  return rows.join("\n");
}

/**
 * Resolves once xterm has PARSED everything written so far. term.write() is
 * queued, so under load (five agents streaming at once) the buffer can lag
 * the stream — reading it before the queue drains would capture a half-drawn
 * screen.
 */
const drain = (term: Terminal) =>
  new Promise<void>((resolve) => {
    // The timeout keeps a disposed/stalled terminal from hanging the loop.
    const timer = setTimeout(resolve, 500);
    term.write("", () => {
      clearTimeout(timer);
      resolve();
    });
  });

/** What the user can see: the screen plus scrollback growth (not raw bytes). */
const screenSignature = (term: Terminal, screen: string) =>
  `${term.buffer.active.length}|${term.buffer.active.baseY}|${screen}`;

const statusLabel: Record<TerminalStatus, string> = {
  idle: "غير مشغّلة",
  starting: "تبدأ…",
  live: "حيّة",
  exited: "انتهت",
  unavailable: "غير متاحة",
  error: "تعذّر التشغيل",
};

const statusTone: Record<TerminalStatus, string> = {
  idle: "bg-slate-200 text-slate-600",
  starting: "bg-sky-100 text-sky-700",
  live: "bg-emerald-100 text-emerald-700",
  exited: "bg-slate-200 text-slate-600",
  unavailable: "bg-amber-100 text-amber-800",
  error: "bg-rose-100 text-rose-700",
};

/**
 * The agent's own interactive TUI, live in a pseudo-terminal on the bridge
 * and rendered here with xterm.js. Fixed height, vertical scrollback. The
 * session survives tab switches and page reloads (re-attached from
 * sessionStorage) and ends only when the agent exits or you stop it.
 */
export function AgentTerminal({
  agent,
  bridge,
  workspace,
  trust,
  ready,
  visible,
  onStatus,
  ref,
}: {
  agent: string;
  bridge: BridgeConfig;
  workspace?: string;
  trust?: boolean;
  /** The tab's mandatory folder check passed for the current workspace. */
  ready: boolean;
  visible: boolean;
  onStatus?: (status: TerminalStatus) => void;
  ref?: Ref<AgentTerminalHandle>;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const sessionRef = useRef<{ id: string; config: BridgeConfig } | null>(null);
  const streamAbort = useRef<AbortController | null>(null);
  const quiet = useRef(createQuietTracker());
  const firstOutput = useRef(0);
  const inputBuffer = useRef("");
  const inputTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const captureNow = useRef(false);
  const turnActive = useRef(false);
  const statusRef = useRef<TerminalStatus>("idle");
  const messageRef = useRef<string | null>(null);
  // Latest props for async callbacks (they outlive the render that made them).
  const props = useRef({ bridge, workspace, trust, ready, onStatus });
  useEffect(() => {
    props.current = { bridge, workspace, trust, ready, onStatus };
  });

  const [status, setStatusState] = useState<TerminalStatus>("idle");
  const [message, setMessageState] = useState<string | null>(null);
  const [sessionCwd, setSessionCwd] = useState<string | null>(null);
  const [turnRunning, setTurnRunning] = useState(false);
  const [restored, setRestored] = useState(false);

  const setStatus = (next: TerminalStatus) => {
    statusRef.current = next;
    setStatusState(next);
    props.current.onStatus?.(next);
  };
  const setMessage = (next: string | null) => {
    messageRef.current = next;
    setMessageState(next);
  };

  function safeFit() {
    const host = hostRef.current;
    if (!host || host.clientWidth === 0 || !fitRef.current) return;
    fitRef.current.fit();
  }

  function attach(session: PtySession, config: BridgeConfig) {
    sessionRef.current = { id: session.id, config };
    setSessionCwd(session.cwd);
    setMessage(null);
    setStatus(session.alive ? "live" : "exited");
    streamAbort.current?.abort();
    const controller = new AbortController();
    streamAbort.current = controller;
    termRef.current?.reset();
    followPty(
      config,
      session.id,
      0,
      (event) => {
        if (typeof event.d === "string" && event.d) {
          termRef.current?.write(event.d);
          firstOutput.current ||= Date.now();
        }
        if (typeof event.exit === "number") {
          setMessage(
            event.exit === 127
              ? `${agentLabel(agent)} غير مثبّت أو غير موجود في PATH.`
              : `انتهت الجلسة (exit ${event.exit}) — أعد التشغيل لمتابعة العمل.`,
          );
          setStatus("exited");
        }
      },
      controller.signal,
    ).catch(() => {
      if (controller.signal.aborted) return;
      setMessage("انقطع البث من الجسر — أعد تشغيل الجسر أو الجلسة.");
      setStatus("error");
    });
  }

  async function start() {
    if (statusRef.current === "starting" || statusRef.current === "live")
      return;
    // No checked folder = no session — the bridge would inherit TOSO's own
    // cwd, and an unchecked path may not exist.
    if (!props.current.workspace?.trim() || !props.current.ready) {
      setMessage(
        "افحص مجلد المشروع أولاً — الخطوة ① أعلى هذه اللوحة — فالجلسة لا تبدأ قبل نجاح الفحص.",
      );
      setStatus("idle");
      return;
    }
    setStatus("starting");
    setMessage(null);
    firstOutput.current = 0;
    const dims = fitRef.current?.proposeDimensions();
    const { bridge: config, workspace: cwd, trust: trusted } = props.current;
    const result = await startPtySession(config, agent, {
      cwd,
      trust: trusted,
      cols: dims?.cols,
      rows: dims?.rows,
    });
    if (result.state !== "ok") {
      setMessage(
        result.state === "pty_unavailable"
          ? "الطرفيات المدمجة غير متاحة على هذا الجسر (node-pty) — يُستخدم التشغيل الأحادي بدلها."
          : result.state === "offline"
            ? "الجسر غير متصل — شغّله بأمر npm run bridge."
            : result.state === "bad_token"
              ? "توكن الجسر مرفوض — راجع الإعدادات."
              : result.state === "invalid_workspace"
                ? `مجلد المشروع مرفوض${result.detail ? `: ${result.detail}` : ""}.`
                : result.state === "too_many_sessions"
                  ? "الجسر وصل حدّه الأقصى (8 جلسات حيّة) — الجلسات تبقى بعد إغلاق الصفحة. أنهِ جلسة لا تحتاجها من قسم «جلسات الجسر» أعلاه ثم أعد المحاولة."
                  : `تعذّر تشغيل الجلسة${"detail" in result && result.detail ? ` (${result.detail})` : ""}.`,
      );
      setStatus(result.state === "pty_unavailable" ? "unavailable" : "error");
      return;
    }
    try {
      window.sessionStorage.setItem(sessionKey(agent), result.session.id);
    } catch {
      /* reattach after reload just won't be available */
    }
    attach(result.session, result.config);
  }

  async function stop() {
    const session = sessionRef.current;
    streamAbort.current?.abort();
    sessionRef.current = null;
    try {
      window.sessionStorage.removeItem(sessionKey(agent));
    } catch {
      /* ignore */
    }
    if (session) await stopPtySession(session.config, session.id);
    setSessionCwd(null);
    setMessage(null);
    setStatus("idle");
  }

  function detach(): boolean {
    if (turnActive.current) return false;
    streamAbort.current?.abort();
    sessionRef.current = null;
    try {
      window.sessionStorage.removeItem(sessionKey(agent));
    } catch {
      /* ignore */
    }
    termRef.current?.reset();
    setSessionCwd(null);
    setMessage(null);
    setStatus("idle");
    return true;
  }

  async function connect(id: string): Promise<boolean> {
    if (turnActive.current) return false;
    if (sessionRef.current?.id === id) return true;
    const config = await resolveBridgeConfig(props.current.bridge);
    const session = await getPtySession(config, id);
    if (!session?.alive) return false;
    try {
      window.sessionStorage.setItem(sessionKey(agent), id);
    } catch {
      /* reattach after reload just won't be available */
    }
    attach(session, config);
    return true;
  }

  function queueInput(data: string) {
    if (!sessionRef.current || statusRef.current !== "live") return;
    inputBuffer.current += data;
    if (inputTimer.current) return;
    inputTimer.current = setTimeout(() => {
      const session = sessionRef.current;
      const chunk = inputBuffer.current;
      inputBuffer.current = "";
      inputTimer.current = null;
      if (session && chunk)
        void sendPtyInput(session.config, session.id, chunk);
    }, 12);
  }

  /**
   * Waits until the agent's prompt accepts input. A dialog on screen (folder
   * trust, a menu, a first-run question) is the user's to answer — typing a
   * prompt into it would pick an option blindly (seen live: Claude's trust
   * dialog defaults to "No, exit"), so the turn stops and says so.
   */
  async function waitReady(term: Terminal) {
    const t0 = Date.now();
    while (Date.now() - t0 < READY_MAX_MS) {
      if (statusRef.current !== "live") break;
      await drain(term);
      const screen = viewport(term);
      const sinceOutput = quiet.current.observe(screenSignature(term, screen));
      const decision = pendingDecision(screen);
      if (decision && sinceOutput > 1000) {
        throw new Error(
          `${agentLabel(agent)} ينتظر قراراً منك في الطرفية أعلاه (${decision}) — أجب عليه ثم أعد الإرسال.`,
        );
      }
      const settled = !isAgentBusy(screen);
      // Ink TUIs (Gemini, Claude) switch bracketed paste on once their input
      // box is ready — the most reliable "ready" signal measured.
      if (term.modes.bracketedPasteMode && settled && sinceOutput > 800) return;
      if (
        firstOutput.current &&
        settled &&
        sinceOutput > READY_FALLBACK_QUIET_MS
      )
        return;
      await sleep(200);
    }
    if (statusRef.current !== "live") {
      throw new Error(messageRef.current ?? "terminal_not_live");
    }
  }

  async function send(text: string): Promise<TurnCapture> {
    if (turnActive.current)
      throw new Error("دورة سابقة لهذا الوكيل لم تنتهِ بعد.");
    turnActive.current = true;
    setTurnRunning(true);
    captureNow.current = false;
    try {
      if (statusRef.current !== "live") await start();
      const term = termRef.current;
      const session = sessionRef.current;
      if (!term || !session || statusRef.current !== "live") {
        throw new Error(messageRef.current ?? "الجلسة غير حيّة.");
      }
      await waitReady(term);
      // Some agents enable their input before a startup dialog paints (Devin
      // did live) — look once more right before typing.
      await sleep(400);
      const late = pendingDecision(viewport(term));
      if (late) {
        throw new Error(
          `${agentLabel(agent)} ينتظر قراراً منك في الطرفية أعلاه (${late}) — أجب عليه ثم أعد الإرسال.`,
        );
      }
      await drain(term);
      const before = bufferLines(term);
      const payload = term.modes.bracketedPasteMode
        ? `\x1b[200~${text}\x1b[201~`
        : text.replace(/\s*\r?\n\s*/g, " ");
      await sendPtyInput(session.config, session.id, payload);
      await sleep(300);
      await sendPtyInput(session.config, session.id, "\r");
      const t0 = Date.now();
      let sawBusy = false;
      let timedOut = false;
      let resubmitted = false;
      await sleep(1500);
      while (statusRef.current === "live" && !captureNow.current) {
        await drain(term);
        const screen = viewport(term);
        const busy = isAgentBusy(screen);
        sawBusy ||= busy;
        // A freshly started agent can take the paste yet drop the Enter (seen
        // live: Claude finishing a self-update). Text still in the input box
        // and no work begun → press Enter once more. Safe: a consumed Enter
        // empties the box, so this never fires twice for one prompt.
        if (
          !resubmitted &&
          !sawBusy &&
          Date.now() - t0 > RESUBMIT_AFTER_MS &&
          promptStuckInInput(screen, text)
        ) {
          resubmitted = true;
          await sendPtyInput(session.config, session.id, "\r");
          await sleep(1000);
          continue;
        }

        // A pending dialog (tool approval, menu) is neither busy nor done —
        // the agent is waiting on the user, not finished. Keep waiting so an
        // answered prompt resumes the turn instead of capturing the dialog.
        const waitingOnUser = Boolean(pendingDecision(screen));
        const settled =
          quiet.current.observe(screenSignature(term, screen)) >= QUIET_MS;
        const elapsed = Date.now() - t0;
        if (
          !busy &&
          !waitingOnUser &&
          settled &&
          (sawBusy || elapsed > MIN_TURN_MS)
        ) {
          // Quiet is not proof of an answer: a freshly started agent can sit
          // silent for 10s+ before it begins (seen live with Claude — the
          // prompt was still in its input box). A finished turn always has a
          // reply, so keep waiting while there is none.
          await drain(term);
          if (
            extractReply(before, bufferLines(term), text) ||
            elapsed > NO_REPLY_MAX_MS
          )
            break;
        }
        if (Date.now() - t0 > TURN_MAX_MS) {
          timedOut = true;
          break;
        }
        await sleep(250);
      }
      await drain(term);
      const after = bufferLines(term);
      const reply = extractReply(before, after, text);
      // Still waiting on a permission/menu and nothing real was captured —
      // record the blocker honestly instead of an empty or noisy reply.
      const pending = pendingDecision(viewport(term));
      if (pending && !reply) {
        throw new Error(
          `${agentLabel(agent)} ينتظر قراراً منك في الطرفية أعلاه (${pending}) — أجب عليه ثم أعد الإرسال.`,
        );
      }
      // The text never left the input box and nothing answered: say so
      // instead of reporting a finished turn with an empty/noisy reply.
      if (!reply && !sawBusy && promptStuckInInput(viewport(term), text)) {
        throw new Error(
          `${agentLabel(agent)} لم يستلم النص — بقي في خانة الإدخال دون إرسال. اضغط Enter في الطرفية أعلاه أو أعد الإرسال.`,
        );
      }
      return {
        reply,
        region: turnRegion(before, after),
        timedOut,
      };
    } finally {
      turnActive.current = false;
      setTurnRunning(false);
    }
  }

  useImperativeHandle(ref, () => ({
    send,
    start,
    status: () => statusRef.current,
    busy: () => turnActive.current,
    sessionId: () => sessionRef.current?.id ?? null,
    connect,
    detach,
    end: stop,
  }));

  // Mount: create xterm (client-only modules), then re-attach a session that
  // survived a page reload.
  useEffect(() => {
    let disposed = false;
    void (async () => {
      const [{ Terminal: XTerm }, { FitAddon: Fit }] = await Promise.all([
        import("@xterm/xterm"),
        import("@xterm/addon-fit"),
      ]);
      if (disposed || !hostRef.current) return;
      const term = new XTerm({
        fontFamily: '"Geist Mono", Consolas, "Courier New", monospace',
        fontSize: 13,
        scrollback: 5000,
        cursorBlink: false,
        theme: { background: "#14121f", foreground: "#e6e4f0" },
      });
      const fit = new Fit();
      term.loadAddon(fit);
      term.open(hostRef.current);
      termRef.current = term;
      fitRef.current = fit;
      safeFit();
      term.onData(queueInput);
      let saved: string | null = null;
      try {
        saved = window.sessionStorage.getItem(sessionKey(agent));
      } catch {
        /* no storage */
      }
      if (saved) {
        const config = await resolveBridgeConfig(props.current.bridge);
        const session = await getPtySession(config, saved);
        if (disposed) return;
        if (session?.alive) attach(session, config);
        else {
          try {
            window.sessionStorage.removeItem(sessionKey(agent));
          } catch {
            /* ignore */
          }
        }
      }
      if (!disposed) setRestored(true);
    })();
    return () => {
      disposed = true;
      streamAbort.current?.abort();
      termRef.current?.dispose();
      termRef.current = null;
    };
    // Mount-only by design: the session outlives prop changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the PTY sized to the pane (debounced; skipped while hidden).
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const observer = new ResizeObserver(() => {
      safeFit();
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const session = sessionRef.current;
        const term = termRef.current;
        if (session && term && statusRef.current === "live") {
          void resizePty(session.config, session.id, term.cols, term.rows);
        }
      }, 150);
    });
    observer.observe(host);
    return () => {
      observer.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, []);

  // Showing the tab: refit (after the reattach check).
  useEffect(() => {
    if (!visible || !restored) return;
    safeFit();
  }, [visible, restored]);

  const cwdChanged =
    status === "live" &&
    sessionCwd !== null &&
    Boolean(workspace?.trim()) &&
    !samePath(sessionCwd, workspace!.trim());

  return (
    <div className="overflow-hidden border-x border-b border-ink bg-[#14121f]">
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-3 py-2 text-[11px]">
        <span className={`px-2 py-0.5 font-bold ${statusTone[status]}`}>
          {statusLabel[status]}
        </span>
        <span className="font-bold text-white/80">
          {agentLabel(agent)} — طرفية تفاعلية
        </span>
        {sessionCwd && (
          <code dir="ltr" className="truncate font-mono text-white/50">
            {sessionCwd}
          </code>
        )}
        <div className="ms-auto flex items-center gap-1.5">
          {turnRunning && (
            <button
              type="button"
              onClick={() => (captureNow.current = true)}
              title="اعتبر الرد مكتملاً والتقطه الآن"
              className="flex items-center gap-1 border border-amber-400/60 px-2 py-1 font-bold text-amber-300 transition hover:bg-amber-400/10"
            >
              <ScanText size={12} /> يلتقط الرد… التقط الآن
            </button>
          )}
          {/* Starting lives in the tab's setup sequence (step ④); once a
              session runs, restart/stop belong to the terminal itself. */}
          {status === "live" || status === "starting" ? (
            <>
              <button
                type="button"
                onClick={() => void stop().then(start)}
                className="flex items-center gap-1 border border-white/20 px-2 py-1 font-bold text-white/70 transition hover:border-white/60 hover:text-white"
              >
                <RotateCcw size={12} /> إعادة تشغيل
              </button>
              <button
                type="button"
                onClick={() => void stop()}
                title="ينهي جلسة هذا التبويب فقط (يُغلق الوكيل) — الجلسات الأخرى لا تتأثر"
                className="flex items-center gap-1 border border-white/20 px-2 py-1 font-bold text-white/70 transition hover:border-rose-400 hover:text-rose-300"
              >
                <Square size={12} /> إنهاء الجلسة
              </button>
            </>
          ) : null}
        </div>
      </div>
      {(message || cwdChanged) && (
        <p
          role="status"
          dir="auto"
          className="border-b border-white/10 px-3 py-1.5 text-[11px] text-amber-300"
        >
          {cwdChanged
            ? "مسار المشروع تغيّر منذ بدء الجلسة — أعد التشغيل لتطبيقه."
            : message}
        </p>
      )}
      {/* overflow-hidden: xterm parks its helper textarea at left:-9999em,
          which on an RTL page becomes horizontal page scroll. */}
      <div className="relative h-[26rem] overflow-hidden p-2" dir="ltr">
        <div ref={hostRef} className="h-full w-full" />
        {status === "idle" && (
          <p
            dir="rtl"
            className="pointer-events-none absolute inset-0 grid place-items-center px-6 text-center text-sm text-white/40"
          >
            {ready
              ? "الجلسة غير مشغّلة — اضغط «④ تشغيل الجلسة» أعلاه، أو أرسل نصاً من مدخل الوكيل أدناه فتبدأ تلقائياً."
              : "الجلسة غير مشغّلة — ابدأ بالخطوة ① «فحص» أعلاه."}
          </p>
        )}
      </div>
    </div>
  );
}
