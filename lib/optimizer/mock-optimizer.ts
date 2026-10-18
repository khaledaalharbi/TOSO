import { normalizeArabic } from "@/lib/optimizer/arabic-normalizer";
import { checkEntities } from "@/lib/optimizer/entity-guard";
import type { OptimizationResult } from "@/lib/types";

/** Deterministic local mock. A future LLM adapter can implement the same contract. */
export function optimizePrompt(prompt: string): OptimizationResult {
  const normalized = normalizeArabic(prompt);
  return {
    optimizedPrompt: checkEntities(prompt, normalized).preserved
      ? normalized
      : prompt,
  };
}
