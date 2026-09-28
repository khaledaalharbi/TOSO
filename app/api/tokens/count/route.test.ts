import { describe, expect, it } from "vitest";
import { POST } from "./route";

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

  it("returns fallback with reason no_api_key when GEMINI_API_KEY is unset", async () => {
    const prevKey = process.env.GEMINI_API_KEY;
    const prevBackup = process.env.GEMINI_API_KEY_BACKUP;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY_BACKUP;
    try {
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
    } finally {
      if (prevKey !== undefined) {
        process.env.GEMINI_API_KEY = prevKey;
      }
      if (prevBackup !== undefined) {
        process.env.GEMINI_API_KEY_BACKUP = prevBackup;
      }
    }
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
