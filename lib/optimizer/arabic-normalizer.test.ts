import { describe, expect, it } from "vitest";
import { normalizeArabic } from "./arabic-normalizer";

describe("normalizeArabic", () => {
  it("cleans introductory filler, diacritics, tatweel and spacing", () => {
    expect(normalizeArabic("  من فضلك   حَلِّلْ الــنص  ،  الآن!  ")).toBe(
      "حلل النص، الآن!",
    );
  });

  it("keeps meaningful connectors and numbers", () => {
    expect(normalizeArabic("حلل 2025 و 50% لذلك اذكر السبب")).toBe(
      "حلل 2025 و 50% لذلك اذكر السبب",
    );
  });

  it("does not touch URLs, quotes or technical content", () => {
    expect(normalizeArabic('من فضلك راجع https://a.test/حَلِّل "حَلِّل"')).toBe(
      'راجع https://a.test/حَلِّل "حَلِّل"',
    );
    const structured = 'من فضلك ```json\n{"prompt": "حَلِّلْ"}\n```';
    expect(normalizeArabic(structured)).toBe(
      '```json\n{"prompt": "حَلِّلْ"}\n```',
    );
    expect(normalizeArabic('{"value": "حَلِّلْ"}')).toBe(
      '{"value": "حَلِّلْ"}',
    );
  });

  it("cleans prose around nested JSON without changing its contents", () => {
    const json = '{"الطلب":{"text":"حَلِّلْ","values":[1,2]}}';
    expect(normalizeArabic(`من فضلك   حَلِّلْ  ${json}  ثم  لَخِّصْ`)).toBe(
      `حلل ${json} ثم لخص`,
    );
  });

  it("keeps escaped quotes and nested brackets intact", () => {
    const json = '{"text":"قال \\\"حَلِّلْ\\\"","items":[{"id":1}]}';
    expect(normalizeArabic(`لَخِّصْ  ${json}  ثم  أَجِبْ`)).toBe(
      `لخص ${json} ثم أجب`,
    );
  });

  it("protects fenced and inline code while cleaning surrounding prose", () => {
    const code = '```json\n{"text": "حَلِّلْ"}\n```';
    expect(normalizeArabic(`من فضلك   حَلِّلْ  ${code}  ثم  لَخِّصْ`)).toBe(
      `حلل ${code} ثم لخص`,
    );
    expect(
      normalizeArabic('من فضلك  اشرح  `const س = "حَلِّلْ"`  ثم  لَخِّصْ'),
    ).toBe('اشرح `const س = "حَلِّلْ"` ثم لخص');
  });

  it("protects unclosed structured segments instead of rewriting their payloads", () => {
    expect(normalizeArabic('من فضلك  اشرح  {"text":"حَلِّلْ"')).toBe(
      'اشرح {"text":"حَلِّلْ"',
    );
    expect(
      normalizeArabic('من فضلك  لَخِّصْ  ```json\n{"text":"حَلِّلْ"'),
    ).toBe('لخص ```json\n{"text":"حَلِّلْ"');
  });

  it("leaves a pure preamble alone rather than returning an empty prompt", () => {
    expect(normalizeArabic("من فضلك")).toBe("من فضلك");
  });

  it("protects unfenced code lines while still cleaning prose around them", () => {
    const code = 'const س = "حَلِّلْ"';
    expect(normalizeArabic(`من فضلك نَفّذْ\n${code}\nثم لَخِّصْ`)).toBe(
      `نفذ\n${code}\nثم لخص`,
    );
    expect(normalizeArabic("import x\nحَلِّلْ   النتيجة")).toBe(
      "import x\nحلل النتيجة",
    );
  });

  it("does not treat prose starting with an English word as code", () => {
    expect(normalizeArabic("if you see this حَلِّلْ   النص")).toBe(
      "if you see this حلل النص",
    );
  });
});
