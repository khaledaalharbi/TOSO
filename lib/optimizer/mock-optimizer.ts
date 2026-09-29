import { normalizeArabic } from "@/lib/optimizer/arabic-normalizer";
import type { OptimizationResult } from "@/lib/types";

/** Deterministic local mock. A future LLM adapter can implement the same contract. */
export function optimizePrompt(prompt: string): OptimizationResult {
  return { optimizedPrompt: normalizeArabic(prompt) };
}
