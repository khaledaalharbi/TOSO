import { describe, expect, it } from "vitest";
import { checkEntities } from "./entity-guard";
import { normalizeEnglish } from "./english-normalizer";

describe("normalizeEnglish", () => {
  it("strips opening courtesy and request frames, keeping the task", () => {
    expect(normalizeEnglish("Please   summarize the report")).toBe(
      "summarize the report",
    );
    expect(
      normalizeEnglish("Hi there, could you please translate this text"),
    ).toBe("translate this text");
    expect(normalizeEnglish("I want you to act as a code reviewer")).toBe(
      "act as a code reviewer",
    );
    expect(normalizeEnglish("I'd like you to list 3 risks")).toBe(
      "list 3 risks",
    );
  });

  it("strips trailing courtesy only after sentence punctuation", () => {
    expect(normalizeEnglish("Translate this paragraph, thanks!")).toBe(
      "Translate this paragraph",
    );
    expect(normalizeEnglish("Fix the bug. Thank you so much.")).toBe(
      "Fix the bug.",
    );
    expect(normalizeEnglish("Write a message to say thank you")).toBe(
      "Write a message to say thank you",
    );
  });

  it("leaves real questions and task wording alone", () => {
    expect(normalizeEnglish("Can you access the internet?")).toBe(
      "Can you access the internet?",
    );
    expect(normalizeEnglish("Hello world program in C")).toBe(
      "Hello world program in C",
    );
    expect(normalizeEnglish("Please")).toBe("Please");
    expect(normalizeEnglish("Please.")).toBe("Please.");
  });

  it("cleans spacing, punctuation gaps, invisible characters and blank-line runs", () => {
    expect(
      normalizeEnglish(
        "Review  this \u200Bcode  ,  then  explain it !\n\n\n\nDone",
      ),
    ).toBe("Review this code, then explain it!\n\nDone");
  });

  it("does not touch URLs, quotes, JSON, code or variables", () => {
    const protectedParts =
      'https://a.test/Path "Keep   this  ,  exactly" {"a":  1} `x  =  1` {{user_id}}';
    expect(normalizeEnglish(`Please check  ${protectedParts}`)).toBe(
      `check ${protectedParts}`,
    );
    const fenced = "Please fix\n```js\nconst  a  =  1 ;\n```\nthanks";
    expect(normalizeEnglish(fenced)).toBe("fix\n```js\nconst  a  =  1 ;\n```");
  });

  it("protects code lines but not prose that merely starts with a code word", () => {
    expect(normalizeEnglish("import numpy as np\nsum   the  columns")).toBe(
      "import numpy as np\nsum the columns",
    );
    expect(normalizeEnglish("from now on   answer  briefly")).toBe(
      "from now on answer briefly",
    );
    expect(normalizeEnglish("return the list   sorted by date")).toBe(
      "return the list sorted by date",
    );
    expect(normalizeEnglish("const  a  =  1;\nexplain   it")).toBe(
      "const  a  =  1;\nexplain it",
    );
  });

  it("never loses an entity the guard tracks", () => {
    const text =
      'Hey, please send 50% of $1,200 to {{account_id}} via https://pay.test/x?a=1 and quote "as is".';
    expect(checkEntities(text, normalizeEnglish(text)).preserved).toBe(true);
  });
});
