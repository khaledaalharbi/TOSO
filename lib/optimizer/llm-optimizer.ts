/**
 * Dual-language optimizer — Gemini does understanding, translation, and
 * rephrasing through the server route; the API key never reaches the browser.
 *
 * Falls back to the local mock when no key is configured: the Arabic variant
 * still works offline, the English one stays null so the UI can honestly say
 * why the translation is missing instead of fabricating one.
 */

import { optimizePrompt } from "@/lib/optimizer/mock-optimizer";
import type { GeminiUsage } from "@/lib/types";

export type OptimizerSource = "gemini" | "mock";

export interface DualOptimization {
  arabic: string;
  english: string | null;
  /** One-line description of what changed — shown in the Processing stage. */
  note: string;
  source: OptimizerSource;
  /** The Gemini model that produced the variants (may differ from the requested one on quota fallback). */
  model?: string;
  /** True when the call ran on the user's own BYOK key (their quota paid). */
  viaUserKey?: boolean;
  usage?: GeminiUsage | null;
  /** Raw route reason when the run fell back locally (e.g. user_key_quota). */
  fallbackReason?: string;
}

export async function optimizeDual(
  prompt: string,
  model?: string,
  userKey?: string,
): Promise<DualOptimization> {
  let fallbackReason: string | null = null;
  try {
    const response = await fetch("/api/optimize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(userKey ? { "x-user-gemini-key": userKey } : {}),
      },
      body: JSON.stringify({ text: prompt, model }),
    });
    if (response.ok) {
      const payload = (await response.json()) as {
        arabic?: string;
        english?: string;
        note?: string;
        model?: string;
        fallback?: boolean;
        reason?: string;
        viaUserKey?: boolean;
        usage?: GeminiUsage | null;
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
          viaUserKey: payload.viaUserKey === true,
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
    fallbackReason: fallbackReason ?? undefined,
  };
}

/** Honest local-fallback notes keyed by the route's reported reason. */
function localNoteFor(reason: string | null): string {
  switch (reason) {
    case null:
    case "no_api_key":
      return "وضع محلي بدون مفتاح Gemini: تنقيح عربي فقط — الترجمة الإنجليزية غير متاحة.";
    case "network":
      return "تعذّر الاتصال بـ Gemini؛ استُخدمت تنقية محلية دون ترجمة.";
    case "bad_model_output":
      return "أعاد Gemini ردًا غير صالح؛ استُخدمت تنقية محلية دون ترجمة.";
    case "user_key_quota":
      return "حصة مفتاحك في AI Studio استُنزفت مؤقتاً؛ استُخدمت تنقية محلية. راجع حصتك أو امسح المفتاح من الإعدادات.";
    case "user_key_invalid":
      return "مفتاحك مرفوض من Google؛ تحقق منه في الإعدادات — استُخدمت تنقية محلية.";
    default:
      if (reason.startsWith("http_429")) {
        return "حصة نماذج Gemini مستنزفة حالياً؛ استُخدمت تنقية محلية دون ترجمة.";
      }
      if (reason.startsWith("user_key_")) {
        return `تعذّر استدعاء Gemini بمفتاحك (${reason})؛ استُخدمت تنقية محلية دون ترجمة.`;
      }
      return `تعذّر استدعاء Gemini (${reason})؛ استُخدمت تنقية محلية دون ترجمة.`;
  }
}
