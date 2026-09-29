/**
 * Token counting endpoint — the ONLY place that touches a provider secret.
 *
 * Flow:  browser → /api/tokens/count → Agent Platform countTokens → count back.
 * The API key lives in process.env on the server and never reaches the client.
 *
 * The route answers `{ tokens, fallback: true }` (HTTP 200) when no key is
 * configured, so the engine can degrade to local estimation without a
 * network error surfacing in the UI.
 */

import { NextResponse } from "next/server";
import { heuristicCount } from "@/lib/token-engine/token-engine";
import { resolveProviderModel } from "@/lib/providers/registry";

export const runtime = "nodejs";

interface CountRequest {
  text?: string;
  model?: string;
}

const VERTEX_MODELS_URL =
  "https://aiplatform.googleapis.com/v1/publishers/google/models";

export async function POST(request: Request): Promise<NextResponse> {
  let body: CountRequest;
  try {
    body = (await request.json()) as CountRequest;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const text = (body.text ?? "").trim();
  if (!text) return NextResponse.json({ tokens: 0, fallback: false });
  if (text.length > 100_000) {
    return NextResponse.json(
      { error: "text_too_long", limit: 100_000 },
      { status: 413 },
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // No key configured → tell the client to estimate locally.
    return NextResponse.json({
      tokens: heuristicCount(text),
      fallback: true,
      reason: "no_api_key",
    });
  }

  const model = resolveProviderModel("google", body.model).id;

  try {
    const response = await fetch(
      `${VERTEX_MODELS_URL}/${encodeURIComponent(model)}:countTokens?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text }] }],
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      },
    );

    if (!response.ok) {
      // Key/quota problems are recoverable for the user; surface a stable code.
      const errorPayload = await response.json().catch(() => ({}));
      const errorCode =
        typeof errorPayload === "object" &&
        errorPayload !== null &&
        "error" in errorPayload
          ? ((errorPayload.error as { status?: string }).status ??
            `http_${response.status}`)
          : `http_${response.status}`;
      return NextResponse.json(
        { tokens: heuristicCount(text), fallback: true, errorCode },
        { status: 200 },
      );
    }

    const payload = (await response.json()) as { totalTokens?: unknown };
    const tokens = payload.totalTokens;
    // A 200 without a valid count is not an official zero — estimate honestly.
    if (typeof tokens !== "number" || !Number.isFinite(tokens) || tokens < 0) {
      return NextResponse.json({
        tokens: heuristicCount(text),
        fallback: true,
      });
    }
    return NextResponse.json({
      tokens: Math.round(tokens),
      fallback: false,
      model,
    });
  } catch {
    // Network/timeout — degrade to local estimation.
    return NextResponse.json({
      tokens: heuristicCount(text),
      fallback: true,
    });
  }
}
