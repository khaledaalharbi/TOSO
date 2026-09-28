/**
 * Deterministic quality checks on optimizer output — a thin safety layer that
 * complements entity-guard without claiming semantic equivalence.
 *
 * What it can honestly verify:
 *   - The Arabic variant is actually written in Arabic (language contract).
 *   - Negation markers present in the source survived in the output.
 *   - Rough coverage of meaningful content words (same-language only).
 *
 * What it cannot verify: intent preservation, tone, or whether the rewrite is
 * a better prompt. Warnings are surfaced to the UI as hints, not verdicts.
 */

export interface QualityCheck {
  /** The output is written in the expected language (script-ratio test). */
  languageOk: boolean;
  /** Negation survival — null when the source has no negation to keep. */
  negationKept: boolean | null;
  /** Share of meaningful source words seen in the output; null when too few. */
  keywordCoverage: number | null;
  warnings: string[];
}

const AR_LETTER = /[ء-ي]/;
const LATIN_LETTER = /[A-Za-z]/;

function letterCounts(text: string): { ar: number; la: number } {
  let ar = 0;
  let la = 0;
  for (const char of text) {
    if (AR_LETTER.test(char)) ar += 1;
    else if (LATIN_LETTER.test(char)) la += 1;
  }
  return { ar, la };
}

const NEGATION_MARKERS = {
  ar: [
    "لا",
    "لن",
    "لم",
    "ليس",
    "ليست",
    "دون",
    "بدون",
    "غير",
    "من غير",
    "بلا",
    "إلا",
  ],
  en: [
    "no",
    "not",
    "never",
    "without",
    "don't",
    "do not",
    "cannot",
    "can't",
    "won't",
  ],
} as const;

function containsWord(text: string, word: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^\\p{L}])${escaped}(?=$|[^\\p{L}])`, "u").test(text);
}

function countMarkers(text: string, markers: readonly string[]): number {
  return markers.filter((marker) => containsWord(text, marker)).length;
}

/** Arabic stop-words — function words carry no content signal for coverage. */
const AR_STOPWORDS = new Set(
  [
    "في",
    "من",
    "على",
    "الي",
    "الى",
    "عن",
    "ان",
    "أن",
    "إن",
    "انه",
    "أنه",
    "كان",
    "كانت",
    "يكون",
    "هذا",
    "هذه",
    "ذلك",
    "تلك",
    "التي",
    "الذي",
    "الذين",
    "ما",
    "لا",
    "لم",
    "لن",
    "ليس",
    "ليست",
    "مع",
    "او",
    "أو",
    "و",
    "ثم",
    "قد",
    "هو",
    "هي",
    "هم",
    "انا",
    "أنا",
    "انت",
    "أنت",
    "نحن",
    "كل",
    "بعد",
    "قبل",
    "عند",
    "منذ",
    "بين",
    "حتي",
    "حتى",
    "اذا",
    "إذا",
    "كما",
    "لكن",
    "بل",
    "اي",
    "أي",
    "لدي",
    "لدى",
    "عبر",
    "ضد",
    "خلال",
    "حول",
    "داخل",
    "خارج",
    "تحت",
    "فوق",
    "امام",
    "أمام",
    "وراء",
    "خلف",
    "ال",
    "ب",
    "ك",
    "ف",
    "س",
    "يا",
    "لو",
  ].map((w) => normalizeArabicWord(w)),
);

function normalizeArabicWord(word: string): string {
  return word
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه");
}

function arabicContentWords(text: string): Set<string> {
  const words = new Set<string>();
  for (const raw of text.split(/[^ء-ي]+/u)) {
    const word = normalizeArabicWord(raw);
    if (word.length >= 3 && !AR_STOPWORDS.has(word)) words.add(word);
  }
  return words;
}

/**
 * @param lang "ar" checks the Arabic variant; "en" checks the English one —
 *            coverage stays null there since the languages differ by design.
 */
export function checkQuality(
  original: string,
  output: string,
  lang: "ar" | "en",
): QualityCheck {
  const warnings: string[] = [];
  const { ar, la } = letterCounts(output);
  // Presence + dominance, no length floor: a short dialect output like
  // "عايز حلل" is still Arabic; an English paragraph in the arabic field is not.
  const languageOk = lang === "ar" ? ar > 0 && ar >= la : la > 0 && la > ar;
  if (!languageOk) {
    warnings.push(
      lang === "ar"
        ? "المخرج العربي ليس مكتوباً بالعربية في الغالب"
        : "المخرج الإنجليزي ليس مكتوباً بالإنجليزية في الغالب",
    );
  }

  // Negation survival: the markers live in the source language, so only check
  // the side that shares it — cross-language negation is handled by the model
  // and stays out of this deterministic check's reach.
  const negationKept =
    lang === "ar" && countMarkers(original, NEGATION_MARKERS.ar) > 0
      ? countMarkers(output, NEGATION_MARKERS.ar) > 0
      : lang === "en" && countMarkers(original, NEGATION_MARKERS.en) > 0
        ? countMarkers(output, NEGATION_MARKERS.en) > 0
        : null;
  if (negationKept === false) {
    warnings.push("لم تُحفظ أدوات النفي الموجودة في المدخل");
  }

  let keywordCoverage: number | null = null;
  if (lang === "ar") {
    const sourceWords = arabicContentWords(original);
    if (sourceWords.size >= 3) {
      const outputWords = arabicContentWords(output);
      let kept = 0;
      for (const word of sourceWords) if (outputWords.has(word)) kept += 1;
      keywordCoverage = kept / sourceWords.size;
      if (keywordCoverage < 0.4) {
        warnings.push(
          `تغطية كلمات المحتوى منخفضة (~${Math.round(keywordCoverage * 100)}%)`,
        );
      }
    }
  }

  return { languageOk, negationKept, keywordCoverage, warnings };
}
