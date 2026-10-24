"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_LANG,
  LANG_COOKIE,
  dirOf,
  setCurrentLang,
  translate,
  type Lang,
  type TParams,
} from "@/lib/i18n";

export interface I18n {
  lang: Lang;
  dir: "rtl" | "ltr";
  t: (source: string, params?: TParams) => string;
  setLang: (lang: Lang) => void;
}

const fallback: I18n = {
  lang: DEFAULT_LANG,
  dir: dirOf(DEFAULT_LANG),
  t: (source, params) => translate(DEFAULT_LANG, source, params),
  setLang: () => {},
};

const I18nContext = createContext<I18n>(fallback);

/** One year — the choice is a stable preference, read on the server for the first paint. */
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function I18nProvider({
  initialLang,
  children,
}: {
  initialLang: Lang;
  children: ReactNode;
}) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  setCurrentLang(lang);

  const setLang = useCallback((next: Lang) => {
    document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
    setLangState(next);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = lang;
    root.dir = dirOf(lang);
    document.title = translate(lang, "مُحسّن التلقينة العربية");
  }, [lang]);

  const value = useMemo<I18n>(
    () => ({
      lang,
      dir: dirOf(lang),
      t: (source, params) => translate(lang, source, params),
      setLang,
    }),
    [lang, setLang],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = (): I18n => useContext(I18nContext);
