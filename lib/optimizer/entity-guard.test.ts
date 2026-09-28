import { describe, expect, it } from "vitest";
import { checkEntities } from "./entity-guard";

describe("checkEntities", () => {
  it("detects missing dates, percentages, URLs, variables, identifiers and quotes", () => {
    const original =
      'حلل 2025-03-01 و50% على https://a.test/p?id=2 مع {user_id} و api_key ثم "نص محدد"';
    const result = checkEntities(original, "حلل 2025-03-01 و50% مع {user_id}");
    expect(result.preserved).toBe(false);
    expect(result.checked).toBe(6);
    expect(result.missing).toEqual([
      { kind: "url", value: "https://a.test/p?id=2" },
      { kind: "identifier", value: "api_key" },
      { kind: "quote", value: '"نص محدد"' },
    ]);
  });

  it("reports when no supported entities were available to check", () => {
    expect(checkEntities("لخص المقال", "لخص النص")).toEqual({
      preserved: true,
      checked: 0,
      missing: [],
    });
  });

  it("checks multiplicity instead of mere presence", () => {
    expect(checkEntities("كرر 42 ثم 42", "كرر 42").missing).toEqual([
      { kind: "number", value: "42" },
    ]);
  });

  it("accepts Arabic or Persian digits when numeric values match", () => {
    expect(
      checkEntities(
        "خصم ٥٠٪ بتاريخ ۲۰۲۵/۰۳/۰۱",
        "Discount 50% on 2025/03/01",
        false,
      ).preserved,
    ).toBe(true);
  });

  it("still checks numbers inside translated quotations", () => {
    expect(checkEntities('اكتب "50%"', 'Write "40%"', false).missing).toEqual([
      { kind: "number", value: "50%" },
    ]);
  });

  it("detects changes in values and formats, without claiming semantic equivalence", () => {
    expect(
      checkEntities("50% و 2025-03-01", "50 و 2025-03-02").missing,
    ).toEqual([
      { kind: "number", value: "50%" },
      { kind: "number", value: "2025-03-01" },
    ]);
  });
});
