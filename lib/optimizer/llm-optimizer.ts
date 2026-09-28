/**
 * Dual-language optimizer — Gemini does understanding, translation, and
 * rephrasing through the server route; the API key never reaches the browser.
 *
 * Falls back to the local mock when no key is configured: the Arabic variant
 * still works offline, the English one stays null so the UI can honestly say
 * why the translation is missing instead of fabricating one.
 */

import { optimizePrompt } from "@/lib/optimizer/mock-optimizer";

export type OptimizerSource = "gemini" | "mock";

export interface DualOptimization {
  arabic: string;
  english: string | null;
  /** One-line description of what changed — shown in the Processing stage. */
  note: string;
  source: OptimizerSource;
  /** The Gemini model that produced the variants (may differ from the requested one on quota fallback). */
  model?: string;
}

export async function optimizeDual(
  prompt: string,
  model?: string,
): Promise<DualOptimization> {
  try {
    const response = await fetch("/api/optimize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: prompt, model }),
    });
    if (response.ok) {
      const payload = (await response.json()) as {
        arabic?: string;
        english?: string;
        note?: string;
        model?: string;
        fallback?: boolean;
      };
      if (
        !payload.fallback &&
        typeof payload.arabic === "string" &&
        payload.arabic.trim()
      ) {
        return {
          arabic: payload.arabic.trim(),
          english: payload.english?.trim() ? payload.english.trim() : null,
          note:
            payload.note?.trim() ||
            "فُهمت النية وأُعيدت الصياغة عبر Gemini دون فقدان المعلومات الأساسية.",
          source: "gemini",
          model: payload.model,
        };
      }
    }
  } catch {
    // Network/route failure → degrade to the local mock below.
  }

  const mock = optimizePrompt(prompt);
  return {
    arabic: mock.optimizedPrompt,
    english: null,
    note: "وضع محلي بدون مفتاح Gemini: تنقيح عربي فقط — الترجمة الإنجليزية غير متاحة.",
    source: "mock",
  };
}
