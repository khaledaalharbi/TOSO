import { describe, expect, it } from "vitest";
import { checkQuality } from "./quality-guard";

describe("checkQuality", () => {
  it("recognizes English negation regardless of case or apostrophe style", () => {
    expect(
      checkQuality("Do NOT predict sales", "Predict sales", "en").negationKept,
    ).toBe(false);
    expect(
      checkQuality("Don't predict sales", "DON’T predict sales", "en")
        .negationKept,
    ).toBe(true);
    expect(
      checkQuality("DON’T predict sales", "Predict sales", "en").negationKept,
    ).toBe(false);
  });

  it("compares vocalized Arabic negation and content without false warnings", () => {
    const check = checkQuality(
      "لَا تُلَخِّصْ أَدَاءَ الشَّرِكَةِ",
      "لا تلخص أداء الشركة",
      "ar",
    );
    expect(check.negationKept).toBe(true);
    expect(check.keywordCoverage).toBe(1);
  });

  it("passes a normal Arabic rewrite with preserved negation and content", () => {
    const check = checkQuality(
      "أريد تحليل أداء الشركة دون ذكر الأسعار",
      "حلّل أداء الشركة دون ذكر الأسعار",
      "ar",
    );
    expect(check.languageOk).toBe(true);
    expect(check.negationKept).toBe(true);
    expect(check.keywordCoverage).toBeGreaterThanOrEqual(0.5);
    expect(check.warnings).toEqual([]);
  });

  it("rejects an Arabic field that is not actually Arabic", () => {
    const check = checkQuality(
      "اكتب رسالة اعتذار للعميل",
      "Write an apology message to the customer",
      "ar",
    );
    expect(check.languageOk).toBe(false);
    expect(check.warnings.some((w) => w.includes("ليس مكتوباً بالعربية"))).toBe(
      true,
    );
  });

  it("flags dropped negation without rejecting the output by itself", () => {
    const check = checkQuality(
      "لخص التقرير في ثلاث نقاط دون أي توقعات",
      "لخص التقرير في ثلاث نقاط مع توقعات",
      "ar",
    );
    expect(check.languageOk).toBe(true);
    expect(check.negationKept).toBe(false);
    expect(check.warnings.some((w) => w.includes("النفي"))).toBe(true);
  });

  it("reports low coverage when meaningful words vanish", () => {
    const check = checkQuality(
      "حلل أداء المبيعات والمخزون والشحن لفرع الرياض",
      "راجع الطلب",
      "ar",
    );
    expect(check.keywordCoverage).not.toBeNull();
    expect(check.keywordCoverage).toBeLessThan(0.4);
    expect(check.warnings.some((w) => w.includes("تغطية"))).toBe(true);
  });

  it("returns null negation when the source has none to keep", () => {
    const check = checkQuality(
      "اكتب رسالة شكر للعميل",
      "اكتب شكراً للعميل",
      "ar",
    );
    expect(check.negationKept).toBeNull();
  });

  it("checks the English variant's language without Arabic coverage", () => {
    const check = checkQuality(
      "اكتب رسالة اعتذار",
      "Write an apology message to the customer",
      "en",
    );
    expect(check.languageOk).toBe(true);
    expect(check.keywordCoverage).toBeNull();
  });

  it("detects English negation survival for English inputs", () => {
    const kept = checkQuality(
      "write a summary without predictions",
      "Write a summary with no predictions",
      "en",
    );
    expect(kept.negationKept).toBe(true);
    const dropped = checkQuality(
      "write a summary without predictions",
      "Write a summary with predictions",
      "en",
    );
    expect(dropped.negationKept).toBe(false);
  });

  it("accepts a faithful mixed Arabic/code rewrite (regression: false rejection)", () => {
    const mixed = "حلل SELECT customer_name, invoice_total FROM sales_data";
    const check = checkQuality(mixed, mixed, "ar");
    expect(check.languageOk).toBe(true);
    expect(check.warnings).not.toContain("المخرج العربي ليس مكتوباً بالعربية");
  });

  it("accepts a purely code-bearing prompt with no Arabic", () => {
    const code = "SELECT customer_name, invoice_total FROM sales_data";
    const check = checkQuality(code, code, "ar");
    expect(check.languageOk).toBe(true);
  });

  it("still rejects an English paragraph returned in the arabic field", () => {
    const check = checkQuality(
      "حلل أداء المبيعات",
      "Analyze the sales performance data carefully",
      "ar",
    );
    expect(check.languageOk).toBe(false);
  });

  it("still rejects a code-only output that lost Arabic content", () => {
    const check = checkQuality(
      "حلل أداء المبيعات في الربع الأول",
      "SELECT FROM WHERE",
      "ar",
    );
    expect(check.languageOk).toBe(false);
  });

  it("still rejects Arabic script returned in the english field", () => {
    const check = checkQuality("write a summary", "اكتب ملخصاً", "en");
    expect(check.languageOk).toBe(false);
  });
});
