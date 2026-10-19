/**
 * One in-flight run per agent. Starting a run supersedes only THAT agent's
 * previous run — the polling loop of another agent's tab is never touched,
 * which is what lets Claude work on one project while Gemini works on
 * another.
 */

export type RunRegistry = Record<string, AbortController>;

/** Aborts the agent's previous run (if any) and returns a fresh controller. */
export function beginRun(registry: RunRegistry, agent: string) {
  registry[agent]?.abort();
  const controller = new AbortController();
  registry[agent] = controller;
  return controller;
}

/** Aborts every run and empties the registry (the explicit "reset"). */
export function abortAllRuns(registry: RunRegistry) {
  for (const controller of Object.values(registry)) controller.abort();
  for (const agent of Object.keys(registry)) delete registry[agent];
}
