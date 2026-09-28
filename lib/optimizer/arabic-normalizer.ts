const openingFiller = /^(?:(?:من فضلك|لو سمحت|أريد منك أن|أحتاج منك أن)\s+)+/;

/** Line-start tokens that mark a line as code even without fences/backticks. */
const CODE_LINE =
  /^(?:import\b|export\b|from\b|const\b|let\b|var\b|function\b|def\b|class\b|return\b|await\b|async\b|elif\b|try\b|catch\b|finally\b|raise\b|print\s*\(|console\.|echo\b|npm\b|yarn\b|pnpm\b|git\b|curl\b|pip\b|SELECT\b|INSERT\b|UPDATE\b|DELETE\b|FROM\b|WHERE\b|if\s*\(|for\s*\(|while\s*\(|else\b|fn\b|pub\b|package\b|use\b|#[A-Za-z!])/;

function quoteEnd(text: string, start: number): number {
  const closing =
    text[start] === "«" ? "»" : text[start] === "“" ? "”" : text[start];
  for (let index = start + 1; index < text.length; index++) {
    if (text[index] === "\\" && closing === '"') {
      index++;
    } else if (text[index] === closing) {
      return index + 1;
    }
  }
  return text.length;
}

function structureEnd(text: string, start: number): number {
  const closings: string[] = [];
  for (let index = start; index < text.length; index++) {
    const char = text[index];
    if (char === '"' || char === "«" || char === "“") {
      index = quoteEnd(text, index) - 1;
    } else if (char === "{" || char === "[") {
      closings.push(char === "{" ? "}" : "]");
    } else if (char === "}" || char === "]") {
      if (closings.pop() !== char) return text.length;
      if (!closings.length) return index + 1;
    }
  }
  return text.length;
}

function protectedEnd(text: string, index: number): number | null {
  if (text.startsWith("```", index)) {
    const closing = text.indexOf("```", index + 3);
    return closing === -1 ? text.length : closing + 3;
  }
  if (text[index] === "`") {
    const closing = text.indexOf("`", index + 1);
    return closing === -1 ? text.length : closing + 1;
  }
  if (text.startsWith("https://", index) || text.startsWith("http://", index)) {
    const url = text.slice(index).match(/^https?:\/\/[^\s،<>"'`]+/);
    if (url) return index + url[0].length;
  }
  if (text[index] === "{" || text[index] === "[")
    return structureEnd(text, index);
  if (text[index] === '"' || text[index] === "«" || text[index] === "“") {
    return quoteEnd(text, index);
  }
  if (text[index] === "}" || text[index] === "]") return text.length;
  // Unfenced code: protect whole lines that open with a code-only token, so
  // prose normalization never touches `const x = ...` or `SELECT ...` lines.
  if (index === 0 || text[index - 1] === "\n") {
    const lineEnd = text.indexOf("\n", index);
    const line = text.slice(index, lineEnd === -1 ? text.length : lineEnd);
    const trimmed = line.trimStart();
    if (trimmed && CODE_LINE.test(trimmed)) {
      return index + (line.length - trimmed.length) + trimmed.length;
    }
  }
  return null;
}

function normalizeProse(text: string): string {
  return text
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, "")
    .replace(/[^\S\r\n]+/g, " ")
    .replace(/\s+([،؛؟,.!?])/g, "$1");
}

export function normalizeArabic(prompt: string): string {
  const segments: string[] = [];
  let proseStart = 0;
  for (let index = 0; index < prompt.length; index++) {
    const end = protectedEnd(prompt, index);
    if (end === null) continue;
    if (index > proseStart)
      segments.push(normalizeProse(prompt.slice(proseStart, index)));
    segments.push(prompt.slice(index, end));
    proseStart = end;
    index = end - 1;
  }
  if (proseStart < prompt.length)
    segments.push(normalizeProse(prompt.slice(proseStart)));
  return segments.join("").trim().replace(openingFiller, "");
}
