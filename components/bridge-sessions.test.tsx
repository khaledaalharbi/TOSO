import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { sessionPanels } from "@/lib/bridge/session-history";
import { BridgeSessions } from "./bridge-sessions";

const render = (props: Partial<Parameters<typeof BridgeSessions>[0]> = {}) =>
  renderToStaticMarkup(
    <BridgeSessions
      state="ok"
      panels={sessionPanels(
        [
          { id: "a", agent: "hermes", cwd: "C:\\JrsAlsoq_v2", alive: true },
          { id: "b", agent: "codex", cwd: "C:\\statistics", alive: true },
        ],
        [{ agent: "claude", cwd: "C:\\TOSO", endedAt: 1 }],
      )}
      max={8}
      attached={new Set(["b"])}
      pending={null}
      onConnect={() => {}}
      onEnd={() => {}}
      onOpen={() => {}}
      {...props}
    />,
  );

describe("BridgeSessions", () => {
  it("lists live sessions with name, folder, connect and end", () => {
    const html = render();
    expect(html).toContain("الجلسات الحية");
    expect(html).toContain("Hermes");
    expect(html).toContain("C:\\JrsAlsoq_v2");
    expect(html).toContain("الاتصال بالجلسة");
    expect(html).toContain("إنهاء الجلسة");
    expect(html).toContain("حيّة 2/8");
  });

  it("marks the session a tab already shows as connected", () => {
    expect(render()).toMatch(/disabled=""[^>]*>[^]*?متصلة/);
  });

  it("lists closed sessions with a single «فتح الجلسة» button", () => {
    const html = render();
    expect(html).toContain("الجلسات المغلقة");
    expect(html).toContain("Claude Code");
    expect(html).toContain("فتح الجلسة");
  });

  it("opens itself when there are detached live sessions", () => {
    expect(render()).toMatch(/<details[^>]*open=""/);
    expect(render({ attached: new Set(["a", "b"]) })).not.toMatch(
      /<details[^>]*open=""/,
    );
  });

  it("says when the running bridge is too old to list its sessions", () => {
    const html = render({ state: "outdated" });
    expect(html).toContain("بإصدار أقدم");
    expect(html).not.toContain("الجلسات الحية");
  });
});
