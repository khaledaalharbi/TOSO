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
