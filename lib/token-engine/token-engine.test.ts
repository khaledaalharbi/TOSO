import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { arabicRatio, heuristicCount } from "./token-engine";

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());

describe("analyzeTokens", () => {
  it("requests and records the selected counting model", async () => {
    const { analyzeTokens } = await import("./token-engine");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        tokens: 12,
        fallback: false,
        model: "gemini-3.5-flash-lite",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await analyzeTokens(
      "حلل التقرير",
      undefined,
      "gemini-3.5-flash-lite",
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      text: "حلل التقرير",
      model: "gemini-3.5-flash-lite",
    });
    expect(result).toMatchObject({
      tokens: 12,
      source: "provider",
      model: "gemini-3.5-flash-lite",
    });
  });

  it("allows a BYOK key after latching the missing server key", async () => {
    const { analyzeTokens } = await import("./token-engine");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ fallback: true, reason: "no_api_key" }),
      })
      .mockResolvedValue({
        ok: true,
        json: async () => ({ tokens: 12, fallback: false }),
      });
    vi.stubGlobal("fetch", fetchMock);
    await analyzeTokens("حلل التقرير");
    await analyzeTokens("نص آخر");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await analyzeTokens("حلل التقرير", "user-key")).toMatchObject({
      tokens: 12,
      source: "provider",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("uses the same local estimator for concurrent cold-start measurements", async () => {
    const { analyzeTokens, warmTokenizer } = await import("./token-engine");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    warmTokenizer();
    const results = await Promise.all([
      analyzeTokens("حلل التقرير"),
      analyzeTokens("حلل التقرير"),
      analyzeTokens("حلل التقرير"),
    ]);
    expect(results.map(({ source }) => source)).toEqual(["bpe", "bpe", "bpe"]);
    expect(results[0]).toEqual(results[1]);
  });

  it.each([NaN, Infinity, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    "does not accept invalid official counts: %s",
    async (tokens) => {
      const { analyzeTokens } = await import("./token-engine");
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ tokens, fallback: false }),
        }),
      );
      const result = await analyzeTokens("حلل التقرير");
      expect(result.source).toBe("bpe");
      expect(Number.isSafeInteger(result.tokens)).toBe(true);
      expect(result.tokens).toBeGreaterThan(0);
    },
  );
});

describe("heuristicCount", () => {
  it("returns 0 for empty text", () => {
    expect(heuristicCount("")).toBe(0);
  });

  it("counts Arabic at the calibrated 0.333 tokens/char", () => {
    expect(heuristicCount("م".repeat(100))).toBe(34);
  });

  it("counts Latin at the calibrated 0.25 tokens/char", () => {
    expect(heuristicCount("a".repeat(100))).toBe(25);
  });

  it("rates Arabic higher than Latin for equal length — the product premise", () => {
    expect(heuristicCount("م".repeat(100))).toBeGreaterThan(
      heuristicCount("a".repeat(100)),
    );
  });
});

describe("arabicRatio", () => {
  it("returns 0 for empty and non-Arabic text", () => {
    expect(arabicRatio("")).toBe(0);
    expect(arabicRatio("hello world")).toBe(0);
  });

  it("returns 1 for fully Arabic text", () => {
    expect(arabicRatio("حللالأداء")).toBe(1);
  });

  it("counts Arabic-script letters over total characters", () => {
    // 9 Arabic letters + 1 space = 10 chars
    expect(arabicRatio("حلل الأداء")).toBeCloseTo(0.9);
  });

  it("treats mixed text proportionally", () => {
    expect(arabicRatio("حلل ok")).toBeCloseTo(0.5);
  });
});
