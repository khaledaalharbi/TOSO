"use client";

import { Languages } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import type { Lang } from "@/lib/i18n";

const options: { code: Lang; label: string }[] = [
  { code: "ar", label: "العربية" },
  { code: "en", label: "English" },
];

/**
 * Header switch between the two supported UI languages. Each option is
 * written in its own language so it can be found whichever is active; the
 * choice is remembered in a cookie so the first paint already matches it.
 */
export function LanguageToggle() {
  const { lang, setLang, t } = useI18n();
  return (
    <div
      role="group"
      aria-label={t("لغة الواجهة")}
      dir="ltr"
      className="flex items-stretch border border-ink bg-white text-xs font-bold"
    >
      <span
        aria-hidden="true"
        className="flex items-center border-e border-slate-300 px-2 text-slate-500"
      >
        <Languages size={14} />
      </span>
      {options.map(({ code, label }) => {
        const active = lang === code;
        return (
          <button
            key={code}
            type="button"
            lang={code}
            aria-pressed={active}
            onClick={() => setLang(code)}
            className={`px-3 py-2 transition ${
              active
                ? "bg-ink text-white"
                : "text-slate-600 hover:bg-slate-50 hover:text-ink"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
