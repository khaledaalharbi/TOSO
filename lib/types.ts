import type { EntityCheck } from "@/lib/optimizer/entity-guard";
import type { QualityCheck } from "@/lib/optimizer/quality-guard";

export type ProviderId = "openai" | "anthropic" | "google" | "local";

export interface ModelOption {
  id: string;
  label: string;
  inputCostPerMillion: number;
  outputCostPerMillion: number;
}

export interface ProviderConfig {
  provider: ProviderId;
  model: string;
}

export interface TokenAnalysis {
  tokens: number;
  characters: number;
  words: number;
  /** 0..1 share of Arabic-script characters — the language insight behind the count. */
  arabicRatio?: number;
}

export interface OptimizationResult {
  optimizedPrompt: string;
  notes: string[];
}

export interface InteractionUsage {
  total_input_tokens?: number;
  total_output_tokens?: number;
  total_thought_tokens?: number;
  total_cached_tokens?: number;
  total_tool_use_tokens?: number;
  total_tokens?: number;
}

export interface CostEstimate {
  original: number;
  optimized: number;
  saved: number;
  savingPercent: number;
}

/** One optimized variant — the Arabic rewrite or the English translation. */
export interface VariantReport {
  text: string;
  analysis: TokenAnalysis;
  cost: CostEstimate;
  /** Provenance for the token numbers: provider | bpe | heuristic. */
  measurement?: TokenMeasurement;
}

export interface OptimizationReport {
  originalPrompt: string;
  original: TokenAnalysis;
  originalMeasurement?: TokenMeasurement;
  arabic: VariantReport;
  /** Null when the optimizer ran locally without a key — translation needs Gemini. */
  english: VariantReport | null;
  /** One-line description of what the optimizer changed. */
  note: string;
  /** Which engine produced the variants. */
  source: "gemini" | "mock";
  normalizedPrompt: string;
  normalizedMeasurement: TokenMeasurement;
  entityChecks: { arabic: EntityCheck; english: EntityCheck | null };
  /** Approximate quality signals (language/negation/coverage) — hints, not proofs. */
  quality: { arabic: QualityCheck; english: QualityCheck | null };
  rejectedByGuard: boolean;
  optimizationUsage: InteractionUsage | null;
  /** Which configured Gemini key served the call; null for local fallback. */
  keyRole: "primary" | "backup" | null;
}

/** How the tokens were counted — the UI shows this as a live/estimate badge. */
export interface TokenMeasurement {
  tokens: number;
  characters: number;
  words: number;
  source: "provider" | "bpe" | "heuristic";
}
