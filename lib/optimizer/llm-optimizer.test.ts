import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let optimizeDual: typeof import("./llm-optimizer").optimizeDual;
beforeEach(async () => {
  vi.resetModules();
  ({ optimizeDual } = await import("./llm-optimizer"));
});

afterEach(() => vi.unstubAllGlobals());

describe("optimizeDual usage", () => {
  it("keeps separate numeric entities intact on local fallback", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ fallback: true, reason: "no_api_key" }),
      }),
    );
    const result = await optimizeDual("اكتب 3 .14");
    expect(result.arabic).toBe("اكتب 3 .14");
  });

  it("skips repeated no-key requests but allows a newly supplied user key", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ fallback: true, reason: "no_api_key" }),
      })
      .mockResolvedValue({
        ok: true,
        json: async () => ({
          arabic: "حلل",
          english: "Analyze",
          fallback: false,
          viaUserKey: true,
        }),
      });
    vi.stubGlobal("fetch", fetchMock);
    await optimizeDual("حلل");
    expect((await optimizeDual("حلل مرة أخرى")).source).toBe("mock");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((await optimizeDual("حلل", undefined, "user-key")).source).toBe(
      "gemini",
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([{}, null, { arabic: 12 }, { arabic: "حلل", english: 12 }])(
    "reports invalid successful responses honestly: %j",
    async (payload) => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: true, json: async () => payload }),
      );
      const result = await optimizeDual("حلل التقرير");
      expect(result.fallbackReason).toBe("bad_model_output");
      expect(result.note).not.toContain("بدون مفتاح");
    },
  );

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

  it("forwards the BYOK key as a header and reports viaUserKey", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        arabic: "حلل",
        english: "Analyze",
        note: "تم",
        model: "gemini-3.8-flash",
        fallback: false,
        viaUserKey: true,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await optimizeDual("حلل", "gemini-3.8-flash", "user-ai-key");
    expect(result.viaUserKey).toBe(true);
    expect(fetchMock.mock.calls[0][1].headers["x-user-gemini-key"]).toBe(
      "user-ai-key",
    );
  });

  it("explains user_key_quota without blaming the server key", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ fallback: true, reason: "user_key_quota" }),
      }),
    );
    const result = await optimizeDual("حلل");
    expect(result.source).toBe("mock");
    expect(result.note).toContain("مفتاحك");
    expect(result.note).toContain("حصة");
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

  it("accepts an English-only reply for an input with no Arabic and leaves Arabic null", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          english: "Summarize the report.",
          note: "حُذفت المجاملات",
          direction: "en",
          model: "gemini-3.8-flash",
          fallback: false,
        }),
      }),
    );
    expect(await optimizeDual("Please summarize the report")).toMatchObject({
      arabic: null,
      english: "Summarize the report.",
      source: "gemini",
    });
  });

  it("ignores a stray arabic field for an English input and rejects a missing english field", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          arabic: "لخص",
          english: "Summarize",
          fallback: false,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ arabic: "لخص", fallback: false }),
      });
    vi.stubGlobal("fetch", fetchMock);
    expect((await optimizeDual("Summarize it")).arabic).toBeNull();
    const rejected = await optimizeDual("Summarize it");
    expect(rejected.fallbackReason).toBe("bad_model_output");
    expect(rejected.source).toBe("mock");
  });

  it("cleans an English input locally on fallback and keeps Arabic null", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ fallback: true, reason: "no_api_key" }),
      }),
    );
    expect(
      await optimizeDual("Please   summarize the report, thanks!"),
    ).toMatchObject({
      arabic: null,
      english: "summarize the report",
      source: "mock",
    });
  });
});
