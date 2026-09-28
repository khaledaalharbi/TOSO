import { afterEach, describe, expect, it, vi } from "vitest";
import { POST, safeParseDual } from "./route";

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
  it("sends user input separately from style-neutral instructions and retains the three output fields", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        usage: {
          total_input_tokens: 12,
          total_output_tokens: 20,
          total_thought_tokens: 4,
          total_tokens: 36,
          total_cached_tokens: 0,
        },
        steps: [
          {
            type: "model_output",
            content: [
              {
                type: "text",
                text: '{"arabic":"شلون","english":"how","note":"ok"}',
              },
            ],
          },
        ],
      }),
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
    expect(payload.keyRole).toBe("primary");
    expect(payload.usage).toEqual({
      total_input_tokens: 12,
      total_output_tokens: 20,
      total_thought_tokens: 4,
      total_tokens: 36,
      total_cached_tokens: 0,
    });
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(requestBody.system_instruction).toContain("أسلوب المستخدم");
    expect(requestBody.system_instruction).toContain("لا تفرض لهجة");
    expect(requestBody.system_instruction).toContain(
      "الأولوية لحفظ المقصود قبل تقليل التوكنز",
    );
    expect(requestBody.system_instruction).toContain(
      "احفظ المهمة والنفي والشروط والاستثناءات",
    );
    expect(requestBody.system_instruction).toContain("إذا أضر الاختصار بالدقة");
    expect(requestBody.system_instruction).toContain("أبقِ كلمات اللهجة");
    expect(requestBody.system_instruction).toContain("أوجز من نص المدخل");
    expect(requestBody.system_instruction).toContain("عربية دائماً");
    expect(requestBody.system_instruction).toContain(
      '"note": جملة عربية قصيرة',
    );
    expect(requestBody.system_instruction).not.toContain("Detected dialect:");
    expect(requestBody.system_instruction).not.toContain("Gulf Arabic");
    expect(requestBody.input).toBe("شلون أسويه؟");
    expect(requestBody.response_format[0].schema.required).toEqual([
      "arabic",
      "english",
      "note",
    ]);
    expect(requestBody.store).toBe(false);
    expect(requestBody).not.toHaveProperty("previous_interaction_id");
  });

  it.each([
    "أبي رسالة اعتذار للعميل، لا تذكر الأسعار وخليها سطرين فقط.",
    "عايز تلخص التقرير ده في ٣ نقاط بس، من غير توقعات، واحتفظ بـ {order_id}.",
    'حوّل البيانات {"count":2,"ratio":"٥٠٪"} إلى جدول من عمودين دون تغيير القيم.',
  ])("does not inject a guessed dialect for %s", async (text) => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        steps: [
          {
            type: "model_output",
            content: [
              {
                type: "text",
                text: '{"arabic":"صغ الطلب","english":"Rewrite the request","note":"صيغ بإيجاز"}',
              },
            ],
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await POST(
      new Request("http://localhost/api/optimize", {
        method: "POST",
        body: JSON.stringify({ text }),
      }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.input).toBe(text);
    expect(body.system_instruction).toContain("أسلوب المستخدم");
    expect(body.system_instruction).not.toContain("Detected dialect:");
  });

  it("omits invalid counters without treating missing usage as zero", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          usage: {
            total_input_tokens: 0,
            total_output_tokens: -2,
            total_tokens: "37",
          },
          steps: [
            {
              type: "model_output",
              content: [{ type: "text", text: '{"arabic":"أ","english":"a"}' }],
            },
          ],
        }),
      }),
    );
    const response = await POST(
      new Request("http://localhost/api/optimize", {
        method: "POST",
        body: JSON.stringify({ text: "حلل" }),
      }),
    );
    expect((await response.json()).usage).toEqual({ total_input_tokens: 0 });
  });

  it("returns null usage when a valid optimization has no usage block", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          steps: [
            {
              type: "model_output",
              content: [
                { type: "text", text: '{"arabic":"حلل","english":"Analyze"}' },
              ],
            },
          ],
        }),
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

  it("falls back to GEMINI_API_KEY_BACKUP after the primary key hits quota", async () => {
    vi.stubEnv("GEMINI_API_KEY", "primary-key");
    vi.stubEnv("GEMINI_API_KEY_BACKUP", "backup-key");
    const quota = { ok: false, status: 429 };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(quota)
      .mockResolvedValueOnce(quota)
      .mockResolvedValueOnce(quota)
      .mockResolvedValueOnce(quota)
      .mockResolvedValue({
        ok: true,
        json: async () => ({
          steps: [
            {
              type: "model_output",
              content: [
                {
                  type: "text",
                  text: '{"arabic":"حلل","english":"Analyze","note":"تم"}',
                },
              ],
            },
          ],
        }),
      });
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(
      new Request("http://localhost/api/optimize", {
        method: "POST",
        body: JSON.stringify({ text: "حلل التقرير" }),
      }),
    );
    const body = await response.json();
    expect(body.fallback).toBe(false);
    expect(body.keyRole).toBe("backup");
    expect(body.model).toBe("gemini-3.8-flash");
    const usedKeys = fetchMock.mock.calls.map(
      (call) => (call[1].headers as Record<string, string>)["x-goog-api-key"],
    );
    expect(usedKeys.slice(0, 4)).toEqual([
      "primary-key",
      "primary-key",
      "primary-key",
      "primary-key",
    ]);
    expect(usedKeys[4]).toBe("backup-key");
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("does not try the backup key for non-quota failures", async () => {
    vi.stubEnv("GEMINI_API_KEY", "primary-key");
    vi.stubEnv("GEMINI_API_KEY_BACKUP", "backup-key");
    const badOutput = {
      ok: true,
      json: async () => ({
        steps: [
          {
            type: "model_output",
            content: [{ type: "text", text: "not json at all" }],
          },
        ],
      }),
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
      fetchMock.mock.calls.map(
        (call) => (call[1].headers as Record<string, string>)["x-goog-api-key"],
      ),
    );
    expect(usedKeys).toEqual(new Set(["primary-key"]));
  });
});
