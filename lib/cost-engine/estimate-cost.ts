import type { CostEstimate, ModelOption } from "@/lib/types";

/** Cost is based on input tokens only for this prototype. */
export function estimateCost(originalTokens: number, optimizedTokens: number, model: ModelOption): CostEstimate {
  const original = (originalTokens / 1_000_000) * model.inputCostPerMillion;
  const optimized = (optimizedTokens / 1_000_000) * model.inputCostPerMillion;
  const saved = Math.max(0, original - optimized);
  const savingPercent = original ? Math.round((saved / original) * 100) : 0;
  return { original, optimized, saved, savingPercent };
}
