import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { I18nProvider } from "./i18n-provider";
import {
  AgentTranscript,
  turnsProject,
  restoreLog,
  type AgentTurn,
} from "./agent-session-log";

describe("restoreLog", () => {
  it("restores turns and marks a reload-interrupted capture as an error", () => {
    const saved = JSON.stringify({
      gemini: [
        {
          n: 1,
          jobId: "a",
          inputUser: "س",
          inputWire: "q",
          outputWire: "ok",
          status: "done",
        },
        {
          n: 2,
          jobId: "b",
          inputUser: "س2",
          inputWire: "q2",
          outputWire: "",
          status: "running",
        },
      ],
    });
    const log = restoreLog(saved);
    expect(log.gemini.map((t) => t.status)).toEqual(["done", "error"]);
    expect(log.gemini[1].outputWire).toContain("انقطع الالتقاط");
  });

  it("drops malformed data instead of crashing", () => {
    for (const raw of [
      null,
      "",
      "nope",
      "[]",
      JSON.stringify({ gemini: "x" }),
    ]) {
      expect(restoreLog(raw)).toEqual({});
    }
    expect(restoreLog(JSON.stringify({ gemini: [{ n: "1" }, null] }))).toEqual(
      {},
    );
  });
});

const turns: AgentTurn[] = [
  {
    n: 1,
    jobId: "a",
    inputUser: "اذكر ثلاثة ألوان",
    inputWire: "List three colors",
    outputWire: "1. Red\n2. Yellow\n3. Blue",
    outputRaw: "✦  1. Red\n   2. Yellow\n   3. Blue",
    cleanedBy: "local",
    outputUser: "١. أحمر",
    status: "done",
  },
  {
    n: 2,
    jobId: "b",
    inputUser: "والرابع؟",
    inputWire: "And a fourth?",
    outputWire: "",
    status: "running",
  },
];

const render = (props: Partial<Parameters<typeof AgentTranscript>[0]> = {}) =>
  renderToStaticMarkup(
    <AgentTranscript
      agent="gemini"
      side="in"
      turns={turns}
      translatingJobs={new Set()}
      onTranslate={() => {}}
      onClear={() => {}}
      {...props}
    />,
  );

describe("AgentTranscript", () => {
  it("opens on IN: each turn its own numbered rectangle, Arabic RTL and English LTR", () => {
    const html = render();
    expect(html).toMatch(/<li dir="rtl"[^>]*>[^]*?1\.[^]*?اذكر ثلاثة ألوان/);
    expect(html).toMatch(/<li dir="rtl"[^>]*>[^]*?2\.[^]*?والرابع؟/);
    expect(html).toMatch(/<li dir="ltr"[^>]*>[^]*?1\.[^]*?List three colors/);
    expect(html).toMatch(/<li dir="ltr"[^>]*>[^]*?2\.[^]*?And a fourth\?/);
    expect(html.match(/<li dir="(rtl|ltr)"/g)).toHaveLength(4);
  });

  it("lays English left of Arabic with the arrow pointing Arabic → English on IN", () => {
    const html = render();
    const english = html.indexOf(">English<");
    const arrow = html.indexOf("ترجمة من العربية إلى الإنجليزية");
    const arabic = html.indexOf(">العربية<");
    // Source order = visual order at md+ (the section is laid out LTR).
    expect(english).toBeGreaterThan(-1);
    expect(english).toBeLessThan(arrow);
    expect(arrow).toBeLessThan(arabic);
    expect(html).toContain("lucide-arrow-left");
    expect(html).not.toContain("lucide-arrow-right");
  });

  it("shows OUT when told to: replies, the arrow reversed, and no IN/OUT tabs of its own", () => {
    const html = render({ side: "out" });
    expect(html).toContain("waiting for the agent…");
    expect(html).toContain("lucide-arrow-right");
    expect(html).not.toContain("lucide-arrow-left");
    expect(html).not.toContain('role="tab"');
    // «إرسال أيضاً» belongs to IN only.
    expect(
      render({ side: "out", sendTargets: ["codex"], onSendAlso: () => {} }),
    ).not.toContain("إرسال أيضاً");
  });

  it("states an empty tab honestly", () => {
    const html = render({ turns: [] });
    expect(html).toContain("لا دورات بعد مع Gemini CLI");
    expect(html).not.toContain("مسح Gemini CLI");
  });

  it("offers an expand toggle on each language box (expand arrows in split view)", () => {
    const html = render();
    expect(html).toContain('aria-label="وسّع النص الإنجليزي"');
    expect(html).toContain('aria-label="وسّع النص العربي"');
    expect(html).toContain("lucide-chevrons-left-right");
    expect(html).not.toContain("lucide-chevrons-right-left");
    expect(html).not.toContain("اطوِ إلى عرض العمودين");
  });

  it("offers «إرسال أيضاً» only with other agents to send to — no checkboxes until pressed", () => {
    expect(render()).not.toContain("إرسال أيضاً");
    const html = render({ sendTargets: ["codex"], onSendAlso: () => {} });
    expect(html).toContain("إرسال أيضاً");
    expect(html).toContain('aria-pressed="false"');
    expect(html).not.toContain('type="checkbox"');
    expect(
      render({ turns: [], sendTargets: ["codex"], onSendAlso: () => {} }),
    ).not.toContain("إرسال أيضاً");
  });

  it("keeps the project a turn ran in through a reload", () => {
    const log = restoreLog(
      JSON.stringify({ gemini: [{ ...turns[0], cwd: "C:\\A" }] }),
    );
    expect(log.gemini[0].cwd).toBe("C:\\A");
  });

  it("offers per-agent clear, and clear-all only when asked", () => {
    expect(render()).toContain("مسح Gemini CLI");
    expect(render()).not.toContain("مسح الكل");
    expect(render({ onClearAll: () => {} })).toContain("مسح الكل");
  });
});

describe("turnsProject — which project the selected texts belong to", () => {
  const turn = (cwd?: string) =>
    ({
      n: 1,
      jobId: "j",
      inputUser: "",
      inputWire: "",
      outputWire: "",
      status: "done",
      cwd,
    }) as AgentTurn;

  it("is the shared folder (case/slash-insensitive on Windows)", () => {
    expect(turnsProject([turn("C:/A"), turn("c:/a/")])).toBe("C:/A");
  });

  it("is undefined when the texts ran in several projects", () => {
    expect(turnsProject([turn("C:/A"), turn("C:/B")])).toBeUndefined();
  });

  it("falls back to the agent's folder for turns recorded without one", () => {
    expect(turnsProject([turn(undefined)], "C:/A")).toBe("C:/A");
    expect(turnsProject([turn(undefined)])).toBeUndefined();
  });
});

describe("AgentTranscript in the English UI and with Arabic replies", () => {
  const arabicReply: AgentTurn[] = [
    {
      n: 1,
      jobId: "h",
      inputUser: "capital of France?",
      inputWire: "What is the capital of France?",
      outputWire: "باريس",
      status: "done",
    },
  ];
  const renderEn = (
    props: Partial<Parameters<typeof AgentTranscript>[0]> = {},
  ) =>
    renderToStaticMarkup(
      <I18nProvider initialLang="en">
        <AgentTranscript
          agent="hermes"
          side="out"
          turns={arabicReply}
          translatingJobs={new Set()}
          onTranslate={() => {}}
          onClear={() => {}}
          {...props}
        />
      </I18nProvider>,
    );

  it("shows OUT as one English column with no arrow or translate button", () => {
    const html = renderEn({ turns });
    expect(html).toContain(">English<");
    expect(html).not.toContain("lucide-arrow-right");
    expect(html).not.toContain(">Translate<");
    expect(html).not.toContain(">Your original text<");
  });

  it("keeps IN as two columns, the user's side titled for English", () => {
    const html = renderEn({ side: "in", turns });
    expect(html).toContain(">Your original text<");
    expect(html).toContain("lucide-arrow-left");
  });

  it("renders a reply the agent wrote in Arabic with its own direction", () => {
    const html = renderEn();
    expect(html).toMatch(/<li dir="auto"[^>]*>[^]*?باريس/);
  });

  it("puts an Arabic reply straight into the Arabic column instead of offering a translation", () => {
    const html = render({ side: "out", turns: arabicReply });
    expect(html).toMatch(/<li dir="rtl"[^>]*>[^]*?1\.[^]*?باريس/);
    expect(html).not.toContain(">ترجمة<");
  });
});
