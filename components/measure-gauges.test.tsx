import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { OptimizationReport } from "@/lib/types";
import { BridgeBadge } from "./bridge-badge";
import { AgentViewTabs } from "./agent-view-tabs";
import { MeasureGauges, gaugeData, niceMax } from "./measure-gauges";

const measure = (tokens: number, source: "provider" | "bpe" = "provider") => ({
  tokens,
  characters: 0,
  words: 0,
  source,
});

const report = (over: Partial<OptimizationReport> = {}) =>
  ({
    original: { tokens: 96, characters: 0, words: 0 },
    originalMeasurement: measure(96),
    english: {
      text: "x",
      analysis: { tokens: 41, characters: 0, words: 0 },
      cost: {
        original: 0.000604,
        optimized: 0.000258,
        saved: 0,
        savingPercent: 0,
      },
      measurement: measure(41),
    },
    arabic: null,
    entityChecks: {
      arabic: null,
      english: { preserved: true, checked: 3, missing: [] },
    },
    quality: {
      arabic: null,
      english: {
        languageOk: true,
        negationKept: null,
        keywordCoverage: 1,
        warnings: [],
      },
    },
    ...over,
  }) as unknown as OptimizationReport;

describe("niceMax", () => {
  it("rounds up to a readable 1·2·5 scale", () => {
    expect(niceMax(96)).toBe(100);
    expect(niceMax(18)).toBe(20);
    expect(niceMax(101)).toBe(200);
    expect(niceMax(1200)).toBe(2000);
    expect(niceMax(4)).toBe(10);
  });
});

describe("gaugeData", () => {
  it("reads before/after, the saving and one shared scale", () => {
    const data = gaugeData(report());
    expect(data).toMatchObject({
      before: 96,
      after: 41,
      scaleMax: 100,
      percent: 57.3,
      mixedSources: false,
      estimated: false,
      entities: { ok: true, count: 3 },
      quality: "ok",
    });
    expect(data.costBefore).toBeTruthy();
  });

  it("refuses a percentage when the two counts come from different sources", () => {
    const data = gaugeData(report({ originalMeasurement: measure(96, "bpe") }));
    expect(data.percent).toBeNull();
    expect(data.mixedSources).toBe(true);
  });

  it("shows growth as a negative saving", () => {
    expect(
      gaugeData(
        report({
          original: { tokens: 10, characters: 0, words: 0 },
          originalMeasurement: measure(10),
        }),
      ).percent,
    ).toBeLessThan(0);
  });
});

describe("MeasureGauges", () => {
  it("waits quietly: no sweeping radar, a still breathing arc and the step label", () => {
    const html = renderToStaticMarkup(
      <MeasureGauges data={null} running progress="يقيس الـTokens…" />,
    );
    expect(html).toContain("gauge-wait");
    expect(html).toContain("يقيس الـTokens…");
    expect(html).not.toContain("radar");
  });

  it("invites the first run when empty", () => {
    const html = renderToStaticMarkup(
      <MeasureGauges data={null} running={false} progress={null} />,
    );
    expect(html).toContain("«معالجة»");
    expect(html).not.toContain("gauge-wait");
  });

  it("shows the short version of a result: dials, delta, cost, checks, source", () => {
    const html = renderToStaticMarkup(
      <MeasureGauges
        data={gaugeData(report())}
        running={false}
        progress={null}
        source="Gemini · مفتاحك"
        caption="Codex · 12:15"
      />,
    );
    expect(html).toContain("الأصل: 96 توكن من 100");
    expect(html).toContain("الناتج: 41 توكن من 100");
    expect(html).toContain("57.3%");
    expect(html).toContain("تكلفة الإرسال قبل");
    expect(html).toContain("الكيانات محفوظة (3)");
    expect(html).toContain("فحص الجودة: اجتاز");
    expect(html).toContain("Gemini · مفتاحك");
    expect(html).toContain("Codex · 12:15");
  });
});

describe("BridgeBadge", () => {
  const badge = (state: Parameters<typeof BridgeBadge>[0]["state"]) =>
    renderToStaticMarkup(
      <BridgeBadge
        state={state}
        url="http://127.0.0.1:8676"
        onClick={() => {}}
      />,
    );

  it("shows the real address, green when it answers", () => {
    const html = badge("ok");
    expect(html).toContain("bridge 127.0.0.1:8676");
    expect(html).toContain("bg-emerald-500");
  });

  it("says plainly when the bridge is down, old, or refuses the token", () => {
    expect(badge("offline")).toContain("غير متصل");
    expect(badge("outdated")).toContain("قديم");
    expect(badge("bad_token")).toContain("توكن مرفوض");
  });
});

describe("AgentViewTabs", () => {
  const tabs = (props: Partial<Parameters<typeof AgentViewTabs>[0]> = {}) =>
    renderToStaticMarkup(
      <AgentViewTabs
        agent="codex"
        view="terminal"
        turns={0}
        unseenReply={false}
        onChange={() => {}}
        {...props}
      />,
    );

  it("offers terminal, IN and OUT in that order", () => {
    const html = tabs();
    expect(html.indexOf("التيرمينال")).toBeLessThan(html.indexOf("سجل IN"));
    expect(html.indexOf("سجل IN")).toBeLessThan(html.indexOf("سجل OUT"));
    expect(html.match(/aria-selected="true"/g)).toHaveLength(1);
  });

  it("flags an unread reply on OUT only while elsewhere", () => {
    expect(tabs({ unseenReply: true, turns: 2 })).toContain("رد جديد لم تقرأه");
    expect(tabs({ unseenReply: true, turns: 2, view: "out" })).not.toContain(
      "رد جديد لم تقرأه",
    );
  });
});

describe("gauge details", () => {
  it("does not claim preserved entities when there were none to guard", () => {
    const none = report({
      entityChecks: {
        arabic: null,
        english: { preserved: true, checked: 0, missing: [] },
      },
    });
    const html = renderToStaticMarkup(
      <MeasureGauges data={gaugeData(none)} running={false} progress={null} />,
    );
    expect(html).toContain("لا كيانات تحتاج حماية");
    expect(html).not.toContain("الكيانات محفوظة");
  });

  it("shows tiny costs instead of a flat zero", () => {
    const tiny = report();
    tiny.english!.cost.original = 0.0000143;
    expect(gaugeData(tiny).costBefore).toContain("0.000014");
  });
});
