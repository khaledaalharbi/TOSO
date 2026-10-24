import { normalizeArabic } from "@/lib/optimizer/arabic-normalizer";
import { normalizeEnglish } from "@/lib/optimizer/english-normalizer";
import { checkEntities } from "@/lib/optimizer/entity-guard";
import { arabicRatio } from "@/lib/token-engine/token-engine";
import type { OptimizationResult } from "@/lib/types";

/** Deterministic local mock. A future LLM adapter can implement the same contract. */
export function optimizePrompt(prompt: string): OptimizationResult {
  const normalized = (
    arabicRatio(prompt) === 0 ? normalizeEnglish : normalizeArabic
  )(prompt);
  return {
    optimizedPrompt: checkEntities(prompt, normalized).preserved
      ? normalized
      : prompt,
  };
}
