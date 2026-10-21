import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { OptimizationReport } from "@/lib/types";
import { AgentComposer, tokenDelta } from "./agent-composer";

const render = (props: Partial<Parameters<typeof AgentComposer>[0]> = {}) =>
  renderToStaticMarkup(
    <AgentComposer
      agent="codex"
      disabled={false}
      busy={false}
      agentBusy={false}
      progress={null}
      autoSend={false}
      onAutoSendChange={() => {}}
      onProcess={async () => null}
      onSend={() => true}
      {...props}
    />,
  );

describe("AgentComposer", () => {
  it("is the agent's own box: named after it, starting as a draft in the user's language", () => {
    const html = render();
    expect(html).toContain("مدخل OpenAI Codex");
    expect(html).toContain("مسودة — بلغتك");
    expect(html).toContain('dir="auto"');
    expect(html).toContain("إرسال مباشرة بعد المعالجة");
    // Nothing to send before processing: no send button yet.
    expect(html).not.toContain("إرسال إلى OpenAI Codex");
  });

  it("names the one-step action when the agent's auto-send switch is on", () => {
    const html = render({ autoSend: true });
    expect(html).toContain("معالجة وإرسال إلى OpenAI Codex");
    expect(html).toMatch(/<input[^>]*type="checkbox"[^>]*checked=""/);
  });

  it("locks the box until settings are hydrated", () => {
    const html = render({ disabled: true });
    expect(html).toMatch(/<textarea[^>]*disabled=""/);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>[^]*?معالجة/);
  });
});

describe("tokenDelta", () => {
  const report = (original: number, english: number | null) =>
    ({
      original: { tokens: original, characters: 0, words: 0 },
      english:
        english === null
          ? null
          : { analysis: { tokens: english, characters: 0, words: 0 } },
    }) as unknown as OptimizationReport;

  it("reads before → after from the report", () => {
    expect(tokenDelta(report(38, 24))).toBe("38 → 24");
  });

  it("prefers the provider measurement of the original", () => {
    const r = report(38, 24);
    r.originalMeasurement = { tokens: 41, source: "provider" } as never;
    expect(tokenDelta(r)).toBe("41 → 24");
  });

  it("is null without an English version", () => {
    expect(tokenDelta(report(38, null))).toBeNull();
  });
});
