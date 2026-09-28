import { describe, expect, it } from "vitest";
import { detectDialect } from "./dialect-detector";

describe("detectDialect", () => {
  it.each([
    ["عايز أعرف إزاي ده بيشتغل", "egyptian"],
    ["شلون أسويه الحين؟", "gulf"],
    ["شو بدي أعمل هلأ؟", "levantine"],
    ["واش بغيت دابا؟", "maghrebi"],
    ["يرجى تحليل التقرير", "msa"],
    ["hello world", "undetermined"],
    ["شو أعمل، واش ندير؟", "undetermined"],
  ] as const)("classifies %s as %s", (text, dialect) => {
    expect(detectDialect(text)).toBe(dialect);
  });

  it("matches entire words, not substrings of identifiers", () => {
    expect(detectDialect("show_now")).toBe("undetermined");
  });
});
