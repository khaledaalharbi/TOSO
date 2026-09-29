import { afterEach, describe, expect, it, vi } from "vitest";
import { POST, safeParseDual } from "./route";

const generateContentPayload = (
  text: string,
  usageMetadata?: Record<string, number>,
) => ({
  candidates: [{ content: { parts: [{ text }] } }],
  ...(usageMetadata ? { usageMetadata } : {}),
});

describe("safeParseDual", () => {
  it("parses a clean JSON object", () => {
    expect(safeParseDual('{"arabic":"أ","english":"e","note":"n"}')).toEqual({
      arabic: "أ",
      english: "e",
      note: "n",
    });
  });

  it("extracts JSON wrapped in markdown fences", () => {
    const raw = '```json\n{"arabic":"أحسن","english":"better"}\n```';
    const parsed = safeParseDual(raw);
    expect(parsed?.arabic).toBe("أحسن");
    expect(parsed?.english).toBe("better");
  });

  it("returns null when arabic is missing or empty", () => {
    expect(safeParseDual('{"english":"x"}')).toBeNull();
    expect(safeParseDual('{"arabic":"  ","english":"x"}')).toBeNull();
  });

  it("returns null for non-JSON text", () => {
    expect(safeParseDual("no json here")).toBeNull();
    expect(safeParseDual("")).toBeNull();
  });

  it("defaults missing english/note to empty strings", () => {
    expect(safeParseDual('{"arabic":"فقط"}')).toEqual({
      arabic: "فقط",
      english: "",
      note: "",
    });
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("POST", () => {
  it("sends separate system and user content through Agent Platform and maps usage", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () =>
        generateContentPayload(
          '{"arabic":"شلون","english":"how","note":"ok"}',
          {
            promptTokenCount: 12,
            candidatesTokenCount: 20,
            thoughtsTokenCount: 4,
            totalTokenCount: 36,
            cachedContentTokenCount: 0,
          },
        ),
    });
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(
      new Request("http://localhost/api/optimize", {
        method: "POST",
        body: JSON.stringify({ text: "شلون أسويه؟" }),
      }),
    );
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).not.toHaveProperty("keyRole");
    expect(payload.usage).toEqual({
      total_input_tokens: 12,
      total_output_tokens: 20,
      total_thought_tokens: 4,
      total_tokens: 36,
      total_cached_tokens: 0,
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-3.8-flash:generateContent?key=test-key",
    );
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(requestBody.systemInstruction.parts[0].text).toContain(
      "أسلوب المستخدم",
    );
    expect(requestBody.systemInstruction.parts[0].text).toContain(
      "لا تفرض لهجة",
    );
    expect(requestBody.systemInstruction.parts[0].text).toContain(
      "الأولوية لحفظ المقصود قبل تقليل التوكنز",
    );
    expect(requestBody.systemInstruction.parts[0].text).toContain(
      "احفظ المهمة والنفي والشروط والاستثناءات",
    );
    expect(requestBody.systemInstruction.parts[0].text).toContain(
      "إذا أضر الاختصار بالدقة",
    );
    expect(requestBody.systemInstruction.parts[0].text).toContain(
      "أبقِ كلمات اللهجة",
    );
    expect(requestBody.systemInstruction.parts[0].text).toContain(
      "أوجز من نص المدخل",
    );
    expect(requestBody.systemInstruction.parts[0].text).toContain(
      "عربية دائماً",
    );
    expect(requestBody.systemInstruction.parts[0].text).toContain(
      '"note": جملة عربية قصيرة',
    );
    expect(requestBody.systemInstruction.parts[0].text).not.toContain(
      "Detected dialect:",
    );
    expect(requestBody.systemInstruction.parts[0].text).not.toContain(
      "Gulf Arabic",
    );
    expect(requestBody.contents[0]).toEqual({
      role: "user",
      parts: [{ text: "شلون أسويه؟" }],
    });
    expect(requestBody.generationConfig.responseFormat).toEqual([
      {
        text: {
          mimeType: "APPLICATION_JSON",
          schema: expect.objectContaining({
            required: ["arabic", "english", "note"],
          }),
        },
      },
    ]);
    expect(requestBody.generationConfig.thinkingConfig.thinkingLevel).toBe(
      "LOW",
    );
    expect(requestBody).not.toHaveProperty("store");
  });

  it.each([
    "أبي رسالة اعتذار للعميل، لا تذكر الأسعار وخليها سطرين فقط.",
    "عايز تلخص التقرير ده في ٣ نقاط بس، من غير توقعات، واحتفظ بـ {order_id}.",
    'حوّل البيانات {"count":2,"ratio":"٥٠٪"} إلى جدول من عمودين دون تغيير القيم.',
  ])("does not inject a guessed dialect for %s", async (text) => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () =>
        generateContentPayload(
          '{"arabic":"صغ الطلب","english":"Rewrite the request","note":"صيغ بإيجاز"}',
        ),
    });
    vi.stubGlobal("fetch", fetchMock);
    await POST(
      new Request("http://localhost/api/optimize", {
        method: "POST",
        body: JSON.stringify({ text }),
      }),
    );
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(requestBody.contents[0].parts[0].text).toBe(text);
    expect(requestBody.systemInstruction.parts[0].text).toContain(
      "أسلوب المستخدم",
    );
    expect(requestBody.systemInstruction.parts[0].text).not.toContain(
      "Detected dialect:",
    );
  });

  it("omits invalid counters without treating missing usage as zero", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () =>
          generateContentPayload('{"arabic":"أ","english":"a"}', {
            promptTokenCount: 0,
            candidatesTokenCount: -2,
            totalTokenCount: 37,
          }),
      }),
    );
    const response = await POST(
      new Request("http://localhost/api/optimize", {
        method: "POST",
        body: JSON.stringify({ text: "حلل" }),
      }),
    );
    expect((await response.json()).usage).toEqual({
      total_input_tokens: 0,
      total_tokens: 37,
    });
  });

  it("returns null usage when a valid optimization has no usage block", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () =>
          generateContentPayload('{"arabic":"حلل","english":"Analyze"}'),
      }),
    );
    const response = await POST(
      new Request("http://localhost/api/optimize", {
        method: "POST",
        body: JSON.stringify({ text: "حلل" }),
      }),
    );
    expect((await response.json()).usage).toBeNull();
  });

  it("does not invent usage when there is no API key", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("GEMINI_API_KEY_BACKUP", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(
      new Request("http://localhost/api/optimize", {
        method: "POST",
        body: JSON.stringify({ text: "حلل" }),
      }),
    );
    expect(await response.json()).toEqual({
      fallback: true,
      reason: "no_api_key",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("tries every model on quota and never touches a second key", async () => {
    vi.stubEnv("GEMINI_API_KEY", "primary-key");
    vi.stubEnv("GEMINI_API_KEY_BACKUP", "backup-key");
    const quota = { ok: false, status: 429 };
    const fetchMock = vi.fn().mockResolvedValue(quota);
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(
      new Request("http://localhost/api/optimize", {
        method: "POST",
        body: JSON.stringify({ text: "حلل التقرير" }),
      }),
    );
    expect(await response.json()).toEqual({
      fallback: true,
      reason: "http_429",
    });
    const usedKeys = fetchMock.mock.calls.map((call) =>
      new URL(String(call[0])).searchParams.get("key"),
    );
    // One attempt per candidate model — the backup env var is never read.
    expect(new Set(usedKeys)).toEqual(new Set(["primary-key"]));
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("treats an unparseable 200 body as bad model output, not a crash", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => {
          throw new Error("invalid json");
        },
      }),
    );
    const response = await POST(
      new Request("http://localhost/api/optimize", {
        method: "POST",
        body: JSON.stringify({ text: "حلل التقرير" }),
      }),
    );
    expect(await response.json()).toEqual({
      fallback: true,
      reason: "bad_model_output",
    });
  });

  it("does not fall back to a second key on malformed model output", async () => {
    vi.stubEnv("GEMINI_API_KEY", "primary-key");
    vi.stubEnv("GEMINI_API_KEY_BACKUP", "backup-key");
    const badOutput = {
      ok: true,
      json: async () => generateContentPayload("not json at all"),
    };
    const fetchMock = vi.fn().mockResolvedValue(badOutput);
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(
      new Request("http://localhost/api/optimize", {
        method: "POST",
        body: JSON.stringify({ text: "حلل التقرير" }),
      }),
    );
    expect(await response.json()).toEqual({
      fallback: true,
      reason: "bad_model_output",
    });
    const usedKeys = new Set(
      fetchMock.mock.calls.map((call) =>
        new URL(String(call[0])).searchParams.get("key"),
      ),
    );
    expect(usedKeys).toEqual(new Set(["primary-key"]));
  });
});
