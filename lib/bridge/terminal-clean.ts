/**
 * Deterministic extraction of an agent's reply from its embedded terminal.
 *
 * The browser pane reads xterm's RENDERED buffer (cursor moves and in-place
 * redraws already resolved) before and after a turn; this module turns that
 * pair into the reply text — no model involved. Built against real Gemini
 * CLI captures (`__fixtures__/gemini-tui-capture.json`); the rules are
 * generic enough for other Ink/TUI agents but only Gemini is proven.
 *
 *   1. Divergence: everything above the first line that changed is history.
 *   2. Echo: the agent re-prints the user's prompt — the reply starts after
 *      its LAST echo (and any wrapped continuation of it).
 *   3. Bounds: the reply ends at the TUI chrome (input box rules, "? for
 *      shortcuts", spinner/"esc to cancel", the input placeholder).
 *   4. Cleanup: drop tool-status and box-border lines, replace the reply
 *      bullet (✦ ⏺ ●) with a space, dedent, collapse blank runs.
 */

// A rule line; Claude Code's input box draws one that ends in its "❯".
const RULE = /^\s*[▄▀─━═╌┄]{8,}\s*[❯›>]?\s*$/;
const END_MARKERS = [
  RULE,
  /\?\s+for shortcuts/i,
  /esc to (cancel|interrupt)/i,
  /^\s*>\s+Type your message/i,
  /^\s*Shift\+Tab to /i,
  // The next input prompt (Codex "›", Hermes/Claude "❯") closes the reply.
  /^\s*[›❯]\s/,
];
const BOX_ONLY = /^\s*[╭╮╰╯│─━┌┐└┘├┤┬┴┼\s]+$/;
const TOOL_STATUS = /^\s*[✓✔✗✖⊷]\s/;
/**
 * Per-turn status lines: Codex "Worked for 2s • 3:27 AM", Claude Code
 * "✻ Churned for 3m 20s · done 3:46 AM" (the verb varies per turn).
 */
const STATUS_LINE = /^\s*(?:[─•·]?\s*Worked for \d|✻\s+\S+ for \d)/i;
/** Reply bullets: Gemini ✦, Claude ⏺/●, Codex •. Only the FIRST line's. */
const REPLY_MARK = /^(\s*)[✦⏺●•]/;
const SPINNER = /^\s*[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/;

/**
 * Comparison form: lower-case letters/digits only. TUIs sometimes swallow
 * punctuation while echoing (Codex dropped a "?" live), so punctuation must
 * not decide whether a line is the prompt's echo.
 */
const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
const promptText = (line: string) => line.replace(/^\s*[>›❯]\s?/, "");

const DECISION_PATTERNS: [RegExp, string][] = [
  [
    /do you trust|trust (the files in )?this folder|trust the authors/i,
    "الثقة بالمجلد",
  ],
  [/allow .{0,40}work in this folder/i, "السماح بالعمل في المجلد"],
  // Tool-approval dialogs across the TUIs — Gemini "Allow execution of
  // [Shell]?", Claude "Do you want to proceed?", Codex "Would you like to
  // run the following command?". The agent waits on a permission, the turn
  // is not done, and the dialog must not be captured as the reply.
  [
    /allow execution of|allow this (action|command|tool)|do you want to (run|execute|proceed|make|apply)|would you like to (run|execute)|proceed with .{0,40}\?|apply this (edit|change)/i,
    "إذن تنفيذ أداة",
  ],
  [/enter to confirm|↵ to choose|to select\s*·/i, "اختيار من قائمة"],
  [/choice \[default/i, "سؤال إعداد أولي"],
  [/\[(y\/n|Y\/n|y\/N)\]|\(y\/n\)/, "سؤال نعم/لا"],
  [/press enter to continue/i, "ضغط Enter للمتابعة"],
];

/**
 * A dialog the agent is waiting on (folder trust, a menu, a first-run
 * question). TOSO must not type a prompt into it — the user answers in the
 * embedded terminal. Returns what kind of decision, or null.
 */
export function pendingDecision(viewport: string): string | null {
  for (const [pattern, label] of DECISION_PATTERNS) {
    if (pattern.test(viewport)) return label;
  }
  return null;
}

/** True while the TUI shows it is working (spinner / "esc to cancel"). */
export function isAgentBusy(viewport: string): boolean {
  return viewport
    .split("\n")
    .some(
      (line) => /esc to (cancel|interrupt)/i.test(line) || SPINNER.test(line),
    );
}

function commonPrefix(before: string[], after: string[]): number {
  let i = 0;
  while (
    i < before.length &&
    i < after.length &&
    before[i].trimEnd() === after[i].trimEnd()
  ) {
    i++;
  }
  return i;
}

/** Index of the last line in `lines` that echoes the start of `sent`, or -1. */
function lastEcho(lines: string[], sent: string): number {
  const target = norm(sent);
  if (!target) return -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    const candidate = norm(promptText(lines[i]));
    if (
      candidate.length >= Math.min(8, target.length) &&
      (target.startsWith(candidate) ||
        candidate.startsWith(target.slice(0, 40)))
    ) {
      return i;
    }
  }
  return -1;
}

function dedent(lines: string[]): string[] {
  const indents = lines
    .filter((l) => l.trim())
    .map((l) => l.length - l.trimStart().length);
  const cut = indents.length ? Math.min(...indents) : 0;
  return lines.map((l) =>
    l.slice(Math.min(cut, l.length - l.trimStart().length)),
  );
}

/**
 * Tool-approval dialogs paint as one contiguous block: a "?" pending line
 * ("? Shell  git …"), the boxed command preview, "Allow execution of …",
 * then numbered options ("● 1. Allow once"). A boxed line can be real reply
 * content (the reply itself renders inside a box), so the block is dropped
 * as a unit — suppression stops at the first line that isn't dialog-shaped.
 */
const DIALOG_START =
  /^\s*\?\s|allow execution of|allow this (action|command|tool)|do you want to (run|execute|proceed|make|apply)|would you like to (run|execute)/i;
// yes/no qualify as menu options only in the menus' own phrasing ("No,
// suggest changes", "Yes.", Claude's bare "❯ 1. Yes"/"3. No") — a plain
// "No files" list item is reply text. Codex menus use "1)" not "1.".
const PERMISSION_OPTION =
  /^\s*[●○·•❯]?\s*\d+[.)]\s+(allow|accept|deny|always|never|suggest|yes([,.]|\s*$)|no([,.]|\s*$))/i;
const BOX_CONTENT = /^\s*│[^\n]*│\s*$/;
const ESC_HINT = /\(\s*esc\s*\)\s*$|\besc to (quit|cancel|back|leave)\b/i;

/** Cleans a block of reply lines (chrome already cut off). */
export function cleanReplyLines(lines: string[]): string {
  let markDone = false;
  let inDialog = false;
  const kept = lines
    .filter((line) => {
      if (!line.trim()) return !inDialog;
      if (inDialog) {
        if (
          PERMISSION_OPTION.test(line) ||
          BOX_CONTENT.test(line) ||
          BOX_ONLY.test(line) ||
          ESC_HINT.test(line) ||
          DIALOG_START.test(line)
        ) {
          return false;
        }
        inDialog = false; // dialog ended — fall through to normal filters
      }
      if (DIALOG_START.test(line) || PERMISSION_OPTION.test(line)) {
        inDialog = true;
        return false;
      }
      return true;
    })
    .filter(
      (l) => !TOOL_STATUS.test(l) && !SPINNER.test(l) && !STATUS_LINE.test(l),
    )
    .filter((l) => !(BOX_ONLY.test(l) && l.trim()))
    .map((l) => {
      let line = l
        .replace(/^(\s*)│\s?/, "$1")
        .replace(/\s?│\s*$/, "")
        .trimEnd();
      // The reply bullet marks only the reply's first line; later "•" are
      // the reply's own list items and must survive.
      if (!markDone && line.trim()) {
        line = line.replace(REPLY_MARK, "$1 ");
        markDone = true;
      }
      return line;
    });
  return dedent(kept)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Everything the turn changed on screen — the raw material for smart cleanup. */
export function turnRegion(before: string[], after: string[]): string {
  return after
    .slice(commonPrefix(before, after))
    .map((l) => l.trimEnd())
    .join("\n")
    .trim();
}

const WORD = /[\p{L}\p{N}][\p{L}\p{N}'’-]{2,}/gu;

/**
 * Guard for model-cleaned output: it may re-flow and drop chrome, never
 * invent. At least 95% of its words (3+ chars) must occur in the raw
 * capture, and it must not be empty.
 */
export function isGrounded(cleaned: string, raw: string): boolean {
  const words = cleaned.toLowerCase().match(WORD) ?? [];
  if (!cleaned.trim()) return false;
  if (words.length === 0) return raw.includes(cleaned.trim());
  const source = new Set(raw.toLowerCase().match(WORD) ?? []);
  const found = words.filter((w) => source.has(w)).length;
  return found / words.length >= 0.95;
}

/**
 * The reply produced by sending `sent`, given the rendered buffer lines
 * before and after the turn. Empty string when nothing new was printed.
 */
export function extractReply(
  before: string[],
  after: string[],
  sent: string,
): string {
  const region = after.slice(commonPrefix(before, after));
  let start = 0;
  const echo = lastEcho(region, sent);
  if (echo >= 0) {
    start = echo + 1;
    // A long or multi-line prompt wraps inside its echo box — skip the rest.
    const target = norm(sent);
    while (
      start < region.length &&
      region[start].trim() &&
      !RULE.test(region[start]) &&
      target.includes(norm(promptText(region[start])))
    ) {
      start++;
    }
  }
  while (
    start < region.length &&
    (!region[start].trim() || RULE.test(region[start]))
  ) {
    start++;
  }
  let end = start;
  while (
    end < region.length &&
    !END_MARKERS.some((re) => re.test(region[end]))
  ) {
    end++;
  }
  return cleanReplyLines(region.slice(start, end));
}
