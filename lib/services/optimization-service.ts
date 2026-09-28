import { estimateCost } from "@/lib/cost-engine/estimate-cost";
import {
  optimizeDual,
  type DualOptimization,
} from "@/lib/optimizer/llm-optimizer";
import { getModel } from "@/lib/providers/registry";
import {
  analyzeTokens,
  arabicRatio,
  warmTokenizer,
  type TokenMeasurement,
} from "@/lib/token-engine/token-engine";
import type {
  ModelOption,
  OptimizationReport,
  ProviderConfig,
  VariantReport,
} from "@/lib/types";

/** Progress hooks so the UI can light the pipeline as real work completes. */
export interface OptimizationEvents {
  onOriginalMeasured?: (measurement: TokenMeasurement) => void;
  onOptimized?: (optimized: DualOptimization) => void;
}

/** Orchestrates replaceable adapters; UI should only consume this service contract. */
export async function runOptimization(
  prompt: string,
  config: ProviderConfig,
  events: OptimizationEvents = {},
): Promise<OptimizationReport> {
  warmTokenizer();
  const original = await analyzeTokens(prompt);
  events.onOriginalMeasured?.(original);

  const model = getModel(config.provider, config.model);
  const optimized = await optimizeDual(
    prompt,
    config.provider === "google" ? model.id : undefined,
  );
  events.onOptimized?.(optimized);

  const [arabicM, englishM] = await Promise.all([
    analyzeTokens(optimized.arabic),
    optimized.english
      ? analyzeTokens(optimized.english)
      : Promise.resolve(null),
  ]);

  return {
    original: {
      ...measurementToAnalysis(original),
      arabicRatio: arabicRatio(prompt),
    },
    originalMeasurement: original,
    arabic: variantReport(optimized.arabic, arabicM, original.tokens, model),
    english:
      optimized.english && englishM
        ? variantReport(optimized.english, englishM, original.tokens, model)
        : null,
    note: optimized.note,
    source: optimized.source,
  };
}

function variantReport(
  text: string,
  measurement: TokenMeasurement,
  originalTokens: number,
  model: ModelOption,
): VariantReport {
  return {
    text,
    analysis: {
      ...measurementToAnalysis(measurement),
      arabicRatio: arabicRatio(text),
    },
    measurement,
    cost: estimateCost(originalTokens, measurement.tokens, model),
  };
}

function measurementToAnalysis(measurement: TokenMeasurement) {
  return {
    tokens: measurement.tokens,
    characters: measurement.characters,
    words: measurement.words,
  };
}
