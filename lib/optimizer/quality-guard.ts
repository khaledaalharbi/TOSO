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

import { t } from "@/lib/i18n";

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
  const normalized = text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[ً-ٰٟـ]/g, "");
  return markers.filter((marker) => containsWord(normalized, marker)).length;
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

/** English function words and courtesy filler — no content signal for coverage. */
const EN_STOPWORDS = new Set(
  (
    "the and for are but not you your yours this that these those with from into onto over under about after before " +
    "was were been being have has had having does did doing will would shall should could can may might must " +
    "its it's his her hers our ours their theirs them they she him who whom whose which what when where why how " +
    "than then there here also just very too any all some each every more most other such only own same " +
    "please pls plz kindly thanks thank hello hey want need like wanna gonna let lets make sure"
  ).split(" "),
);

/** Crude suffix stripping so "analyze/analyzed/analyzing" count as one word. */
function stemEnglishWord(word: string): string {
  return word.length > 4
    ? word.replace(/(?:ing|edly|ed|es|s|ly)$/, "").replace(/e$/, "")
    : word;
}

function englishContentWords(text: string): Set<string> {
  const words = new Set<string>();
  for (const raw of text.toLowerCase().split(/[^a-z]+/)) {
    if (raw.length >= 3 && !EN_STOPWORDS.has(raw))
      words.add(stemEnglishWord(raw));
  }
  return words;
}

function arabicContentWords(text: string): Set<string> {
  const words = new Set<string>();
  for (const raw of text.replace(/[ً-ٰٟـ]/g, "").split(/[^ء-ي]+/u)) {
    const word = normalizeArabicWord(raw);
    if (word.length >= 3 && !AR_STOPWORDS.has(word)) words.add(word);
  }
  return words;
}

/**
 * Language contract: presence, not dominance.
 *
 * A mixed Arabic/code prompt ("حلل SELECT ... FROM sales_data") legitimately
 * ends up with more Latin letters than Arabic ones in its own rewrite — the
 * SQL identifiers carry no Arabic script at all. Requiring Arabic to *win*
 * the letter count would hard-reject such a faithful output as "not Arabic",
 * which in turn would block the English variant for no reason (the guard
 * rejects on languageOk failure).
 *
 * So the rule is keyed on the input: an Arabic-bearing input must stay
 * Arabic-bearing (a rewrite that loses every Arabic letter dropped real
 * content); an input with no Arabic at all has nothing Arabic to preserve,
 * so its rewrite is judged as-is. English is checked by presence only.
 */
export function checkQuality(
  original: string,
  output: string,
  lang: "ar" | "en",
): QualityCheck {
  const warnings: string[] = [];
  const { ar, la } = letterCounts(output);
  const originalArabic = letterCounts(original).ar;
  // Presence-based contract, keyed on what the input actually asks for:
  // an Arabic-bearing input must stay Arabic-bearing (a rewrite that loses
  // every Arabic letter dropped real content); an input with no Arabic at
  // all has nothing Arabic to preserve, so its rewrite is judged as-is.
  // A short dialect output like "عايز حلل" is still Arabic; an English
  // paragraph in the arabic field of an Arabic prompt is not.
  const languageOk = lang === "ar" ? ar > 0 || originalArabic === 0 : la > 0;
  if (!languageOk) {
    warnings.push(
      lang === "ar"
        ? t("المخرج العربي ليس مكتوباً بالعربية")
        : t("المخرج الإنجليزي ليس مكتوباً بالإنجليزية"),
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
    warnings.push(t("لم تُحفظ أدوات النفي الموجودة في المدخل"));
  }

  // Coverage is same-language only: Arabic against Arabic, English against an
  // English-written source (an Arabic source has no English words to compare).
  let keywordCoverage: number | null = null;
  const contentWords =
    lang === "ar"
      ? arabicContentWords
      : originalArabic === 0
        ? englishContentWords
        : null;
  if (contentWords) {
    const sourceWords = contentWords(original);
    if (sourceWords.size >= 3) {
      const outputWords = contentWords(output);
      let kept = 0;
      for (const word of sourceWords) if (outputWords.has(word)) kept += 1;
      keywordCoverage = kept / sourceWords.size;
      if (keywordCoverage < 0.4) {
        warnings.push(
          t("تغطية كلمات المحتوى منخفضة (~{percent}%)", {
            percent: Math.round(keywordCoverage * 100),
          }),
        );
      }
    }
  }

  return { languageOk, negationKept, keywordCoverage, warnings };
}
