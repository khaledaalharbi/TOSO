/**
 * Dual-language optimizer — Gemini does understanding, translation, and
 * rephrasing through the server route; the API key never reaches the browser.
 *
 * Falls back to the local mock when no key is configured: the Arabic variant
 * still works offline, the English one stays null so the UI can honestly say
 * why the translation is missing instead of fabricating one. An input with no
 * Arabic runs the other way round: English only, nothing translated.
 */

import { optimizePrompt } from "@/lib/optimizer/mock-optimizer";
import { arabicRatio } from "@/lib/token-engine/token-engine";
import type { GeminiUsage } from "@/lib/types";

export type OptimizerSource = "gemini" | "mock";

export interface DualOptimization {
  /** Null when the input carried no Arabic and the run stayed local — the cleaned text then lives in `english`. */
  arabic: string | null;
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

let optimizerUnavailable = false;

export async function optimizeDual(
  prompt: string,
  model?: string,
  userKey?: string,
): Promise<DualOptimization> {
  if (optimizerUnavailable && !userKey)
    return localOptimization(prompt, "no_api_key");
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
      const payload = (await response.json().catch(() => null)) as {
        arabic?: string;
        english?: string;
        note?: string;
        model?: string;
        fallback?: boolean;
        reason?: string;
        viaUserKey?: boolean;
        usage?: GeminiUsage | null;
      } | null;
      // English-primary runs ask Gemini for one variant: the Arabic slot
      // stays null whatever the payload carries (Arabic is on demand only).
      const englishPrimary = arabicRatio(prompt) === 0;
      if (
        payload &&
        !payload.fallback &&
        (englishPrimary
          ? typeof payload.english === "string" && payload.english.trim()
          : typeof payload.arabic === "string" &&
            payload.arabic.trim() &&
            (payload.english === undefined ||
              typeof payload.english === "string")) &&
        (payload.note === undefined || typeof payload.note === "string")
      ) {
        return {
          arabic: englishPrimary ? null : (payload.arabic?.trim() ?? null),
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
      fallbackReason =
        payload?.fallback && typeof payload.reason === "string"
          ? payload.reason
          : "bad_model_output";
      if (!userKey && fallbackReason === "no_api_key")
        optimizerUnavailable = true;
    } else {
      fallbackReason = `http_${response.status}`;
    }
  } catch {
    fallbackReason = "network";
    // Network/route failure → degrade to the local mock below.
  }

  return localOptimization(prompt, fallbackReason);
}

function localOptimization(
  prompt: string,
  fallbackReason: string | null,
): DualOptimization {
  const mock = optimizePrompt(prompt);
  // A no-Arabic input reverses the local contract too: the cleaned English
  // belongs to the english slot; nothing Arabic is fabricated.
  const englishInput = arabicRatio(prompt) === 0;
  return {
    arabic: englishInput ? null : mock.optimizedPrompt,
    english: englishInput ? mock.optimizedPrompt : null,
    note: localNoteFor(fallbackReason, englishInput),
    source: "mock",
    usage: null,
    fallbackReason: fallbackReason ?? undefined,
  };
}

/** Honest local-fallback notes keyed by the route's reported reason. */
function localNoteFor(reason: string | null, englishInput = false): string {
  // The cleanup that ran, and the variant that could not be produced locally.
  const cleanup = englishInput ? "تنقية النص محلياً" : "تنقية محلية";
  const missing = englishInput
    ? "النسخة العربية غير متاحة"
    : "الترجمة الإنجليزية غير متاحة";
  switch (reason) {
    case null:
    case "no_api_key":
      return `وضع محلي بدون مفتاح Gemini: ${cleanup} فقط — ${missing}.`;
    case "network":
      return `تعذّر الاتصال بـ Gemini؛ استُخدمت ${cleanup} — ${missing}.`;
    case "bad_model_output":
      return `أعاد Gemini ردًا غير صالح؛ استُخدمت ${cleanup} — ${missing}.`;
    case "user_key_quota":
      return `حصة مفتاحك في AI Studio استُنزفت مؤقتاً؛ استُخدمت ${cleanup}. راجع حصتك أو امسح المفتاح من الإعدادات.`;
    case "user_key_invalid":
      return `مفتاحك مرفوض من Google؛ تحقق منه في الإعدادات — استُخدمت ${cleanup}.`;
    default:
      if (reason.startsWith("http_429")) {
        return `حصة نماذج Gemini مستنزفة حالياً؛ استُخدمت ${cleanup} — ${missing}.`;
      }
      if (reason.startsWith("user_key_")) {
        return `تعذّر استدعاء Gemini بمفتاحك (${reason})؛ استُخدمت ${cleanup} — ${missing}.`;
      }
      return `تعذّر استدعاء Gemini (${reason})؛ استُخدمت ${cleanup} — ${missing}.`;
  }
}
