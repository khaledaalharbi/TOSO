import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ArabicOnDemand } from "./arabic-on-demand";

describe("ArabicOnDemand", () => {
  it("offers the Arabic version as a button and translates nothing up front", () => {
    const html = renderToStaticMarkup(
      <ArabicOnDemand
        english="Summarize the report."
        model="gemini-3.8-flash"
      />,
    );
    expect(html).toContain("عرض النسخة العربية");
    expect(html).not.toContain("للقراءة فقط");
    expect(html).not.toContain("disabled=");
  });
});
