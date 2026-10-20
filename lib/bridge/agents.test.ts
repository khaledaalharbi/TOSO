import { describe, expect, it } from "vitest";
import { isAgentWireText } from "./agents";

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
