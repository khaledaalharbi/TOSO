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
      openedCount={0}
      terminalBusy={false}
      terminalNote={null}
      autoTrust={false}
      onWorkspaceChange={() => {}}
      onAutoTrustChange={() => {}}
      onOpenTerminal={() => {}}
      {...overrides}
    />,
  );

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
  it("binds the path input and terminal button to its own agent", () => {
    const html = panel();
    expect(html).toContain('id="agent-workspace-claude"');
    expect(html).toContain("C:\\Projects\\AppA");
    // The panel's terminal button is the secondary EXTERNAL window now —
    // the embedded live terminal is a separate pane below it.
    expect(html).toContain("نافذة خارجية");
    expect(html).not.toContain("agent-workspace-gemini");
  });

  it("states the folder is required when the agent has no project", () => {
    const html = panel({ workspace: undefined });
    expect(html).toContain("إلزامي: لن يعمل هذا الوكيل قبل تحديد مجلد");
  });

  it("marks unsupported agents honestly — no permanent trust, no per-run toggle", () => {
    const html = panel(); // claude: neither trust contract exists
    expect(html).toContain("ثقة دائمة — غير مدعومة");
    expect(html).toContain("ثقة لكل تشغيلة — غير مدعومة");
    // A supporting agent gets both controls enabled instead.
    const gemini = panel({ agent: "gemini" });
    expect(gemini).toContain("ثقة دائمة بالمجلد");
    expect(gemini).toContain("ثقة لكل تشغيلة");
    expect(gemini).not.toContain("غير مدعومة");
    // Devin supports permanent trust but no per-run env.
    const devin = panel({ agent: "devin" });
    expect(devin).toContain("ثقة دائمة بالمجلد");
    expect(devin).toContain("ثقة لكل تشغيلة — غير مدعومة");
  });

  it("shows a terminal note only on the tab it belongs to", () => {
    const note = { agent: "gemini", ok: true, text: "فُتحت نافذة Gemini CLI" };
    expect(panel({ terminalNote: note })).not.toContain("فُتحت نافذة");
    expect(panel({ agent: "gemini", terminalNote: note })).toContain(
      "فُتحت نافذة Gemini CLI",
    );
  });

  it("counts opened windows and disables check/trust with no folder", () => {
    // Opening tags by their unique marker, so each assertion is about one button.
    const tag = (html: string, marker: string) =>
      html.match(new RegExp(`<button[^>]*${marker}[^>]*>`))?.[0] ?? "";
    const empty = panel({ workspace: "", openedCount: 3, agent: "gemini" });
    expect(empty).toMatch(/>3<\/span>/);
    expect(tag(empty, "يكتب في ملف إعدادات")).toContain('disabled=""');
    expect(tag(empty, "نافذة PowerShell")).not.toContain('disabled=""');
    expect(tag(empty, "يفحص أن المجلد")).toContain('disabled=""');
    // With a folder the check and trust buttons are enabled too.
    const set = panel({ agent: "gemini" });
    expect(tag(set, "يكتب في ملف إعدادات")).not.toContain('disabled=""');
    expect(tag(set, "يفحص أن المجلد")).not.toContain('disabled=""');
  });
});
