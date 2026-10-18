"use client";

import { KeyRound, TerminalSquare, Trash2, X } from "lucide-react";
import { useState } from "react";
import { GeminiKeyGuide } from "@/components/gemini-key-guide";
import { AGENT_OPTIONS, DEFAULT_BRIDGE_URL } from "@/lib/bridge/agents";
import { checkBridge } from "@/lib/services/agent-service";
import { providers } from "@/lib/providers/registry";
import type { ProviderConfig } from "@/lib/types";

export type KeyStatus =
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
  if (signal === "user_key_invalid") return "invalid";
  return signal ? "unreachable" : "idle";
}

export const dotClass: Record<KeyStatus, string> = {
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

/** One-word status shown inline next to the masked key. */
const statusLabel: Partial<Record<KeyStatus, string>> = {
  ok: "يعمل",
  invalid: "مرفوض",
  quota: "الحصة منتهية",
  unreachable: "تعذّر الفحص",
};

/** Short actionable hint — surfaced only on failure states. */
const statusHint: Partial<Record<KeyStatus, string>> = {
  invalid: "تأكد أنه منسوخ كاملاً من AI Studio ويبدأ بـ AQ.",
  quota: "راجع حصتك في AI Studio.",
  unreachable: "أعد المحاولة بعد قليل أو راجع الاتصال.",
};

interface Props {
  open: boolean;
  onClose: () => void;
  config: ProviderConfig;
  onChange: (config: ProviderConfig) => void;
  /** Latest user-key evidence — a run result or a manual verify — bound to the key it saw. */
  keySignal?: { key: string; signal: string } | null;
  /** Reports a fresh verify result into the shared signal channel. */
  onSignal?: (next: { key: string; signal: string }) => void;
}

export function SettingsModal({
  open,
  onClose,
  config,
  onChange,
  keySignal,
  onSignal,
}: Props) {
  const [checking, setChecking] = useState(false);
  const [bridgeStatus, setBridgeStatus] = useState<
    "idle" | "checking" | "ok" | "bad_token" | "offline"
  >("idle");

  async function verifyBridge() {
    if (bridgeStatus === "checking") return;
    setBridgeStatus("checking");
    try {
      const result = await checkBridge({
        url: config.bridgeUrl ?? DEFAULT_BRIDGE_URL,
        token: config.bridgeToken ?? "",
      });
      setBridgeStatus(
        result.state === "ok"
          ? "ok"
          : result.state === "bad_token"
            ? "bad_token"
            : "offline",
      );
    } catch {
      setBridgeStatus("offline");
    }
  }

  const userKey = config.userKey ?? "";
  const signal =
    keySignal && keySignal.key === userKey ? keySignal.signal : null;
  const status: KeyStatus = checking ? "checking" : statusFromKeySignal(signal);

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
      onSignal?.({
        key,
        signal:
          response.ok && payload.fallback === false
            ? "ok"
            : (payload.errorCode ?? "unreachable"),
      });
    } catch {
      onSignal?.({ key, signal: "unreachable" });
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
      <div className="w-full max-w-md border border-ink bg-white p-6 shadow-hard">
        <div className="mb-6 flex items-center justify-between border-b border-slate-200 pb-4">
          <button
            onClick={onClose}
            className="border border-slate-300 p-2 text-slate-500 transition hover:border-ink hover:bg-slate-50"
            aria-label="إغلاق"
          >
            <X size={20} />
          </button>
          <div>
            <h2 className="text-lg font-bold">إعدادات النموذج</h2>
            <p className="font-mono text-[11px] text-slate-500">
              ENGINE — Google Gemini
            </p>
          </div>
        </div>
        <div className="space-y-4">
          <label className="block text-sm font-semibold">
            النموذج
            <select
              id="model"
              name="model"
              className="mt-2 w-full border border-slate-300 bg-white p-3 font-mono text-sm outline-none focus:border-ink"
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
                className="w-full border border-slate-300 bg-white py-3 pr-10 pl-3 font-mono text-sm outline-none focus:border-ink"
                dir="ltr"
              />
            </div>
          </label>
          {userKey ? (
            <div
              className={`border border-slate-300 px-3 py-2 text-xs ${chipTone[status]}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${dotClass[status]}`}
                    aria-hidden="true"
                  />
                  <span dir="ltr" className="font-semibold">
                    ••••{userKey.slice(-4)}
                  </span>
                  {statusLabel[status] ? (
                    <span className="font-bold">{statusLabel[status]}</span>
                  ) : null}
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
              {statusHint[status] ? (
                <p className="mt-1 leading-5">{statusHint[status]}</p>
              ) : null}
            </div>
          ) : null}
          <GeminiKeyGuide />
          <div className="border-t border-slate-200 pt-4">
            <p className="flex items-center gap-2 text-sm font-bold">
              <TerminalSquare size={16} className="text-violet-600" />
              جسر وكيل CLI{" "}
              <span className="font-normal text-slate-400">
                اختياري — إرسال النص المنقّح إلى وكيل محلي
              </span>
            </p>
            <label className="mt-3 block text-sm font-semibold">
              عنوان الجسر
              <input
                id="bridge-url"
                name="bridge-url"
                type="text"
                dir="ltr"
                autoComplete="off"
                value={config.bridgeUrl ?? ""}
                onChange={(event) => {
                  onChange({ ...config, bridgeUrl: event.target.value });
                  setBridgeStatus("idle");
                }}
                placeholder={DEFAULT_BRIDGE_URL}
                className="mt-2 w-full border border-slate-300 bg-white p-3 font-mono text-sm outline-none focus:border-ink"
              />
            </label>
            <label className="mt-3 block text-sm font-semibold">
              توكن الجسر
              <input
                id="bridge-token"
                name="bridge-token"
                type="password"
                dir="ltr"
                autoComplete="off"
                value={config.bridgeToken ?? ""}
                onChange={(event) => {
                  onChange({
                    ...config,
                    bridgeToken: event.target.value.trim(),
                  });
                  setBridgeStatus("idle");
                }}
                placeholder="يُطبع في الطرفية عند تشغيل npm run bridge"
                className="mt-2 w-full border border-slate-300 bg-white p-3 font-mono text-sm outline-none focus:border-ink"
              />
            </label>
            <div className="mt-3 flex items-center gap-3">
              <label className="block flex-1 text-sm font-semibold">
                الوكيل
                <select
                  id="agent"
                  name="agent"
                  className="mt-2 w-full border border-slate-300 bg-white p-3 font-mono text-sm outline-none focus:border-ink"
                  value={config.agent ?? AGENT_OPTIONS[0].id}
                  onChange={(event) =>
                    onChange({ ...config, agent: event.target.value })
                  }
                >
                  {AGENT_OPTIONS.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={verifyBridge}
                disabled={bridgeStatus === "checking"}
                className="mt-7 shrink-0 border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-600 transition hover:border-ink hover:text-ink disabled:opacity-50"
              >
                {bridgeStatus === "checking" ? "يفحص…" : "فحص الاتصال"}
              </button>
            </div>
            {bridgeStatus !== "idle" && bridgeStatus !== "checking" && (
              <p
                role="status"
                className={`mt-2 border px-3 py-2 text-xs ${
                  bridgeStatus === "ok"
                    ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                    : "border-amber-300 bg-amber-50 text-amber-800"
                }`}
              >
                {bridgeStatus === "ok"
                  ? "الجسر متصل وجاهز لاستقبال البرومبتات."
                  : bridgeStatus === "bad_token"
                    ? "التوكن مرفوض — انسخ التوكن الظاهر في طرفية الجسر كاملاً."
                    : "لا يوجد جسر على هذا العنوان — شغّله بأمر npm run bridge."}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="mt-6 w-full border border-ink bg-ink py-3 font-bold text-white transition hover:bg-slate-800"
        >
          تم
        </button>
      </div>
    </div>
  );
}
