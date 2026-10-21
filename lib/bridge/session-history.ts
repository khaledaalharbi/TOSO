/**
 * The «جلسات الجسر» panel: live sessions come from the bridge (GET /pty);
 * closed ones are remembered in the browser, because the bridge forgets an
 * ended session within minutes and a session can end while no page is open.
 */
import { samePath } from "@/lib/bridge/workspaces";

export const SESSION_HISTORY_STORAGE = "toso.sessionHistory";
/**
 * The live sessions at the last look, kept across page loads: stopping
 * dev:all stops a bridge it started — and every session with it — while no
 * page is open. Comparing with this snapshot on the next load still lists
 * them as closed.
 */
export const LIVE_SNAPSHOT_STORAGE = "toso.sessionLive";

export function parseLiveSnapshot(raw: string | null): BridgeSessionView[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    return Array.isArray(data)
      ? data.filter(
          (s): s is BridgeSessionView =>
            s &&
            typeof s === "object" &&
            typeof s.id === "string" &&
            typeof s.agent === "string" &&
            typeof s.cwd === "string" &&
            s.cwd.trim() !== "",
        )
      : [];
  } catch {
    return [];
  }
}
const HISTORY_MAX = 20;
/** Shown per section — the rest is summarised as "+N". */
export const PANEL_LIMIT = 3;

/** What the panel needs from a bridge session (a subset of PtySession). */
export interface BridgeSessionView {
  id: string;
  agent: string;
  cwd: string;
  alive: boolean;
  startedAt?: number;
  endedAt?: number | null;
}

export interface ClosedSession {
  agent: string;
  cwd: string;
  endedAt: number;
}

const sameSession = (a: { agent: string; cwd: string }, b: typeof a) =>
  a.agent === b.agent && samePath(a.cwd, b.cwd);

export function parseHistory(raw: string | null): ClosedSession[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data
      .filter(
        (e): e is ClosedSession =>
          e &&
          typeof e === "object" &&
          typeof e.agent === "string" &&
          typeof e.cwd === "string" &&
          e.cwd.trim() !== "" &&
          typeof e.endedAt === "number",
      )
      .slice(0, HISTORY_MAX);
  } catch {
    return [];
  }
}

/**
 * Adds closed sessions, newest first, one entry per agent + folder (opening
 * the same project twice is one line, not two).
 */
export function recordClosed(
  history: ClosedSession[],
  closed: ClosedSession[],
): ClosedSession[] {
  const merged = [...closed, ...history].sort((a, b) => b.endedAt - a.endedAt);
  const out: ClosedSession[] = [];
  for (const entry of merged) {
    if (!out.some((e) => sameSession(e, entry))) out.push(entry);
  }
  return out.slice(0, HISTORY_MAX);
}

/**
 * Sessions that were live at the last look and are not any more — ended in
 * a tab, by the agent itself, or killed with the bridge.
 */
export function newlyClosed(
  previouslyLive: BridgeSessionView[],
  now: BridgeSessionView[],
  at: number,
): ClosedSession[] {
  return previouslyLive
    .filter((before) => !now.some((s) => s.id === before.id && s.alive))
    .map((s) => ({
      agent: s.agent,
      cwd: s.cwd,
      endedAt: now.find((n) => n.id === s.id)?.endedAt ?? at,
    }));
}

export interface SessionPanels {
  live: BridgeSessionView[];
  moreLive: number;
  liveCount: number;
  closed: ClosedSession[];
  moreClosed: number;
}

/**
 * The two sections, at most PANEL_LIMIT each. A closed project that is
 * live again (reopened) is not listed as closed.
 */
export function sessionPanels(
  sessions: BridgeSessionView[],
  history: ClosedSession[],
): SessionPanels {
  const live = sessions.filter((s) => s.alive);
  const exited = sessions
    .filter((s) => !s.alive)
    .map((s) => ({
      agent: s.agent,
      cwd: s.cwd,
      endedAt: s.endedAt ?? s.startedAt ?? 0,
    }));
  const closed = recordClosed(history, exited).filter(
    (c) => !live.some((s) => sameSession(s, c)),
  );
  return {
    live: live.slice(0, PANEL_LIMIT),
    moreLive: Math.max(0, live.length - PANEL_LIMIT),
    liveCount: live.length,
    closed: closed.slice(0, PANEL_LIMIT),
    moreClosed: Math.max(0, closed.length - PANEL_LIMIT),
  };
}
