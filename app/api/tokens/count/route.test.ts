import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("POST /api/tokens/count", () => {
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
    vi.stubEnv("GEMINI_API_KEY", "test-key");
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
    vi.stubEnv("GEMINI_API_KEY", "test-key");
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

  it("returns fallback with reason no_api_key when GEMINI_API_KEY is unset", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
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
