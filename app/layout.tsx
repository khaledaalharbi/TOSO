import type { Metadata } from "next";
import { cookies } from "next/headers";
import "@fontsource/tajawal/400.css";
import "@fontsource/tajawal/500.css";
import "@fontsource/tajawal/700.css";
import "@fontsource/geist-mono/400.css";
import "@fontsource/geist-mono/500.css";
import "@fontsource/geist-mono/700.css";
import "./globals.css";
import { I18nProvider } from "@/components/i18n-provider";
import {
  DEFAULT_LANG,
  LANG_COOKIE,
  dirOf,
  isLang,
  translate,
  type Lang,
} from "@/lib/i18n";

async function requestLang(): Promise<Lang> {
  const value = (await cookies()).get(LANG_COOKIE)?.value;
  return isLang(value) ? value : DEFAULT_LANG;
}

export async function generateMetadata(): Promise<Metadata> {
  const lang = await requestLang();
  return {
    title: translate(lang, "مُحسّن التلقينة العربية"),
    description: translate(lang, "نموذج أولي لتحليل وتحسين تكلفة التلقينات العربية"),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const lang = await requestLang();
  return (
    <html lang={lang} dir={dirOf(lang)}>
      <body>
        <I18nProvider initialLang={lang}>{children}</I18nProvider>
      </body>
    </html>
  );
}
