import { describe, expect, it } from "vitest";
import { countViaBpe } from "./bpe-estimator";

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
