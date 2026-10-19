import { describe, expect, it } from "vitest";
import {
  parseWorkspaces,
  serializeWorkspaces,
  withWorkspace,
  workspaceFor,
} from "./workspaces";

describe("per-agent workspaces", () => {
  it("parses a stored map and drops malformed or blank entries", () => {
    expect(
      parseWorkspaces(
        JSON.stringify({ claude: " C:\\A ", gemini: "", devin: 5, x: null }),
      ),
    ).toEqual({ claude: "C:\\A" });
    for (const raw of [null, "", "not json", "[]", '"str"', "42"]) {
      expect(parseWorkspaces(raw)).toEqual({});
    }
  });

  it("sets each agent independently and never mutates the input", () => {
    const base = { claude: "C:\\A" };
    const next = withWorkspace(base, "gemini", "C:\\B");
    expect(next).toEqual({ claude: "C:\\A", gemini: "C:\\B" });
    expect(base).toEqual({ claude: "C:\\A" });
  });

  it("keeps a half-typed path raw but a blank path clears the entry", () => {
    expect(withWorkspace({}, "claude", "C:\\My ")).toEqual({
      claude: "C:\\My ",
    });
    expect(withWorkspace({ claude: "C:\\A" }, "claude", "   ")).toBeUndefined();
    expect(
      withWorkspace({ claude: "C:\\A", gemini: "C:\\B" }, "claude", ""),
    ).toEqual({ gemini: "C:\\B" });
  });

  it("resolves the trimmed folder per agent, undefined when unset", () => {
    const all = { claude: "  C:\\A  " };
    expect(workspaceFor(all, "claude")).toBe("C:\\A");
    expect(workspaceFor(all, "gemini")).toBeUndefined();
    expect(workspaceFor(undefined, "claude")).toBeUndefined();
  });

  it("serializes trimmed values, or null when nothing is set", () => {
    expect(serializeWorkspaces({ claude: " C:\\A " })).toBe(
      JSON.stringify({ claude: "C:\\A" }),
    );
    expect(serializeWorkspaces({ claude: "  " })).toBeNull();
    expect(serializeWorkspaces(undefined)).toBeNull();
  });
});
