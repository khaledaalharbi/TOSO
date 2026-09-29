import { beforeEach, describe, expect, it, vi } from "vitest";
import { optimizeDual } from "@/lib/optimizer/llm-optimizer";
import { analyzeTokens } from "@/lib/token-engine/token-engine";
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
});

describe("runOptimization", () => {
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
    expect(report.entityChecks.arabic.preserved).toBe(true);
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
    expect(report.entityChecks.arabic.preserved).toBe(true);
    expect(report.arabic.measurement).toBe(report.normalizedMeasurement);
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
    expect(report.arabic.text).toBe("حلل 42% من البيانات");
    expect(report.arabic.measurement).toBe(report.normalizedMeasurement);
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
    expect(report.arabic.text).toBe("اكتب رسالة اعتذار للعميل");
    expect(report.quality.arabic.languageOk).toBe(true);
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
    expect(report.arabic.text).toBe("حلل 50%");
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
    expect(report.entityChecks.arabic.preserved).toBe(true);
  });
});
