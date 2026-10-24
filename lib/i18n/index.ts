/**
 * Source-keyed UI translation. The Arabic source text IS the key: code reads
 * naturally in the app's primary language, Arabic needs no dictionary, and a
 * test (i18n-coverage.test.ts) proves every key has an English entry.
 *
 *   t("حفظ")                           → "Save" in English
 *   t("{n} جلسات", { n: 3 })           → "3 sessions" in English
 *
 * React components get `t` from `useI18n()` (request-safe, re-renders on
 * switch). Plain client-side code (service messages built inside event
 * handlers) uses the module-level `t`, which follows the language last
 * announced through `setCurrentLang`.
 */

import { EN } from "@/lib/i18n/en";

export type Lang = "ar" | "en";

export const LANG_COOKIE = "toso-lang";
export const DEFAULT_LANG: Lang = "ar";

export function isLang(value: unknown): value is Lang {
  return value === "ar" || value === "en";
}

export function dirOf(lang: Lang): "rtl" | "ltr" {
  return lang === "ar" ? "rtl" : "ltr";
}

export type TParams = Record<string, string | number>;

export function translate(
  lang: Lang,
  source: string,
  params?: TParams,
): string {
  const text = lang === "ar" ? source : (EN[source] ?? source);
  return params
    ? text.replace(/\{(\w+)\}/g, (match: string, key: string) =>
        key in params ? String(params[key]) : match,
      )
    : text;
}

/** Marks a string that is translated later (module-level tables); identity at runtime. */
export const tx = (source: string): string => source;

let currentLang: Lang = DEFAULT_LANG;

export const getCurrentLang = (): Lang => currentLang;

export function setCurrentLang(lang: Lang): void {
  currentLang = lang;
}

/** For non-React client code — follows the language the provider announced. */
export const t = (source: string, params?: TParams): string =>
  translate(currentLang, source, params);
