import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/translate", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

const geminiText = (text: string) => ({
  ok: true,
  json: async () => ({
    candidates: [{ content: { parts: [{ text }] } }],
  }),
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("POST /api/translate", () => {
  it.each([
    null,
    [],
    "text",
    42,
    { text: 42 },
    { text: null },
    { text: "hi", model: [] },
  ])("rejects invalid request shapes with 400: %j", async (body) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(request(body));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_request" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects empty text with 400", async () => {
    const response = await POST(request({ text: "   " }));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("empty_text");
  });

  it("falls back honestly when no key is configured", async () => {
    vi.stubEnv("AGENT_PLATFORM_API_KEY", "");
    const response = await POST(request({ text: "hello" }));
    expect(await response.json()).toEqual({
      fallback: true,
      reason: "no_api_key",
    });
  });

  it("translates via the server env key on the Vertex host", async () => {
    vi.stubEnv("AGENT_PLATFORM_API_KEY", "server-key");
    const fetchMock = vi.fn().mockResolvedValue(geminiText("هذه ترجمة عربية"));
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(request({ text: "This is English output." }));
    const payload = await response.json();
    expect(payload).toMatchObject({
      fallback: false,
      arabic: "هذه ترجمة عربية",
      viaUserKey: false,
    });
    expect(fetchMock.mock.calls[0][0]).toContain("aiplatform.googleapis.com");
    expect(fetchMock.mock.calls[0][0]).toContain("key=server-key");
  });

  it("prefers the user BYOK key and the AI Studio host", async () => {
    vi.stubEnv("AGENT_PLATFORM_API_KEY", "server-key");
    const fetchMock = vi.fn().mockResolvedValue(geminiText("ترجمة"));
    vi.stubGlobal("fetch", fetchMock);
    await POST(
      request({ text: "output" }, { "x-user-gemini-key": "user-key-9" }),
    );
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("generativelanguage.googleapis.com");
    expect(url).toContain("key=user-key-9");
  });

  it("treats a non-Arabic 'translation' as bad output and tries the next model", async () => {
    vi.stubEnv("AGENT_PLATFORM_API_KEY", "k");
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        calls.push(url);
        // First model returns English (rejected), second returns Arabic.
        return Promise.resolve(
          geminiText(
            calls.length === 1 ? "still English, no Arabic" : "ترجمة صحيحة",
          ),
        );
      }),
    );
    const response = await POST(request({ text: "translate me" }));
    const payload = await response.json();
    expect(payload.fallback).toBe(false);
    expect(payload.arabic).toBe("ترجمة صحيحة");
    expect(calls.length).toBeGreaterThan(1);
    expect(calls[0]).not.toBe(calls[1]); // different model in the URL
  });

  it("reports user-scoped reasons for a failing BYOK key", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 403, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(
      request({ text: "x" }, { "x-user-gemini-key": "bad" }),
    );
    expect(await response.json()).toEqual({
      fallback: true,
      reason: "user_key_invalid",
    });
  });

  it("maps 429 to the model chain and ends with an honest reason", async () => {
    vi.stubEnv("AGENT_PLATFORM_API_KEY", "k");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({ ok: false, status: 429, json: async () => ({}) }),
    );
    const response = await POST(request({ text: "x" }));
    const payload = await response.json();
    expect(payload.fallback).toBe(true);
    expect(payload.reason).toBe("http_429");
  });
});
