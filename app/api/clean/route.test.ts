import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const request = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/clean", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

const geminiText = (text: string) => ({
  ok: true,
  json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
});

const RAW = [
  " > List the files",
  "▀▀▀▀▀▀▀▀▀▀▀▀▀▀",
  "✦ The project has two files: package.json and the",
  "  README that explains setup.",
  "                       ? for shortcuts",
].join("\n");

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("POST /api/clean", () => {
  it.each([null, [], { raw: 42 }, { raw: "x", sent: 5 }, { raw: "x", model: [] }])(
    "rejects invalid shapes: %j",
    async (body) => {
      const response = await POST(request(body));
      expect(response.status).toBe(400);
    },
  );

  it("falls back honestly with no key", async () => {
    vi.stubEnv("AGENT_PLATFORM_API_KEY", "");
    expect(await (await POST(request({ raw: RAW }))).json()).toEqual({
      fallback: true,
      reason: "no_api_key",
    });
  });

  it("accepts a grounded cleanup that re-joins wrapped lines", async () => {
    vi.stubEnv("AGENT_PLATFORM_API_KEY", "k");
    const cleaned =
      "The project has two files: package.json and the README that explains setup.";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(geminiText(cleaned)));
    const payload = await (
      await POST(request({ raw: RAW, sent: "List the files" }))
    ).json();
    expect(payload).toMatchObject({ fallback: false, text: cleaned });
  });

  it("rejects an invented cleanup on every model instead of returning it", async () => {
    vi.stubEnv("AGENT_PLATFORM_API_KEY", "k");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        geminiText("Sure! I refactored your database layer and added tests."),
      );
    vi.stubGlobal("fetch", fetchMock);
    const payload = await (await POST(request({ raw: RAW }))).json();
    expect(payload).toEqual({ fallback: true, reason: "bad_model_output" });
    expect(fetchMock).toHaveBeenCalled();
  });
});
