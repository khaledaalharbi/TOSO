import { describe, expect, it } from "vitest";
import { abortAllRuns, beginRun, type RunRegistry } from "./run-registry";

describe("run registry", () => {
  it("starting another agent never aborts a run in flight elsewhere", () => {
    const registry: RunRegistry = {};
    const claude = beginRun(registry, "claude");
    const gemini = beginRun(registry, "gemini");
    expect(claude.signal.aborted).toBe(false);
    expect(gemini.signal.aborted).toBe(false);
  });

  it("a second send to the SAME agent supersedes only its previous run", () => {
    const registry: RunRegistry = {};
    const claude = beginRun(registry, "claude");
    const gemini = beginRun(registry, "gemini");
    const claudeAgain = beginRun(registry, "claude");
    expect(claude.signal.aborted).toBe(true);
    expect(claudeAgain.signal.aborted).toBe(false);
    expect(gemini.signal.aborted).toBe(false);
    expect(registry.claude).toBe(claudeAgain);
  });

  it("abortAllRuns cancels everything and empties the registry", () => {
    const registry: RunRegistry = {};
    const a = beginRun(registry, "claude");
    const b = beginRun(registry, "gemini");
    abortAllRuns(registry);
    expect(a.signal.aborted && b.signal.aborted).toBe(true);
    expect(Object.keys(registry)).toEqual([]);
  });
});
