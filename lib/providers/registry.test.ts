import { describe, expect, it } from "vitest";
import { getModel, providers, resolveProviderModel } from "./registry";

describe("resolveProviderModel", () => {
  it("returns the requested model when it exists", () => {
    expect(resolveProviderModel("google", "gemini-3.5-flash").id).toBe(
      "gemini-3.5-flash",
    );
  });

  it("falls back to the provider's first model for unknown ids", () => {
    expect(resolveProviderModel("google", "gemini-2.5-flash").id).toBe(
      providers.google.models[0].id,
    );
  });

  it("falls back when no model is given", () => {
    expect(resolveProviderModel("google").id).toBe(
      providers.google.models[0].id,
    );
  });
});

describe("getModel", () => {
  it("returns the exact model for a valid pair", () => {
    const model = getModel("openai", "gpt-4.1");
    expect(model.id).toBe("gpt-4.1");
  });

  it("never throws for a stale stored selection", () => {
    expect(getModel("anthropic", "deleted-model").id).toBe(
      providers.anthropic.models[0].id,
    );
  });
});
