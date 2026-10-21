"use client";

import {
  Check,
  ChevronDown,
  Coins,
  Copy,
  Gauge,
  Info,
  Languages,
  RotateCcw,
  Settings2,
  Sparkles,
  Wand2,
} from "lucide-react";
import { memo, useEffect, useRef, useState, type ReactNode } from "react";
import {
  AgentCard,
  type AgentRunState,
  type AgentTranslation,
} from "@/components/agent-card";
import { AgentComposer } from "@/components/agent-composer";
import { AgentViewTabs, type AgentView } from "@/components/agent-view-tabs";
import { BridgeBadge } from "@/components/bridge-badge";
import {
  MeasureGauges,
  formatCost,
  gaugeData,
} from "@/components/measure-gauges";
import {
  BridgeSessions,
  type SessionsState,
} from "@/components/bridge-sessions";
import {
  AgentTabStrip,
  AgentWorkspacePanel,
  type TabStatus,
  type TerminalNote,
} from "@/components/agent-tabs";
import {
  AGENT_LOG_SESSION,
  AgentTranscript,
  appendTurn,
  patchTurn,
  restoreLog,
  type AgentLog,
  type AgentTurn,
} from "@/components/agent-session-log";
import {
  AgentTerminal,
  type AgentTerminalHandle,
  type TerminalStatus,
} from "@/components/agent-terminal";
import {
  SettingsModal,
  dotClass,
  statusFromKeySignal,
  type KeyStatus,
} from "@/components/settings-modal";
import {
  AGENT_OPTIONS,
  DEFAULT_BRIDGE_URL,
  agentCommand,
  agentLabel,
  isAgentWireText,
} from "@/lib/bridge/agents";
import {
  abortAllRuns,
  beginRun,
  type RunRegistry,
} from "@/lib/bridge/run-registry";
import {
  AGENT_SETUP_SESSION,
  AUTO_TRUST_AGENTS_STORAGE,
  LEGACY_AUTO_TERMINAL_STORAGE,
  parseAgentSetup,
  setupDone,
  type AgentSetup,
  LEGACY_AUTO_TRUST_STORAGE,
  LEGACY_WORKSPACE_STORAGE,
  WORKSPACES_STORAGE,
  parseAgentFlags,
  parseWorkspaces,
  samePath,
  serializeAgentFlags,
  serializeWorkspaces,
  withAgentFlag,
  withWorkspace,
  workspaceFor,
} from "@/lib/bridge/workspaces";
import type { DualOptimization } from "@/lib/optimizer/llm-optimizer";
import type { EntityCheck } from "@/lib/optimizer/entity-guard";
import type { QualityCheck } from "@/lib/optimizer/quality-guard";
import {
  DEFAULT_MODEL,
  DEFAULT_PROVIDER,
  getModel,
  providers,
} from "@/lib/providers/registry";
import {
  LIVE_SNAPSHOT_STORAGE,
  SESSION_HISTORY_STORAGE,
  newlyClosed,
  parseHistory,
  parseLiveSnapshot,
  recordClosed,
  sessionPanels,
  type BridgeSessionView,
  type ClosedSession,
} from "@/lib/bridge/session-history";
import {
  checkWorkspace,
  cleanAgentOutput,
  describeBridgeAction,
  listPtySessions,
  openAgentTerminal,
  resolveBridgeConfig,
  sendPromptToAgent,
  stopPtySession,
  translateToArabic,
} from "@/lib/services/agent-service";
import { runOptimization } from "@/lib/services/optimization-service";
import { estimateHeatmapSegments } from "@/lib/token-engine/bpe-estimator";
import { arabicRatio } from "@/lib/token-engine/token-engine";
import type {
  CostEstimate,
  GeminiUsage,
  OptimizationReport,
  ProviderConfig,
  TokenMeasurement,
  VariantReport,
} from "@/lib/types";

const initialConfig: ProviderConfig = {
  provider: DEFAULT_PROVIDER,
  model: DEFAULT_MODEL,
};

/** BYOK key lives in browser storage only — sent per request as a header. */
const USER_KEY_STORAGE = "toso.userGeminiKey";
const BRIDGE_URL_STORAGE = "toso.bridgeUrl";
const BRIDGE_TOKEN_STORAGE = "toso.bridgeToken";
const AGENT_STORAGE = "toso.agent";
const NO_ENGLISH_NOTE =
  "لم يُرسَل شيء: الوكلاء يستقبلون الإنجليزية فقط (لتقليل التوكنز)، وهذا النص ليس إنجليزياً — عالجه أولاً من مدخل الوكيل.";
/** Per-agent «إرسال مباشرة بعد المعالجة» switches. */
const AUTO_SEND_AGENTS_STORAGE = "toso.autoSendAgents";
/** The old single global auto-send (default agent only) — migrated once. */
const LEGACY_AUTO_SEND_STORAGE = "toso.autoSend";
const AUTO_TRANSLATE_STORAGE = "toso.autoTranslate";
const SMART_CLEAN_STORAGE = "toso.smartClean";

/** One agent tab's CLI leg: its latest run and that run's translation. */
interface AgentSession {
  run: AgentRunState | null;
  translation: AgentTranslation | null;
}
const EMPTY_SESSION: AgentSession = { run: null, translation: null };

/** The bridge-facing settings a terminal launch needs, for one agent's tab. */
interface TerminalSettings {
  bridgeUrl?: string;
  bridgeToken?: string;
  workspace?: string;
  autoTrust?: boolean;
  /** Step ① passed for this folder. */
  checked: boolean;
}

function terminalSettings(
  config: ProviderConfig,
  agentId: string,
  checked: boolean,
): TerminalSettings {
  return {
    bridgeUrl: config.bridgeUrl,
    bridgeToken: config.bridgeToken,
    workspace: workspaceFor(config.workspaces, agentId),
    autoTrust: config.autoTrustAgents?.[agentId],
    checked,
  };
}

/** Turns whose reply (or failure) is in — the ones OUT has something to show for. */
const finishedCount = (turns: AgentTurn[] | undefined) =>
  (turns ?? []).filter((t) => t.status !== "running").length;

/**
 * Tab dot: a turn or one-shot run in flight beats everything; then the last
 * turn's outcome; a live idle session reads as ready.
 */
function tabStatus(
  run: AgentRunState | null,
  turns: AgentTurn[] | undefined,
  terminal: TerminalStatus | undefined,
): TabStatus {
  const last = turns?.at(-1);
  if (
    last?.status === "running" ||
    run?.phase === "connecting" ||
    run?.phase === "running"
  ) {
    return "running";
  }
  if (last) return last.status === "done" ? "done" : "error";
  if (terminal === "live") return "done";
  if (terminal === "error") return "error";
  return "idle";
}

interface TerminalUi {
  setBusy: (agent: string | null) => void;
  setNote: (note: TerminalNote | null) => void;
  setOpened: (
    update: (opened: Record<string, number>) => Record<string, number>,
  ) => void;
}

/**
 * Opens a separate, EXTERNAL terminal window for the agent (a secondary
 * option beside the embedded terminal): launch and release — TOSO never
 * reads it, and it shares no context with the embedded session.
 */
async function launchAgentTerminal(
  agentId: string,
  settings: TerminalSettings,
  ui: TerminalUi,
) {
  ui.setBusy(agentId);
  ui.setNote(null);
  if (!settings.workspace?.trim() || !settings.checked) {
    ui.setNote({
      agent: agentId,
      ok: false,
      text: `افحص مجلد مشروع ${agentLabel(agentId)} أولاً (الخطوة ①) — نافذة خارجية بلا مجلد مفحوص قد تعمل على مجلد TOSO نفسه.`,
    });
    ui.setBusy(null);
    return;
  }
  try {
    const result = await openAgentTerminal(
      {
        url: settings.bridgeUrl ?? DEFAULT_BRIDGE_URL,
        token: settings.bridgeToken ?? "",
      },
      agentId,
      { cwd: settings.workspace, trust: settings.autoTrust },
    );
    if (result.state === "ok") {
      ui.setOpened((opened) => ({
        ...opened,
        [agentId]: (opened[agentId] ?? 0) + 1,
      }));
      ui.setNote({
        agent: agentId,
        ok: true,
        text: `فُتحت نافذة خارجية لـ ${agentLabel(agentId)} — جلسة منفصلة عن الطرفية المدمجة، لا يقرؤها TOSO.`,
      });
    } else {
      ui.setNote({
        agent: agentId,
        ok: false,
        text: describeBridgeAction(result),
      });
    }
  } finally {
    ui.setBusy(null);
  }
}

export type Phase = "idle" | "analyzing" | "optimizing" | "measuring" | "done";
type NodeStatus = "idle" | "active" | "done";

const runLabel: Record<Exclude<Phase, "idle" | "done">, string> = {
  analyzing: "يقيس الـTokens…",
  optimizing: "يفهم ويعيد الصياغة…",
  measuring: "يقيس الناتج…",
};

export function OptimizerWorkspace() {
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [original, setOriginal] = useState<TokenMeasurement | null>(null);
  const [originalRatio, setOriginalRatio] = useState<number | null>(null);
  const [dual, setDual] = useState<DualOptimization | null>(null);
  const [report, setReport] = useState<OptimizationReport | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [config, setConfig] = useState<ProviderConfig>(initialConfig);
  const [keyHydrated, setKeyHydrated] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  // Latest user-key signal: ok (served), user_key_* reason, or null (no
  // user-key evidence this run). Bound to the key value it describes.
  const [keySignal, setKeySignal] = useState<{
    key: string;
    signal: string;
  } | null>(null);
  // The CLI-agent leg, one session per agent tab: which text was sent, the
  // job state, and the on-demand Arabic translation of its output. Each
  // agent has its own abort controller, so a send to Gemini never cancels
  // a Claude run in another project.
  const [sessions, setSessions] = useState<Record<string, AgentSession>>({});
  const agentAbort = useRef<RunRegistry>({});
  // Job ids being translated (card or log) — independent per job.
  const [translatingJobs, setTranslatingJobs] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  // Numbered per-agent session log — React state only, gone with the tab.
  const [agentLog, setAgentLog] = useState<AgentLog>({});
  // Interactive terminal windows opened this session (count per agent).
  const [terminalOpened, setTerminalOpened] = useState<Record<string, number>>(
    {},
  );
  const [terminalBusy, setTerminalBusy] = useState<string | null>(null);
  const [terminalNote, setTerminalNote] = useState<TerminalNote | null>(null);
  // Per-agent setup steps (① check, ② permanent trust), bound to the folder
  // each succeeded on — survives tab switches and reloads (sessionStorage).
  const [agentSetup, setAgentSetup] = useState<AgentSetup>({});
  const folderChecked = (agent: string) =>
    setupDone(agentSetup, config.workspaces, agent, "checked");
  const patchSession = (
    agent: string,
    update: (session: AgentSession) => AgentSession,
  ) =>
    setSessions((all) => ({
      ...all,
      [agent]: update(all[agent] ?? EMPTY_SESSION),
    }));
  const setRun = (
    agent: string,
    next:
      | AgentRunState
      | null
      | ((current: AgentRunState | null) => AgentRunState | null),
  ) =>
    patchSession(agent, (session) => ({
      ...session,
      run: typeof next === "function" ? next(session.run) : next,
    }));
  // The open agent tab — null means "the default from settings" (the tab
  // that opens first). Every agent has its own prompt box, so the open tab
  // is only what you look at, never a send target to get wrong.
  const [pickedAgent, setPickedAgent] = useState<string | null>(null);
  const defaultAgent = config.agent ?? AGENT_OPTIONS[0].id;
  const activeAgent = pickedAgent ?? defaultAgent;

  const terminalUi: TerminalUi = {
    setBusy: setTerminalBusy,
    setNote: setTerminalNote,
    setOpened: setTerminalOpened,
  };
  const launchTerminal = (agentId: string, settings: TerminalSettings) =>
    launchAgentTerminal(agentId, settings, terminalUi);
  const activeSession = sessions[activeAgent] ?? EMPTY_SESSION;
  const activeRun = activeSession.run;
  // Embedded terminal per agent tab: its imperative handle (send/capture)
  // and its live status (drives the tab dot and the one-shot fallback).
  const terminals = useRef<Record<string, AgentTerminalHandle | null>>({});
  const [terminalStatus, setTerminalStatus] = useState<
    Record<string, TerminalStatus>
  >({});
  // «جلسات الجسر»: what the bridge holds (sessions outlive the page), the
  // browser's memory of closed ones, and which ids the tabs are showing.
  const [bridgeSessions, setBridgeSessions] = useState<{
    state: SessionsState;
    sessions: BridgeSessionView[];
    max: number;
    /** The bridge the page is paired with (settings or auto-pairing). */
    url: string;
  }>({ state: "loading", sessions: [], max: 8, url: DEFAULT_BRIDGE_URL });
  const [sessionHistory, setSessionHistory] = useState<ClosedSession[]>([]);
  const [attachedIds, setAttachedIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [sessionPending, setSessionPending] = useState<string | null>(null);
  // Which of the three views each agent shows: its terminal, IN or OUT.
  const [views, setViews] = useState<Record<string, AgentView>>({});
  // Finished turns the user has already looked at, per agent — the OUT dot
  // appears only for replies that landed after the last look.
  const [seenTurns, setSeenTurns] = useState<Record<string, number>>({});
  // Which agent's processing the gauges describe, and when it finished.
  const [lastRun, setLastRun] = useState<{ agent: string; at: number } | null>(
    null,
  );
  const [sessionsOpenSignal, setSessionsOpenSignal] = useState(0);
  const lastLive = useRef<BridgeSessionView[] | null>(null);
  /** «فتح الجلسة»: start once the tab shows the reopened, checked folder. */
  const pendingStart = useRef<{ agent: string; cwd: string } | null>(null);

  // Hydrate the BYOK key and bridge settings once on mount, then mirror
  // every change to storage.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(USER_KEY_STORAGE);
      const bridgeUrl = window.localStorage.getItem(BRIDGE_URL_STORAGE);
      const bridgeToken = window.localStorage.getItem(BRIDGE_TOKEN_STORAGE);
      const agent = window.localStorage.getItem(AGENT_STORAGE);
      const autoSendAgents = parseAgentFlags(
        window.localStorage.getItem(AUTO_SEND_AGENTS_STORAGE),
      );
      // The old global auto-send applied to the default agent only — carry
      // it over to that agent's own switch, once.
      if (window.localStorage.getItem(LEGACY_AUTO_SEND_STORAGE) === "1") {
        autoSendAgents[agent ?? AGENT_OPTIONS[0].id] = true;
      }
      window.localStorage.removeItem(LEGACY_AUTO_SEND_STORAGE);
      const workspaces = parseWorkspaces(
        window.localStorage.getItem(WORKSPACES_STORAGE),
      );
      // The single global folder was replaced by per-agent folders.
      window.localStorage.removeItem(LEGACY_WORKSPACE_STORAGE);
      const autoTrustAgents = parseAgentFlags(
        window.localStorage.getItem(AUTO_TRUST_AGENTS_STORAGE),
      );
      // Migrations: a single trust boolean predated the per-agent map (it
      // applied to gemini — then the only supporting agent), and the
      // auto-terminal toggle was removed; sessions start on first send.
      if (
        window.localStorage.getItem(LEGACY_AUTO_TRUST_STORAGE) === "1" &&
        !autoTrustAgents.gemini
      ) {
        autoTrustAgents.gemini = true;
      }
      window.localStorage.removeItem(LEGACY_AUTO_TRUST_STORAGE);
      window.localStorage.removeItem(LEGACY_AUTO_TERMINAL_STORAGE);
      const autoTranslate =
        window.localStorage.getItem(AUTO_TRANSLATE_STORAGE) === "1";
      const smartClean =
        window.localStorage.getItem(SMART_CLEAN_STORAGE) === "1";
      setConfig((c) => ({
        ...c,
        ...(stored ? { userKey: stored } : {}),
        ...(bridgeUrl ? { bridgeUrl } : {}),
        ...(bridgeToken ? { bridgeToken } : {}),
        ...(agent ? { agent } : {}),
        ...(Object.keys(autoSendAgents).length ? { autoSendAgents } : {}),
        ...(Object.keys(workspaces).length ? { workspaces } : {}),
        ...(Object.keys(autoTrustAgents).length ? { autoTrustAgents } : {}),
        ...(autoTranslate ? { autoTranslate } : {}),
        ...(smartClean ? { smartClean } : {}),
      }));
      setSessionHistory(
        parseHistory(window.localStorage.getItem(SESSION_HISTORY_STORAGE)),
      );
      const restoredLog = restoreLog(
        window.sessionStorage.getItem(AGENT_LOG_SESSION),
      );
      setAgentLog(restoredLog);
      setSeenTurns(
        Object.fromEntries(
          Object.entries(restoredLog).map(([id, turns]) => [
            id,
            finishedCount(turns),
          ]),
        ),
      );
      setAgentSetup(
        parseAgentSetup(window.sessionStorage.getItem(AGENT_SETUP_SESSION)),
      );
    } catch {
      setStorageWarning(true);
    } finally {
      setKeyHydrated(true);
    }
  }, []);
  useEffect(() => {
    if (!keyHydrated) return;
    try {
      if (config.userKey) {
        window.localStorage.setItem(USER_KEY_STORAGE, config.userKey);
      } else {
        window.localStorage.removeItem(USER_KEY_STORAGE);
      }
    } catch {
      setStorageWarning(true);
    }
  }, [config.userKey, keyHydrated]);
  useEffect(() => {
    if (!keyHydrated) return;
    try {
      if (config.bridgeUrl) {
        window.localStorage.setItem(BRIDGE_URL_STORAGE, config.bridgeUrl);
      } else {
        window.localStorage.removeItem(BRIDGE_URL_STORAGE);
      }
      if (config.bridgeToken) {
        window.localStorage.setItem(BRIDGE_TOKEN_STORAGE, config.bridgeToken);
      } else {
        window.localStorage.removeItem(BRIDGE_TOKEN_STORAGE);
      }
      if (config.agent) {
        window.localStorage.setItem(AGENT_STORAGE, config.agent);
      } else {
        window.localStorage.removeItem(AGENT_STORAGE);
      }
      const autoSendJson = serializeAgentFlags(config.autoSendAgents);
      if (autoSendJson) {
        window.localStorage.setItem(AUTO_SEND_AGENTS_STORAGE, autoSendJson);
      } else {
        window.localStorage.removeItem(AUTO_SEND_AGENTS_STORAGE);
      }
      const workspacesJson = serializeWorkspaces(config.workspaces);
      if (workspacesJson) {
        window.localStorage.setItem(WORKSPACES_STORAGE, workspacesJson);
      } else {
        window.localStorage.removeItem(WORKSPACES_STORAGE);
      }
      const autoTrustJson = serializeAgentFlags(config.autoTrustAgents);
      if (autoTrustJson) {
        window.localStorage.setItem(AUTO_TRUST_AGENTS_STORAGE, autoTrustJson);
      } else {
        window.localStorage.removeItem(AUTO_TRUST_AGENTS_STORAGE);
      }
      for (const [key, on] of [
        [AUTO_TRANSLATE_STORAGE, config.autoTranslate],
        [SMART_CLEAN_STORAGE, config.smartClean],
      ] as const) {
        if (on) window.localStorage.setItem(key, "1");
        else window.localStorage.removeItem(key);
      }
    } catch {
      setStorageWarning(true);
    }
  }, [
    config.bridgeUrl,
    config.bridgeToken,
    config.agent,
    config.autoSendAgents,
    config.workspaces,
    config.autoTrustAgents,
    config.autoTranslate,
    config.smartClean,
    keyHydrated,
  ]);
  // The IN/OUT log lives as long as the tab (reloads included), like the
  // reattachable terminal — closing the tab/browser erases it.
  useEffect(() => {
    if (!keyHydrated) return;
    try {
      if (Object.keys(agentLog).length) {
        window.sessionStorage.setItem(
          AGENT_LOG_SESSION,
          JSON.stringify(agentLog),
        );
      } else {
        window.sessionStorage.removeItem(AGENT_LOG_SESSION);
      }
    } catch {
      /* quota or no storage — the log still works for this page view */
    }
  }, [agentLog, keyHydrated]);
  useEffect(() => {
    if (!keyHydrated) return;
    try {
      if (Object.keys(agentSetup).length) {
        window.sessionStorage.setItem(
          AGENT_SETUP_SESSION,
          JSON.stringify(agentSetup),
        );
      } else {
        window.sessionStorage.removeItem(AGENT_SETUP_SESSION);
      }
    } catch {
      /* no storage — the steps still hold for this page view */
    }
  }, [agentSetup, keyHydrated]);
  // A new default in settings opens that agent's tab.
  useEffect(() => setPickedAgent(null), [config.agent]);

  // Closed sessions are remembered across browser restarts — the bridge
  // forgets an ended session within minutes.
  useEffect(() => {
    if (!keyHydrated) return;
    try {
      if (sessionHistory.length) {
        window.localStorage.setItem(
          SESSION_HISTORY_STORAGE,
          JSON.stringify(sessionHistory),
        );
      } else {
        window.localStorage.removeItem(SESSION_HISTORY_STORAGE);
      }
    } catch {
      /* no storage — the panel still works for this page view */
    }
  }, [sessionHistory, keyHydrated]);

  // «جلسات الجسر»: re-read the bridge's sessions (cheap, local) so a new
  // tab sees sessions started before it, and notice the ones that closed.
  const refreshSessions = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    refreshSessions.current = async () => {
      const result = await listPtySessions({
        url: config.bridgeUrl ?? DEFAULT_BRIDGE_URL,
        token: config.bridgeToken ?? "",
      });
      if (result.state !== "ok") {
        setBridgeSessions((s) => ({ ...s, state: result.state }));
        return;
      }
      // First look of this page: compare with the snapshot the last page
      // left — sessions may have ended while no page was open.
      let before = lastLive.current;
      if (!before) {
        try {
          before = parseLiveSnapshot(
            window.localStorage.getItem(LIVE_SNAPSHOT_STORAGE),
          );
        } catch {
          before = [];
        }
      }
      const closed = newlyClosed(before, result.sessions, Date.now());
      if (closed.length) setSessionHistory((h) => recordClosed(h, closed));
      lastLive.current = result.sessions
        .filter((s) => s.alive)
        .map(({ id, agent, cwd, alive, startedAt }) => ({
          id,
          agent,
          cwd,
          alive,
          startedAt,
        }));
      try {
        window.localStorage.setItem(
          LIVE_SNAPSHOT_STORAGE,
          JSON.stringify(lastLive.current),
        );
      } catch {
        /* no storage — closes are still noticed while this page is open */
      }
      setBridgeSessions({
        state: "ok",
        sessions: result.sessions,
        max: result.max,
        url: result.config.url,
      });
      // A tab still re-attaching after a reload counts as showing its
      // session — else the panel would flag it as detached for a moment.
      const reattaching = (agent: string) => {
        try {
          return window.sessionStorage.getItem(`toso.pty.${agent}`);
        } catch {
          return null;
        }
      };
      setAttachedIds(
        new Set(
          AGENT_OPTIONS.map(
            (o) => terminals.current[o.id]?.sessionId() ?? reattaching(o.id),
          ).filter((id): id is string => Boolean(id)),
        ),
      );
    };
  });
  useEffect(() => {
    if (!keyHydrated) return;
    void refreshSessions.current();
    const timer = setInterval(() => void refreshSessions.current(), 5_000);
    return () => clearInterval(timer);
  }, [keyHydrated]);
  // «فتح الجلسة» starts the session only once the tab shows the reopened
  // folder as checked (the pane reads its props after this render).
  useEffect(() => {
    const target = pendingStart.current;
    if (
      !target ||
      !folderChecked(target.agent) ||
      !samePath(workspaceFor(config.workspaces, target.agent), target.cwd)
    )
      return;
    pendingStart.current = null;
    void terminals.current[target.agent]
      ?.start()
      .then(() => refreshSessions.current());
  });

  /** Shows a live bridge session in its agent's tab. */
  async function connectSession(session: BridgeSessionView) {
    setSessionPending(session.id);
    try {
      const terminal = terminals.current[session.agent];
      setPickedAgent(session.agent);
      if (!terminal || !(await terminal.connect(session.id))) {
        setTerminalNote({
          agent: session.agent,
          ok: false,
          text: terminal?.busy()
            ? `${agentLabel(session.agent)} يعمل على دورة في هذا التبويب — انتظر انتهاءها ثم اتصل بالجلسة.`
            : "الجلسة لم تعد حيّة على الجسر.",
        });
        return;
      }
      // The bridge validated this folder when it started the session.
      setConfig((c) => ({
        ...c,
        workspaces: withWorkspace(c.workspaces, session.agent, session.cwd),
      }));
      setAgentSetup((all) => ({
        ...all,
        [session.agent]: { ...all[session.agent], checked: session.cwd },
      }));
      setTerminalNote(null);
    } finally {
      setSessionPending(null);
      void refreshSessions.current();
    }
  }

  /** Ends a bridge session (closes the agent) — shown in a tab or not. */
  async function endSession(session: BridgeSessionView) {
    setSessionPending(session.id);
    try {
      const terminal = terminals.current[session.agent];
      if (terminal?.sessionId() === session.id) await terminal.end();
      else {
        await stopPtySession(
          await resolveBridgeConfig({
            url: config.bridgeUrl ?? DEFAULT_BRIDGE_URL,
            token: config.bridgeToken ?? "",
          }),
          session.id,
        );
      }
    } finally {
      setSessionPending(null);
      void refreshSessions.current();
    }
  }

  /**
   * Reopens a closed session: a NEW session of that agent in that folder
   * (the old conversation is gone with its process). A session the tab is
   * showing is let go, not ended — it stays in the live list.
   */
  async function openClosedSession(closed: ClosedSession) {
    setSessionPending(`${closed.agent}:${closed.cwd}`);
    try {
      setPickedAgent(closed.agent);
      const check = await checkWorkspace(
        {
          url: config.bridgeUrl ?? DEFAULT_BRIDGE_URL,
          token: config.bridgeToken ?? "",
        },
        closed.cwd,
      );
      if (check.state !== "ok") {
        setTerminalNote({
          agent: closed.agent,
          ok: false,
          text: `تعذّر فتح الجلسة: ${describeBridgeAction(check)}`,
        });
        return;
      }
      const terminal = terminals.current[closed.agent];
      if (terminal?.sessionId() && !terminal.detach()) {
        setTerminalNote({
          agent: closed.agent,
          ok: false,
          text: `${agentLabel(closed.agent)} يعمل على دورة في هذا التبويب — انتظر انتهاءها ثم افتح الجلسة.`,
        });
        return;
      }
      const cwd = check.path ?? closed.cwd;
      pendingStart.current = { agent: closed.agent, cwd };
      setConfig((c) => ({
        ...c,
        workspaces: withWorkspace(c.workspaces, closed.agent, cwd),
      }));
      setAgentSetup((all) => ({
        ...all,
        [closed.agent]: { ...all[closed.agent], checked: cwd },
      }));
      setTerminalNote(null);
    } finally {
      setSessionPending(null);
    }
  }

  /**
   * Analyses one agent's draft (measure → local cleanup → Gemini rewrite →
   * measure) and returns the report, or null on failure. One analysis at a
   * time; the details zone always shows the latest one.
   */
  async function handleRun(
    prompt: string,
    agent: string,
  ): Promise<OptimizationReport | null> {
    if (!keyHydrated || !prompt.trim() || running) return null;
    setRunning(true);
    setRunError(null);
    setReport(null);
    setDual(null);
    setOriginal(null);
    setOriginalRatio(null);
    setPhase("analyzing");
    try {
      const nextReport = await runOptimization(prompt, config, {
        onOriginalMeasured: (measurement) => {
          setOriginal(measurement);
          setOriginalRatio(arabicRatio(prompt));
          setPhase("optimizing");
        },
        onOptimized: (optimized) => {
          setDual(optimized);
          setPhase("measuring");
          setKeySignal(
            config.userKey
              ? optimized.source === "gemini" && optimized.viaUserKey
                ? { key: config.userKey, signal: "ok" }
                : optimized.fallbackReason?.startsWith("user_key_")
                  ? { key: config.userKey, signal: optimized.fallbackReason }
                  : null
              : null,
          );
        },
      });
      setReport(nextReport);
      setOriginal(nextReport.originalMeasurement ?? null);
      setPhase("done");
      setLastRun({ agent, at: Date.now() });
      return nextReport;
    } catch {
      setReport(null);
      setDual(null);
      setOriginal(null);
      setOriginalRatio(null);
      setPhase("idle");
      setRunError(
        "تعذّر إكمال التحليل. نصك ما زال في مدخل الوكيل؛ أعد المحاولة.",
      );
      return null;
    } finally {
      setRunning(false);
    }
  }
  function reset() {
    setRunError(null);
    setReport(null);
    setDual(null);
    setOriginal(null);
    setOriginalRatio(null);
    setPhase("idle");
    abortAllRuns(agentAbort.current);
    setSessions({});
    setPickedAgent(null);
  }

  /**
   * Sends the polished text to the chosen CLI agent via the local bridge.
   * Every failure is its own honest state — bridge offline, bad token,
   * agent crash — and a fresh send to the SAME agent aborts only that
   * agent's previous run; other agents' tabs keep running untouched.
   */
  /**
   * Why a send to this agent must not happen, or null. Agents receive
   * English only (fewer tokens) — so no path can leak Arabic to an agent —
   * and a run needs its own CHECKED project folder, without which the
   * bridge would silently operate on TOSO itself.
   */
  function sendBlocker(text: string, agent: string): string | null {
    if (!isAgentWireText(text)) return NO_ENGLISH_NOTE;
    if (!folderChecked(agent)) {
      return workspaceFor(config.workspaces, agent)
        ? `لم يُرسَل النص: افحص مجلد مشروع ${agentLabel(agent)} أولاً — الخطوة ① «فحص المجلد».`
        : `لم يُرسَل النص: حدّد مجلد مشروع ${agentLabel(agent)} ثم افحصه — الخطوة ①.`;
    }
    return null;
  }

  /** Shows a refused send in that agent's tab, where the setup lives. */
  function refuseSend(agent: string, text: string) {
    setPickedAgent(agent);
    setTerminalNote({ agent, ok: false, text });
  }

  /**
   * The prompt box's send: checks synchronously (so a refused text stays in
   * the box), then fires the turn without waiting for the reply.
   */
  function dispatchToAgent(text: string, agent: string, inputUser: string) {
    const blocked = sendBlocker(text, agent);
    if (blocked) {
      refuseSend(agent, blocked);
      return false;
    }
    setTerminalNote(null);
    void sendToAgent(text, agent, inputUser);
    return true;
  }

  /**
   * «إرسال أيضاً» from the IN/OUT log: re-sends already-processed English
   * texts to another agent, one turn after another (an agent takes one turn
   * at a time) — no new processing, no new cost.
   */
  async function sendAlso(jobIds: string[], target: string) {
    const turns = (agentLog[activeAgent] ?? []).filter((t) =>
      jobIds.includes(t.jobId),
    );
    if (!turns.length) return;
    const blocked = sendBlocker(turns[0].inputWire, target);
    if (blocked) {
      refuseSend(target, blocked);
      return;
    }
    setPickedAgent(target);
    for (const turn of turns) {
      // An agent takes one turn at a time: wait for the one in flight
      // (started here or by the user) instead of failing every text. A turn
      // is "in flight" from the moment it is sent — including while the
      // session is still starting (seen live) — and always ends (finally).
      const terminal = terminals.current[target];
      while (terminal?.busy()) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      await sendToAgent(turn.inputWire, target, turn.inputUser);
    }
  }

  async function sendToAgent(text: string, agent: string, inputUser: string) {
    const blocked = sendBlocker(text, agent);
    if (blocked) {
      refuseSend(agent, blocked);
      return;
    }
    // The live embedded session is the primary path; the one-shot run is
    // the honest fallback when the bridge has no PTY support.
    const terminal = terminals.current[agent];
    if (terminal && terminalStatus[agent] !== "unavailable") {
      if (await sendViaTerminal(terminal, text, agent, inputUser)) return;
    }
    const controller = beginRun(agentAbort.current, agent);
    patchSession(agent, () => ({
      run: { agent, prompt: text, phase: "connecting" },
      translation: null,
    }));
    const bridge = {
      url: config.bridgeUrl ?? DEFAULT_BRIDGE_URL,
      token: config.bridgeToken ?? "",
    };
    try {
      const result = await sendPromptToAgent(
        bridge,
        agent,
        text,
        controller.signal,
        (job) =>
          setRun(agent, (current) =>
            current && current.phase !== "done" && current.phase !== "error"
              ? {
                  ...current,
                  phase: job.status === "running" ? "running" : current.phase,
                  job,
                }
              : current,
          ),
        {
          cwd: workspaceFor(config.workspaces, agent),
          trust: config.autoTrustAgents?.[agent],
        },
      );
      if (!result.ok) {
        const status = result.status;
        setRun(agent, {
          agent,
          prompt: text,
          phase: status.state === "invalid_workspace" ? "error" : "offline",
          message:
            status.state === "invalid_workspace"
              ? `مجلد مشروع هذا الوكيل مرفوض${status.detail ? `: ${status.detail}` : ""} — صحّحه من تبويبه.`
              : status.state === "bad_token"
                ? "التوكن غير صحيح — انسخ التوكن الذي طبعه الجسر عند تشغيله إلى الإعدادات."
                : status.state === "bad_url"
                  ? "عنوان الجسر غير صالح في الإعدادات."
                  : "الجسر غير متصل على هذا العنوان.",
        });
        return;
      }
      const job = result.job;
      if (job.status !== "running") {
        const output = job.output.trim();
        setAgentLog((log) =>
          appendTurn(log, agent, {
            jobId: job.id,
            inputUser,
            inputWire: text,
            cwd: workspaceFor(config.workspaces, agent),
            outputWire: output || (job.error ?? ""),
            cleanedBy: "headless",
            status: job.status,
          }),
        );
        if (job.status === "done" && output && config.autoTranslate) {
          void translateJob(agent, job.id, output);
        }
      }
      setRun(agent, {
        agent,
        prompt: text,
        phase:
          job.status === "done"
            ? "done"
            : job.status === "running"
              ? "running"
              : "error",
        job,
        message: job.error ?? undefined,
      });
    } catch {
      if (!controller.signal.aborted) {
        setRun(agent, {
          agent,
          prompt: text,
          phase: "error",
          message: "انقطع الاتصال بالجسر أثناء التشغيل.",
        });
      }
    }
  }

  /**
   * One turn through the agent's live terminal: type the text, wait for the
   * TUI to settle, extract the reply deterministically, optionally let
   * Gemini clean it (grounded), then translate per the user's setting.
   * Returns false only when the bridge turned out to lack PTY support, so
   * the caller falls back to a one-shot run.
   */
  async function sendViaTerminal(
    terminal: AgentTerminalHandle,
    text: string,
    agent: string,
    inputUser: string,
  ): Promise<boolean> {
    const jobId = `pty-${crypto.randomUUID()}`;
    setAgentLog((log) =>
      appendTurn(log, agent, {
        jobId,
        inputUser,
        inputWire: text,
        cwd: workspaceFor(config.workspaces, agent),
        outputWire: "",
        status: "running",
      }),
    );
    try {
      const capture = await terminal.send(text);
      let output = capture.reply;
      let cleanedBy: "local" | "gemini" = "local";
      if (config.smartClean && capture.region) {
        const smart = await cleanAgentOutput(
          capture.region,
          text,
          config.model,
          config.userKey,
        );
        if (smart.text) {
          output = smart.text;
          cleanedBy = "gemini";
        }
      }
      setAgentLog((log) =>
        patchTurn(log, agent, jobId, {
          outputWire:
            output ||
            (capture.timedOut
              ? "انتهت مهلة الالتقاط — الرد الكامل في الطرفية أعلاه."
              : "لم يُلتقط رد نصي — راجع الطرفية أعلاه."),
          outputRaw: capture.region,
          cleanedBy,
          status: output ? "done" : "error",
        }),
      );
      if (output && config.autoTranslate)
        void translateJob(agent, jobId, output);
      return true;
    } catch (error) {
      if (terminal.status() === "unavailable") {
        setAgentLog((log) => ({
          ...log,
          [agent]: (log[agent] ?? []).filter((t) => t.jobId !== jobId),
        }));
        return false;
      }
      setAgentLog((log) =>
        patchTurn(log, agent, jobId, {
          outputWire:
            error instanceof Error
              ? error.message
              : "تعذّر الإرسال إلى الطرفية.",
          status: "error",
        }),
      );
      return true;
    }
  }

  /**
   * Translates one job's English output via /api/translate (honest
   * fallback) and records it on the matching log turn; the card shows it
   * too when that job is the current run.
   */
  async function translateJob(agent: string, jobId: string, output: string) {
    if (!output.trim() || translatingJobs.has(jobId)) return;
    setTranslatingJobs((jobs) => new Set(jobs).add(jobId));
    try {
      const result = await translateToArabic(
        output,
        config.model,
        config.userKey,
      );
      setAgentLog((log) =>
        patchTurn(
          log,
          agent,
          jobId,
          result.arabic
            ? { outputUser: result.arabic, translateError: undefined }
            : { translateError: result.fallbackReason ?? "unavailable" },
        ),
      );
      // The card shows a translation only for that tab's CURRENT job.
      patchSession(agent, (session) =>
        session.run?.job?.id === jobId
          ? { ...session, translation: result }
          : session,
      );
    } finally {
      setTranslatingJobs((jobs) => {
        const next = new Set(jobs);
        next.delete(jobId);
        return next;
      });
    }
  }

  /** Bridge unreachable → hand the user a ready shell command instead. */
  async function copyAgentCommand() {
    if (!activeRun) return;
    try {
      await navigator.clipboard.writeText(
        agentCommand(activeRun.agent, activeRun.prompt),
      );
    } catch {
      /* clipboard unavailable — the command is also visible in the card */
    }
  }

  const modelLabel = providers[config.provider].models.find(
    (item) => item.id === config.model,
  )?.label;
  // Header dot mirrors the shared user-key signal; null hides it entirely.
  const savedKeyStatus: KeyStatus | null = config.userKey
    ? statusFromKeySignal(
        keySignal && keySignal.key === config.userKey ? keySignal.signal : null,
      )
    : null;
  const s1: NodeStatus =
    phase === "analyzing" ? "active" : original ? "done" : "idle";
  const s2: NodeStatus =
    phase === "optimizing" ? "active" : dual ? "done" : "idle";
  const s3: NodeStatus =
    phase === "measuring" ? "active" : report ? "done" : "idle";
  const arabicUnavailable = dual !== null && dual.arabic === null;
  const isMock = report?.source === "mock" || dual?.source === "mock";
  const nativeText = report?.arabic?.text ?? dual?.arabic ?? null;
  const progress = running
    ? (runLabel[phase as keyof typeof runLabel] ?? "يعالج…")
    : null;
  const viewOf = (id: string): AgentView => views[id] ?? "terminal";
  const changeView = (id: string, next: AgentView) => {
    if (viewOf(id) === "out" || next === "out") {
      setSeenTurns((all) => ({ ...all, [id]: finishedCount(agentLog[id]) }));
    }
    setViews((all) => ({ ...all, [id]: next }));
  };
  const agentStatus = (id: string) =>
    tabStatus(sessions[id]?.run ?? null, agentLog[id], terminalStatus[id]);
  const bridge = {
    url: config.bridgeUrl ?? DEFAULT_BRIDGE_URL,
    token: config.bridgeToken ?? "",
  };

  return (
    <main className="blueprint-grid min-h-screen px-4 py-8 sm:px-7">
      <div className="mx-auto max-w-[1840px]">
        <header className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {savedKeyStatus ? <KeyStatusHint status={savedKeyStatus} /> : null}
            <button
              onClick={() => setSettingsOpen(true)}
              className="flex items-center gap-2 border border-ink bg-white px-3 py-2 text-sm font-semibold transition hover:bg-slate-50"
            >
              <Settings2 size={17} /> الإعدادات
            </button>
            <span className="hidden border border-slate-300 bg-white px-2.5 py-1 font-mono text-[11px] text-slate-600 sm:inline">
              {modelLabel}
            </span>
            <BridgeBadge
              state={bridgeSessions.state}
              url={bridgeSessions.url}
              onClick={() => setSessionsOpenSignal((n) => n + 1)}
            />
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2 text-xl font-black">
              <Sparkles className="text-brand-500" /> مُحسّن التلقينة العربية
            </div>
            <p className="mt-1 font-mono text-[11px] text-slate-500">
              TOSO — قياس وتقليص تكلفة التلقينة / Prompt Workbench
            </p>
          </div>
        </header>
        {storageWarning && (
          <p
            role="status"
            className="mt-4 border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800"
          >
            تعذّر الوصول إلى تخزين المتصفح؛ لا يمكن ضمان حفظ المفتاح أو مسحه بعد
            إغلاق الصفحة. يمكنك المتابعة في هذه الجلسة.
          </p>
        )}
        {runError && (
          <p
            role="alert"
            className="mt-4 border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800"
          >
            {runError}
          </p>
        )}

        <div className="grid items-start gap-x-6 xl:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
          {/* WORK — the agent, its own prompt box, the native companion */}
          <div className="min-w-0">
            <SpecHead
              title="وكيل CLI"
              note="اكتب في تبويب الوكيل، عالج، ثم أرسل — الوكيل يستلم الإنجليزية فقط"
            />
            <BridgeSessions
              state={bridgeSessions.state}
              panels={sessionPanels(bridgeSessions.sessions, sessionHistory)}
              max={bridgeSessions.max}
              attached={attachedIds}
              pending={sessionPending}
              onConnect={(session) => void connectSession(session)}
              onEnd={(session) => void endSession(session)}
              onOpen={(closed) => void openClosedSession(closed)}
              openSignal={sessionsOpenSignal}
            />
            <AgentTabStrip
              activeAgent={activeAgent}
              status={Object.fromEntries(
                AGENT_OPTIONS.map((opt) => [opt.id, agentStatus(opt.id)]),
              )}
              turns={Object.fromEntries(
                Object.entries(agentLog).map(([id, turns]) => [
                  id,
                  turns.length,
                ]),
              )}
              defaultAgent={defaultAgent}
              onSelect={setPickedAgent}
            />
            <div
              id="agent-tabpanel"
              role="tabpanel"
              aria-labelledby={`agent-tab-${activeAgent}`}
            >
              {/* 1 — project path & permissions */}
              <AgentWorkspacePanel
                key={activeAgent}
                agent={activeAgent}
                workspace={config.workspaces?.[activeAgent]}
                bridge={bridge}
                checked={folderChecked(activeAgent)}
                trusted={setupDone(
                  agentSetup,
                  config.workspaces,
                  activeAgent,
                  "trusted",
                )}
                sessionStatus={terminalStatus[activeAgent]}
                openedCount={terminalOpened[activeAgent] ?? 0}
                terminalBusy={terminalBusy === activeAgent}
                terminalNote={terminalNote}
                onWorkspaceChange={(path) =>
                  setConfig((c) => ({
                    ...c,
                    workspaces: withWorkspace(c.workspaces, activeAgent, path),
                  }))
                }
                onStepDone={(step, path) =>
                  setAgentSetup((all) => ({
                    ...all,
                    [activeAgent]: { ...all[activeAgent], [step]: path },
                  }))
                }
                onStart={() => {
                  setTerminalNote(null);
                  void terminals.current[activeAgent]?.start();
                }}
                autoTrust={Boolean(config.autoTrustAgents?.[activeAgent])}
                onAutoTrustChange={(on) =>
                  setConfig((c) => ({
                    ...c,
                    autoTrustAgents: withAgentFlag(
                      c.autoTrustAgents,
                      activeAgent,
                      on,
                    ),
                  }))
                }
                onOpenTerminal={() =>
                  void launchTerminal(
                    activeAgent,
                    terminalSettings(
                      config,
                      activeAgent,
                      folderChecked(activeAgent),
                    ),
                  )
                }
              />
              {/* 2 — the live terminal and, under it, the agent's own prompt
                  box. Every agent keeps both mounted (hidden when not shown)
                  so its session keeps running and its draft survives. */}
              {AGENT_OPTIONS.map((opt) => {
                const view = viewOf(opt.id);
                const turns = agentLog[opt.id] ?? [];
                return (
                  <div key={opt.id} hidden={opt.id !== activeAgent}>
                    <AgentViewTabs
                      agent={opt.id}
                      view={view}
                      turns={turns.length}
                      unseenReply={
                        finishedCount(turns) > (seenTurns[opt.id] ?? 0)
                      }
                      onChange={(next) => changeView(opt.id, next)}
                    />
                    <div className="h-[30rem]">
                      {/* The terminal stays mounted under IN/OUT so its
                          session and any turn in flight carry on. */}
                      <div hidden={view !== "terminal"} className="h-full">
                        <AgentTerminal
                          ref={(handle) => {
                            terminals.current[opt.id] = handle;
                          }}
                          agent={opt.id}
                          bridge={bridge}
                          workspace={workspaceFor(config.workspaces, opt.id)}
                          trust={config.autoTrustAgents?.[opt.id]}
                          ready={folderChecked(opt.id)}
                          visible={
                            opt.id === activeAgent &&
                            view === "terminal" &&
                            keyHydrated
                          }
                          onStatus={(status) => {
                            setTerminalStatus((all) =>
                              all[opt.id] === status
                                ? all
                                : { ...all, [opt.id]: status },
                            );
                            // Started/ended here → the sessions panel follows now.
                            void refreshSessions.current();
                          }}
                        />
                      </div>
                      {opt.id === activeAgent && view !== "terminal" ? (
                        <div className="h-full border-x border-b border-ink bg-white p-3">
                          <AgentTranscript
                            agent={opt.id}
                            side={view}
                            turns={turns}
                            translatingJobs={translatingJobs}
                            autoTranslate={config.autoTranslate}
                            onTranslate={(jobId) => {
                              const turn = turns.find((t) => t.jobId === jobId);
                              if (turn)
                                void translateJob(
                                  opt.id,
                                  jobId,
                                  turn.outputWire,
                                );
                            }}
                            onClear={() =>
                              setAgentLog(
                                ({ [opt.id]: _cleared, ...rest }) => rest,
                              )
                            }
                            onClearAll={
                              Object.keys(agentLog).some(
                                (id) =>
                                  id !== opt.id && agentLog[id].length > 0,
                              )
                                ? () => setAgentLog({})
                                : undefined
                            }
                            sendTargets={AGENT_OPTIONS.map((o) => o.id).filter(
                              (id) => id !== opt.id,
                            )}
                            onSendAlso={(jobIds, target) =>
                              void sendAlso(jobIds, target)
                            }
                            sourceFolder={workspaceFor(
                              config.workspaces,
                              opt.id,
                            )}
                            targetState={(id) => ({
                              folder: workspaceFor(config.workspaces, id),
                              checked: folderChecked(id),
                              live: terminalStatus[id] === "live",
                              busy: agentStatus(id) === "running",
                            })}
                            onOpenTab={setPickedAgent}
                          />
                        </div>
                      ) : null}
                    </div>
                    <AgentComposer
                      agent={opt.id}
                      disabled={!keyHydrated}
                      busy={running}
                      agentBusy={agentStatus(opt.id) === "running"}
                      progress={progress}
                      autoSend={Boolean(config.autoSendAgents?.[opt.id])}
                      onAutoSendChange={(on) =>
                        setConfig((c) => ({
                          ...c,
                          autoSendAgents: withAgentFlag(
                            c.autoSendAgents,
                            opt.id,
                            on,
                          ),
                        }))
                      }
                      onProcess={(text) => handleRun(text, opt.id)}
                      onSend={(english, inputUser) =>
                        dispatchToAgent(english, opt.id, inputUser)
                      }
                    />
                  </div>
                );
              })}
              {/* One-shot fallback (bridge without PTY): show that run's card. */}
              {terminalStatus[activeAgent] === "unavailable" && activeRun && (
                <div className="mt-4">
                  <AgentCard
                    run={activeRun}
                    translation={activeSession.translation}
                    translating={
                      activeRun.job
                        ? translatingJobs.has(activeRun.job.id)
                        : false
                    }
                    onTranslate={() =>
                      activeRun.job &&
                      void translateJob(
                        activeRun.agent,
                        activeRun.job.id,
                        activeRun.job.output,
                      )
                    }
                    onCopyFallback={copyAgentCommand}
                  />
                </div>
              )}
            </div>
          </div>

          {/* SIDE — the measurement dials, then the native-language card */}
          <aside className="min-w-0 xl:self-stretch">
            <div className="xl:sticky xl:top-4">
              <SpecHead title="العدّاد" note="قبل المعالجة وبعدها — الخلاصة" />
              <MeasureGauges
                data={report ? gaugeData(report) : null}
                running={running}
                progress={progress}
                source={
                  dual
                    ? dual.source === "gemini"
                      ? `${dual.model ? getModel("google", dual.model).label : "Gemini"}${dual.viaUserKey ? " · مفتاحك" : ""}`
                      : "محلي"
                    : undefined
                }
                caption={
                  lastRun
                    ? `${agentLabel(lastRun.agent)} · ${new Date(lastRun.at).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })}`
                    : undefined
                }
              />
              {/* The polished text in the user's language — read and copy. */}
              <details className="group mt-4 border border-ink bg-white">
                <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center gap-1.5 bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">
                    <Languages size={14} /> بطاقة لغة المستخدم
                  </span>
                  <span className="text-xs text-slate-500">
                    {nativeText
                      ? "النسخة المنقّحة بلغتك من آخر معالجة — للقراءة والنسخ"
                      : "تظهر هنا النسخة المنقّحة بلغتك بعد المعالجة"}
                  </span>
                  <ChevronDown
                    size={16}
                    className="ms-auto text-slate-500 transition group-open:rotate-180"
                  />
                </summary>
                <div className="border-t border-slate-200 p-4">
                  <OutputCard
                    lang="ar"
                    title="Optimized Output"
                    chip={isMock && nativeText ? "تنقية محلية" : "العربية"}
                    status={s3}
                    text={nativeText}
                    unavailable={arabicUnavailable}
                    unavailableReason={
                      report?.rejectedByGuard
                        ? "حُجبت النسخة العربية لأن مخرج Gemini لم يجتز فحوص السلامة؛ عُرض النص المنقّى محلياً."
                        : "الترجمة العربية غير متاحة في الوضع المحلي أو عند تعذّر Gemini."
                    }
                    report={report?.arabic ?? null}
                  />
                </div>
              </details>
            </div>
          </aside>
        </div>

        <div className="mt-2">
          <SpecHead
            title="التعليمات والتفاصيل"
            note="نتائج المحطات والتحليل والتكلفة لآخر معالجة"
          />
          <DetailsDrawer
            tabs={[
              {
                id: "stations",
                label: "نتائج المحطات",
                body: (
                  <div className="grid gap-4 md:grid-cols-2">
                    <SpecCard
                      tag="ST-01"
                      title="قياس الأصل"
                      subtitle="Token Analysis — قياس النص الأصلي"
                      status={s1}
                      action={
                        original ? (
                          <SourceBadge
                            compact
                            source={original.source}
                            providerLabel={
                              original.model
                                ? getModel("google", original.model).label
                                : undefined
                            }
                          />
                        ) : null
                      }
                    >
                      {original ? (
                        <div>
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <Metric
                              label={
                                original.source === "provider"
                                  ? "Tokens حقيقية"
                                  : "Tokens تقديرية"
                              }
                              value={original.tokens}
                            />
                            <Metric label="كلمة" value={original.words} />
                            <Metric label="حرف" value={original.characters} />
                          </div>
                          {originalRatio !== null && (
                            <div className="mt-3 flex items-center gap-2 border border-slate-300 bg-slate-50 px-3 py-2 text-xs">
                              <span className="font-bold text-slate-500">
                                نسبة العربية
                              </span>
                              <div className="h-2 flex-1 overflow-hidden bg-slate-200">
                                <div
                                  className="h-full bg-brand-500 transition-all"
                                  style={{
                                    width: `${Math.round(originalRatio * 100)}%`,
                                  }}
                                />
                              </div>
                              <span className="font-mono font-black text-ink">
                                {Math.round(originalRatio * 100)}%
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <Placeholder
                          active={s1 === "active"}
                          text="ستظهر قياسات النص الأصلي هنا"
                        />
                      )}
                    </SpecCard>
                    <SpecCard
                      tag="ST-02"
                      title="المعالجة"
                      subtitle="تنقية محلية ثم إعادة صياغة عبر Gemini عند توفره"
                      status={s2}
                    >
                      {dual ? (
                        <div className="flex items-center gap-3 border border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                          <Wand2 className="shrink-0 text-brand-500" />
                          <span className="flex-1">{dual.note}</span>
                          <span
                            className={`px-2.5 py-1 text-[11px] font-bold ${dual.source === "gemini" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}
                          >
                            {dual.source === "gemini"
                              ? `${dual.model ?? "Gemini"}${dual.viaUserKey ? " · مفتاحك" : ""}`
                              : "محلي"}
                          </span>
                        </div>
                      ) : (
                        <Placeholder
                          active={s2 === "active"}
                          text="يُنقّى النص محلياً، ويُنشئ Gemini النسخة الإنجليزية المختصرة عند توفره"
                        />
                      )}
                    </SpecCard>
                  </div>
                ),
              },
              {
                id: "analysis",
                label: "التحليل",
                body: report ? (
                  <div className="space-y-4">
                    <TokenHeatmap report={report} />
                    <OptimizationInsights report={report} />
                    <OptimizationUsagePanel report={report} />
                  </div>
                ) : (
                  <Placeholder
                    active={phase === "measuring"}
                    text="تظهر خريطة الثقل وتفصيل التوفير هنا بعد أول معالجة"
                  />
                ),
              },
              {
                id: "cost",
                label: "التكلفة",
                body: (
                  <CostBar
                    report={report}
                    active={phase === "measuring"}
                    modelLabel={
                      report?.model
                        ? getModel("google", report.model).label
                        : modelLabel
                    }
                    onReset={reset}
                  />
                ),
              },
              {
                id: "notes",
                label: "ملاحظات",
                body: (
                  <ul className="space-y-2 border border-slate-300 bg-white p-4 text-xs leading-6 text-slate-600">
                    <li>
                      لكل وكيل مدخله: ما تكتبه في تبويب وكيل يُرسل إليه هو.
                      «معالجة» تستبدل مسودتك بالإنجليزية المختصرة، و«عرض الأصل»
                      و«تراجع» يعيدانها حتى الإرسال.
                    </li>
                    <li>
                      الوكلاء يستلمون الإنجليزية فقط لتقليل التوكنز؛ نصك بلغتك
                      يُحفظ في عمود لغتك من سجل IN / OUT.
                    </li>
                    <li>
                      «إرسال أيضاً» في السجل يعيد إرسال نصوص عولجت سابقاً إلى
                      وكيل آخر — بلا معالجة جديدة ولا تكلفة إضافية.
                    </li>
                    <li className="flex items-center gap-2">
                      <Gauge size={14} className="shrink-0" /> القياس عبر Gemini
                      countTokens عند توفره، وإلا بتقدير محلي · مفتاحك يبقى في
                      متصفحك.
                    </li>
                  </ul>
                ),
              },
            ]}
          />
        </div>

        <SettingsModal
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          config={config}
          onChange={setConfig}
          keySignal={keySignal}
          onSignal={setKeySignal}
        />
      </div>
    </main>
  );
}

/* ---- spec-sheet chrome -------------------------------------------------- */

function SpecHead({ title, note }: { title: string; note: string }) {
  return (
    <div className="mt-8 mb-3 flex items-baseline gap-3">
      <span className="h-2 w-2 shrink-0 self-center bg-brand-500" aria-hidden />
      <h2 className="text-base font-bold">{title}</h2>
      <span className="hidden text-[11px] text-slate-500 sm:inline">
        {note}
      </span>
      <div className="h-px flex-1 bg-ink/25" />
    </div>
  );
}

function SpecCard({
  tag,
  title,
  subtitle,
  status,
  action,
  children,
}: {
  tag: string;
  title: string;
  subtitle: string;
  status: NodeStatus;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const active = status === "active";
  const done = status === "done";
  return (
    <section
      className={`border bg-white p-5 transition ${
        active
          ? "border-brand-500 shadow-hard-sm"
          : done
            ? "border-ink"
            : "border-slate-300"
      }`}
    >
      <div className="mb-4 flex items-center gap-3">
        <span
          className={`grid h-8 min-w-14 place-items-center border px-2 font-mono text-[11px] font-medium ${
            done
              ? "border-ink bg-ink text-white"
              : active
                ? "border-brand-500 bg-brand-500/10 text-brand-600"
                : "border-slate-300 bg-white text-slate-400"
          }`}
        >
          {done ? <Check size={14} /> : tag}
        </span>
        <div>
          <h3 className="font-bold leading-5">{title}</h3>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
        {(active || action) && (
          <div className="ms-auto flex items-center gap-2">
            {active && (
              <span className="h-2.5 w-2.5 animate-ping bg-brand-400" />
            )}
            {action}
          </div>
        )}
      </div>
      {children}
    </section>
  );
}

/** One tabbed drawer for everything that explains the latest processing. */
function DetailsDrawer({
  tabs,
}: {
  tabs: { id: string; label: string; body: ReactNode }[];
}) {
  const [open, setOpen] = useState(tabs[0].id);
  const current = tabs.find((tab) => tab.id === open) ?? tabs[0];
  return (
    <section className="border border-ink bg-white">
      <div
        role="tablist"
        aria-label="التعليمات والتفاصيل"
        className="flex flex-wrap gap-1.5 border-b border-slate-200 p-2"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            id={`details-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={tab.id === current.id}
            aria-controls="details-panel"
            onClick={() => setOpen(tab.id)}
            className={`border px-3 py-1.5 text-xs font-bold transition ${
              tab.id === current.id
                ? "border-ink bg-ink text-white"
                : "border-slate-300 bg-white text-slate-600 hover:border-ink"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div
        id="details-panel"
        role="tabpanel"
        aria-labelledby={`details-tab-${current.id}`}
        className="p-3"
      >
        {current.body}
      </div>
    </section>
  );
}

function Placeholder({ active, text }: { active: boolean; text: string }) {
  return (
    <div
      className={`border bg-slate-50/60 p-4 text-center text-sm ${active ? "border-brand-500/60 text-slate-500" : "border-slate-300 text-slate-400"}`}
    >
      {active ? "جارٍ المعالجة…" : text}
    </div>
  );
}

/** Header dot + legend for the saved BYOK key's latest evidence. */
const keyStatusLegend: { status: KeyStatus; label: string }[] = [
  {
    status: "idle",
    label: "مفتاح محفوظ لم يُفحص بعد — اضغط «تحقق» في الإعدادات",
  },
  { status: "ok", label: "يعمل — آخر تشغيل أو فحص نجح على مفتاحك" },
  { status: "invalid", label: "مرفوض من Google في آخر محاولة" },
  { status: "quota", label: "حصة مفتاحك مستنزفة مؤقتاً" },
  { status: "unreachable", label: "تعذّر الفحص — الشبكة أو الخادم" },
];

function KeyStatusHint({ status }: { status: KeyStatus }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 ${dotClass[status]}`} aria-hidden="true" />
      <details className="group relative">
        <summary
          className="flex cursor-pointer list-none items-center text-slate-400 transition hover:text-slate-600 [&::-webkit-details-marker]:hidden"
          aria-label="معنى ألوان حالة المفتاح"
        >
          <Info size={15} />
        </summary>
        <div className="absolute start-0 top-6 z-40 w-64 border border-ink bg-white p-3 text-xs leading-5 text-slate-600 shadow-hard-sm">
          <p className="mb-2 font-bold text-slate-700">حالة مفتاحك المحفوظ</p>
          <ul className="space-y-1.5">
            {keyStatusLegend.map((item) => (
              <li key={item.status} className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 shrink-0 ${dotClass[item.status]}`}
                  aria-hidden="true"
                />
                {item.label}
              </li>
            ))}
          </ul>
        </div>
      </details>
    </div>
  );
}

/* ---- output containers -------------------------------------------------- */

function OutputCard({
  lang,
  title,
  chip,
  text,
  unavailable,
  unavailableReason,
  report,
  status,
}: {
  lang: "ar" | "en";
  title: string;
  chip: string;
  text: string | null;
  unavailable?: boolean;
  unavailableReason?: string;
  report: VariantReport | null;
  status: NodeStatus;
}) {
  const emerald = lang === "ar";
  const bar = emerald ? "bg-emerald-500" : "bg-sky-500";
  const chipCls = emerald
    ? "bg-emerald-100 text-emerald-700"
    : "bg-sky-100 text-sky-700";
  const active = status === "active";
  return (
    <section
      className={`border border-ink bg-white transition ${active ? "shadow-hard-sm" : ""}`}
    >
      <div className={`h-1 ${bar}`} />
      <div className="p-5">
        <div className="mb-4 flex items-center gap-2 border-b border-slate-200 pb-3">
          <span
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold ${chipCls}`}
          >
            <Languages size={14} />
            {chip}
          </span>
          <h3 className="font-bold">{title}</h3>
          <div className="ms-auto flex items-center gap-1.5">
            {text && <CopyButton text={text} />}
          </div>
        </div>
        <div
          dir={lang === "en" ? "ltr" : "rtl"}
          className={`min-h-56 border border-slate-200 bg-slate-50/60 p-4 leading-8 text-slate-700 whitespace-pre-wrap ${lang === "en" ? "text-left" : "text-right"}`}
        >
          {text ??
            (unavailable ? (
              <span className="text-sm text-slate-400">
                {unavailableReason}
              </span>
            ) : (
              <span className="text-sm text-slate-400">
                {active ? "تُستكمل القياسات…" : "الناتج المحسّن سيظهر هنا"}
              </span>
            ))}
        </div>
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="flex items-center gap-3">
            <span className="flex items-baseline gap-1.5">
              <span className="font-mono text-sm font-black text-ink">
                {report ? report.analysis.tokens : "—"}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
                Tokens
              </span>
            </span>
            {lang === "ar" && report?.analysis.arabicRatio !== undefined && (
              <>
                <span className="h-3.5 w-px bg-slate-300" aria-hidden />
                <span className="flex items-baseline gap-1.5">
                  <span className="font-mono text-sm font-black text-ink">
                    {Math.round(report.analysis.arabicRatio * 100)}%
                  </span>
                  <span className="text-[10px] text-slate-400">عربي</span>
                </span>
              </>
            )}
          </span>
          {report?.measurement && (
            <span
              className={`flex items-center gap-1.5 font-bold ${report.measurement.source === "provider" ? "text-emerald-600" : "text-amber-600"}`}
            >
              <span
                className={`h-2 w-2 ${report.measurement.source === "provider" ? "bg-emerald-500" : "bg-amber-500"}`}
              />
              {report.measurement.source === "provider"
                ? "قياس حقيقي"
                : report.measurement.source === "bpe"
                  ? "BPE محلي"
                  : "تقدير"}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  async function copy() {
    setCopyFailed(false);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
      setCopied(false);
      setCopyFailed(true);
    }
  }
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1.5 border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-600 transition hover:border-ink hover:text-ink"
    >
      {copied ? (
        <Check size={14} className="text-emerald-600" />
      ) : (
        <Copy size={14} />
      )}
      {copied ? "نُسخ!" : copyFailed ? "تعذّر النسخ" : "نسخ"}
    </button>
  );
}

const heatLevels = [
  {
    label: "خفيف · نحو 1",
    className: "bg-emerald-50 text-emerald-900 ring-emerald-200",
  },
  {
    label: "متوسط · نحو 2–3",
    className: "bg-amber-100 text-amber-950 ring-amber-200",
  },
  {
    label: "مرتفع · نحو 4+",
    className: "bg-rose-100 text-rose-900 ring-rose-200",
  },
];

function heatLevel(tokens: number) {
  return tokens <= 1
    ? heatLevels[0]
    : tokens <= 3
      ? heatLevels[1]
      : heatLevels[2];
}

export const TokenHeatmap = memo(function TokenHeatmap({
  report,
}: {
  report: OptimizationReport;
}) {
  return (
    <section
      aria-labelledby="heatmap-title"
      className="border border-ink bg-white p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h2 id="heatmap-title" className="text-lg font-bold text-ink">
            خريطة ثقل المقاطع
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            شاهد مواضع الثقل التقريبي في النص الأصلي والمخرجات، من دون إرسال كل
            مقطع إلى مزود الخدمة.
          </p>
        </div>
        <span className="border border-sky-300 bg-sky-50 px-3 py-1 font-mono text-xs font-bold text-sky-800">
          تقدير محلي
        </span>
      </div>
      <div
        aria-label="مفتاح ألوان الخريطة الحرارية"
        className="mt-4 flex flex-wrap gap-2 text-xs"
      >
        {heatLevels.map(({ label, className }) => (
          <span
            key={label}
            className={`px-2.5 py-1.5 font-semibold ring-1 ring-inset ${className}`}
          >
            {label} توكن لكل مقطع
          </span>
        ))}
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {(() => {
          const arabicVariant = report.arabic ? (
            <HeatmapVariant
              key="ar"
              title="النسخة العربية"
              text={report.arabic.text}
              direction="rtl"
            />
          ) : (
            <HeatmapUnavailable key="ar" title="النسخة العربية" />
          );
          const englishVariant = report.english ? (
            <HeatmapVariant
              key="en"
              title="النسخة الإنجليزية"
              text={report.english.text}
              direction="ltr"
            />
          ) : (
            <HeatmapUnavailable key="en" title="النسخة الإنجليزية" />
          );
          return (
            <>
              <HeatmapVariant
                title="النص الأصلي"
                text={report.originalPrompt}
                direction={report.direction === "en" ? "ltr" : "rtl"}
              />
              {report.direction === "en"
                ? [englishVariant, arabicVariant]
                : [arabicVariant, englishVariant]}
            </>
          );
        })()}
      </div>
      <p className="mt-4 border border-sky-200 bg-sky-50 px-4 py-3 text-xs leading-6 text-sky-900">
        الألوان تقدير لطول المقطع ونوع حروفه، وليست تفكيكاً رسمياً من Gemini. لا
        تجمع تقديرات المقاطع لتطابق إجمالي countTokens؛ الأرقام الرسمية والتكلفة
        المعروضة أعلاه/أدناه منفصلة عن هذه الخريطة.
      </p>
    </section>
  );
});

function HeatmapUnavailable({ title }: { title: string }) {
  return (
    <div className="border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
      <h3 className="font-bold text-slate-700">{title}</h3>
      <p className="mt-3">
        غير متاحة في هذا التشغيل؛ لا توجد خريطة لنص غير موجود.
      </p>
    </div>
  );
}

function HeatmapVariant({
  title,
  text,
  direction,
}: {
  title: string;
  text: string;
  direction: "rtl" | "ltr";
}) {
  const { segments, scoredSegments, truncated } = estimateHeatmapSegments(text);
  const heaviest = segments
    .filter(({ tokens }) => tokens !== null)
    .sort((a, b) => (b.tokens ?? 0) - (a.tokens ?? 0))
    .slice(0, 3);
  return (
    <div className="min-w-0 border border-slate-300 bg-slate-50/60 p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold text-ink">{title}</h3>
        <span className="border border-slate-200 bg-white px-2 py-1 font-mono text-[11px] font-semibold text-slate-600">
          {scoredSegments} مقطع في المعاينة
        </span>
      </div>
      <div
        dir={direction}
        className="max-h-52 min-h-32 overflow-y-auto border border-slate-200 bg-white p-3 text-sm leading-9 whitespace-pre-wrap break-words"
      >
        {segments.map(({ text: part, tokens }, index) =>
          tokens === null ? (
            <span key={index}>{part}</span>
          ) : (
            <span
              key={index}
              dir="auto"
              title={`${part} — نحو ${tokens} توكن (تقدير محلي)`}
              aria-label={`${part}: نحو ${tokens} توكن بتقدير محلي`}
              className={`px-1 py-0.5 ring-1 ring-inset ${heatLevel(tokens).className}`}
            >
              {part}
            </span>
          ),
        )}
        {truncated && <span aria-hidden="true">…</span>}
        {!segments.length && (
          <span className="text-slate-500">
            لا توجد مقاطع قصيرة قابلة للمعاينة.
          </span>
        )}
      </div>
      {truncated && (
        <p className="mt-2 text-xs font-medium text-amber-800">
          معاينة محدودة: أول {scoredSegments} مقطع ضمن 2000 حرف؛ بقية النص لم
          تُحلَّل بصرياً.
        </p>
      )}
      {heaviest.length > 0 && (
        <div className="mt-3 border-t border-slate-300 pt-3">
          <p className="mb-2 text-xs font-semibold text-slate-600">
            أثقل المقاطع في المعاينة
          </p>
          <div className="flex flex-wrap gap-1.5">
            {heaviest.map(({ text: part, tokens }, index) => (
              <span
                key={index}
                className="inline-flex max-w-full items-center gap-1 border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
              >
                <span dir="auto" className="max-w-28 truncate">
                  {part}
                </span>
                <span dir="ltr" className="shrink-0 font-mono text-sky-800">
                  ~{tokens}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---- analysis & cost ----------------------------------------------------- */

export function OptimizationInsights({
  report,
}: {
  report: OptimizationReport;
}) {
  const {
    originalMeasurement,
    normalizedMeasurement,
    arabic,
    english,
    entityChecks,
    direction,
  } = report;
  // The polished primary follows the pipeline direction, not a fixed field.
  const primary = direction === "en" ? english : arabic;
  if (!originalMeasurement || !primary?.measurement) return null;

  const arabicEntity = entityChecks.arabic ? (
    <EntityStatus
      key="ar-entity"
      label="النسخة العربية"
      check={entityChecks.arabic}
    />
  ) : (
    <p
      key="ar-entity"
      className="border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500"
    >
      النسخة العربية غير متاحة للفحص.
    </p>
  );
  const englishEntity = entityChecks.english ? (
    <EntityStatus
      key="en-entity"
      label="النسخة الإنجليزية"
      check={entityChecks.english}
    />
  ) : (
    <p
      key="en-entity"
      className="border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500"
    >
      النسخة الإنجليزية غير متاحة للفحص.
    </p>
  );
  const arabicQuality = report.quality.arabic ? (
    <QualityStatus
      key="ar-quality"
      label="النسخة العربية"
      check={report.quality.arabic}
    />
  ) : null;
  const englishQuality = report.quality.english ? (
    <QualityStatus
      key="en-quality"
      label="النسخة الإنجليزية"
      check={report.quality.english}
    />
  ) : null;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className="border border-ink bg-white p-5">
        <h2 className="font-bold text-ink">تفصيل التوفير في توكنز الإدخال</h2>
        <p className="mt-1 text-xs text-slate-500">
          مقارنة النص الأصلي بالمنقّح محلياً، ثم بالنسخة{" "}
          {direction === "en" ? "الإنجليزية" : "العربية"} النهائية.
        </p>
        <div className="mt-4 space-y-3">
          <MeasurementStep
            title="التنقية المحلية"
            before={originalMeasurement}
            after={normalizedMeasurement}
          />
          <MeasurementStep
            title={
              report.source === "gemini"
                ? "إعادة صياغة Gemini"
                : "تعديل إضافي محلي"
            }
            before={normalizedMeasurement}
            after={primary.measurement}
          />
        </div>
        <details className="mt-4 border border-emerald-200 bg-emerald-50/50 p-3 text-xs">
          <summary className="cursor-pointer font-semibold text-emerald-900">
            عرض النص بعد التنقية المحلية
          </summary>
          <p
            dir="auto"
            className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap break-words text-slate-700"
          >
            {report.normalizedPrompt}
          </p>
        </details>
        {direction === "en"
          ? arabic && (
              <p className="mt-3 text-xs text-slate-500">
                العربية نسخة مرافقة منقولة للمعنى؛ لا تُضاف وفوراتها إلى
                الإنجليزية.
              </p>
            )
          : english && (
              <p className="mt-3 text-xs text-slate-500">
                الإنجليزية بديل مستقل مقارنة بالنص الأصلي؛ لا تُضاف وفوراتها إلى
                العربية.
              </p>
            )}
      </section>
      <section className="border border-ink bg-white p-5">
        <h2 className="font-bold text-ink">فحص الكيانات والجودة الظاهرة</h2>
        {report.rejectedByGuard && (
          <p
            role="status"
            className="mt-3 border border-amber-300 bg-amber-50 p-3 text-xs font-semibold text-amber-800"
          >
            رُفض مخرج Gemini لعدم اجتيازه فحوص السلامة المحلية. المعروض تنقية
            محلية، والترجمة محجوبة.
          </p>
        )}
        <div className="mt-3 space-y-2">
          {direction === "en"
            ? [englishEntity, arabicEntity, englishQuality, arabicQuality]
            : [arabicEntity, englishEntity, arabicQuality, englishQuality]}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          فحوص الكيانات والجودة تقيس عناصر ظاهرة قابلة للمطابقة (لغة، نفي، كلمات
          محتوى)؛ ليست ضماناً لحفظ المعنى أو جميع المتطلبات.
        </p>
      </section>
    </div>
  );
}

function MeasurementStep({
  title,
  before,
  after,
}: {
  title: string;
  before: TokenMeasurement;
  after: TokenMeasurement;
}) {
  const comparable = before.source === after.source;
  const saved = before.tokens - after.tokens;
  const percent = before.tokens
    ? Math.round((Math.abs(saved) / before.tokens) * 100)
    : 0;
  const difference = !comparable
    ? "لا يمكن حساب الفرق بدقة لاختلاف مصدر العد"
    : saved > 0
      ? `توفير ${saved} توكن (${percent}%)`
      : saved < 0
        ? `زيادة ${-saved} توكن (${percent}%)`
        : "لا تغير في عدد التوكنز";
  return (
    <div className="border border-slate-200 bg-slate-50 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-bold">{title}</span>
        <span dir="ltr" className="font-mono font-semibold tabular-nums">
          {before.tokens} → {after.tokens}
        </span>
      </div>
      <p
        className={`mt-1 text-xs ${comparable && saved > 0 ? "text-emerald-700" : "text-slate-600"}`}
      >
        {difference}
      </p>
      <p className="mt-1 font-mono text-[11px] text-slate-400">
        {comparable
          ? before.source === "provider"
            ? "Gemini countTokens"
            : "تقدير محلي"
          : "قياس بمصادر مختلفة: Gemini أو تقدير محلي"}
      </p>
    </div>
  );
}

function QualityStatus({
  label,
  check,
}: {
  label: string;
  check: QualityCheck;
}) {
  const coverage = check.keywordCoverage;
  const clean = check.warnings.length === 0;
  return (
    <div
      className={`border p-3 text-xs ${clean ? "border-sky-200 bg-sky-50 text-sky-800" : "border-amber-300 bg-amber-50 text-amber-800"}`}
    >
      <span className="font-bold">{label} — فحص الجودة: </span>
      {clean
        ? coverage !== null
          ? `سليم ظاهرياً — تغطية كلمات المحتوى ~${Math.round(coverage * 100)}%`
          : "سليم ظاهرياً"
        : check.warnings.join("؛ ")}
    </div>
  );
}

function EntityStatus({ label, check }: { label: string; check: EntityCheck }) {
  const message = !check.checked
    ? "لا توجد كيانات مدعومة للفحص"
    : check.preserved
      ? `لم يُرصد فقد في ${check.checked} كيان قابل للفحص`
      : `تعذّر حفظ ${check.missing.length} من ${check.checked} كيان`;
  return (
    <div
      className={`border p-3 text-xs ${check.checked && check.preserved ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-300 bg-amber-50 text-amber-800"}`}
    >
      <span className="font-bold">{label}: </span>
      {message}
      {check.missing.length > 0 && (
        <p dir="auto" className="mt-1 break-all">
          المفقود:{" "}
          {check.missing
            .slice(0, 5)
            .map(({ value }) => value)
            .join("، ")}
          {check.missing.length > 5 ? "…" : ""}
        </p>
      )}
    </div>
  );
}

const usageFields: { key: keyof GeminiUsage; label: string }[] = [
  { key: "total_input_tokens", label: "مدخلات الاستدعاء" },
  { key: "total_output_tokens", label: "المخرجات" },
  { key: "total_thought_tokens", label: "التفكير" },
  { key: "total_cached_tokens", label: "المخزّن مؤقتاً" },
  { key: "total_tool_use_tokens", label: "استخدام الأدوات" },
  { key: "total_tokens", label: "الإجمالي حسب Gemini" },
];

export function OptimizationUsagePanel({
  report,
}: {
  report: OptimizationReport;
}) {
  const usage = report.optimizationUsage;
  return (
    <section className="border border-ink bg-white p-5">
      <h2 className="font-bold text-ink">استهلاك استدعاء التحسين الفعلي</h2>
      {usage ? (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {usageFields
              .filter(({ key }) => usage[key] !== undefined)
              .map(({ key, label }) => (
                <Metric key={key} label={label} value={usage[key] ?? "—"} />
              ))}
          </div>
          {report.rejectedByGuard && (
            <p className="mt-3 text-xs text-amber-800">
              حدث استدعاء Gemini فعلي، لكن حارس الكيانات رفض مخرجه؛ الأرقام تخص
              الاستدعاء المرفوض.
            </p>
          )}
          <p className="mt-3 text-xs text-slate-500">
            أرقام Gemini لهذا الاستدعاء الناجح فقط؛ مدخلاته تشمل تعليمات النظام،
            وليست عدّ التلقينة وحدها. الحقول التفصيلية لا تُجمع يدويًا؛ الإجمالي
            معروض كما أعاده Gemini.
          </p>
        </>
      ) : (
        <p className="mt-3 text-xs text-slate-500">
          لا تتوفر بيانات استهلاك فعلية لهذا التشغيل؛ لن نعرض رقماً مفترضاً.
        </p>
      )}
      <p className="mt-2 text-xs text-slate-500">
        تقدير التكلفة أدناه يخص استخدام النص الناتج لاحقاً، وليس فاتورة هذا
        الاستدعاء. لا تشمل هذه الأرقام طلبات عدّ التوكنز أو المحاولات الأخرى.
      </p>
    </section>
  );
}

function CostBar({
  report,
  active,
  modelLabel,
  onReset,
}: {
  report: OptimizationReport | null;
  active: boolean;
  modelLabel?: string;
  onReset: () => void;
}) {
  return (
    <section className="border border-ink bg-amber-50/70 p-5">
      <div className="mb-4 flex items-center justify-between border-b border-amber-200 pb-3">
        <div className="flex items-center gap-2 font-bold">
          <Coins className="text-amber-600" size={18} /> Cost Analysis{" "}
          <span className="hidden text-xs font-normal text-slate-500 sm:inline">
            تقدير تكلفة الإدخال · {modelLabel}
          </span>
        </div>
        {report && (
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 text-sm font-bold text-slate-600 hover:text-ink"
          >
            <RotateCcw size={15} /> بدء جديد
          </button>
        )}
      </div>
      {report ? (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            {(() => {
              const arabicGroup = report.arabic ? (
                <CostGroup
                  key="ar"
                  label="النسخة العربية"
                  cost={report.arabic.cost}
                  comparable={
                    report.originalMeasurement?.source ===
                    report.arabic.measurement?.source
                  }
                />
              ) : (
                <div
                  key="ar"
                  className="grid place-items-center border border-slate-200 bg-white/70 p-3 text-center text-xs text-slate-400"
                >
                  توفير النسخة العربية يظهر مع الترجمة
                </div>
              );
              const englishGroup = report.english ? (
                <CostGroup
                  key="en"
                  label="النسخة الإنجليزية"
                  cost={report.english.cost}
                  comparable={
                    report.originalMeasurement?.source ===
                    report.english.measurement?.source
                  }
                />
              ) : (
                <div
                  key="en"
                  className="grid place-items-center border border-slate-200 bg-white/70 p-3 text-center text-xs text-slate-400"
                >
                  توفير النسخة الإنجليزية يظهر مع الترجمة
                </div>
              );
              return report.direction === "en"
                ? [englishGroup, arabicGroup]
                : [arabicGroup, englishGroup];
            })()}
          </div>
          {report.originalMeasurement &&
            ((report.arabic &&
              report.originalMeasurement.source !==
                report.arabic.measurement?.source) ||
              (report.english &&
                report.originalMeasurement.source !==
                  report.english.measurement?.source)) && (
              <p className="mt-3 text-xs text-amber-800">
                تختلف مصادر عد التوكنز بين المدخل والمخرج؛ أُخفيت نسبة التوفير
                لأنها غير قابلة للمقارنة بدقة.
              </p>
            )}
        </>
      ) : (
        <div className="border border-slate-200 bg-white/70 p-4 text-center text-sm text-slate-400">
          {active
            ? "يُحسب التقدير…"
            : "سيظهر تحليل التكلفة هنا بعد تشغيل التحسين"}
        </div>
      )}
    </section>
  );
}

function CostGroup({
  label,
  cost,
  comparable = true,
}: {
  label: string;
  cost: CostEstimate;
  comparable?: boolean;
}) {
  return (
    <div className="border border-slate-200 bg-white p-3">
      <div className="mb-2 text-xs font-bold text-slate-500">{label}</div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <Metric label="قبل" value={formatCost(cost.original)} />
        <Metric label="بعد" value={formatCost(cost.optimized)} />
        <Metric
          label="التوفير"
          value={comparable ? `${cost.savingPercent}%` : "—"}
        />
      </div>
    </div>
  );
}

/* ---- shared bits --------------------------------------------------------- */

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border border-slate-200 bg-slate-50 px-3 py-2.5">
      <span className="font-mono text-lg font-black text-ink" dir="auto">
        {value}
      </span>
      <span className="text-[11px] text-slate-500">{label}</span>
    </div>
  );
}

function SourceBadge({
  source,
  providerLabel,
  compact,
}: {
  source?: TokenMeasurement["source"];
  providerLabel?: string;
  compact?: boolean;
}) {
  if (!source) return null;
  const live = source === "provider";
  const label = live
    ? `مقياس حقيقي · ${providerLabel ?? "Gemini"}`
    : source === "bpe"
      ? "تقدير BPE محلي"
      : "تقدير تجريبي";
  const colors = live
    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
    : "border-amber-300 bg-amber-50 text-amber-700";
  return (
    <div
      className={
        compact
          ? `inline-flex items-center gap-1.5 border px-2 py-1 text-[11px] font-bold ${colors}`
          : `mt-3 flex items-center justify-center gap-1.5 border px-3 py-2 text-xs font-bold ${colors}`
      }
    >
      <span className={`h-2 w-2 ${live ? "bg-emerald-500" : "bg-amber-500"}`} />
      {label}
    </div>
  );
}
