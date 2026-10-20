import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AgentTabStrip, AgentWorkspacePanel } from "./agent-tabs";

const bridge = { url: "http://127.0.0.1:8676", token: "t" };

const panel = (
  overrides: Partial<Parameters<typeof AgentWorkspacePanel>[0]> = {},
) =>
  renderToStaticMarkup(
    <AgentWorkspacePanel
      agent="claude"
      workspace={"C:\\Projects\\AppA"}
      bridge={bridge}
      checked={false}
      trusted={false}
      autoTrust={false}
      sessionStatus="idle"
      openedCount={0}
      terminalBusy={false}
      terminalNote={null}
      onWorkspaceChange={() => {}}
      onStepDone={() => {}}
      onAutoTrustChange={() => {}}
      onStart={() => {}}
      onOpenTerminal={() => {}}
      {...overrides}
    />,
  );

/** The opening tag of the step/button whose title (hint) contains `marker`. */
const tag = (html: string, marker: string) =>
  html.match(
    new RegExp(`<button[^>]*title="[^"]*${marker}[^"]*"[^>]*>`),
  )?.[0] ?? "";
const CHECK = "يفحص أن المجلد";
const TRUST = "يكتب في ملف إعدادات";
const PER_RUN = "مفتاح مؤقت";
const START = "يشغّل واجهة الوكيل";
const EXTERNAL = "نافذة PowerShell";

describe("AgentTabStrip", () => {
  it("renders a tab per agent, marks the active one and shows run dots", () => {
    const html = renderToStaticMarkup(
      <AgentTabStrip
        activeAgent="claude"
        status={{ claude: "done", gemini: "running" }}
        turns={{ gemini: 2 }}
        onSelect={() => {}}
      />,
    );
    for (const label of [
      "Gemini CLI",
      "Devin",
      "Hermes",
      "Claude Code",
      "OpenAI Codex",
    ]) {
      expect(html).toContain(label);
    }
    expect(html).toContain('id="agent-tab-claude" role="tab"');
    expect(html).toMatch(/id="agent-tab-claude"[^>]*aria-selected="true"/);
    expect(html).toMatch(/id="agent-tab-gemini"[^>]*aria-selected="false"/);
    // A background run stays visible on its tab while another tab is open.
    expect(html).toContain("يعمل الآن");
    expect(html).toContain("اكتمل");
  });
});

describe("AgentWorkspacePanel", () => {
  it("binds the path input to its own agent", () => {
    const html = panel();
    expect(html).toContain('id="agent-workspace-claude"');
    expect(html).toContain("C:\\Projects\\AppA");
    expect(html).not.toContain("agent-workspace-gemini");
  });

  it("lays out the four steps in order: check, permanent, per-run, start", () => {
    const html = panel({ agent: "gemini" });
    const order = [CHECK, TRUST, PER_RUN, START].map((m) =>
      html.indexOf(tag(html, m)),
    );
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(html).toContain("إلزامي");
    expect(html).toContain("اختياري");
  });

  it("locks everything after ① until the folder check passes", () => {
    const html = panel({ agent: "gemini" });
    expect(tag(html, CHECK)).not.toContain('disabled=""');
    for (const m of [TRUST, PER_RUN, START, EXTERNAL]) {
      expect(tag(html, m)).toContain('disabled=""');
    }
    // No folder at all → even ① is locked.
    expect(tag(panel({ workspace: "" }), CHECK)).toContain('disabled=""');
  });

  it("unlocks ②–④ after the check and shows each success in green", () => {
    const html = panel({ agent: "gemini", checked: true });
    for (const m of [CHECK, TRUST, PER_RUN, START, EXTERNAL]) {
      expect(tag(html, m)).not.toContain('disabled=""');
    }
    expect(tag(html, CHECK)).toContain("emerald");
    expect(html).toContain("مفحوص");
    const done = panel({
      agent: "gemini",
      checked: true,
      trusted: true,
      autoTrust: true,
    });
    expect(tag(done, TRUST)).toContain("emerald");
    expect(tag(done, PER_RUN)).toContain("emerald");
    expect(tag(done, PER_RUN)).toContain('aria-pressed="true"');
    expect(done).toContain("موثوق دائماً");
  });

  it("reports a running session on ④ and stops it from re-launching", () => {
    const html = panel({
      agent: "gemini",
      checked: true,
      sessionStatus: "live",
    });
    expect(html).toContain("الجلسة تعمل");
    expect(tag(html, START)).toContain('disabled=""');
    expect(tag(html, START)).toContain("emerald");
  });

  it("marks unsupported trust steps per agent — even after the check", () => {
    const claude = panel({ checked: true }); // neither trust contract exists
    expect(claude.match(/غير مدعومة لهذا الوكيل/g)).toHaveLength(2);
    expect(tag(claude, "لا يملك ملف ثقة")).toContain('disabled=""');
    expect(tag(claude, "لا يملك هذا الوكيل متغير")).toContain('disabled=""');
    // Devin: permanent trust yes, per-run no.
    const devin = panel({ agent: "devin", checked: true });
    expect(tag(devin, TRUST)).not.toContain('disabled=""');
    expect(devin.match(/غير مدعومة لهذا الوكيل/g)).toHaveLength(1);
  });

  it("shows a terminal note only on the tab it belongs to", () => {
    const note = { agent: "gemini", ok: true, text: "فُتحت نافذة Gemini CLI" };
    expect(panel({ terminalNote: note })).not.toContain("فُتحت نافذة");
    expect(panel({ agent: "gemini", terminalNote: note })).toContain(
      "فُتحت نافذة Gemini CLI",
    );
  });

  it("counts opened external windows", () => {
    expect(panel({ checked: true, openedCount: 3 })).toMatch(/>3<\/span>/);
  });
});
