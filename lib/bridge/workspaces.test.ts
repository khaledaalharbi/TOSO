import { describe, expect, it } from "vitest";
import {
  parseAgentFlags,
  parseAgentSetup,
  parseWorkspaces,
  samePath,
  sendAlsoCheck,
  serializeAgentFlags,
  serializeWorkspaces,
  setupDone,
  withAgentFlag,
  withWorkspace,
  workspaceFor,
} from "./workspaces";

describe("agent setup steps", () => {
  it("counts a step only for the folder it succeeded on", () => {
    const setup = { gemini: { checked: "C:\\A", trusted: "C:\\A" } };
    expect(setupDone(setup, { gemini: "C:\\A" }, "gemini", "checked")).toBe(
      true,
    );
    // Editing the path re-locks the sequence.
    expect(setupDone(setup, { gemini: "C:\\B" }, "gemini", "checked")).toBe(
      false,
    );
    expect(setupDone(setup, { gemini: " C:\\A " }, "gemini", "trusted")).toBe(
      true,
    );
    expect(setupDone(setup, undefined, "gemini", "checked")).toBe(false);
    expect(setupDone({}, { devin: "C:\\A" }, "devin", "checked")).toBe(false);
  });

  it("parses stored steps defensively", () => {
    expect(
      parseAgentSetup(
        JSON.stringify({ gemini: { checked: "C:\\A", trusted: 5 }, x: null }),
      ),
    ).toEqual({ gemini: { checked: "C:\\A" } });
    for (const raw of [null, "", "nope", "[]"]) {
      expect(parseAgentSetup(raw)).toEqual({});
    }
  });
});

describe("per-agent flags", () => {
  it("keeps only true flags and drops the map when empty", () => {
    expect(parseAgentFlags('{"gemini":true,"devin":false,"x":"1"}')).toEqual({
      gemini: true,
    });
    expect(withAgentFlag({ gemini: true }, "gemini", false)).toBeUndefined();
    expect(withAgentFlag(undefined, "devin", true)).toEqual({ devin: true });
    expect(serializeAgentFlags({})).toBeNull();
  });
});

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

describe("samePath", () => {
  it("treats Windows case, slash style and a trailing separator as the same folder", () => {
    expect(samePath("C:\\MyProject\\App", "c:/myproject/app/")).toBe(true);
    expect(samePath("C:\\MyProject\\App\\", "C:\\MyProject\\App")).toBe(true);
  });

  it("keeps different folders different, and empty is never a match", () => {
    expect(samePath("C:\\MyProject\\App", "C:\\MyProject\\App2")).toBe(false);
    expect(samePath("", "")).toBe(false);
    expect(samePath(undefined, "C:\\A")).toBe(false);
  });

  it("stays case-sensitive for POSIX paths", () => {
    expect(samePath("/home/u/App", "/home/u/app")).toBe(false);
    expect(samePath("/", "/")).toBe(true);
  });
});

describe("sendAlsoCheck — judged before the send button is pressed", () => {
  const ready = { folder: "C:\\B", checked: true, live: true, busy: false };

  it("blocks a target without a checked folder", () => {
    expect(sendAlsoCheck("C:\\A", { ...ready, checked: false })).toEqual({
      kind: "unchecked",
    });
    expect(sendAlsoCheck("C:\\A", { ...ready, folder: " " })).toEqual({
      kind: "unchecked",
    });
  });

  it("flags another project so the user must confirm", () => {
    expect(sendAlsoCheck("C:\\A", ready)).toMatchObject({
      kind: "ready",
      otherProject: true,
    });
    expect(sendAlsoCheck("c:/b/", ready)).toMatchObject({
      otherProject: false,
    });
  });

  it("says when the session will start, or when texts will queue behind a turn", () => {
    expect(sendAlsoCheck("C:\\B", { ...ready, live: false })).toMatchObject({
      willStart: true,
      willQueue: false,
    });
    expect(sendAlsoCheck("C:\\B", { ...ready, busy: true })).toMatchObject({
      willStart: false,
      willQueue: true,
    });
  });

  it("queues behind a turn whose session is still starting (seen live)", () => {
    expect(
      sendAlsoCheck("C:\\B", { ...ready, live: false, busy: true }),
    ).toMatchObject({ willStart: false, willQueue: true });
  });
});
