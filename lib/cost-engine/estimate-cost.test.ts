import { describe, expect, it } from "vitest";
import type { ModelOption } from "@/lib/types";
import { estimateCost } from "./estimate-cost";

const model: ModelOption = {
  id: "m",
  label: "M",
  inputCostPerMillion: 1,
  outputCostPerMillion: 2,
};

describe("estimateCost", () => {
  it("computes input-token cost per million", () => {
    const cost = estimateCost(1_000_000, 500_000, model);
    expect(cost.original).toBe(1);
    expect(cost.optimized).toBe(0.5);
    expect(cost.saved).toBe(0.5);
    expect(cost.savingPercent).toBe(50);
  });

  it("returns 0% savings for empty input instead of NaN", () => {
    expect(estimateCost(0, 0, model).savingPercent).toBe(0);
  });

  it("clamps savings at 0 when the optimized prompt is bigger", () => {
    const cost = estimateCost(10, 100, model);
    expect(cost.saved).toBe(0);
    expect(cost.savingPercent).toBe(0);
  });

  it("scales with the model input price", () => {
    const cheap = estimateCost(1_000_000, 0, model);
    const pricey = estimateCost(1_000_000, 0, {
      ...model,
      inputCostPerMillion: 10,
    });
    expect(pricey.original).toBe(cheap.original * 10);
  });
});
