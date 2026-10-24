import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { EN } from "./en";
import { translate } from "./index";

const ROOT = join(__dirname, "..", "..");
const TRANSLATORS = new Set(["t", "tx", "tNow"]);

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next") continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(path, out);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name))
      out.push(path);
  }
  return out;
}

/** Every source string handed to t()/tx()/tNow() (and translate(lang, …)). */
function collectKeys(): Set<string> {
  const keys = new Set<string>();
  const literals = (node: ts.Node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
      keys.add(node.text);
    else if (!ts.isFunctionLike(node)) ts.forEachChild(node, literals);
  };
  for (const dir of ["app", "components", "lib"]) {
    for (const file of sourceFiles(join(ROOT, dir))) {
      const text = readFileSync(file, "utf8");
      const kind = file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
      const sf = ts.createSourceFile(
        file,
        text,
        ts.ScriptTarget.Latest,
        true,
        kind,
      );
      const visit = (node: ts.Node) => {
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
          const name = node.expression.text;
          if (TRANSLATORS.has(name) && node.arguments[0])
            literals(node.arguments[0]);
          if (name === "translate" && node.arguments[1])
            literals(node.arguments[1]);
        }
        ts.forEachChild(node, visit);
      };
      visit(sf);
    }
  }
  return keys;
}

const placeholders = (text: string) =>
  [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

describe("English UI dictionary", () => {
  const keys = collectKeys();

  it("finds the translatable strings (guards the scan itself)", () => {
    expect(keys.size).toBeGreaterThan(300);
  });

  it("has an English entry for every string used in code", () => {
    expect([...keys].filter((key) => !(key in EN))).toEqual([]);
  });

  it("has no stale entries", () => {
    expect(Object.keys(EN).filter((key) => !keys.has(key))).toEqual([]);
  });

  it("keeps the same {placeholders} in both languages", () => {
    const mismatched = Object.entries(EN).filter(
      ([key, value]) => placeholders(key).join() !== placeholders(value).join(),
    );
    expect(mismatched.map(([key]) => key)).toEqual([]);
  });

  it("never leaves Arabic script in an English value", () => {
    const leaked = Object.entries(EN).filter(([, value]) =>
      /[؀-ۿ]/.test(value),
    );
    expect(leaked.map(([key]) => key)).toEqual([]);
  });
});

describe("translate", () => {
  it("returns the Arabic source unchanged for ar and fills {params}", () => {
    expect(translate("ar", "مسح {label}", { label: "Codex" })).toBe(
      "مسح Codex",
    );
  });

  it("looks the source up for en, falling back to the source", () => {
    expect(translate("en", "مسح {label}", { label: "Codex" })).toBe(
      "Clear Codex",
    );
    expect(translate("en", "نص بلا ترجمة")).toBe("نص بلا ترجمة");
  });

  it("leaves unknown placeholders alone", () => {
    expect(translate("en", "مسح {label}", { other: 1 })).toBe("Clear {label}");
  });
});
