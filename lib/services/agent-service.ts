/**
 * Agent round-trip service — sends the polished prompt to a local CLI agent
 * through the TOSO bridge, then (on demand) translates the agent's English
 * output back to Arabic via /api/translate.
 *
 * Everything honest by construction: a missing bridge, a bad token, a
 * crashed agent, or a missing Gemini key each surface as their own state —
 * nothing is simulated.
 */

import { DEFAULT_BRIDGE_URL } from "@/lib/bridge/agents";
import type { GeminiUsage } from "@/lib/types";

export interface BridgeConfig {
  url: string;
  token: string;
}

export type BridgeStatus =
  | { state: "ok"; agents: { id: string; label: string }[] }
  | { state: "offline" | "bad_token" | "bad_url" };

export interface AgentJob {
  id: string;
  agent: string;
  status: "running" | "done" | "error" | "killed" | string;
  output: string;
  error: string | null;
  exitCode: number | null;
  startedAt: number;
  endedAt: number | null;
  /** Folder the agent actually ran in; null → the bridge's own cwd. */
  cwd?: string | null;
  /** Whether per-run folder trust was applied (adapter supports it + asked). */
  trusted?: boolean;
}

export interface AgentRunOptions {
  cwd?: string;
  trust?: boolean;
}

export type AgentSendResult =
  | { ok: true; job: AgentJob }
  | { ok: false; status: BridgeStatus }
  | { ok: false; status: { state: "invalid_workspace"; detail?: string } };

/** Outcome of a bridge utility call (/fs/check, /trust/workspace, /open-terminal). */
export type BridgeActionResult =
  | { state: "ok"; path?: string; file?: string; already?: boolean }
  | {
      state:
        | "invalid_workspace"
        | "trust_unsupported"
        | "trust_file_unreadable"
        | "trust_conflict"
        | "trust_path_unsupported"
        | "agent_not_installed"
        | "no_terminal_found"
        | "failed";
      detail?: string;
    }
  | { state: "offline" | "bad_token" };

const POLL_MS = 1500;

function normalizeUrl(url: string): string {
  return (url.trim() || DEFAULT_BRIDGE_URL).replace(/\/+$/, "");
}

/**
 * Auto-pairing: when the user never pasted a token, ask the app whether a
 * bridge it spawned (or one running manually) published a session. Returns
 * a usable config or null — the caller then falls back to the stored values.
 */
export async function discoverBridge(): Promise<BridgeConfig | null> {
  try {
    const response = await fetch("/api/bridge/session", {
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return null;
    const payload = (await response.json().catch(() => null)) as {
      ok?: boolean;
      url?: string;
      token?: string;
    } | null;
    return payload?.ok && payload.url && payload.token
      ? { url: payload.url, token: payload.token }
      : null;
  } catch {
    return null;
  }
}

/** Effective bridge config: stored settings win; auto-pairing fills a gap. */
export async function resolveBridgeConfig(
  config: BridgeConfig,
): Promise<BridgeConfig> {
  if (config.token)
    return { url: normalizeUrl(config.url), token: config.token };
  const discovered = await discoverBridge();
  return discovered ?? { url: normalizeUrl(config.url), token: "" };
}

async function bridgeFetch(
  config: BridgeConfig,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(`${normalizeUrl(config.url)}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-toso-token": config.token,
      ...(init.headers ?? {}),
    },
  });
}

export async function checkBridge(config: BridgeConfig): Promise<BridgeStatus> {
  try {
    const resolved = await resolveBridgeConfig(config);
    const response = await bridgeFetch(resolved, "/health", {
      signal: AbortSignal.timeout(4000),
    });
    if (response.status === 401) return { state: "bad_token" };
    if (!response.ok) return { state: "offline" };
    const payload = (await response.json().catch(() => null)) as {
      ok?: boolean;
      agents?: { id: string; label: string }[];
    } | null;
    if (!payload?.ok) return { state: "offline" };
    return { state: "ok", agents: payload.agents ?? [] };
  } catch {
    return { state: "offline" };
  }
}

/**
 * Fires the job, then polls until it leaves "running" (or the caller aborts).
 * Agent runs can take minutes — polling, not a held request, is the contract.
 * `onJob` reports each polled job state so the UI can show "running" instead
 * of lingering on "connecting" for the whole run.
 */
export async function sendPromptToAgent(
  config: BridgeConfig,
  agent: string,
  prompt: string,
  signal?: AbortSignal,
  onJob?: (job: AgentJob) => void,
  options: AgentRunOptions = {},
): Promise<AgentSendResult> {
  const resolved = await resolveBridgeConfig(config);
  const health = await checkBridge(resolved);
  if (health.state !== "ok") return { ok: false, status: health };
  config = resolved;

  let response: Response;
  try {
    response = await bridgeFetch(config, "/run", {
      method: "POST",
      body: JSON.stringify({
        agent,
        prompt,
        ...(options.cwd?.trim() ? { cwd: options.cwd.trim() } : {}),
        ...(options.trust ? { trust: true } : {}),
      }),
      signal: signal ?? null,
    });
  } catch {
    return { ok: false, status: { state: "offline" } };
  }
  if (response.status === 401) {
    return { ok: false, status: { state: "bad_token" } };
  }
  const started = (await response.json().catch(() => null)) as {
    jobId?: string;
    job?: AgentJob;
    error?: string;
    detail?: string;
  } | null;
  if (started?.error === "invalid_workspace") {
    return {
      ok: false,
      status: { state: "invalid_workspace", detail: started.detail },
    };
  }
  if (!response.ok || !started?.jobId) {
    return { ok: false, status: { state: "offline" } };
  }
  if (started.job && started.job.status !== "running") {
    return { ok: true, job: started.job };
  }
  if (started.job) onJob?.(started.job);

  while (true) {
    if (signal?.aborted) {
      await bridgeFetch(config, `/job/${started.jobId}`, {
        method: "DELETE",
      }).catch(() => {});
      throw new DOMException("aborted", "AbortError");
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    let poll: Response;
    try {
      poll = await bridgeFetch(config, `/job/${started.jobId}`, {
        signal: signal ?? null,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError")
        throw error;
      return { ok: false, status: { state: "offline" } };
    }
    const payload = (await poll.json().catch(() => null)) as {
      job?: AgentJob;
    } | null;
    if (!payload?.job) return { ok: false, status: { state: "offline" } };
    onJob?.(payload.job);
    if (payload.job.status !== "running") {
      return { ok: true, job: payload.job };
    }
  }
}

type ActionFailure = Extract<BridgeActionResult, { detail?: string }>["state"];
const ACTION_STATES = new Set<string>([
  "invalid_workspace",
  "trust_unsupported",
  "trust_file_unreadable",
  "trust_conflict",
  "trust_path_unsupported",
  "agent_not_installed",
  "no_terminal_found",
]);

/** POSTs a bridge utility endpoint and maps every outcome to an honest state. */
async function bridgeAction(
  config: BridgeConfig,
  path: string,
  body: Record<string, unknown>,
): Promise<BridgeActionResult> {
  try {
    const resolved = await resolveBridgeConfig(config);
    const response = await bridgeFetch(resolved, path, {
      method: "POST",
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
    if (response.status === 401) return { state: "bad_token" };
    const payload = (await response.json().catch(() => null)) as {
      ok?: boolean;
      error?: string;
      detail?: string;
      path?: string;
      file?: string;
      already?: boolean;
    } | null;
    if (payload?.ok) {
      return {
        state: "ok",
        path: payload.path,
        file: payload.file,
        already: payload.already,
      };
    }
    if (payload?.error === "not_found") {
      return {
        state: "failed",
        detail: "الجسر بإصدار أقدم لا يعرف هذه الميزة — أعد تشغيله",
      };
    }
    const error = payload?.error ?? "";
    return {
      state: (ACTION_STATES.has(error) ? error : "failed") as ActionFailure,
      detail: payload?.detail ?? (error || `http_${response.status}`),
    };
  } catch {
    return { state: "offline" };
  }
}

/** Validates a workspace folder on the bridge's machine. */
export function checkWorkspace(config: BridgeConfig, path: string) {
  return bridgeAction(config, "/fs/check", { path });
}

/** Records the folder in the agent's own trust file — explicit user action only. */
export function trustWorkspace(
  config: BridgeConfig,
  agent: string,
  cwd: string,
) {
  return bridgeAction(config, "/trust/workspace", { agent, cwd });
}

/**
 * Opens an interactive terminal window for the agent in the workspace — a
 * window the user owns; TOSO never reads it back.
 */
export function openAgentTerminal(
  config: BridgeConfig,
  agent: string,
  options: AgentRunOptions = {},
) {
  return bridgeAction(config, "/open-terminal", {
    agent,
    ...(options.cwd?.trim() ? { cwd: options.cwd.trim() } : {}),
    trust: Boolean(options.trust),
  });
}

/** Arabic, user-facing reading of a bridge action failure. */
export function describeBridgeAction(result: BridgeActionResult): string {
  switch (result.state) {
    case "ok":
      return "تم.";
    case "offline":
      return "الجسر غير متصل — شغّله بأمر npm run bridge.";
    case "bad_token":
      return "توكن الجسر مرفوض — راجع الإعدادات.";
    case "invalid_workspace":
      return `مجلد مساحة العمل غير صالح${result.detail ? `: ${result.detail}` : ""}.`;
    case "trust_unsupported":
      return "هذا الوكيل لا يملك ملف ثقة معروفاً — ثقته تُدار من داخله.";
    case "trust_file_unreadable":
      return "ملف الثقة الخاص بالوكيل غير قابل للقراءة — لم يُعدَّل شيء.";
    case "trust_conflict":
      return "المجلد مسجّل في إعدادات الوكيل بمستوى ثقة آخر — لم يُعدَّل شيء؛ غيّره من داخل الوكيل.";
    case "trust_path_unsupported":
      return "مسار المجلد يحوي علامة ' لا يقبلها ملف إعدادات الوكيل — لم يُعدَّل شيء.";
    case "agent_not_installed":
      return "الوكيل غير مثبّت أو غير موجود في PATH.";
    case "no_terminal_found":
      return "لم يُعثر على تطبيق طرفية على هذا النظام.";
    default:
      return `تعذّر التنفيذ${result.detail ? ` (${result.detail})` : ""}.`;
  }
}

/* ---- embedded terminals (bridge /pty/*) ------------------------------- */

export interface PtySession {
  id: string;
  agent: string;
  cwd: string;
  trusted: boolean;
  alive: boolean;
  exitCode: number | null;
  size: number;
}

export type PtyStartResult =
  | { state: "ok"; session: PtySession; config: BridgeConfig }
  | {
      state:
        | "pty_unavailable"
        | "invalid_workspace"
        | "too_many_sessions"
        | "failed";
      detail?: string;
    }
  | { state: "offline" | "bad_token" };

export interface PtyEvent {
  o?: number;
  d?: string;
  exit?: number;
  truncated?: boolean;
}

/**
 * Starts a live agent session in a pseudo-terminal. Returns the resolved
 * bridge config too, so the pane keeps talking to the same bridge.
 */
export async function startPtySession(
  config: BridgeConfig,
  agent: string,
  options: AgentRunOptions & { cols?: number; rows?: number } = {},
): Promise<PtyStartResult> {
  try {
    const resolved = await resolveBridgeConfig(config);
    const response = await bridgeFetch(resolved, "/pty/start", {
      method: "POST",
      body: JSON.stringify({
        agent,
        ...(options.cwd?.trim() ? { cwd: options.cwd.trim() } : {}),
        trust: Boolean(options.trust),
        cols: options.cols,
        rows: options.rows,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (response.status === 401) return { state: "bad_token" };
    const payload = (await response.json().catch(() => null)) as {
      ok?: boolean;
      session?: PtySession;
      error?: string;
      detail?: string;
    } | null;
    if (payload?.ok && payload.session) {
      return { state: "ok", session: payload.session, config: resolved };
    }
    const error = payload?.error;
    return {
      state:
        error === "pty_unavailable" ||
        error === "invalid_workspace" ||
        error === "too_many_sessions"
          ? error
          : "failed",
      detail:
        payload?.detail ??
        (error === "not_found"
          ? "الجسر بإصدار أقدم لا يعرف الطرفيات المدمجة — أعد تشغيله"
          : (error ?? `http_${response.status}`)),
    };
  } catch {
    return { state: "offline" };
  }
}

/** A session's current state, or null when the bridge no longer has it. */
export async function getPtySession(
  config: BridgeConfig,
  id: string,
): Promise<PtySession | null> {
  try {
    const response = await bridgeFetch(config, `/pty/${id}`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return null;
    const payload = (await response.json().catch(() => null)) as {
      session?: PtySession;
    } | null;
    return payload?.session ?? null;
  } catch {
    return null;
  }
}

export async function sendPtyInput(
  config: BridgeConfig,
  id: string,
  data: string,
): Promise<boolean> {
  try {
    const response = await bridgeFetch(config, `/pty/${id}/input`, {
      method: "POST",
      body: JSON.stringify({ data }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export function resizePty(
  config: BridgeConfig,
  id: string,
  cols: number,
  rows: number,
) {
  return bridgeFetch(config, `/pty/${id}/resize`, {
    method: "POST",
    body: JSON.stringify({ cols, rows }),
  }).catch(() => null);
}

export function stopPtySession(config: BridgeConfig, id: string) {
  return bridgeFetch(config, `/pty/${id}`, { method: "DELETE" }).catch(
    () => null,
  );
}

/**
 * Follows a session's NDJSON stream from `from` until it exits, the bridge
 * drops, or `signal` aborts. Resolves when the stream ends.
 */
export async function followPty(
  config: BridgeConfig,
  id: string,
  from: number,
  onEvent: (event: PtyEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  const response = await bridgeFetch(config, `/pty/${id}/stream?from=${from}`, {
    signal,
  });
  if (!response.ok || !response.body) {
    throw new Error(`pty_stream_${response.status}`);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    pending += decoder.decode(value, { stream: true });
    const lines = pending.split("\n");
    pending = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        onEvent(JSON.parse(line) as PtyEvent);
      } catch {
        /* a malformed line is skipped, never fatal */
      }
    }
  }
}

export interface CleanResult {
  text: string | null;
  model?: string;
  fallbackReason?: string;
}

/** Optional Gemini pass over a terminal capture (grounded server-side). */
export async function cleanAgentOutput(
  raw: string,
  sent: string,
  model: string,
  userKey?: string,
): Promise<CleanResult> {
  try {
    const response = await fetch("/api/clean", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(userKey ? { "x-user-gemini-key": userKey } : {}),
      },
      body: JSON.stringify({ raw, sent, model }),
    });
    const payload = (await response.json().catch(() => null)) as {
      text?: string;
      model?: string;
      fallback?: boolean;
      reason?: string;
    } | null;
    if (
      response.ok &&
      payload?.fallback === false &&
      typeof payload.text === "string" &&
      payload.text.trim()
    ) {
      return { text: payload.text.trim(), model: payload.model };
    }
    return {
      text: null,
      fallbackReason: payload?.reason ?? `http_${response.status}`,
    };
  } catch {
    return { text: null, fallbackReason: "network" };
  }
}

export interface TranslationResult {
  arabic: string | null;
  model?: string;
  fallbackReason?: string;
}

/** English agent output → Arabic, via the same key contract as optimization. */
export async function translateToArabic(
  text: string,
  model: string,
  userKey?: string,
): Promise<TranslationResult> {
  try {
    const response = await fetch("/api/translate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(userKey ? { "x-user-gemini-key": userKey } : {}),
      },
      body: JSON.stringify({ text, model }),
    });
    const payload = (await response.json().catch(() => null)) as {
      arabic?: string;
      model?: string;
      fallback?: boolean;
      reason?: string;
    } | null;
    if (
      response.ok &&
      payload &&
      payload.fallback === false &&
      typeof payload.arabic === "string" &&
      payload.arabic.trim()
    ) {
      return { arabic: payload.arabic.trim(), model: payload.model };
    }
    return {
      arabic: null,
      fallbackReason: payload?.reason ?? `http_${response.status}`,
    };
  } catch {
    return { arabic: null, fallbackReason: "network" };
  }
}
