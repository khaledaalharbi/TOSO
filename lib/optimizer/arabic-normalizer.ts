import { cleanOutsideProtected } from "@/lib/optimizer/protected-segments";

const openingFiller = /^(?:(?:من فضلك|لو سمحت|أريد منك أن|أحتاج منك أن)\s+)+/;

function normalizeProse(text: string): string {
  return text
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, "")
    .replace(/[^\S\r\n]+/g, " ")
    .replace(/\s+([،؛؟,.!?])/g, "$1");
}

export function normalizeArabic(prompt: string): string {
  return cleanOutsideProtected(prompt, "ar", normalizeProse)
    .trim()
    .replace(openingFiller, "");
}
