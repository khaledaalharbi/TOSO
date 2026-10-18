/**
 * Shared Gemini caller for server routes — owns the host selection, the model
 * fallback chain, timeouts/retries, and response-part filtering so route
 * handlers only declare an instruction and an acceptance check.
 *
 * Two hosts exist because two key origins exist:
 *  - Vertex AI Agent Platform (server env key) — `responseFormat` union.
 *  - AI Studio generativelanguage (user BYOK key) — `responseMimeType`/`responseSchema`.
 */

import { providers, resolveProviderModel } from "@/lib/providers/registry";
import type { GeminiUsage } from "@/lib/types";

export const VERTEX_MODELS_URL =
  "https://aiplatform.googleapis.com/v1/publishers/google/models";
export const AI_STUDIO_MODELS_URL =
  "https://generativelanguage.googleapis.com/v1beta/models";

export interface GeminiCallSpec {
  /** Resolved key — a user BYOK key picks the AI Studio host and config contract. */
  apiKey: string;
  viaUserKey: boolean;
  /** Requested model id; resolved through the registry, then chained. */
  model?: string;
  systemInstruction: string;
  userText: string;
  /** generationConfig for the AI Studio host. */
  studioConfig: Record<string, unknown>;
  /** generationConfig for the Vertex host. */
  vertexConfig: Record<string, unknown>;
  /**
   * Optional acceptance check on the joined response text (e.g. JSON parses,
   * or the text actually contains Arabic). A failing check behaves like a
   * bad model output: `bad_model_output` and the chain moves on.
   */
  accept?: (text: string) => boolean;
}

export type GeminiGenerateResult =
  | { ok: true; text: string; model: string; usage: GeminiUsage | null }
  | { ok: false; reason: string };

/**
 * Candidate chain: the resolved model first, then the other Gemini models.
 * Quota availability can differ by model; the result reports which ran.
 */
export async function generateGemini(
  spec: GeminiCallSpec,
): Promise<GeminiGenerateResult> {
  const baseUrl = spec.viaUserKey ? AI_STUDIO_MODELS_URL : VERTEX_MODELS_URL;
  const model = resolveProviderModel("google", spec.model).id;
  const requestBody = () =>
    JSON.stringify({
      systemInstruction: { parts: [{ text: spec.systemInstruction }] },
      contents: [{ role: "user", parts: [{ text: spec.userText }] }],
      generationConfig: spec.viaUserKey
        ? spec.studioConfig
        : spec.vertexConfig,
    });
  const candidateModels = [
    model,
    ...providers.google.models
      .map((entry) => entry.id)
      .filter((id) => id !== model),
  ];

  let lastReason = "exhausted";
  for (const candidate of candidateModels) {
    let retries5xx = 0;
    while (true) {
      let response: Response;
      try {
        response = await fetch(
          `${baseUrl}/${encodeURIComponent(candidate)}:generateContent?key=${encodeURIComponent(spec.apiKey)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: requestBody(),
            cache: "no-store",
            // Bound every attempt — a stalled Gemini connection must not
            // freeze the request (and the user's UI) forever.
            signal: AbortSignal.timeout(15_000),
          },
        );
      } catch {
        lastReason = "network";
        break;
      }

      if (!response.ok) {
        // A failing user key reports user-scoped reasons so the UI can say
        // "YOUR key" instead of blaming the server — and we never silently
        // retry on the server key (that would bill the operator while the
        // user believes their own quota paid).
        lastReason = spec.viaUserKey
          ? response.status === 429
            ? "user_key_quota"
            : response.status === 400 ||
                response.status === 401 ||
                response.status === 403
              ? "user_key_invalid"
              : `user_key_http_${response.status}`
          : `http_${response.status}`;
        // 429 may be model-specific → try the next model. 5xx is transient →
        // a couple of quick retries, then move on.
        if (response.status >= 500 && retries5xx < 2) {
          retries5xx += 1;
          await new Promise((resolve) => setTimeout(resolve, 700));
          continue;
        }
        break;
      }

      // A 200 with an unparseable body degrades to fallback, not a 500.
      const payload = (await response.json().catch(() => null)) as {
        candidates?: {
          content?: { parts?: { text?: string; thought?: boolean }[] };
        }[];
        usageMetadata?: unknown;
      } | null;
      const parts = payload?.candidates?.[0]?.content?.parts;
      const text = (Array.isArray(parts) ? parts : [])
        .filter(
          (part) => typeof part?.text === "string" && part.thought !== true,
        )
        .map((part) => part.text ?? "")
        .join("");
      if (spec.accept && !spec.accept(text)) {
        lastReason = "bad_model_output";
        break;
      }
      return {
        ok: true,
        text,
        model: candidate,
        usage: parseVertexUsage(payload?.usageMetadata),
      };
    }
  }
  return { ok: false, reason: lastReason };
}

export function parseVertexUsage(raw: unknown): GeminiUsage | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const payload = raw as Record<string, unknown>;
  const fields = [
    ["total_input_tokens", "promptTokenCount"],
    ["total_output_tokens", "candidatesTokenCount"],
    ["total_thought_tokens", "thoughtsTokenCount"],
    ["total_cached_tokens", "cachedContentTokenCount"],
    ["total_tool_use_tokens", "toolUsePromptTokenCount"],
    ["total_tokens", "totalTokenCount"],
  ] as const;
  const usage: GeminiUsage = {};
  for (const [field, sourceField] of fields) {
    const value = payload[sourceField];
    if (
      typeof value === "number" &&
      Number.isSafeInteger(value) &&
      value >= 0
    ) {
      usage[field] = value;
    }
  }
  return Object.keys(usage).length ? usage : null;
}
