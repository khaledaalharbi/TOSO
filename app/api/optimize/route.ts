/**
 * Optimization endpoint — the ONLY place that rewrites prompts via Gemini.
 *
 * Flow:  browser → /api/optimize → Gemini Interactions API → {arabic, english} back.
 * The API key lives in process.env on the server and never reaches the client.
 *
 * The system instruction (the carefully drawn "background injection") forces
 * both output languages in a single call, with strict intent-preservation
 * rules, as a JSON object — so the two variants always stay semantically paired.
 *
 * The route answers `{ fallback: true }` (HTTP 200) when no key is configured
 * or Gemini fails, so the client can degrade to the local mock optimizer.
 */

import { NextResponse } from "next/server";
import { providers, resolveProviderModel } from "@/lib/providers/registry";

export const runtime = "nodejs";

interface OptimizeRequest {
  text?: string;
  model?: string;
}

interface DualOutput {
  arabic?: string;
  english?: string;
  note?: string;
}

const INTERACTIONS_URL =
  "https://generativelanguage.googleapis.com/v1beta/interactions";
const API_REVISION = "2026-05-20";

/** Structured-output schema — the API enforces this shape, no fence-stripping needed. */
const DUAL_SCHEMA = {
  type: "OBJECT",
  properties: {
    arabic: { type: "STRING" },
    english: { type: "STRING" },
    note: { type: "STRING" },
  },
  required: ["arabic", "english", "note"],
};

const SYSTEM_INSTRUCTION = [
  "You are TOSO, an expert prompt optimizer for Arabic and English.",
  "You receive a user prompt (usually Arabic, possibly dialectal or mixed-language).",
  'Reply with a JSON object of exactly three fields: {"arabic": "...", "english": "...", "note": "..."}',
  "",
  "Rules:",
  '- "arabic": rewrite the prompt concisely in the SAME Arabic register/dialect the user used.',
  "  Remove filler, pleasantries, and redundancies. Keep it directly actionable.",
  '- "english": translate-and-optimize into natural, precise English ready to be used as an LLM prompt.',
  '- "note": one short Arabic sentence describing what you changed (max 15 words).',
  "- NEVER drop essential information: entities, numbers, dates, constraints, deliverables,",
  "  tone, or output-format requirements.",
  "- NEVER add requirements the user did not state.",
  "- Output ONLY the JSON object. No markdown, no code fences, no commentary.",
].join("\n");

export async function POST(request: Request): Promise<NextResponse> {
  let body: OptimizeRequest;
  try {
    body = (await request.json()) as OptimizeRequest;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const text = (body.text ?? "").trim();
  if (!text) return NextResponse.json({ error: "empty_text" }, { status: 400 });
  if (text.length > 100_000) {
    return NextResponse.json(
      { error: "text_too_long", limit: 100_000 },
      { status: 413 },
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // No key configured → client falls back to the local mock optimizer.
    return NextResponse.json({ fallback: true, reason: "no_api_key" });
  }

  const model = resolveProviderModel("google", body.model).id;
  // Per-candidate body — "model" lives inside the request for this API.
  const requestBody = (candidate: string) =>
    JSON.stringify({
      model: candidate,
      system_instruction: SYSTEM_INSTRUCTION,
      input: text,
      // store=false: user prompts are not retained server-side (no
      // previous_interaction_id / background usage in this app anyway).
      store: false,
      response_format: [
        { type: "text", mime_type: "application/json", schema: DUAL_SCHEMA },
      ],
      generation_config: {
        // Rewriting is not deep reasoning — keep thought tokens (cost+latency) down.
        thinking_level: "low",
      },
    });

  /**
   * Candidate chain: the resolved model first, then the other Gemini models.
   * Free-tier quotas are per model per day, so a 429 on the default does not
   * mean the optimization has to fail — the response reports which model ran.
   */
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
        response = await fetch(INTERACTIONS_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
            "Api-Revision": API_REVISION,
          },
          body: requestBody(candidate),
          cache: "no-store",
        });
      } catch {
        lastReason = "network";
        break;
      }

      if (!response.ok) {
        lastReason = `http_${response.status}`;
        // 429 is a per-model quota → try the next model. 5xx is transient →
        // a couple of quick retries, then move on.
        if (response.status >= 500 && retries5xx < 2) {
          retries5xx += 1;
          await new Promise((resolve) => setTimeout(resolve, 700));
          continue;
        }
        break;
      }

      const payload = (await response.json()) as {
        status?: string;
        steps?: {
          type?: string;
          content?: { type?: string; text?: string }[];
        }[];
      };
      // The answer sits in the last model_output step; earlier steps may be thoughts.
      const outputStep = [...(payload.steps ?? [])]
        .reverse()
        .find((step) => step.type === "model_output");
      const raw = (outputStep?.content ?? [])
        .filter((part) => part.type === "text")
        .map((part) => part.text ?? "")
        .join("");
      const parsed = safeParseDual(raw);
      if (!parsed) {
        lastReason = "bad_model_output";
        break;
      }
      return NextResponse.json({
        ...parsed,
        model: candidate,
        fallback: false,
      });
    }
  }
  return NextResponse.json({ fallback: true, reason: lastReason });
}

/** Tolerant extraction — models sometimes wrap JSON in stray text or fences. */
export function safeParseDual(raw: string): DualOutput | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as DualOutput;
    if (typeof parsed.arabic !== "string" || !parsed.arabic.trim()) return null;
    return {
      arabic: parsed.arabic.trim(),
      english: typeof parsed.english === "string" ? parsed.english.trim() : "",
      note: typeof parsed.note === "string" ? parsed.note.trim() : "",
    };
  } catch {
    return null;
  }
}
