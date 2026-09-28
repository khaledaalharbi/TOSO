import type { OptimizationResult } from "@/lib/types";

const filler = /(?:^|\s)(من فضلك|لو سمحت|أريد منك|أحتاج منك|بشكل مفصل جدا|بالتفصيل الممل)(?=\s|[،,.!?؟]|$)/gi;

/** Deterministic local mock. A future LLM adapter can implement the same contract. */
export function optimizePrompt(prompt: string): OptimizationResult {
  const compact = prompt
    .replace(filler, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+([،,.!?؟])/g, "$1")
    .trim();
  const prefix = "المهمة: ";
  const optimizedPrompt = compact.startsWith(prefix) ? compact : `${prefix}${compact}`;
  return {
    optimizedPrompt,
    notes: ["أزيلت عبارات تمهيدية متكررة.", "تم توحيد المسافات وعلامات الترقيم.", "هذه نتيجة Mock محلية ولا يُرسل النص إلى أي خدمة."],
  };
}
