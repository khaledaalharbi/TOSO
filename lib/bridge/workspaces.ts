/**
 * Per-agent workspace folders — each agent tab works on its own project, so
 * Claude can run in one folder while Gemini runs in another. Stored as one
 * small JSON map; values are kept raw while typing (a trailing space is part
 * of a path being typed) and trimmed only when used or persisted.
 */

export type Workspaces = Record<string, string>;

export const WORKSPACES_STORAGE = "toso.workspaces";

/** Pre-tabs global key — removed on load; the global folder no longer exists. */
export const LEGACY_WORKSPACE_STORAGE = "toso.workspace";

/** Reads the persisted map defensively: anything malformed becomes `{}`. */
export function parseWorkspaces(raw: string | null): Workspaces {
  if (!raw) return {};
  try {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object" || Array.isArray(data)) return {};
    const entries: [string, string][] = [];
    for (const [agent, value] of Object.entries(data)) {
      if (typeof value === "string" && value.trim()) {
        entries.push([agent, value.trim()]);
      }
    }
    return Object.fromEntries(entries);
  } catch {
    return {};
  }
}

/** The trimmed folder for an agent, or undefined (→ the bridge's own cwd). */
export function workspaceFor(
  all: Workspaces | undefined,
  agent: string,
): string | undefined {
  return all?.[agent]?.trim() || undefined;
}

/** Immutable update; a blank path removes the agent's entry (and the map when empty). */
export function withWorkspace(
  all: Workspaces | undefined,
  agent: string,
  path: string,
): Workspaces | undefined {
  const next = { ...all };
  if (path.trim()) next[agent] = path;
  else delete next[agent];
  return Object.keys(next).length ? next : undefined;
}

/** JSON for storage: trimmed values, or null when nothing is set. */
export function serializeWorkspaces(
  all: Workspaces | undefined,
): string | null {
  const clean = parseWorkspaces(JSON.stringify(all ?? {}));
  return Object.keys(clean).length ? JSON.stringify(clean) : null;
}

/**
 * Per-agent setup steps, each holding the folder it succeeded on — editing
 * the path retires them (the stored path no longer matches). The check is
 * a snapshot, so this lives in sessionStorage, not localStorage.
 */
export type AgentSetup = Record<string, { checked?: string; trusted?: string }>;

export const AGENT_SETUP_SESSION = "toso.agentSetup";

export function parseAgentSetup(raw: string | null): AgentSetup {
  if (!raw) return {};
  try {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object" || Array.isArray(data)) return {};
    const out: AgentSetup = {};
    for (const [agent, value] of Object.entries(data)) {
      if (!value || typeof value !== "object") continue;
      const { checked, trusted } = value as Record<string, unknown>;
      out[agent] = {
        ...(typeof checked === "string" ? { checked } : {}),
        ...(typeof trusted === "string" ? { trusted } : {}),
      };
    }
    return out;
  } catch {
    return {};
  }
}

/** Has `step` succeeded for the agent's CURRENT folder? */
export function setupDone(
  setup: AgentSetup,
  workspaces: Workspaces | undefined,
  agent: string,
  step: "checked" | "trusted",
): boolean {
  const path = workspaceFor(workspaces, agent);
  return Boolean(path) && setup[agent]?.[step] === path;
}

/**
 * Per-agent boolean toggles stored as one small JSON map — same shape and
 * same defensive parsing as the workspaces map. Used for the per-tab
 * «ثقة لكل تشغيلة» switch.
 */
export type AgentFlags = Record<string, boolean>;

export const AUTO_TRUST_AGENTS_STORAGE = "toso.autoTrustAgents";

/** Pre-map single trust boolean — migrated to `{gemini:true}` then removed. */
export const LEGACY_AUTO_TRUST_STORAGE = "toso.autoTrust";

/** Removed feature: sessions start on first send or the start button only. */
export const LEGACY_AUTO_TERMINAL_STORAGE = "toso.autoTerminal";

export function parseAgentFlags(raw: string | null): AgentFlags {
  if (!raw) return {};
  try {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object" || Array.isArray(data)) return {};
    return Object.fromEntries(
      Object.entries(data).filter(([, v]) => v === true),
    );
  } catch {
    return {};
  }
}

export function withAgentFlag(
  all: AgentFlags | undefined,
  agent: string,
  on: boolean,
): AgentFlags | undefined {
  const next = { ...all };
  if (on) next[agent] = true;
  else delete next[agent];
  return Object.keys(next).length ? next : undefined;
}

export function serializeAgentFlags(
  all: AgentFlags | undefined,
): string | null {
  const clean = parseAgentFlags(JSON.stringify(all ?? {}));
  return Object.keys(clean).length ? JSON.stringify(clean) : null;
}
