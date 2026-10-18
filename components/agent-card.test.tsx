import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AgentCard, type AgentRunState } from "./agent-card";

const baseRun: AgentRunState = {
  agent: "claude",
  prompt: "النص المنقّح",
  phase: "running",
};

const render = (
  run: AgentRunState,
  translation: Parameters<typeof AgentCard>[0]["translation"] = null,
) =>
  renderToStaticMarkup(
    <AgentCard
      run={run}
      translation={translation}
      translating={false}
      onTranslate={() => {}}
      onCopyFallback={() => {}}
    />,
  );

describe("AgentCard", () => {
  it("shows the running state with the agent label", () => {
    const html = render(baseRun);
    expect(html).toContain("Claude Code");
    expect(html).toContain("الوكيل يعمل");
  });

  it("shows the agent output when done", () => {
    const html = render({
      ...baseRun,
      phase: "done",
      job: {
        id: "j",
        agent: "claude",
        status: "done",
        output: "Done: 3 files changed",
        error: null,
        exitCode: 0,
        startedAt: 0,
        endedAt: 1,
      },
    });
    expect(html).toContain("Done: 3 files changed");
    expect(html).toContain("ترجمة النتيجة إلى العربية");
    expect(html).toContain("exit 0");
  });

  it("explains bridge-offline and offers the command fallback", () => {
    const html = render({
      ...baseRun,
      phase: "offline",
      message: "الجسر غير متصل على هذا العنوان.",
    });
    expect(html).toContain("الجسر غير متصل");
    expect(html).toContain("npm run bridge");
    expect(html).toContain("نسخ أمر التشغيل");
  });

  it("surfaces job errors without hiding them", () => {
    const html = render({
      ...baseRun,
      phase: "error",
      job: {
        id: "j",
        agent: "codex",
        status: "error",
        output: "partial",
        error: "exit_3: boom",
        exitCode: 3,
        startedAt: 0,
        endedAt: 1,
      },
      message: "انقطع الاتصال",
    });
    expect(html).toContain("exit_3: boom");
  });

  it("renders the Arabic translation when present", () => {
    const html = render(
      {
        ...baseRun,
        phase: "done",
        job: {
          id: "j",
          agent: "gemini",
          status: "done",
          output: "English",
          error: null,
          exitCode: 0,
          startedAt: 0,
          endedAt: 1,
        },
      },
      { arabic: "الترجمة العربية هنا", model: "gemini-3.8-flash" },
    );
    expect(html).toContain("الترجمة العربية هنا");
    expect(html).toContain("gemini-3.8-flash");
  });

  it("states the missing translation honestly instead of hiding it", () => {
    const html = render(
      {
        ...baseRun,
        phase: "done",
        job: {
          id: "j",
          agent: "gemini",
          status: "done",
          output: "English",
          error: null,
          exitCode: 0,
          startedAt: 0,
          endedAt: 1,
        },
      },
      { arabic: null, fallbackReason: "no_api_key" },
    );
    expect(html).toContain("تعذّرت الترجمة");
    expect(html).toContain("no_api_key");
  });
});
