"use client";

import { Languages } from "lucide-react";
import { useState } from "react";
import {
  translateToArabic,
  type TranslationResult,
} from "@/lib/services/agent-service";

/**
 * English-primary runs carry no Arabic version — the user asks for one here,
 * and only then does a translation call (and its tokens) happen.
 */
export function ArabicOnDemand({
  english,
  model,
  userKey,
}: {
  english: string;
  model: string;
  userKey?: string;
}) {
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function show() {
    setLoading(true);
    try {
      setResult(await translateToArabic(english, model, userKey));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-3">
      {!result?.arabic && (
        <button
          type="button"
          onClick={() => void show()}
          disabled={loading}
          className="flex items-center gap-2 border border-ink bg-white px-4 py-2.5 text-sm font-bold text-ink transition hover:bg-slate-50 disabled:opacity-50"
        >
          <Languages size={15} />
          {loading ? "تُترجم…" : "عرض النسخة العربية"}
        </button>
      )}
      {result && !result.arabic && (
        <p
          role="status"
          className="mt-2 border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800"
        >
          تعذّرت الترجمة عبر Gemini
          {result.fallbackReason ? ` (${result.fallbackReason})` : ""}؛ النسخة
          الإنجليزية هي المعتمدة للإرسال على أي حال.
        </p>
      )}
      {result?.arabic && (
        <div className="border border-emerald-300 bg-emerald-50/50">
          <div className="border-b border-emerald-200 px-4 py-2.5 text-xs font-bold text-emerald-800">
            <span className="flex items-center gap-1.5">
              <Languages size={14} /> النسخة العربية (للقراءة فقط — لا تُرسل)
              {result.model ? ` · ${result.model}` : ""}
            </span>
          </div>
          <div
            dir="rtl"
            className="max-h-72 overflow-y-auto p-4 text-right text-sm leading-8 whitespace-pre-wrap break-words text-slate-700"
          >
            {result.arabic}
          </div>
        </div>
      )}
    </div>
  );
}
