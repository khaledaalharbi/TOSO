import { describe, expect, it } from "vitest";
import { arabicRatio, heuristicCount } from "./token-engine";

describe("heuristicCount", () => {
  it("returns 0 for empty text", () => {
    expect(heuristicCount("")).toBe(0);
  });

  it("counts Arabic at the calibrated 0.333 tokens/char", () => {
    expect(heuristicCount("م".repeat(100))).toBe(34);
  });

  it("counts Latin at the calibrated 0.25 tokens/char", () => {
    expect(heuristicCount("a".repeat(100))).toBe(25);
  });

  it("rates Arabic higher than Latin for equal length — the product premise", () => {
    expect(heuristicCount("م".repeat(100))).toBeGreaterThan(
      heuristicCount("a".repeat(100)),
    );
  });
});

describe("arabicRatio", () => {
  it("returns 0 for empty and non-Arabic text", () => {
    expect(arabicRatio("")).toBe(0);
    expect(arabicRatio("hello world")).toBe(0);
  });

  it("returns 1 for fully Arabic text", () => {
    expect(arabicRatio("حللالأداء")).toBe(1);
  });

  it("counts Arabic-script letters over total characters", () => {
    // 9 Arabic letters + 1 space = 10 chars
    expect(arabicRatio("حلل الأداء")).toBeCloseTo(0.9);
  });

  it("treats mixed text proportionally", () => {
    expect(arabicRatio("حلل ok")).toBeCloseTo(0.5);
  });
});
