import { describe, expect, it } from "vitest";
import {
  AGENT_REPLY_DIRECTIVE,
  isAgentWireText,
  withEnglishReply,
} from "./agents";

describe("withEnglishReply — agents answer in English too", () => {
  it("appends the directive on its own line", () => {
    expect(withEnglishReply("List the open tasks.  \n")).toBe(
      `List the open tasks.\n${AGENT_REPLY_DIRECTIVE}`,
    );
  });

  it("is idempotent, so a re-sent turn is not doubled", () => {
    const once = withEnglishReply("List the open tasks.");
    expect(withEnglishReply(once)).toBe(once);
  });

  it("keeps the wire English", () => {
    expect(isAgentWireText(withEnglishReply("Summarize progress"))).toBe(true);
  });
});

describe("isAgentWireText — agents receive English only", () => {
  it("accepts plain English", () => {
    expect(
      isAgentWireText(
        "Analyze this project, detailing its strengths and weaknesses.",
      ),
    ).toBe(true);
  });

  it("refuses Arabic text", () => {
    expect(isAgentWireText("حلل لي هذا المشروع بالتفصيل موضحاً نقاط القوة")).toBe(
      false,
    );
  });

  it("tolerates a few Arabic words kept verbatim inside English", () => {
    expect(
      isAgentWireText(
        'Summarize the file named "تقرير المبيعات" and list the main points.',
      ),
    ).toBe(true);
  });

  it("refuses mostly-Arabic text with an English word or two", () => {
    expect(isAgentWireText("حلل هذا المشروع بالتفصيل مع ذكر الـ SWOT")).toBe(
      false,
    );
  });
});
