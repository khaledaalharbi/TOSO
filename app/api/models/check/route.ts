/**
 * Model availability check — answers "which registered models can THIS key
 * actually use?" by probing each with a free countTokens call. The probe
 * works identically on both key hosts (Vertex Agent Platform for the server
 * key, AI Studio for BYOK) so no host-specific ListModels contract is
 * assumed for the core answer.
 *
 * Discovery is best-effort: a GET on the host's models index may return
 * generateContent-capable ids we don't know yet. Failure leaves `extras`
 * null — an honest "couldn't list" rather than an empty claim.
 */

import { NextResponse } from "next/server";
import { providers } from "@/lib/providers/registry";
import { AI_STUDIO_MODELS_URL, VERTEX_MODELS_URL } from "@/lib/server/gemini";

export const runtime = "nodejs";

export interface ModelCheckResult {
  id: string;
  available: boolean;
  /** HTTP status (or "network") when the probe failed — quota 429 stays visible. */
  status?: number | "network";
}

const PROBE_BODY = JSON.stringify({
  contents: [{ role: "user", parts: [{ text: "تم" }] }],
});

export async function GET(request: Request): Promise<NextResponse> {
  const userKey = request.headers.get("x-user-gemini-key")?.trim() || null;
  const apiKey = userKey ?? process.env.AGENT_PLATFORM_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: false, reason: "no_api_key" });
  }
  const baseUrl = userKey ? AI_STUDIO_MODELS_URL : VERTEX_MODELS_URL;

  const results: ModelCheckResult[] = await Promise.all(
    providers.google.models.map(async ({ id }) => {
      try {
        const response = await fetch(
          `${baseUrl}/${encodeURIComponent(id)}:countTokens?key=${encodeURIComponent(apiKey)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: PROBE_BODY,
            cache: "no-store",
            signal: AbortSignal.timeout(10_000),
          },
        );
        if (response.ok) return { id, available: true };
        // Drain the body so the connection can be reused; status is enough.
        await response.text().catch(() => "");
        return { id, available: false, status: response.status };
      } catch {
        return { id, available: false, status: "network" };
      }
    }),
  );

  // Discovery — extra generateContent-capable gemini-* ids the registry
  // doesn't know. Optional by contract: null means "listing not supported".
  let extras: string[] | null = null;
  try {
    const response = await fetch(
      `${baseUrl}?key=${encodeURIComponent(apiKey)}`,
      { cache: "no-store", signal: AbortSignal.timeout(10_000) },
    );
    if (response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        models?: {
          name?: unknown;
          supportedGenerationMethods?: unknown;
        }[];
      } | null;
      const registered = new Set(providers.google.models.map((m) => m.id));
      const seen = new Set<string>();
      const found: string[] = [];
      const list = Array.isArray(payload?.models) ? payload.models : [];
      for (const entry of list) {
        if (!entry || typeof entry !== "object") continue;
        const id = String(entry.name ?? "")
          .split("/")
          .pop();
        if (!id || !id.startsWith("gemini-") || registered.has(id)) continue;
        if (seen.has(id)) continue;
        const methods = entry.supportedGenerationMethods;
        if (Array.isArray(methods) && !methods.includes("generateContent")) {
          continue;
        }
        seen.add(id);
        found.push(id);
        if (found.length >= 20) break;
      }
      extras = found;
    }
  } catch {
    extras = null;
  }

  return NextResponse.json({
    ok: true,
    viaUserKey: Boolean(userKey),
    results,
    extras,
  });
}
