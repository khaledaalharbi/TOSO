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
}

export type AgentSendResult =
  | { ok: true; job: AgentJob }
  | { ok: false; status: BridgeStatus };

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
 */
export async function sendPromptToAgent(
  config: BridgeConfig,
  agent: string,
  prompt: string,
  signal?: AbortSignal,
): Promise<AgentSendResult> {
  const resolved = await resolveBridgeConfig(config);
  const health = await checkBridge(resolved);
  if (health.state !== "ok") return { ok: false, status: health };
  config = resolved;

  let response: Response;
  try {
    response = await bridgeFetch(config, "/run", {
      method: "POST",
      body: JSON.stringify({ agent, prompt }),
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
  } | null;
  if (!response.ok || !started?.jobId) {
    return { ok: false, status: { state: "offline" } };
  }
  if (started.job && started.job.status !== "running") {
    return { ok: true, job: started.job };
  }

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
    if (payload.job.status !== "running") {
      return { ok: true, job: payload.job };
    }
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
