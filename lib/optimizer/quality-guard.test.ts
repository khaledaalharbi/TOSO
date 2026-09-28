import { describe, expect, it } from "vitest";
import { checkQuality } from "./quality-guard";

describe("checkQuality", () => {
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
    const check = checkQuality("اكتب رسالة شكر للعميل", "اكتب شكراً للعميل", "ar");
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
});
