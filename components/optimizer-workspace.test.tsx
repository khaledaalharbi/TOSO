import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { OptimizationReport, TokenMeasurement } from "@/lib/types";
import {
  OptimizationInsights,
  OptimizationUsagePanel,
  OptimizerWorkspace,
  TokenHeatmap,
} from "./optimizer-workspace";

const measure = (
  tokens: number,
  source: TokenMeasurement["source"] = "provider",
): TokenMeasurement => ({
  tokens,
  source,
  words: 1,
  characters: tokens,
});

const report: OptimizationReport = {
  direction: "ar",
  original: { tokens: 100, characters: 100, words: 1 },
  originalPrompt: "أريد منك أن تَحْلُلَ التقرير   ثم تقارنه ببيانات ٢٠٢٥",
  originalMeasurement: measure(100),
  normalizedPrompt: "نص محلي",
  normalizedMeasurement: measure(80),
  arabic: {
    text: "نص عربي",
    analysis: { tokens: 60, characters: 60, words: 1 },
    measurement: measure(60),
    cost: { original: 1, optimized: 0.6, saved: 0.4, savingPercent: 40 },
  },
  english: null,
  note: "تم",
  source: "gemini",
  entityChecks: {
    arabic: { preserved: true, checked: 2, missing: [] },
    english: null,
  },
  rejectedByGuard: false,
  quality: {
    arabic: {
      languageOk: true,
      negationKept: null,
      keywordCoverage: 0.8,
      warnings: [],
    },
    english: null,
  },
  optimizationUsage: null,
};

const render = (value: OptimizationReport) =>
  renderToStaticMarkup(<OptimizationInsights report={value} />);

describe("OptimizerWorkspace hydration", () => {
  it("prevents input and runs until the browser key has been hydrated", () => {
    const markup = renderToStaticMarkup(<OptimizerWorkspace />);
    expect(markup).toMatch(/<textarea[^>]*disabled=""/);
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>تشغيل التحليل/);
  });
});

describe("OptimizationInsights", () => {
  it("separates local savings from Gemini rewriting without double-counting", () => {
    const markup = render(report);
    expect(markup).toContain("توفير 20 توكن (20%)");
    expect(markup).toContain("توفير 20 توكن (25%)");
    expect(markup).toContain("إعادة صياغة Gemini");
    expect(markup).not.toContain("تصنيف صياغة الإدخال");
    expect(markup).not.toContain("الفصحى");
    expect(markup).toContain("عرض النص بعد التنقية المحلية");
    expect(markup).toContain("نص محلي");
    expect(markup).toContain("لم يُرصد فقد في 2 كيان قابل للفحص");
    expect(markup).toContain("ضماناً لحفظ المعنى");
    expect(markup).toContain("تغطية كلمات المحتوى ~80%");
  });

  it("avoids comparing counts measured by different sources", () => {
    const markup = render({
      ...report,
      normalizedMeasurement: measure(80, "heuristic"),
    });
    expect(markup).toContain("لا يمكن حساب الفرق بدقة لاختلاف مصدر العد");
    expect(markup).not.toContain("توفير 20 توكن");
  });

  it("warns on rejected model output and does not assert preservation when nothing was checked", () => {
    const markup = render({
      ...report,
      source: "mock",
      rejectedByGuard: true,
      entityChecks: {
        arabic: { preserved: true, checked: 0, missing: [] },
        english: null,
      },
    });
    expect(markup).toContain("رُفض مخرج Gemini");
    expect(markup).toContain("لا توجد كيانات مدعومة للفحص");
    expect(markup).not.toContain("لم يُرصد فقد في");
  });

  it("keeps English savings separate and identifies missing entities", () => {
    const markup = render({
      ...report,
      english: { ...report.arabic!, text: "English" },
      entityChecks: {
        arabic: {
          preserved: false,
          checked: 1,
          missing: [{ kind: "variable", value: "{user_id}" }],
        },
        english: { preserved: true, checked: 1, missing: [] },
      },
    });
    expect(markup).toContain("لا تُضاف وفوراتها إلى العربية");
    expect(markup).toContain("تعذّر حفظ 1 من 1 كيان");
    expect(markup).toContain("{user_id}");
  });

  it("shows increases instead of claiming savings", () => {
    const markup = render({ ...report, normalizedMeasurement: measure(110) });
    expect(markup).toContain("زيادة 10 توكن (10%)");
  });
});

describe("TokenHeatmap", () => {
  it("offers contextual original/Arabic previews with legend, local estimate and unavailable English", () => {
    const markup = renderToStaticMarkup(<TokenHeatmap report={report} />);
    expect(markup).toContain("خريطة ثقل المقاطع");
    expect(markup).toContain("النص الأصلي");
    expect(markup).toContain("النسخة العربية");
    expect(markup).toContain("أثقل المقاطع في المعاينة");
    expect(markup).toContain("تقدير محلي");
    expect(markup).toContain("ليست تفكيكاً رسمياً من Gemini");
    expect(markup).toContain("النسخة الإنجليزية");
    expect(markup).toContain("غير متاحة في هذا التشغيل");
    expect(markup).toContain("٢٠٢٥");
  });

  it("includes English when available, preserves the analyzed snapshot and warns when preview is truncated", () => {
    const markup = renderToStaticMarkup(
      <TokenHeatmap
        report={{
          ...report,
          originalPrompt: "تحليل ".repeat(130),
          english: { ...report.arabic!, text: "Analyze this report" },
        }}
      />,
    );
    expect(markup).toContain("النسخة الإنجليزية");
    expect(markup.replace(/<[^>]*>/g, "")).toContain("Analyze this report");
    expect(markup).toContain("معاينة محدودة");
    expect(markup).not.toContain("الإنجليزية غير متاحة في هذا التشغيل");
  });
});

describe("OptimizationUsagePanel", () => {
  it("shows only provider-reported counters, separately from the final prompt estimate", () => {
    const markup = renderToStaticMarkup(
      <OptimizationUsagePanel
        report={{
          ...report,
          optimizationUsage: {
            total_input_tokens: 37,
            total_thought_tokens: 0,
            total_tokens: 62,
          },
        }}
      />,
    );
    expect(markup).toContain("مدخلات الاستدعاء");
    expect(markup).toContain("37");
    expect(markup).toContain("التفكير");
    expect(markup).toContain("0");
    expect(markup).not.toContain("المخرجات</div>");
    expect(markup).toContain("ليست عدّ البرومبت وحده");
    expect(markup).toContain("ليس فاتورة هذا الاستدعاء");
  });

  it("retains real usage for a rejected output without fabricating local usage", () => {
    const rejected = renderToStaticMarkup(
      <OptimizationUsagePanel
        report={{
          ...report,
          source: "mock",
          rejectedByGuard: true,
          optimizationUsage: { total_tokens: 42 },
        }}
      />,
    );
    expect(rejected).toContain("الأرقام تخص الاستدعاء المرفوض");
    const local = renderToStaticMarkup(
      <OptimizationUsagePanel report={report} />,
    );
    expect(local).toContain("لا تتوفر بيانات استهلاك فعلية");
    expect(local).not.toContain("الإجمالي حسب Gemini");
  });
});
