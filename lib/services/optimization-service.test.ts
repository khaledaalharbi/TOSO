import { beforeEach, describe, expect, it, vi } from "vitest";
import { optimizeDual } from "@/lib/optimizer/llm-optimizer";
import { analyzeTokens, arabicRatio } from "@/lib/token-engine/token-engine";
import { runOptimization } from "./optimization-service";

vi.mock("@/lib/optimizer/llm-optimizer", () => ({ optimizeDual: vi.fn() }));
vi.mock("@/lib/token-engine/token-engine", () => ({
  analyzeTokens: vi.fn(async (text: string) => ({
    tokens: text.length,
    words: 1,
    characters: text.length,
    source: "heuristic",
  })),
  arabicRatio: vi.fn(() => 1),
  warmTokenizer: vi.fn(),
}));

const config = { provider: "google" as const, model: "gemini-3.8-flash" };
const mockedOptimize = vi.mocked(optimizeDual);

beforeEach(() => {
  vi.clearAllMocks();
  // vi.clearAllMocks does not reset implementations — re-pin the default.
  vi.mocked(arabicRatio).mockReturnValue(1);
});

describe("runOptimization", () => {
  it("counts every text with the selected model", async () => {
    mockedOptimize.mockResolvedValue({
      arabic: "حلل التقرير",
      english: "Analyze the report",
      source: "gemini",
      note: "تم",
    });
    const selected = { ...config, model: "gemini-3.5-flash-lite" };
    const report = await runOptimization("من فضلك حلل التقرير", selected);
    expect(
      vi
        .mocked(analyzeTokens)
        .mock.calls.every((call) => call[2] === selected.model),
    ).toBe(true);
    expect(report).toHaveProperty("model", selected.model);
  });

  it("remeasures against the served model after fallback and reuses identical texts", async () => {
    const servedModel = "gemini-3.5-flash-lite";
    mockedOptimize.mockResolvedValue({
      arabic: "حلل التقرير",
      english: "Analyze the report",
      source: "gemini",
      model: servedModel,
      note: "تم",
    });
    const report = await runOptimization("من فضلك حلل التقرير", config);
    expect(
      vi.mocked(analyzeTokens).mock.calls.map((call) => [call[0], call[2]]),
    ).toEqual([
      ["من فضلك حلل التقرير", config.model],
      ["حلل التقرير", config.model],
      ["من فضلك حلل التقرير", servedModel],
      ["حلل التقرير", servedModel],
      ["Analyze the report", servedModel],
    ]);
    expect(report.arabic?.measurement).toBe(report.normalizedMeasurement);
    expect(report).toHaveProperty("model", servedModel);
  });

  it("preserves literal quotes in the English primary", async () => {
    vi.mocked(arabicRatio).mockReturnValue(0);
    mockedOptimize.mockResolvedValue({
      arabic: 'اكتب "Access denied"',
      english: 'Write "Access granted"',
      note: "تم",
      source: "gemini",
    });
    const report = await runOptimization('Write "Access denied"', config);
    expect(report.rejectedByGuard).toBe(true);
    expect(report.english?.text).toBe('Write "Access denied"');
    expect(report.arabic).toBeNull();
  });

  it("allows quoted prose to be translated in the Arabic companion", async () => {
    vi.mocked(arabicRatio).mockReturnValue(0);
    mockedOptimize.mockResolvedValue({
      arabic: 'اكتب "مرحبا"',
      english: 'Write "Hello"',
      note: "تم",
      source: "gemini",
    });
    const report = await runOptimization('Write "Hello"', config);
    expect(report.rejectedByGuard).toBe(false);
    expect(report.source).toBe("gemini");
  });

  it("reuses the original measurement for an unchanged English fallback", async () => {
    vi.mocked(arabicRatio).mockReturnValue(0);
    mockedOptimize.mockResolvedValue({
      arabic: null,
      english: "Summarize the report",
      source: "mock",
      note: "محلي",
    });
    const report = await runOptimization("Summarize the report", config);
    expect(report.english?.measurement).toBe(report.originalMeasurement);
    expect(analyzeTokens).toHaveBeenCalledTimes(1);
  });

  it("measures the original while optimizing normalized text and reports safety checks", async () => {
    mockedOptimize.mockResolvedValue({
      arabic: "عايز حلل ٥٠٪",
      english: "Analyze 50%",
      note: "منقح",
      source: "gemini",
      usage: {
        total_input_tokens: 24,
        total_output_tokens: 12,
        total_thought_tokens: 8,
        total_tokens: 44,
      },
    });
    const report = await runOptimization("من فضلك عايز حلل 50%", config);
    expect(mockedOptimize).toHaveBeenCalledWith(
      "عايز حلل 50%",
      config.model,
      undefined,
    );
    expect(vi.mocked(analyzeTokens).mock.calls[0][0]).toBe(
      "من فضلك عايز حلل 50%",
    );
    expect(report.originalPrompt).toBe("من فضلك عايز حلل 50%");
    expect(report.normalizedPrompt).toBe("عايز حلل 50%");
    expect(report.normalizedMeasurement.tokens).toBe("عايز حلل 50%".length);
    expect(vi.mocked(analyzeTokens).mock.calls.map(([text]) => text)).toEqual([
      "من فضلك عايز حلل 50%",
      "عايز حلل 50%",
      "عايز حلل ٥٠٪",
      "Analyze 50%",
    ]);
    expect(report).not.toHaveProperty("dialect");
    expect(report.note).toBe("منقح");
    expect(report.entityChecks.arabic?.preserved).toBe(true);
    expect(report.entityChecks.english?.preserved).toBe(true);
    expect(report.rejectedByGuard).toBe(false);
    expect(report.optimizationUsage).toEqual({
      total_input_tokens: 24,
      total_output_tokens: 12,
      total_thought_tokens: 8,
      total_tokens: 44,
    });
  });

  it("normalizes prose around protected JSON without altering the payload sent to optimization", async () => {
    const payload = '{"النص":"حَلِّلْ","عدد":42}';
    const normalized = `لخص ${payload} ثم أجب`;
    mockedOptimize.mockResolvedValue({
      arabic: normalized,
      english: null,
      note: "محلي",
      source: "mock",
    });
    const report = await runOptimization(
      `من فضلك لَخِّصْ ${payload} ثم أَجِبْ`,
      config,
    );
    expect(mockedOptimize).toHaveBeenCalledWith(
      normalized,
      config.model,
      undefined,
    );
    expect(report.normalizedPrompt).toBe(normalized);
    expect(report.entityChecks.arabic?.preserved).toBe(true);
    expect(report.arabic?.measurement).toBe(report.normalizedMeasurement);
  });

  it("starts the normalization measurement and optimization before awaiting the original count", async () => {
    let releaseOriginal!: (
      value: Awaited<ReturnType<typeof analyzeTokens>>,
    ) => void;
    vi.mocked(analyzeTokens).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseOriginal = resolve;
        }),
    );
    mockedOptimize.mockResolvedValue({
      arabic: "حلل 50%",
      english: null,
      note: "تم",
      source: "mock",
    });
    const pending = runOptimization("من فضلك حلل 50%", config);
    expect(vi.mocked(analyzeTokens).mock.calls).toHaveLength(2);
    expect(mockedOptimize).toHaveBeenCalledOnce();
    releaseOriginal({
      tokens: 20,
      characters: 20,
      words: 4,
      source: "heuristic",
    });
    await pending;
  });

  it("rejects model output that loses a required entity without claiming an English translation", async () => {
    mockedOptimize.mockResolvedValue({
      arabic: "حلل البيانات",
      english: "Analyze data",
      note: "تم",
      source: "gemini",
      usage: { total_input_tokens: 21, total_tokens: 42 },
    });
    const onOptimized = vi.fn();
    const report = await runOptimization(
      "من فضلك حلل 42% من البيانات",
      config,
      { onOptimized },
    );
    expect(report.rejectedByGuard).toBe(true);
    expect(report.optimizationUsage).toEqual({
      total_input_tokens: 21,
      total_tokens: 42,
    });
    expect(report.source).toBe("mock");
    expect(report.arabic?.text).toBe("حلل 42% من البيانات");
    expect(report.arabic?.measurement).toBe(report.normalizedMeasurement);
    expect(vi.mocked(analyzeTokens).mock.calls).toHaveLength(2);
    expect(report.english).toBeNull();
    expect(onOptimized).toHaveBeenCalledWith(
      expect.objectContaining({ source: "mock", english: null }),
    );
  });

  it("rejects a Gemini Arabic field that is not actually written in Arabic", async () => {
    mockedOptimize.mockResolvedValue({
      arabic: "Write an apology message to the customer",
      english: "Write an apology message to the customer",
      note: "تم",
      source: "gemini",
    });
    const report = await runOptimization(
      "من فضلك اكتب رسالة اعتذار للعميل",
      config,
    );
    expect(report.rejectedByGuard).toBe(true);
    expect(report.source).toBe("mock");
    expect(report.english).toBeNull();
    expect(report.arabic?.text).toBe("اكتب رسالة اعتذار للعميل");
    expect(report.quality.arabic?.languageOk).toBe(true);
    expect(report.quality.english).toBeNull();
  });

  it("rejects a translated variant if it changes a protected number", async () => {
    mockedOptimize.mockResolvedValue({
      arabic: "حلل 50%",
      english: "Analyze 40%",
      note: "تم",
      source: "gemini",
    });
    const report = await runOptimization("حلل 50%", config);
    expect(report.rejectedByGuard).toBe(true);
    expect(report.english).toBeNull();
    expect(report.arabic?.text).toBe("حلل 50%");
  });

  it("retains honest mock fallback and does not invent an English variant", async () => {
    mockedOptimize.mockResolvedValue({
      arabic: "راجع {user_id}",
      english: null,
      note: "محلي",
      source: "mock",
    });
    const report = await runOptimization("راجع {user_id}", config);
    expect(report.source).toBe("mock");
    expect(report.english).toBeNull();
    expect(report.optimizationUsage).toBeNull();
    expect(report.normalizedMeasurement).toBe(report.originalMeasurement);
    expect(vi.mocked(analyzeTokens).mock.calls).toHaveLength(1);
    expect(report.entityChecks.arabic?.preserved).toBe(true);
  });

  it("reverses to an English-primary direction when the input carries no Arabic", async () => {
    vi.mocked(arabicRatio).mockReturnValue(0);
    mockedOptimize.mockResolvedValue({
      arabic: "لخص التقرير الفصلي",
      english: "Summarize the quarterly report concisely",
      note: "تم",
      source: "gemini",
    });
    const report = await runOptimization(
      "Please analyze this quarterly report in detail",
      config,
    );
    expect(report.direction).toBe("en");
    expect(report.rejectedByGuard).toBe(false);
    expect(report.english?.text).toBe(
      "Summarize the quarterly report concisely",
    );
    expect(report.arabic?.text).toBe("لخص التقرير الفصلي");
    expect(report.entityChecks.english?.preserved).toBe(true);
  });

  it("rejects a Gemini run whose english field is absent for a no-Arabic input", async () => {
    vi.mocked(arabicRatio).mockReturnValue(0);
    mockedOptimize.mockResolvedValue({
      arabic: "لخص التقرير",
      english: null,
      note: "تم",
      source: "gemini",
    });
    const report = await runOptimization("Summarize the report please", config);
    // Without the polished English primary the run is a provable failure —
    // the cleaned original lands in the english slot, Arabic stays honest null.
    expect(report.rejectedByGuard).toBe(true);
    expect(report.source).toBe("mock");
    expect(report.arabic).toBeNull();
    expect(report.english?.text).toBe("Summarize the report please");
    expect(report.entityChecks.arabic).toBeNull();
    expect(report.entityChecks.english?.preserved).toBe(true);
    expect(report.quality.arabic).toBeNull();
    expect(report.quality.english?.languageOk).toBe(true);
  });

  it("keeps the cleaned English text in the english slot on local fallback", async () => {
    vi.mocked(arabicRatio).mockReturnValue(0);
    mockedOptimize.mockResolvedValue({
      arabic: null,
      english: "Summarize the report",
      note: "محلي",
      source: "mock",
    });
    const report = await runOptimization("Summarize the report", config);
    expect(report.direction).toBe("en");
    expect(report.arabic).toBeNull();
    expect(report.english?.text).toBe("Summarize the report");
    expect(report.entityChecks.arabic).toBeNull();
  });

  it("cleans an English input with the English normalizer and sends only that to Gemini", async () => {
    vi.mocked(arabicRatio).mockReturnValue(0);
    mockedOptimize.mockResolvedValue({
      arabic: null,
      english: "Summarize the report.",
      note: "تم",
      source: "gemini",
    });
    const report = await runOptimization(
      "Please   summarize the report, thanks!",
      config,
    );
    expect(report.normalizedPrompt).toBe("summarize the report");
    expect(mockedOptimize.mock.calls[0][0]).toBe("summarize the report");
    expect(report.direction).toBe("en");
    expect(report.arabic).toBeNull();
    expect(report.english?.text).toBe("Summarize the report.");
  });
});
