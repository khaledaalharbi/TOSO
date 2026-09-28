/**
 * Local BPE estimation — offline approximation when no provider key is set.
 *
 * No network call and no secret key. This mirrors how OpenAI's cl100k_base
 * tends to split Arabic script into smaller pieces than Latin script, which
 * is exactly the asymmetry the project exists to measure. It deliberately
 * stays an *estimator*: only the provider tokenizer gives billing truth.
 */

interface BpeProfile {
  /** Average tokens per character for a script segment. */
  tokensPerChar: number;
}

/**
 * Calibrated against the measured corpus:
 *   Arabic  ≈ 0.333 tokens/char (Gemini)  — high fragmentation
 *   Latin   ≈ 0.250 tokens/char            — cl100k-style BPE merges
 *   CJK     ≈ 0.500 tokens/char            — nearly one token per char
 *   Emoji   ≈ 1.000 tokens/char            — often encoded as surrogate pair
 */
const profiles: Record<string, BpeProfile> = {
  arabic: { tokensPerChar: 0.333 },
  latin: { tokensPerChar: 0.25 },
  cjk: { tokensPerChar: 0.5 },
  emoji: { tokensPerChar: 1.0 },
};

/** Split the text into script buckets so each language is measured by its own rate. */
function bucket(char: string): keyof typeof profiles {
  const code = char.codePointAt(0) ?? 0;
  if (code >= 0x1f300 && code <= 0x1faf8) return "emoji";
  if (code >= 0x1f000 && code <= 0x1f2ff) return "emoji";
  if (code >= 0x4e00 && code <= 0x9fff) return "cjk";
  if (code >= 0x3040 && code <= 0x30ff) return "cjk";
  if (code >= 0x0600 && code <= 0x06ff) return "arabic";
  if (code >= 0x0750 && code <= 0x077f) return "arabic";
  if (code >= 0x0041 && code <= 0x005a) return "latin";
  if (code >= 0x0061 && code <= 0x007a) return "latin";
  if (code >= 0x00c0 && code <= 0x024f) return "latin";
  return "latin"; // digits, punctuation, and spaces behave like Latin BPE merges
}

export function countViaBpe(text: string): number | null {
  if (!text) return 0;
  const buckets: Record<string, number> = {};
  for (const char of Array.from(text)) {
    const group = bucket(char);
    buckets[group] = (buckets[group] ?? 0) + 1;
  }
  let total = 0;
  for (const [group, count] of Object.entries(buckets)) {
    total += count * (profiles[group]?.tokensPerChar ?? 0.25);
  }
  return Math.max(1, Math.ceil(total));
}

export interface HeatmapEstimate {
  segments: { text: string; tokens: number | null }[];
  scoredSegments: number;
  truncated: boolean;
}

export function estimateHeatmapSegments(
  text: string,
  maxSegments = 120,
  maxCharacters = 2000,
): HeatmapEstimate {
  const segments: HeatmapEstimate["segments"] = [];
  let scoredSegments = 0;
  let previewLength = 0;
  for (const match of text.matchAll(/\s+|\S+/gu)) {
    const part = match[0];
    const whitespace = /^\s/u.test(part);
    if (
      previewLength + part.length > maxCharacters ||
      (!whitespace && scoredSegments >= maxSegments)
    ) {
      break;
    }
    segments.push({
      text: part,
      tokens: whitespace ? null : countViaBpe(part),
    });
    previewLength += part.length;
    if (!whitespace) scoredSegments++;
  }
  return { segments, scoredSegments, truncated: previewLength < text.length };
}
