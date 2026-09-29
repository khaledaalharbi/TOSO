import type { ModelOption, ProviderId } from "@/lib/types";

/**
 * Gemini is the only real provider: it is the engine that actually rewrites
 * prompts and owns the countTokens endpoint used for official counts.
 * The record shape stays extensible — a future real adapter can add a key.
 */
export const providers: Record<
  ProviderId,
  { label: string; models: ModelOption[] }
> = {
  google: {
    label: "Google Gemini",
    models: [
      {
        id: "gemini-3.8-flash",
        label: "Gemini 3.8 Flash",
        inputCostPerMillion: 0.1,
        outputCostPerMillion: 0.4,
      },
      {
        id: "gemini-3.5-flash",
        label: "Gemini 3.5 Flash",
        inputCostPerMillion: 0.15,
        outputCostPerMillion: 0.6,
      },
      {
        id: "gemini-3.5-flash-lite",
        label: "Gemini 3.5 Flash-Lite",
        inputCostPerMillion: 0.05,
        outputCostPerMillion: 0.2,
      },
      {
        id: "gemini-3.1-pro-preview",
        label: "Gemini 3.1 Pro",
        inputCostPerMillion: 1.25,
        outputCostPerMillion: 5,
      },
    ],
  },
};

/**
 * The active default provider. Hard preference: Google Gemini, because its
 * countTokens endpoint returns billing-exact counts and the key is already
 * present in the environment.
 */
export const DEFAULT_PROVIDER: ProviderId = "google";
export const DEFAULT_MODEL = "gemini-3.8-flash";

export function getModel(provider: ProviderId, modelId: string): ModelOption {
  return (
    providers[provider].models.find((model) => model.id === modelId) ??
    providers[provider].models[0]
  );
}

/**
 * Returns a valid model id for the provider, fixing the case where a stored
 * selection (e.g. gemini-2.5-flash) is no longer available.
 */
export function resolveProviderModel(
  provider: ProviderId,
  modelId?: string,
): ModelOption {
  if (modelId) {
    const found = providers[provider].models.find(
      (model) => model.id === modelId,
    );
    if (found) return found;
  }
  return providers[provider].models[0];
}
