import { estimateCost } from "@/lib/cost-engine/estimate-cost";
import { normalizeArabic } from "@/lib/optimizer/arabic-normalizer";
import { checkEntities } from "@/lib/optimizer/entity-guard";
import { checkQuality } from "@/lib/optimizer/quality-guard";
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
  const model = getModel(config.provider, config.model);
  const candidate = normalizeArabic(prompt);
  const normalizedPrompt = checkEntities(prompt, candidate).preserved
    ? candidate
    : prompt;
  const originalPromise = analyzeTokens(prompt);
  const normalizedPromise =
    normalizedPrompt === prompt
      ? originalPromise
      : analyzeTokens(normalizedPrompt);
  const optimizedPromise = optimizeDual(
    normalizedPrompt,
    config.provider === "google" ? model.id : undefined,
  );

  const original = await originalPromise;
  events.onOriginalMeasured?.(original);

  const result = await optimizedPromise;
  const arabicCheck = checkEntities(prompt, result.arabic);
  const englishCheck = result.english
    ? checkEntities(prompt, result.english, false)
    : null;
  const arabicQuality = checkQuality(prompt, result.arabic, "ar");
  const englishQuality = result.english
    ? checkQuality(prompt, result.english, "en")
    : null;
  // Hard-reject on provable failures only (lost entities, wrong language);
  // soft signals (negation, coverage) surface as warnings instead.
  const rejectedByGuard =
    result.source === "gemini" &&
    (!arabicCheck.preserved ||
      (englishCheck !== null && !englishCheck.preserved) ||
      !arabicQuality.languageOk);
  const optimized: DualOptimization = rejectedByGuard
    ? {
        arabic: normalizedPrompt,
        english: null,
        source: "mock",
        note: "لم يجتز مخرج Gemini فحوص السلامة المحلية (كيانات أو لغة)؛ استُخدمت تنقية محلية آمنة دون ترجمة.",
      }
    : result;
  events.onOptimized?.(optimized);
  const entityChecks = rejectedByGuard
    ? { arabic: checkEntities(prompt, normalizedPrompt), english: null }
    : { arabic: arabicCheck, english: englishCheck };
  const quality = {
    arabic: rejectedByGuard
      ? checkQuality(prompt, normalizedPrompt, "ar")
      : arabicQuality,
    english: rejectedByGuard ? null : englishQuality,
  };

  const arabicPromise =
    optimized.arabic === normalizedPrompt
      ? normalizedPromise
      : optimized.arabic === prompt
        ? originalPromise
        : analyzeTokens(optimized.arabic);
  const [normalizedMeasurement, arabicM, englishM] = await Promise.all([
    normalizedPromise,
    arabicPromise,
    optimized.english
      ? analyzeTokens(optimized.english)
      : Promise.resolve(null),
  ]);

  // Price against the model that actually served the call, not just the one
  // selected in settings — model fallback may produce a different engine.
  const pricedModel =
    optimized.source === "gemini" && result.model
      ? getModel("google", result.model)
      : model;

  return {
    originalPrompt: prompt,
    original: {
      ...measurementToAnalysis(original),
      arabicRatio: arabicRatio(prompt),
    },
    originalMeasurement: original,
    arabic: variantReport(
      optimized.arabic,
      arabicM,
      original.tokens,
      pricedModel,
    ),
    english:
      optimized.english && englishM
        ? variantReport(
            optimized.english,
            englishM,
            original.tokens,
            pricedModel,
          )
        : null,
    note: optimized.note,
    source: optimized.source,
    normalizedPrompt,
    normalizedMeasurement,
    entityChecks,
    quality,
    rejectedByGuard,
    optimizationUsage:
      result.source === "gemini" ? (result.usage ?? null) : null,
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
