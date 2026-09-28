/**
 * Dual-language optimizer — Gemini does understanding, translation, and
 * rephrasing through the server route; the API key never reaches the browser.
 *
 * Falls back to the local mock when no key is configured: the Arabic variant
 * still works offline, the English one stays null so the UI can honestly say
 * why the translation is missing instead of fabricating one.
 */

import { optimizePrompt } from "@/lib/optimizer/mock-optimizer";
import type { InteractionUsage } from "@/lib/types";

export type OptimizerSource = "gemini" | "mock";

export interface DualOptimization {
  arabic: string;
  english: string | null;
  /** One-line description of what changed — shown in the Processing stage. */
  note: string;
  source: OptimizerSource;
  /** The Gemini model that produced the variants (may differ from the requested one on quota fallback). */
  model?: string;
  /** Which configured key served the call — "backup" means the primary one hit quota. */
  keyRole?: "primary" | "backup";
  usage?: InteractionUsage | null;
}

export async function optimizeDual(
  prompt: string,
  model?: string,
): Promise<DualOptimization> {
  let fallbackReason: string | null = null;
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
        keyRole?: "primary" | "backup";
        fallback?: boolean;
        reason?: string;
        usage?: InteractionUsage | null;
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
          keyRole: payload.keyRole,
          usage: payload.usage ?? null,
        };
      }
      fallbackReason = payload.reason ?? null;
    } else {
      fallbackReason = `http_${response.status}`;
    }
  } catch {
    fallbackReason = "network";
    // Network/route failure → degrade to the local mock below.
  }

  const mock = optimizePrompt(prompt);
  return {
    arabic: mock.optimizedPrompt,
    english: null,
    note: localNoteFor(fallbackReason),
    source: "mock",
    usage: null,
  };
}

/** Honest local-fallback notes keyed by the route's reported reason. */
function localNoteFor(reason: string | null): string {
  switch (reason) {
    case null:
      return "وضع محلي بدون مفتاح Gemini: تنقيح عربي فقط — الترجمة الإنجليزية غير متاحة.";
    case "network":
      return "تعذّر الاتصال بـ Gemini؛ استُخدمت تنقية محلية دون ترجمة.";
    case "bad_model_output":
      return "أعاد Gemini ردًا غير صالح؛ استُخدمت تنقية محلية دون ترجمة.";
    default:
      if (reason.startsWith("http_429")) {
        return "حصة نماذج Gemini مستنزفة حالياً؛ استُخدمت تنقية محلية دون ترجمة.";
      }
      return `تعذّر استدعاء Gemini (${reason})؛ استُخدمت تنقية محلية دون ترجمة.`;
  }
}
