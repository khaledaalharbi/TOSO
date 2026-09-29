import { afterEach, describe, expect, it, vi } from "vitest";
import { optimizeDual } from "./llm-optimizer";

afterEach(() => vi.unstubAllGlobals());

describe("optimizeDual usage", () => {
  it("passes usage from the successful route response without estimating missing fields", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          arabic: "حلل 50%",
          english: "Analyze 50%",
          note: "تم",
          model: "gemini-3.8-flash",
          fallback: false,
          usage: { total_input_tokens: 30, total_thought_tokens: 0 },
        }),
      }),
    );
    expect(await optimizeDual("حلل 50%", "gemini-3.8-flash")).toMatchObject({
      source: "gemini",
      usage: { total_input_tokens: 30, total_thought_tokens: 0 },
    });
  });

  it("does not fabricate usage or English output on local fallback", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ fallback: true, reason: "no_api_key" }),
      }),
    );
    expect(await optimizeDual("حلل 50%")).toMatchObject({
      source: "mock",
      english: null,
      usage: null,
    });
  });

  it("maps the no_api_key reason to the no-key note, not a raw code", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ fallback: true, reason: "no_api_key" }),
      }),
    );
    const result = await optimizeDual("حلل 50%");
    expect(result.source).toBe("mock");
    expect(result.note).toContain("بدون مفتاح");
    expect(result.note).not.toContain("no_api_key");
  });

  it("reports the real fallback reason instead of always blaming the key", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ fallback: true, reason: "http_429" }),
      }),
    );
    const result = await optimizeDual("حلل 50%");
    expect(result.source).toBe("mock");
    expect(result.note).toContain("حصة");
    expect(result.note).not.toContain("بدون مفتاح");
  });
});
