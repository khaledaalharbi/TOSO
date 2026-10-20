/**
 * Browser side of the agent bridge — the registry mirrors the allowlist in
 * bin/toso-bridge.mjs (ids must match) plus the pieces the UI needs: a
 * fallback shell command and the default bridge address.
 */

export interface AgentOption {
  id: string;
  label: string;
  /** Command prefix used when building the copy-paste fallback. */
  cmd: string;
  /** Per-run folder trust exists for this agent (bridge adapter trustEnv). */
  trustPerRun?: boolean;
  /** Permanent folder trust exists (the agent's own registry, trustFile). */
  trustPersistent?: boolean;
}

export const AGENT_OPTIONS: AgentOption[] = [
  {
    id: "gemini",
    label: "Gemini CLI",
    cmd: "gemini -p",
    trustPerRun: true,
    trustPersistent: true,
  },
  { id: "devin", label: "Devin", cmd: "devin -p", trustPersistent: true },
  { id: "hermes", label: "Hermes", cmd: "hermes --oneshot" },
  { id: "claude", label: "Claude Code", cmd: "claude -p" },
  { id: "codex", label: "OpenAI Codex", cmd: "codex exec" },
];

export const DEFAULT_BRIDGE_URL = "http://127.0.0.1:8676";

/**
 * Send-mode rule (the spec): the named send button is disabled while
 * auto-dispatch is on AND the picked agent is the configured default —
 * picking another agent returns manual control; picking the default back
 * re-engages auto. `picked === null` means "the default".
 */
export function agentSendMode(opts: {
  autoSend?: boolean;
  picked?: string | null;
  defaultAgent: string;
}): { active: string; auto: boolean } {
  const active = opts.picked ?? opts.defaultAgent;
  return {
    active,
    auto: Boolean(opts.autoSend) && active === opts.defaultAgent,
  };
}

export function agentLabel(id: string): string {
  return AGENT_OPTIONS.find((agent) => agent.id === id)?.label ?? id;
}

/**
 * Fallback for a missing bridge: the whole invocation as one line the user
 * can paste into a terminal. Quotes inside the prompt are escaped for
 * POSIX shells; Windows PowerShell users may need minor edits — the bridge
 * remains the reliable path.
 */
export function agentCommand(agentId: string, prompt: string): string {
  const agent = AGENT_OPTIONS.find((entry) => entry.id === agentId);
  const escaped = prompt.replace(/(["\\$`])/g, "\\$1");
  return `${agent?.cmd ?? agentId} "${escaped}"`;
}
