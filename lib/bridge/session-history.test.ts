import { describe, expect, it } from "vitest";
import {
  newlyClosed,
  parseHistory,
  recordClosed,
  sessionPanels,
  type BridgeSessionView,
} from "./session-history";

const live = (id: string, agent: string, cwd: string): BridgeSessionView => ({
  id,
  agent,
  cwd,
  alive: true,
  startedAt: 1,
});

describe("sessionPanels", () => {
  it("shows at most 3 live sessions and counts the rest", () => {
    const sessions = ["a", "b", "c", "d", "e"].map((id) =>
      live(id, "hermes", `C:\\${id}`),
    );
    const panels = sessionPanels(sessions, []);
    expect(panels.live.map((s) => s.id)).toEqual(["a", "b", "c"]);
    expect(panels.moreLive).toBe(2);
    expect(panels.liveCount).toBe(5);
  });

  it("lists closed sessions from history and from the bridge's ended ones, newest first", () => {
    const panels = sessionPanels(
      [{ id: "x", agent: "codex", cwd: "C:\\X", alive: false, endedAt: 30 }],
      [
        { agent: "claude", cwd: "C:\\Y", endedAt: 20 },
        { agent: "devin", cwd: "C:\\Z", endedAt: 10 },
        { agent: "gemini", cwd: "C:\\W", endedAt: 5 },
      ],
    );
    expect(panels.closed.map((c) => c.agent)).toEqual([
      "codex",
      "claude",
      "devin",
    ]);
    expect(panels.moreClosed).toBe(1);
  });

  it("does not list a project as closed while it is live again", () => {
    const panels = sessionPanels(
      [live("n", "claude", "c:/y/")],
      [{ agent: "claude", cwd: "C:\\Y", endedAt: 20 }],
    );
    expect(panels.closed).toEqual([]);
  });
});

describe("recordClosed", () => {
  it("keeps one line per agent + folder — the newest", () => {
    const history = recordClosed(
      [{ agent: "claude", cwd: "C:\\Y", endedAt: 1 }],
      [{ agent: "claude", cwd: "c:/y", endedAt: 9 }],
    );
    expect(history).toEqual([{ agent: "claude", cwd: "c:/y", endedAt: 9 }]);
  });

  it("keeps the same folder for two different agents apart", () => {
    expect(
      recordClosed(
        [{ agent: "claude", cwd: "C:\\Y", endedAt: 1 }],
        [{ agent: "codex", cwd: "C:\\Y", endedAt: 2 }],
      ),
    ).toHaveLength(2);
  });
});

describe("newlyClosed", () => {
  it("catches sessions that ended or vanished since the last look", () => {
    const before = [live("a", "hermes", "C:\\A"), live("b", "devin", "C:\\B")];
    const now: BridgeSessionView[] = [
      { ...before[0], alive: false, endedAt: 50 },
    ];
    expect(newlyClosed(before, now, 99)).toEqual([
      { agent: "hermes", cwd: "C:\\A", endedAt: 50 },
      { agent: "devin", cwd: "C:\\B", endedAt: 99 },
    ]);
    expect(newlyClosed(before, before, 99)).toEqual([]);
  });
});

describe("parseHistory", () => {
  it("drops malformed entries instead of crashing", () => {
    expect(parseHistory("nope")).toEqual([]);
    expect(
      parseHistory(
        JSON.stringify([
          { agent: "claude", cwd: "C:\\Y", endedAt: 1 },
          { agent: "claude", cwd: " ", endedAt: 1 },
          { agent: 3 },
        ]),
      ),
    ).toEqual([{ agent: "claude", cwd: "C:\\Y", endedAt: 1 }]);
  });
});
