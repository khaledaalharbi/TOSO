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
  original: TokenAnalysis;
  originalMeasurement?: TokenMeasurement;
  arabic: VariantReport;
  /** Null when the optimizer ran locally without a key — translation needs Gemini. */
  english: VariantReport | null;
  /** One-line description of what the optimizer changed. */
  note: string;
  /** Which engine produced the variants. */
  source: "gemini" | "mock";
}

/** How the tokens were counted — the UI shows this as a live/estimate badge. */
export interface TokenMeasurement {
  tokens: number;
  characters: number;
  words: number;
  source: "provider" | "bpe" | "heuristic";
}
