"use client";

import { KeyRound, Trash2, X } from "lucide-react";
import { useState } from "react";
import { GeminiKeyGuide } from "@/components/gemini-key-guide";
import { providers } from "@/lib/providers/registry";
import type { ProviderConfig } from "@/lib/types";

type KeyStatus =
  | "idle"
  | "checking"
  | "ok"
  | "invalid"
  | "quota"
  | "unreachable";

/**
 * Maps a user-key signal (route errorCode, verify result, or "ok" from a
 * served run) to an honest status. Unknown codes are "unreachable" — the
 * key's health is unproven, not claimed.
 */
export function statusFromKeySignal(
  signal: string | null | undefined,
): KeyStatus {
  if (signal === "ok") return "ok";
  if (signal === "user_key_quota") return "quota";
  if (signal === "unreachable") return "unreachable";
  if (signal?.startsWith("user_key_")) return "invalid";
  return signal ? "unreachable" : "idle";
}

const dotClass: Record<KeyStatus, string> = {
  idle: "bg-slate-300",
  checking: "bg-brand-400 animate-pulse",
  ok: "bg-emerald-500",
  invalid: "bg-rose-500",
  quota: "bg-amber-500",
  unreachable: "bg-slate-400",
};

const chipTone: Record<KeyStatus, string> = {
  idle: "bg-sky-50 text-sky-800",
  checking: "bg-sky-50 text-sky-800",
  ok: "bg-emerald-50 text-emerald-800",
  invalid: "bg-rose-50 text-rose-800",
  quota: "bg-amber-50 text-amber-800",
  unreachable: "bg-sky-50 text-sky-800",
};

const statusMessage: Partial<Record<KeyStatus, string>> = {
  ok: "تحقّقت Google من المفتاح الآن — الطلبات تُحمَّل على حصتك.",
  invalid:
    "Google رفض هذا المفتاح — تأكد أنه منسوخ كاملاً من AI Studio ويبدأ بـ AQ.",
  quota: "حصة مفتاحك مستنزفة مؤقتاً — راجع حسابك في AI Studio.",
  unreachable: "تعذّر الفحص الآن — لم يُتحقق من المفتاح (شبكة أو خادم).",
};

interface Props {
  open: boolean;
  onClose: () => void;
  config: ProviderConfig;
  onChange: (config: ProviderConfig) => void;
  /** Latest user-key evidence from the run loop, bound to the key it saw. */
  keySignal?: { key: string; signal: string } | null;
}

export function SettingsModal({
  open,
  onClose,
  config,
  onChange,
  keySignal,
}: Props) {
  const [checking, setChecking] = useState(false);
  // A manual verify is honored only while the same key + latest run signal
  // hold — editing the key or a newer run re-derives instead of showing a
  // stale result.
  const [check, setCheck] = useState<{
    key: string;
    signal: string | null;
    status: KeyStatus;
  } | null>(null);

  const userKey = config.userKey ?? "";
  const signal =
    keySignal && keySignal.key === userKey ? keySignal.signal : null;
  const status: KeyStatus = checking
    ? "checking"
    : check && check.key === userKey && check.signal === signal
      ? check.status
      : signal
        ? statusFromKeySignal(signal)
        : "idle";

  async function verifyKey() {
    const key = config.userKey?.trim();
    if (!key || checking) return;
    setChecking(true);
    try {
      const response = await fetch("/api/tokens/count", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-gemini-key": key,
        },
        body: JSON.stringify({ text: "اختبار", model: config.model }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        fallback?: boolean;
        errorCode?: string;
      };
      setCheck({
        key,
        signal,
        status:
          response.ok && payload.fallback === false
            ? "ok"
            : statusFromKeySignal(payload.errorCode ?? "unreachable"),
      });
    } catch {
      setCheck({ key, signal, status: "unreachable" });
    } finally {
      setChecking(false);
    }
  }

  if (!open) return null;
  const options = providers.google.models;
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="الإعدادات"
    >
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"
            aria-label="إغلاق"
          >
            <X size={20} />
          </button>
          <div>
            <h2 className="text-lg font-bold">إعدادات النموذج</h2>
            <p className="text-sm text-slate-500">
              محرك المعالجة: Google Gemini
            </p>
          </div>
        </div>
        <div className="space-y-4">
          <label className="block text-sm font-semibold">
            النموذج
            <select
              id="model"
              name="model"
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 outline-none focus:border-brand-500"
              value={config.model}
              onChange={(event) =>
                onChange({ ...config, model: event.target.value })
              }
            >
              {options.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-semibold">
            مفتاح Gemini الخاص بك{" "}
            <span className="font-normal text-slate-400">
              اختياري — استخدم حصتك أنت (BYOK)
            </span>
            <div className="relative mt-2">
              <KeyRound
                className="absolute right-3 top-3 text-slate-400"
                size={18}
              />
              <input
                id="user-gemini-key"
                name="user-gemini-key"
                type="password"
                autoComplete="off"
                value={userKey}
                onChange={(event) =>
                  onChange({ ...config, userKey: event.target.value.trim() })
                }
                placeholder="مفتاح AI Studio — يُحفظ في متصفحك فقط"
                className="w-full rounded-xl border border-slate-200 py-3 pr-10 pl-3 outline-none focus:border-brand-500"
                dir="ltr"
              />
            </div>
          </label>
          {userKey ? (
            <div className={`rounded-xl px-3 py-2 text-xs ${chipTone[status]}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${dotClass[status]}`}
                    aria-hidden="true"
                  />
                  <span className="truncate">
                    مفتاح محفوظ في متصفحك — تُحمَّل الطلبات على حصتك (
                    <span dir="ltr">••••{userKey.slice(-4)}</span>)
                  </span>
                </span>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={verifyKey}
                    disabled={checking}
                    className="font-bold underline underline-offset-2 hover:opacity-80 disabled:opacity-50"
                  >
                    {checking ? "يفحص…" : "تحقق"}
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange({ ...config, userKey: undefined })}
                    className="flex items-center gap-1 font-bold text-rose-600 hover:text-rose-700"
                  >
                    <Trash2 size={14} />
                    مسح
                  </button>
                </div>
              </div>
              {statusMessage[status] ? (
                <p className="mt-1.5 leading-5">{statusMessage[status]}</p>
              ) : null}
            </div>
          ) : null}
          <GeminiKeyGuide />
        </div>
        <button
          onClick={onClose}
          className="mt-6 w-full rounded-xl bg-ink py-3 font-bold text-white hover:bg-slate-800"
        >
          تم
        </button>
      </div>
    </div>
  );
}
