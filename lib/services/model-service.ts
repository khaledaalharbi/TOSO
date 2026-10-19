/**
 * Browser side of /api/models/check — asks the server to probe every
 * registered Gemini model with the active key (user BYOK first) and to
 * list any generateContent-capable ids the registry doesn't know.
 * Informational only; the runtime fallback chain already guards real runs.
 */

export interface ModelCheckResult {
  id: string;
  available: boolean;
  status?: number | "network";
}

export type ModelCheckResponse =
  | {
      state: "ok";
      viaUserKey: boolean;
      results: ModelCheckResult[];
      extras: string[] | null;
    }
  | { state: "no_key" }
  | { state: "offline" };

export async function checkAvailableModels(
  userKey?: string,
): Promise<ModelCheckResponse> {
  try {
    const response = await fetch("/api/models/check", {
      headers: userKey ? { "x-user-gemini-key": userKey } : {},
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => null)) as {
      ok?: boolean;
      reason?: string;
      viaUserKey?: boolean;
      results?: ModelCheckResult[];
      extras?: string[] | null;
    } | null;
    if (!payload) return { state: "offline" };
    if (!payload.ok) {
      return { state: payload.reason === "no_api_key" ? "no_key" : "offline" };
    }
    if (!Array.isArray(payload.results)) return { state: "offline" };
    return {
      state: "ok",
      viaUserKey: Boolean(payload.viaUserKey),
      results: payload.results,
      extras: Array.isArray(payload.extras) ? payload.extras : null,
    };
  } catch {
    return { state: "offline" };
  }
}
