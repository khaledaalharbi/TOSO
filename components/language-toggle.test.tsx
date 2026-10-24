import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { I18nProvider } from "./i18n-provider";
import { LanguageToggle } from "./language-toggle";

const render = (lang: "ar" | "en") =>
  renderToStaticMarkup(
    <I18nProvider initialLang={lang}>
      <LanguageToggle />
    </I18nProvider>,
  );

describe("LanguageToggle", () => {
  it("offers both languages, each written in its own language", () => {
    const html = render("ar");
    expect(html).toContain(">العربية<");
    expect(html).toContain(">English<");
  });

  it("marks the active language as pressed and labels the group per UI language", () => {
    const ar = render("ar");
    expect(ar).toMatch(/aria-pressed="true"[^>]*>العربية</);
    expect(ar).toContain('aria-label="لغة الواجهة"');
    const en = render("en");
    expect(en).toMatch(/aria-pressed="true"[^>]*>English</);
    expect(en).toContain('aria-label="Interface language"');
  });
});
