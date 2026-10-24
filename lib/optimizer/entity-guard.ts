export interface EntityIssue {
  kind: "url" | "variable" | "identifier" | "number" | "quote";
  value: string;
}

export interface EntityCheck {
  preserved: boolean;
  checked: number;
  missing: EntityIssue[];
}

const entityPattern =
  /(https?:\/\/[^\s،<>"'`]+)|(\{\{\s*[A-Za-z_][A-Za-z0-9_.]*\s*\}\}|\{[A-Za-z_][A-Za-z0-9_]*\})|([A-Za-z][A-Za-z0-9]*(?:_[A-Za-z0-9]+)+)|([0-9٠-٩۰-۹]+(?:[.,٫٬/:-][0-9٠-٩۰-۹]+)*(?:\s?[%٪])?)|("(?:\\.|[^"\\])*"|«[^»]*»|“[^”]*”)/g;
const kinds: EntityIssue["kind"][] = [
  "url",
  "variable",
  "identifier",
  "number",
  "quote",
];

function entities(text: string, includeQuotes: boolean): EntityIssue[] {
  return [...text.matchAll(entityPattern)].flatMap((match) => {
    const kind = kinds.find((_, index) => match[index + 1] !== undefined);
    if (!kind) return [];
    if (kind === "quote") {
      const nested = entities(match[0].slice(1, -1), false);
      return includeQuotes ? [{ kind, value: match[0] }, ...nested] : nested;
    }
    const value =
      kind === "url" ? match[0].replace(/[.!?؟؛،.]+$/, "") : match[0];
    return [{ kind, value }];
  });
}

function key(entity: EntityIssue): string {
  const value =
    entity.kind === "number"
      ? entity.value
          .replace(/[٠-٩۰-۹]/g, (digit) =>
            String("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹".indexOf(digit) % 10),
          )
          .replace(/٪/g, "%")
          .replace(/\s+(?=%)/g, "")
      : entity.value;
  return `${entity.kind}:${value}`;
}

export function checkEntities(
  original: string,
  rewritten: string,
  includeQuotes = true,
): EntityCheck {
  const remaining = new Map<string, number>();
  for (const entity of entities(rewritten, includeQuotes)) {
    const id = key(entity);
    remaining.set(id, (remaining.get(id) ?? 0) + 1);
  }

  const originalEntities = entities(original, includeQuotes);
  const missing = originalEntities.filter((entity) => {
    const id = key(entity);
    const count = remaining.get(id) ?? 0;
    if (count) remaining.set(id, count - 1);
    return !count;
  });
  return {
    preserved: missing.length === 0,
    checked: originalEntities.length,
    missing,
  };
}
