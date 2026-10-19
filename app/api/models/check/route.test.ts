import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const request = (userKey?: string) =>
  new Request("http://localhost/api/models/check", {
    headers: userKey ? { "x-user-gemini-key": userKey } : {},
  });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("GET /api/models/check", () => {
  it("reports no_api_key when neither key exists", async () => {
    vi.stubEnv("AGENT_PLATFORM_API_KEY", "");
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: false,
      reason: "no_api_key",
    });
  });

  it("probes every registered model on the Vertex host for the server key", async () => {
    vi.stubEnv("AGENT_PLATFORM_API_KEY", "server-key");
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown) => {
        const u = String(url);
        calls.push(u);
        if (u.includes(":countTokens")) {
          return { ok: true, status: 200 } as Response;
        }
        return {
          ok: true,
          json: async () => ({ models: [] }),
        } as Response;
      }),
    );
    const payload = await (await GET(request())).json();
    expect(payload.ok).toBe(true);
    expect(payload.viaUserKey).toBe(false);
    expect(payload.results).toHaveLength(4);
    expect(
      payload.results.every((r: { available: boolean }) => r.available),
    ).toBe(true);
    expect(calls.filter((u) => u.includes(":countTokens"))).toHaveLength(4);
    expect(calls[0]).toContain("aiplatform.googleapis.com");
    expect(calls[0]).toContain("key=server-key");
  });

  it("uses the AI Studio host when a user key is supplied", async () => {
    vi.stubEnv("AGENT_PLATFORM_API_KEY", "server-key");
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown) => {
        const u = String(url);
        calls.push(u);
        return u.includes(":countTokens")
          ? ({ ok: true, status: 200 } as Response)
          : ({ ok: false, status: 404 } as Response);
      }),
    );
    const payload = await (await GET(request("user-key"))).json();
    expect(payload.viaUserKey).toBe(true);
    expect(calls[0]).toContain("generativelanguage.googleapis.com");
    expect(calls[0]).toContain("key=user-key");
    // The list endpoint failing must not kill the per-model answer.
    expect(payload.extras).toBeNull();
  });

  it("flags missing and quota-limited models distinctly", async () => {
    vi.stubEnv("AGENT_PLATFORM_API_KEY", "server-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown) => {
        const u = String(url);
        if (!u.includes(":countTokens")) {
          return { ok: true, json: async () => ({ models: [] }) } as Response;
        }
        if (u.includes("gemini-3.1-pro")) {
          return {
            ok: false,
            status: 404,
            text: async () => "",
          } as Response;
        }
        if (u.includes("gemini-3.5-flash-lite")) {
          return {
            ok: false,
            status: 429,
            text: async () => "",
          } as Response;
        }
        return { ok: true, status: 200 } as Response;
      }),
    );
    const payload = await (await GET(request())).json();
    const byId = Object.fromEntries(
      payload.results.map((r: { id: string }) => [r.id, r]),
    );
    expect(byId["gemini-3.1-pro-preview"].available).toBe(false);
    expect(byId["gemini-3.1-pro-preview"].status).toBe(404);
    expect(byId["gemini-3.5-flash-lite"].status).toBe(429);
    expect(byId["gemini-3.8-flash"].available).toBe(true);
  });

  it("discovers unregistered gemini models but filters noise", async () => {
    vi.stubEnv("AGENT_PLATFORM_API_KEY", "server-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown) => {
        const u = String(url);
        if (u.includes(":countTokens")) {
          return { ok: true, status: 200 } as Response;
        }
        return {
          ok: true,
          json: async () => ({
            models: [
              {
                name: "models/gemini-3.9-flash",
                supportedGenerationMethods: ["generateContent"],
              },
              { name: "models/gemini-3.8-flash" }, // already registered
              { name: "models/text-embedding-004" }, // not a gemini-* id
              {
                name: "models/gemini-3.8-tts",
                supportedGenerationMethods: ["generateSpeech"],
              },
            ],
          }),
        } as Response;
      }),
    );
    const payload = await (await GET(request())).json();
    expect(payload.extras).toEqual(["gemini-3.9-flash"]);
  });

  it("never throws on a malformed list payload", async () => {
    vi.stubEnv("AGENT_PLATFORM_API_KEY", "server-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown) => {
        const u = String(url);
        return u.includes(":countTokens")
          ? ({ ok: true, status: 200 } as Response)
          : ({
              ok: true,
              json: async () => ({ models: "nope" }),
            } as Response);
      }),
    );
    const payload = await (await GET(request())).json();
    expect(payload.ok).toBe(true);
    expect(payload.extras).toEqual([]);
  });
});
