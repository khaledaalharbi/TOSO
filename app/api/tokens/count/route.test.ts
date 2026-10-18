import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("POST /api/tokens/count", () => {
  it.each([
    null,
    [],
    "text",
    42,
    { text: 42 },
    { text: null },
    { text: "حلل", model: [] },
  ])("rejects invalid request shapes with 400: %j", async (body) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(
      new Request("http://localhost/api/tokens/count", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_request" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([1.5, Number.MAX_SAFE_INTEGER + 1, -1])(
    "rejects an invalid provider token count: %s",
    async (totalTokens) => {
      vi.stubEnv("AGENT_PLATFORM_API_KEY", "test-key");
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ totalTokens }),
        }),
      );
      const response = await POST(
        new Request("http://localhost/api/tokens/count", {
          method: "POST",
          body: JSON.stringify({ text: "حلل التقرير" }),
        }),
      );
      expect(await response.json()).toMatchObject({ fallback: true });
    },
  );

  it("returns 0 tokens with fallback false for empty text", async () => {
    const request = new Request("http://localhost/api/tokens/count", {
      method: "POST",
      body: JSON.stringify({ text: "" }),
      headers: { "Content-Type": "application/json" },
    });
    const response = await POST(request);
    const data = (await response.json()) as {
      tokens: number;
      fallback: boolean;
    };
    expect(response.status).toBe(200);
    expect(data.tokens).toBe(0);
    expect(data.fallback).toBe(false);
  });

  it("uses Agent Platform countTokens and returns its count", async () => {
    vi.stubEnv("AGENT_PLATFORM_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ totalTokens: 17 }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const request = new Request("http://localhost/api/tokens/count", {
      method: "POST",
      body: JSON.stringify({ text: "مرحبا بك" }),
      headers: { "Content-Type": "application/json" },
    });
    const response = await POST(request);
    expect(await response.json()).toEqual({
      tokens: 17,
      fallback: false,
      model: "gemini-3.8-flash",
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-3.8-flash:countTokens?key=test-key",
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({
      contents: [{ role: "user", parts: [{ text: "مرحبا بك" }] }],
    });
  });

  it("treats a 200 without totalTokens as an estimate, not an official zero", async () => {
    vi.stubEnv("AGENT_PLATFORM_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({}),
      }),
    );
    const request = new Request("http://localhost/api/tokens/count", {
      method: "POST",
      body: JSON.stringify({ text: "مرحبا بك" }),
      headers: { "Content-Type": "application/json" },
    });
    const response = await POST(request);
    const data = (await response.json()) as {
      tokens: number;
      fallback: boolean;
    };
    expect(data.fallback).toBe(true);
    expect(data.tokens).toBeGreaterThan(0);
  });

  it("routes a user BYOK key to the AI Studio host", async () => {
    vi.stubEnv("AGENT_PLATFORM_API_KEY", "server-key");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ totalTokens: 9 }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const request = new Request("http://localhost/api/tokens/count", {
      method: "POST",
      body: JSON.stringify({ text: "مرحبا بك" }),
      headers: {
        "Content-Type": "application/json",
        "x-user-gemini-key": "user-ai-key",
      },
    });
    const response = await POST(request);
    expect(await response.json()).toEqual({
      tokens: 9,
      fallback: false,
      model: "gemini-3.8-flash",
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:countTokens?key=user-ai-key",
    );
  });

  it("tags user-key failures with user_key_* codes", async () => {
    vi.stubEnv("AGENT_PLATFORM_API_KEY", "server-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({}),
      }),
    );
    const request = new Request("http://localhost/api/tokens/count", {
      method: "POST",
      body: JSON.stringify({ text: "مرحبا بك" }),
      headers: { "x-user-gemini-key": "bad-key" },
    });
    const response = await POST(request);
    const data = (await response.json()) as {
      fallback: boolean;
      errorCode?: string;
    };
    expect(data.fallback).toBe(true);
    expect(data.errorCode).toBe("user_key_invalid");
  });

  it("returns fallback with reason no_api_key when AGENT_PLATFORM_API_KEY is unset", async () => {
    vi.stubEnv("AGENT_PLATFORM_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const request = new Request("http://localhost/api/tokens/count", {
      method: "POST",
      body: JSON.stringify({ text: "مرحبا بك" }),
      headers: { "Content-Type": "application/json" },
    });
    const response = await POST(request);
    const data = (await response.json()) as {
      tokens: number;
      fallback: boolean;
      reason?: string;
    };
    expect(response.status).toBe(200);
    expect(data.fallback).toBe(true);
    expect(data.reason).toBe("no_api_key");
    expect(data.tokens).toBeGreaterThan(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects invalid JSON with 400", async () => {
    const request = new Request("http://localhost/api/tokens/count", {
      method: "POST",
      body: "not-json",
      headers: { "Content-Type": "application/json" },
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
