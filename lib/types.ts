import type { EntityCheck } from "@/lib/optimizer/entity-guard";
import type { QualityCheck } from "@/lib/optimizer/quality-guard";

export type ProviderId = "google";

export interface ModelOption {
  id: string;
  label: string;
  inputCostPerMillion: number;
  outputCostPerMillion: number;
}

export interface ProviderConfig {
  provider: ProviderId;
  model: string;
  /**
   * BYOK: the user's own Gemini API key, entered in settings and kept in
   * browser storage. Forwarded as the `x-user-gemini-key` request header —
   * never persisted or logged server-side.
   */
  userKey?: string;
  /** Local bridge address (bin/toso-bridge.mjs) for the CLI-agent round trip. */
  bridgeUrl?: string;
  /** Session token the bridge printed on start — required on every call. */
  bridgeToken?: string;
  /** The agent whose tab opens first (claude | codex | gemini | …). */
  agent?: string;
  /**
   * Per-agent «إرسال مباشرة بعد المعالجة» switch in that agent's own prompt
   * box: on = processing sends the English polish straight to that agent.
   */
  autoSendAgents?: Record<string, boolean>;
  /**
   * Absolute project folder per agent id (each agent tab has its own) —
   * sent as that agent's run `cwd` so agents never work implicitly inside
   * TOSO and two agents can work on two projects at once.
   */
  workspaces?: Record<string, string>;
  /**
   * Per-run folder trust per agent id (the tab's «ثقة لكل تشغيلة» toggle,
   * adapter env, dies with the process). Per-agent because support differs —
   * only agents with a documented per-run trust env get a working toggle.
   */
  autoTrustAgents?: Record<string, boolean>;
  /** OUT tab: translate each agent reply automatically (else a button per reply). */
  autoTranslate?: boolean;
  /** Second, Gemini-based cleanup pass over terminal captures (grounded). */
  smartClean?: boolean;
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
}

export interface GeminiUsage {
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
  model?: string;
  originalPrompt: string;
  original: TokenAnalysis;
  originalMeasurement?: TokenMeasurement;
  /**
   * Pipeline direction. "ar" (default): Arabic input → Arabic is the polished
   * primary, English the companion translation. "en": input carried zero
   * Arabic script → English is the polished primary, Arabic the translation.
   */
  direction: "ar" | "en";
  /** Null when direction is "en" and no Arabic translation exists. */
  arabic: VariantReport | null;
  /** Null when the optimizer ran locally without a key — translation needs Gemini. */
  english: VariantReport | null;
  /** One-line description of what the optimizer changed. */
  note: string;
  /** Which engine produced the variants. */
  source: "gemini" | "mock";
  normalizedPrompt: string;
  normalizedMeasurement: TokenMeasurement;
  entityChecks: { arabic: EntityCheck | null; english: EntityCheck | null };
  /** Approximate quality signals (language/negation/coverage) — hints, not proofs. */
  quality: { arabic: QualityCheck | null; english: QualityCheck | null };
  rejectedByGuard: boolean;
  optimizationUsage: GeminiUsage | null;
}

/** How the tokens were counted — the UI shows this as a live/estimate badge. */
export interface TokenMeasurement {
  tokens: number;
  characters: number;
  words: number;
  source: "provider" | "bpe" | "heuristic";
  model?: string;
}
