import { describe, expect, it } from "vitest";
import capture from "./__fixtures__/gemini-tui-capture.json";
import {
  cleanReplyLines,
  extractReply,
  isAgentBusy,
  isGrounded,
  pendingDecision,
  turnRegion,
} from "./terminal-clean";

// Screens captured live (outputs/agent-live-probe.md, 2026-10-19).
const CLAUDE_TRUST = [
  " Accessing workspace:",
  " C:\\Users\\khale\\AppData\\Local\\Temp\\toso-agent-probe",
  " Quick safety check: Is this a project you created or one you trust? (Like your own code, a well-known open source",
  " Claude Code'll be able to read, edit, and execute files here.",
  " ❯ No, exit",
  "   Yes, I trust this folder",
  " Enter to confirm · Esc to cancel",
].join("\n");
const DEVIN_TRUST = [
  " ✱ Do you trust the authors of this directory?",
  "   For security, devin.exe should not be run in directories with untrusted content.",
  " ❭ 1 Yes, trust",
  "   2 No, exit",
  " ↓↑ to select · ↵ to choose · esc to quit",
].join("\n");
const HERMES_FIRST_RUN =
  "Help improve Hermes?\n  1) Yes\n  2) Ask later\n  3) No thanks\nChoice [default 3]:";
// Rebuilt from the live Gemini CLI screen (user capture, 2026-10-19): a tool
// call ran, then the next command sat waiting on the approval menu.
const PERMISSION_TURN = [
  '  ✓  Shell git log -n 10 --format="%h %ad %s" --date=short',
  "     fatal: unable to access 'NUL': Invalid argument",
  "",
  "? Shell  git --no-pager log -n 10 --oneline",
  "╭──────────────────────────────────────────────╮",
  "│ git --no-pager log -n 10 --oneline           │",
  "╰──────────────────────────────────────────────╯",
  " Allow execution of [Shell]?",
  " ● 1. Allow once",
  "   2. Allow for this session",
  "   3. No, suggest changes (esc)",
];

describe("pendingDecision (live first-run screens)", () => {
  it("recognizes Claude's and Devin's trust dialogs and Hermes's setup question", () => {
    expect(pendingDecision(CLAUDE_TRUST)).toBe("الثقة بالمجلد");
    expect(pendingDecision(DEVIN_TRUST)).toBe("الثقة بالمجلد");
    expect(pendingDecision(HERMES_FIRST_RUN)).toBe("سؤال إعداد أولي");
  });

  it("flags a pending tool-approval menu as a decision, not a reply", () => {
    expect(pendingDecision(PERMISSION_TURN.join("\n"))).toBe("إذن تنفيذ أداة");
  });

  it("recognizes Claude's bare Yes/No menu and Codex's run-confirm", () => {
    const claudeMenu = [
      "  ❯ 1. Yes",
      "    2. Yes, and don't ask again for git commands",
      "    3. No",
      "    Enter to confirm · Esc to cancel",
    ];
    // The menu footer alone is already a known decision class.
    expect(pendingDecision(claudeMenu.join("\n"))).toBeTruthy();
    expect(
      pendingDecision("Would you like to run the following command?"),
    ).toBe("إذن تنفيذ أداة");
    expect(pendingDecision("Do you want to make this edit to app.ts?")).toBe(
      "إذن تنفيذ أداة",
    );
    // Cleaning keeps nothing of the menu chrome.
    expect(cleanReplyLines(claudeMenu)).toBe("");
  });

  it("stays quiet on a normal ready prompt", () => {
    expect(pendingDecision(capture.t3)).toBeNull();
    expect(pendingDecision(" › Ask Codex to do anything")).toBeNull();
  });
});

describe("Codex TUI conventions (live)", () => {
  // Rebuilt from the live Codex v0.163.0 screen: "›" prompts, "•" reply
  // bullet, a "Worked for" status line, a swallowed "?" in the echo.
  const before = [
    ">_ OpenAI Codex (v0.163.0)",
    "› Remember the code word BLUE-HERON. Reply with exactly: noted",
    "• noted",
    "  Worked for 2s • 3:27 AM",
    "› Ask Codex to do anything",
    "  GPT-5.6-Terra high · ~\\AppData\\Local\\Temp\\toso-agent-probe",
  ];
  const after = [
    ">_ OpenAI Codex (v0.163.0)",
    "› Remember the code word BLUE-HERON. Reply with exactly: noted",
    "• noted",
    "  Worked for 2s • 3:27 AM",
    "› What was the code word I gave you Reply with only the code word.",
    "• BLUE-HERON",
    "  Worked for 1s • 3:27 AM",
    "› Ask Codex to do anything",
    "  GPT-5.6-Terra high · ~\\AppData\\Local\\Temp\\toso-agent-probe",
  ];

  it("extracts the reply despite the dropped punctuation in the echo", () => {
    expect(
      extractReply(
        before,
        after,
        "What was the code word I gave you? Reply with only the code word.",
      ),
    ).toBe("BLUE-HERON");
  });

  it("drops Claude Code's status line and its ❯-ended rule (live 429 turn)", () => {
    const before = ["❯ earlier", "────────────────────────────────❯"];
    const after = [
      "❯ earlier",
      "> What was the code word I gave you? Reply with only the code word.",
      "  ⎿  API Error: Request rejected (429) · quota exceeded",
      "",
      "✻ Brewed for 3m 17s · done 3:50 AM",
      "",
      "────────────────────────────────❯",
    ];
    expect(
      extractReply(
        before,
        after,
        "What was the code word I gave you? Reply with only the code word.",
      ),
    ).toBe("⎿  API Error: Request rejected (429) · quota exceeded");
  });

  it("keeps the reply's own bullet list (only the leading bullet is a marker)", () => {
    expect(
      cleanReplyLines([
        "• Steps:",
        "  • install",
        "  • run",
        "  Worked for 3s • 9:00 AM",
      ]),
    ).toBe("Steps:\n• install\n• run");
  });
});

describe("isGrounded / turnRegion", () => {
  const raw = "✦ Run npm test then\n  commit the fix.";
  it("accepts re-flowed text made of the capture's own words", () => {
    expect(isGrounded("Run npm test then commit the fix.", raw)).toBe(true);
  });
  it("rejects invented or empty text", () => {
    expect(isGrounded("Run npm test then deploy to production.", raw)).toBe(
      false,
    );
    expect(isGrounded("   ", raw)).toBe(false);
  });
  it("turnRegion returns only what changed on screen", () => {
    expect(turnRegion(["a", "b"], ["a", "c", "d  "])).toBe("c\nd");
  });
});

const lines = (text: string) => text.split("\n");
const [p1, p2, p3] = capture.prompts;

describe("extractReply on real Gemini CLI buffers", () => {
  it("pulls the first reply out of the full TUI chrome", () => {
    expect(extractReply(lines(capture.boot), lines(capture.t1), p1)).toBe(
      "noted",
    );
  });

  it("isolates each later turn from earlier history (context turn)", () => {
    expect(extractReply(lines(capture.t1), lines(capture.t2), p2)).toBe(
      "BLUE-HERON",
    );
  });

  it("keeps multi-line replies aligned and drops the reply bullet", () => {
    expect(extractReply(lines(capture.t2), lines(capture.t3), p3)).toBe(
      "1. Red\n2. Yellow\n3. Blue",
    );
  });

  it("returns empty when the turn printed nothing new", () => {
    expect(extractReply(lines(capture.t3), lines(capture.t3), p3)).toBe("");
  });
});

describe("isAgentBusy", () => {
  it("sees Gemini's spinner / 'esc to cancel' mid-turn", () => {
    expect(isAgentBusy(capture.thinking)).toBe(true);
  });

  it("is idle on a settled screen", () => {
    expect(isAgentBusy(capture.t3)).toBe(false);
  });
});

describe("cleanReplyLines", () => {
  it("strips a tool-approval dialog as a block, keeps real content", () => {
    const cleaned = cleanReplyLines(PERMISSION_TURN);
    expect(cleaned).not.toMatch(/allow|execution|suggest|\?/i);
    // The finished command's own output is real content, not dialog chrome.
    expect(cleaned).toContain("fatal: unable to access 'NUL'");
  });

  it("does not eat a reply's own numbered list", () => {
    expect(
      cleanReplyLines(["1. Red", "2. No files found", "3. Yes we did"]),
    ).toBe("1. Red\n2. No files found\n3. Yes we did");
  });

  it("drops tool-status and box lines, strips borders, dedents", () => {
    expect(
      cleanReplyLines([
        "  ✓  ReadFile  src/app.ts",
        "╭──────────────╮",
        "│ ⏺ Done: one │",
        "│   two       │",
        "╰──────────────╯",
        "",
        "",
        "",
        "  ⠹ Thinking...",
      ]),
    ).toBe("Done: one\ntwo");
  });

  it("falls back to divergence when the agent never echoes the prompt", () => {
    const before = ["banner", "> ", "footer"];
    const after = ["banner", "● The answer is 42.", "", "? for shortcuts"];
    expect(extractReply(before, after, "unrelated prompt text")).toBe(
      "The answer is 42.",
    );
  });
});
