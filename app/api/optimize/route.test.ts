import { describe, expect, it } from "vitest";
import { safeParseDual } from "./route";

describe("safeParseDual", () => {
  it("parses a clean JSON object", () => {
    expect(
      safeParseDual('{"arabic":"أ","english":"e","note":"n"}'),
    ).toEqual({ arabic: "أ", english: "e", note: "n" });
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
