import { describe, expect, it } from "vitest";
import { countViaBpe, estimateHeatmapSegments } from "./bpe-estimator";

describe("countViaBpe", () => {
  it("returns 0 for empty text", () => {
    expect(countViaBpe("")).toBe(0);
  });

  it("never returns less than 1 for non-empty text", () => {
    expect(countViaBpe("a")).toBe(1);
  });

  it("buckets Arabic at ~0.333 tokens/char", () => {
    expect(countViaBpe("م".repeat(100))).toBe(34);
  });

  it("buckets Latin at ~0.25 tokens/char", () => {
    expect(countViaBpe("a".repeat(100))).toBe(25);
  });

  it("counts emoji as ~1 token each (surrogate-pair aware)", () => {
    expect(countViaBpe("😀😀😀")).toBe(3);
  });

  it("sums mixed-script text across buckets", () => {
    // 100 arabic (34) + 100 latin (25) = 59
    expect(countViaBpe("م".repeat(100) + "a".repeat(100))).toBe(59);
  });
});

describe("estimateHeatmapSegments", () => {
  it("preserves the exact Arabic/English text and whitespace while estimating each segment locally", () => {
    const text = "مرحبا  hello\n٢٠٢٥-٠٦-١٠ 😀";
    const result = estimateHeatmapSegments(text);
    expect(result.segments.map(({ text }) => text).join("")).toBe(text);
    expect(result.segments.filter(({ tokens }) => tokens !== null)).toEqual([
      { text: "مرحبا", tokens: countViaBpe("مرحبا") },
      { text: "hello", tokens: countViaBpe("hello") },
      { text: "٢٠٢٥-٠٦-١٠", tokens: countViaBpe("٢٠٢٥-٠٦-١٠") },
      { text: "😀", tokens: countViaBpe("😀") },
    ]);
    expect(result.truncated).toBe(false);
    expect(result.scoredSegments).toBe(4);
  });

  it("bounds long previews instead of rendering the whole prompt or claiming a total", () => {
    const result = estimateHeatmapSegments("أول ثان ثالث رابع", 2);
    expect(result.segments.map(({ text }) => text).join("")).toBe("أول ثان ");
    expect(result.scoredSegments).toBe(2);
    expect(result.truncated).toBe(true);
    const oversized = estimateHeatmapSegments("س".repeat(2500));
    expect(oversized.segments).toEqual([]);
    expect(oversized.truncated).toBe(true);
  });

  it("handles empty text without making network requests or inventing tokens", () => {
    expect(estimateHeatmapSegments("")).toEqual({
      segments: [],
      scoredSegments: 0,
      truncated: false,
    });
  });
});
