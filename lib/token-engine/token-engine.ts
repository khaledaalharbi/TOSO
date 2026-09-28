/**
 * Token Engine — real token measurement, no more char/2.4 guessing.
 *
 * Strategy (strictly ordered):
 *   1. Provider tokenizer  — the model's own official count (billing truth).
 *   2. BPE local tokenizer — offline approximation for the same family.
 *   3. Heuristic estimate  — last-resort fallback so the UI never breaks.
 *
 * Security: every call goes through a server route. The browser never sees
 * process.env and never calls the provider directly.
 */

export type TokenSource = "provider" | "bpe" | "heuristic";

export interface TokenMeasurement {
  tokens: number;
  characters: number;
  words: number;
  source: TokenSource;
}

/** Public contract used across the app. */
export async function analyzeTokens(text: string): Promise<TokenMeasurement> {
  const normalized = text.trim();
  const characters = normalized.length;
  const words = normalized ? normalized.split(/\s+/).length : 0;
  if (!characters) return { tokens: 0, characters, words, source: "heuristic" };

  const providerTokens = await countViaProvider(normalized);
  if (providerTokens !== null) {
    return { tokens: providerTokens, characters, words, source: "provider" };
  }

  const bpeTokens = await countViaBpeAsync(normalized);
  if (bpeTokens !== null) {
    return { tokens: bpeTokens, characters, words, source: "bpe" };
  }

  return {
    tokens: heuristicCount(normalized),
    characters,
    words,
    source: "heuristic",
  };
}

/* -------------------------------------------------------------------------- */
/* 1. Provider tokenizer — billing truth (Gemini countTokens by default)      */
/* -------------------------------------------------------------------------- */

let providerUnavailable = false;

async function countViaProvider(text: string): Promise<number | null> {
  if (providerUnavailable) return null;
  try {
    const response = await fetch("/api/tokens/count", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      tokens?: number;
      fallback?: boolean;
      reason?: string;
    };
    if (payload.fallback && payload.reason === "no_api_key") {
      providerUnavailable = true;
    }
    if (typeof payload.tokens !== "number" || payload.fallback) return null;
    return Math.max(0, Math.round(payload.tokens));
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* 2. Local BPE approximation (offline, no network, no secrets)               */
/* -------------------------------------------------------------------------- */

let bpeEstimator: ((text: string) => number | null) | null = null;
let bpeLoaded = false;

/**
 * Loads the local BPE estimator lazily. Dynamic import keeps the initial
 * bundle small and degrades gracefully if the tokenizer asset is missing.
 */
async function countViaBpeAsync(text: string): Promise<number | null> {
  if (!bpeLoaded) {
    bpeLoaded = true;
    try {
      const estimator = await import("@/lib/token-engine/bpe-estimator");
      bpeEstimator = estimator.countViaBpe;
    } catch {
      bpeEstimator = null;
    }
  }
  return bpeEstimator ? bpeEstimator(text) : null;
}

/** Warm the BPE module so the first real call is instant. */
export function warmTokenizer(): void {
  void countViaBpeAsync("");
}

/* -------------------------------------------------------------------------- */
/* 3. Heuristic fallback — calibrated against measured Gemini rates           */
/* -------------------------------------------------------------------------- */

/**
 * Calibrated from the benchmark corpus (see outputs/token-benchmark.md):
 * Arabic ≈ 33.3 tokens / 100 chars, English ≈ 18.3 tokens / 100 chars.
 * Ratio Arabic/English = 1.82x, far from the old flat char/2.4 assumption.
 */
export function heuristicCount(text: string): number {
  const arabic = (text.match(/[\u0600-\u06FF]/g) ?? []).length;
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  const other = Math.max(0, text.length - arabic - latin);
  const whitespace = (text.match(/\s/g) ?? []).length;
  return Math.ceil(
    arabic * 0.333 + latin * 0.25 + other * 0.4 + whitespace * 0.5,
  );
}

/**
 * How much of the text is Arabic script (0..1) — the UI uses it as the
 * language insight that explains *why* the token count is high.
 */
export function arabicRatio(text: string): number {
  const letters = Array.from(text).filter((char) => {
    const code = char.codePointAt(0) ?? 0;
    return (
      (code >= 0x0600 && code <= 0x06ff) || (code >= 0x0750 && code <= 0x077f)
    );
  });
  return text.length ? letters.length / text.length : 0;
}
