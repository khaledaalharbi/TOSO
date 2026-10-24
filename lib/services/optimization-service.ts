import { estimateCost } from "@/lib/cost-engine/estimate-cost";
import { normalizeArabic } from "@/lib/optimizer/arabic-normalizer";
import { normalizeEnglish } from "@/lib/optimizer/english-normalizer";
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
  // No Arabic script at all → reversed pipeline: English is the polished
  // primary and Arabic becomes the companion translation.
  const direction = arabicRatio(prompt) === 0 ? "en" : "ar";
  const model = getModel(config.provider, config.model);
  const candidate =
    direction === "en" ? normalizeEnglish(prompt) : normalizeArabic(prompt);
  const normalizedPrompt = checkEntities(prompt, candidate).preserved
    ? candidate
    : prompt;
  const measurements = new Map<string, Promise<TokenMeasurement>>();
  function measure(
    text: string,
    modelId = model.id,
  ): Promise<TokenMeasurement> {
    const key = JSON.stringify([modelId, text]);
    const cached = measurements.get(key);
    if (cached) return cached;
    const pending = analyzeTokens(text, config.userKey, modelId);
    measurements.set(key, pending);
    return pending;
  }
  const originalPromise = measure(prompt);
  const normalizedPromise = measure(normalizedPrompt);
  const optimizedPromise = optimizeDual(
    normalizedPrompt,
    model.id,
    config.userKey,
  );

  const [, , result] = await Promise.all([
    originalPromise.then((original) => {
      events.onOriginalMeasured?.(original);
      return original;
    }),
    normalizedPromise,
    optimizedPromise,
  ]);
  const arabicCheck = result.arabic
    ? checkEntities(prompt, result.arabic, direction === "ar")
    : null;
  const englishCheck = result.english
    ? checkEntities(prompt, result.english, direction === "en")
    : null;
  const arabicQuality = result.arabic
    ? checkQuality(prompt, result.arabic, "ar")
    : null;
  const englishQuality = result.english
    ? checkQuality(prompt, result.english, "en")
    : null;
  // Hard-reject on provable failures only (lost entities, wrong language);
  // soft signals (negation, coverage) surface as warnings instead.
  // The language contract binds the primary slot of the active direction:
  // ar → the arabic field must be Arabic; en → the english field must exist
  // and be English (it's the polished output now, not a translation extra).
  const rejectedByGuard =
    result.source === "gemini" &&
    ((arabicCheck !== null && !arabicCheck.preserved) ||
      (englishCheck !== null && !englishCheck.preserved) ||
      (direction === "en"
        ? !englishQuality?.languageOk
        : !arabicQuality?.languageOk));
  const optimized: DualOptimization = rejectedByGuard
    ? direction === "en"
      ? {
          arabic: null,
          english: normalizedPrompt,
          source: "mock",
          note: "لم يجتز مخرج Gemini فحوص السلامة المحلية؛ عُرض النص المنقّى محلياً والنسخة العربية محجوبة.",
        }
      : {
          arabic: normalizedPrompt,
          english: null,
          source: "mock",
          note: "لم يجتز مخرج Gemini فحوص السلامة المحلية (كيانات أو لغة)؛ استُخدمت تنقية محلية آمنة دون ترجمة.",
        }
    : result;
  events.onOptimized?.(optimized);
  const entityChecks = rejectedByGuard
    ? direction === "en"
      ? {
          arabic: null,
          english: checkEntities(prompt, normalizedPrompt),
        }
      : { arabic: checkEntities(prompt, normalizedPrompt), english: null }
    : { arabic: arabicCheck, english: englishCheck };
  const quality = {
    arabic: rejectedByGuard
      ? direction === "en"
        ? null
        : checkQuality(prompt, normalizedPrompt, "ar")
      : arabicQuality,
    english: rejectedByGuard
      ? direction === "en"
        ? checkQuality(prompt, normalizedPrompt, "en")
        : null
      : englishQuality,
  };

  // Price against the model that actually served the call, not just the one
  // selected in settings — model fallback may produce a different engine.
  const pricedModel =
    optimized.source === "gemini" && result.model
      ? getModel("google", result.model)
      : model;
  const [original, normalizedMeasurement, arabicM, englishM] =
    await Promise.all([
      measure(prompt, pricedModel.id),
      measure(normalizedPrompt, pricedModel.id),
      optimized.arabic ? measure(optimized.arabic, pricedModel.id) : null,
      optimized.english ? measure(optimized.english, pricedModel.id) : null,
    ]);

  return {
    model: pricedModel.id,
    originalPrompt: prompt,
    direction,
    original: {
      ...measurementToAnalysis(original),
      arabicRatio: arabicRatio(prompt),
    },
    originalMeasurement: original,
    arabic:
      optimized.arabic && arabicM
        ? variantReport(optimized.arabic, arabicM, original.tokens, pricedModel)
        : null,
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
