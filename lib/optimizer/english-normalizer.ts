import { cleanOutsideProtected } from "@/lib/optimizer/protected-segments";

/**
 * Courtesy and request frames that carry no task. Only unambiguous ones:
 * a greeting counts only before punctuation ("Hello world" is a task, "Hello,"
 * is a greeting), and a bare "can you …" may be a real yes/no question
 * ("Can you access the internet?"), so it goes only with "please"/"kindly".
 */
const greetings =
  "(?:hi|hello|hey)(?: there)?|good (?:morning|afternoon|evening)|dear (?:assistant|ai|chatgpt|gemini|claude)";
const requestFrames = [
  "please|pls|plz|kindly",
  "(?:could|can|would|will) you (?:please|kindly)",
  "i(?: would|'d) (?:like|love) (?:for )?you to",
  "i (?:want|need) you to",
  "i was wondering if you could",
  "if you don't mind",
].join("|");
const openingFiller = new RegExp(
  `^(?:(?:${greetings})[,!.:]+\\s*|(?:${requestFrames})(?:[,.!:]|\\s)+)+`,
  "i",
);

/** Needs a sentence break before it: "…to say thank you" is content, "…, thanks" is not. */
const trailingCourtesy =
  /([,.!?;\n])[\s,.!;]*(?:please|pls|plz|thanks|thank you(?: so much| very much)?|thanks in advance|thank you in advance)[\s.!]*$/i;

function normalizeProse(text: string): string {
  return text
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/g, "")
    .replace(/[^\S\r\n]+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\n{3,}/g, "\n\n");
}

export function normalizeEnglish(prompt: string): string {
  const cleaned = cleanOutsideProtected(prompt, "en", normalizeProse).trim();
  const withoutOpening = cleaned.replace(openingFiller, "");
  const withoutClosing = withoutOpening.replace(trailingCourtesy, (_, mark) =>
    /[.!?]/.test(mark) ? mark : "",
  );
  return withoutClosing.trim() ? withoutClosing.trim() : cleaned;
}
