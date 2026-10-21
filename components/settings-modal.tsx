"use client";

import {
  Check,
  ChevronDown,
  CircleHelp,
  KeyRound,
  Languages,
  Sparkles,
  TerminalSquare,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { GeminiKeyGuide } from "@/components/gemini-key-guide";
import { AGENT_OPTIONS, DEFAULT_BRIDGE_URL } from "@/lib/bridge/agents";
import {
  checkBridge,
  discoverBridge,
  type BridgeConfig,
} from "@/lib/services/agent-service";
import {
  checkAvailableModels,
  type ModelCheckResponse,
} from "@/lib/services/model-service";
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
  idle: "محفوظ",
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

/** Collapsible settings group — closed by default, expands on click. */
function Section({
  icon,
  title,
  hint,
  badge,
  children,
}: {
  icon: ReactNode;
  title: string;
  hint?: string;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <details className="group border border-slate-200">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-bold [&::-webkit-details-marker]:hidden">
        <span className="flex flex-wrap items-center gap-2">
          {icon}
          {title}
          {hint ? (
            <span className="text-xs font-normal text-slate-400">{hint}</span>
          ) : null}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          {badge}
          <ChevronDown
            size={14}
            className="text-slate-400 transition-transform group-open:rotate-180"
          />
        </span>
      </summary>
      <div className="space-y-4 border-t border-slate-200 px-4 py-4">
        {children}
      </div>
    </details>
  );
}

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
  const [modelCheck, setModelCheck] = useState<
    | "idle"
    | "checking"
    | { state: "ok"; data: Extract<ModelCheckResponse, { state: "ok" }> }
    | "no_key"
    | "offline"
  >("idle");
  const [serverKey, setServerKey] = useState<
    "idle" | "checking" | "active" | "none" | "offline"
  >("idle");
  const [bridgeSession, setBridgeSession] = useState<BridgeConfig | null>(null);
  const [showBridgeHelp, setShowBridgeHelp] = useState(false);

  async function verifyModels() {
    if (modelCheck === "checking") return;
    setModelCheck("checking");
    const result = await checkAvailableModels(
      config.userKey?.trim() || undefined,
    );
    setModelCheck(
      result.state === "ok" ? { state: "ok", data: result } : result.state,
    );
  }

  const unavailableModels =
    typeof modelCheck === "object" && modelCheck.state === "ok"
      ? new Set(
          modelCheck.data.results.filter((r) => !r.available).map((r) => r.id),
        )
      : new Set<string>();

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

  // Server-key probe — the server key never reaches the browser, so the only
  // honest signal is one free countTokens call without a user-key header.
  useEffect(() => {
    if (!open || userKey) {
      setServerKey("idle");
      return;
    }
    let cancelled = false;
    setServerKey("checking");
    fetch("/api/tokens/count", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "تم", model: config.model }),
    })
      .then(async (response) => {
        if (cancelled) return;
        const payload = (await response.json().catch(() => ({}))) as {
          fallback?: boolean;
        };
        setServerKey(
          response.ok && payload.fallback === false ? "active" : "none",
        );
      })
      .catch(() => {
        if (!cancelled) setServerKey("offline");
      });
    return () => {
      cancelled = true;
    };
  }, [open, userKey, config.model]);

  // Ask the app for the live bridge's published session so the manual fields
  // can show it as a placeholder instead of a bare default.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    discoverBridge().then((session) => {
      if (!cancelled) setBridgeSession(session);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

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
  const currentModelLabel =
    options.find((model) => model.id === config.model)?.label ?? config.model;
  const keyBadge = userKey ? (
    <span
      className={`flex items-center gap-1 text-xs font-bold ${
        status === "ok"
          ? "text-emerald-700"
          : status === "invalid"
            ? "text-rose-700"
            : status === "quota"
              ? "text-amber-700"
              : "text-slate-600"
      }`}
    >
      <Check size={14} />
      {status === "ok" ? "يعمل" : (statusLabel[status] ?? "محفوظ")}
    </span>
  ) : serverKey === "active" ? (
    <span className="flex items-center gap-1 text-xs font-bold text-emerald-700">
      <Check size={14} /> مفتاح الخادم
    </span>
  ) : serverKey === "checking" ? (
    <span className="text-xs text-slate-400">يفحص…</span>
  ) : serverKey === "none" ? (
    <span className="text-xs font-bold text-amber-700">لا مفتاح</span>
  ) : serverKey === "offline" ? (
    <span className="text-xs text-slate-500">تعذّر الفحص</span>
  ) : null;
  const bridgeReady = Boolean(
    (config.bridgeToken?.trim() || bridgeSession?.token) &&
    (config.bridgeUrl?.trim() || bridgeSession?.url),
  );
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="الإعدادات"
    >
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto border border-ink bg-white p-6 shadow-hard">
        <div className="mb-6 flex items-center justify-between border-b border-slate-200 pb-4">
          <button
            onClick={onClose}
            className="border border-slate-300 p-2 text-slate-500 transition hover:border-ink hover:bg-slate-50"
            aria-label="إغلاق"
          >
            <X size={20} />
          </button>
          <div>
            <h2 className="text-lg font-bold">الإعدادات</h2>
            <p className="font-mono text-[11px] text-slate-500">
              ENGINE — Google Gemini
            </p>
          </div>
        </div>
        <div className="space-y-3">
          <Section
            icon={<KeyRound size={16} className="text-brand-600" />}
            title="المفتاح والوصول"
            hint="BYOK أو مفتاح الخادم"
            badge={keyBadge}
          >
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
                      onClick={() =>
                        onChange({ ...config, userKey: undefined })
                      }
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
            ) : serverKey === "checking" ? (
              <p className="border border-slate-300 px-3 py-2 text-xs text-slate-500">
                يُفحص مفتاح الخادم…
              </p>
            ) : serverKey === "active" ? (
              <p className="flex items-center gap-1.5 border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">
                <Check size={14} /> يُستخدم مفتاح الخادم — لا حاجة لمفتاحك.
              </p>
            ) : serverKey === "none" ? (
              <p className="border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                لا مفتاح على الإطلاق — أضف مفتاحك هنا أو اضبط مفتاح الخادم، وإلا
                تعمل التنقية المحلية فقط.
              </p>
            ) : serverKey === "offline" ? (
              <p className="border border-slate-300 px-3 py-2 text-xs text-slate-500">
                تعذّر فحص مفتاح الخادم — الخادم غير متاح.
              </p>
            ) : null}
            <GeminiKeyGuide />
          </Section>
          <Section
            icon={<Sparkles size={16} className="text-brand-600" />}
            title="النموذج"
            hint="المعالجة والترجمة"
            badge={
              <span className="font-mono text-xs text-slate-500" dir="ltr">
                {currentModelLabel}
              </span>
            }
          >
            <label className="block text-sm font-semibold">
              نموذج المعالجة والترجمة
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
                    {unavailableModels.has(model.id) ? " — غير متاح" : ""}
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-2">
              <button
                type="button"
                onClick={verifyModels}
                disabled={modelCheck === "checking"}
                className="border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:border-ink hover:text-ink disabled:opacity-50"
              >
                {modelCheck === "checking"
                  ? "يفحص النماذج…"
                  : "تحقق من النماذج"}
              </button>
              {modelCheck === "no_key" ? (
                <p className="mt-2 border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  لا يوجد مفتاح للفحص — أضف مفتاحك أعلاه أو اضبط مفتاح الخادم.
                </p>
              ) : null}
              {modelCheck === "offline" ? (
                <p className="mt-2 border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  تعذّر الوصول — راجع الاتصال وأعد المحاولة.
                </p>
              ) : null}
              {typeof modelCheck === "object" && modelCheck.state === "ok" ? (
                <div className="mt-2 space-y-1.5 border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                  {modelCheck.data.results.map((result) => (
                    <div key={result.id} className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${result.available ? "bg-emerald-500" : "bg-rose-500"}`}
                        aria-hidden="true"
                      />
                      <span className="font-mono font-semibold" dir="ltr">
                        {result.id}
                      </span>
                      {!result.available ? (
                        <span className="text-slate-500">
                          {result.status === 429
                            ? "الحصة منتهية"
                            : result.status === "network"
                              ? "تعذّر الوصول"
                              : `http_${result.status}`}
                        </span>
                      ) : null}
                    </div>
                  ))}
                  {modelCheck.data.extras?.length ? (
                    <p className="pt-1 leading-5 text-slate-600">
                      نماذج أخرى متاحة لحسابك غير مسجلة بعد:{" "}
                      <span dir="ltr" className="font-mono">
                        {modelCheck.data.extras.join("، ")}
                      </span>
                    </p>
                  ) : null}
                  <p className="text-slate-400">
                    عبر {modelCheck.data.viaUserKey ? "مفتاحك" : "مفتاح الخادم"}{" "}
                    — فحص حرّ بلا تكلفة
                  </p>
                </div>
              ) : null}
            </div>
          </Section>
          <Section
            icon={<TerminalSquare size={16} className="text-sky-600" />}
            title="جسر وكيل CLI"
            hint="إرسال الناتج إلى وكيل محلي — اختياري"
            badge={
              bridgeReady ? (
                <span className="flex items-center gap-1 text-xs font-bold text-emerald-700">
                  <Check size={14} /> مُهيأ
                </span>
              ) : null
            }
          >
            <button
              type="button"
              onClick={() => setShowBridgeHelp((v) => !v)}
              aria-expanded={showBridgeHelp}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-500 transition hover:text-ink"
            >
              <CircleHelp size={15} />
              ما الجسر؟
            </button>
            {showBridgeHelp ? (
              <div className="border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs leading-6 text-slate-600">
                <p>
                  الجسر خادم صغير على جهازك (
                  <code dir="ltr">bin/toso-bridge.mjs</code>) — المتصفح لا
                  يستطيع تشغيل الوكيل، فيستقبل الجسر طلبات الواجهة ويشغّل الوكيل
                  في مجلد مشروعك.
                </p>
                <p className="mt-1">
                  <b>عنوان الجسر:</b> أين يستمع (الافتراضي{" "}
                  <code dir="ltr">http://127.0.0.1:8676</code>).{" "}
                  <b>توكن الجسر:</b> كلمة سر مؤقتة يولّدها الجسر كل تشغيل ويرفض
                  الطلبات بدونها — لا تخرج من جهازك.
                </p>
                <p className="mt-1 font-semibold text-slate-700">
                  القاعدة البسيطة: كلما كان الجسر على جهازك بالإعدادات
                  الافتراضية لا تلمس الحقلين؛ كلما خرج عن الافتراضي تكتبهما
                  بنفسك.
                </p>
              </div>
            ) : null}
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
                placeholder={bridgeSession?.url ?? DEFAULT_BRIDGE_URL}
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
                placeholder={
                  bridgeSession
                    ? `••••${bridgeSession.token.slice(-6)}`
                    : "يُطبع في الطرفية عند تشغيل npm run bridge"
                }
                className="mt-2 w-full border border-slate-300 bg-white p-3 font-mono text-sm outline-none focus:border-ink"
              />
            </label>
            {bridgeSession &&
            !config.bridgeUrl?.trim() &&
            !config.bridgeToken?.trim() ? (
              <p className="text-xs leading-5 text-slate-500">
                الرمادية أعلاه هي قيم الجسر العامل — اكتُشفت تلقائياً وتُستخدم
                كما هي ما دام الحقل فارغاً.
              </p>
            ) : null}
            <div className="mt-3 flex items-center gap-3">
              <label className="block flex-1 text-sm font-semibold">
                الوكيل الافتراضي
                <span className="block text-xs font-normal text-slate-500">
                  تبويبه يُفتح أولاً. لكل وكيل مدخله الخاص، والإرسال المباشر
                  مفتاح داخل مدخل كل وكيل.
                </span>
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
                  ? "الجسر متصل وجاهز لاستقبال التلقينات."
                  : bridgeStatus === "bad_token"
                    ? "التوكن مرفوض — انسخ التوكن الظاهر في طرفية الجسر كاملاً."
                    : "لا يوجد جسر على هذا العنوان — شغّله بأمر npm run bridge."}
              </p>
            )}
          </Section>
          <Section
            icon={<Languages size={16} className="text-emerald-600" />}
            title="ردود الوكيل (تبويب OUT)"
            hint="الترجمة والتنظيف"
          >
            <label className="mt-3 flex cursor-pointer items-start gap-2.5 border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold">
              <input
                id="auto-translate"
                name="auto-translate"
                type="checkbox"
                checked={config.autoTranslate ?? false}
                onChange={(event) =>
                  onChange({ ...config, autoTranslate: event.target.checked })
                }
                className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600"
              />
              <span>
                ترجمة تلقائية لكل رد
                <span className="block text-xs font-normal leading-5 text-slate-500">
                  مفعّل: يظهر كل رد بالعربية فور التقاطه (استدعاء ترجمة لكل رد).
                  معطّل: زر «ترجمة» بجانب كل رد تضغطه عند الحاجة.
                </span>
              </span>
            </label>
            <label className="mt-3 flex cursor-pointer items-start gap-2.5 border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold">
              <input
                id="smart-clean"
                name="smart-clean"
                type="checkbox"
                checked={config.smartClean ?? false}
                onChange={(event) =>
                  onChange({ ...config, smartClean: event.target.checked })
                }
                className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600"
              />
              <span>
                تنظيف ذكي للمخرجات عبر Gemini
                <span className="block text-xs font-normal leading-5 text-slate-500">
                  بعد الاستخراج المحلي من شاشة الطرفية، تمرّر Gemini الالتقاط
                  لتجمع الأسطر المكسورة بعرض الطرفية وتحذف بقايا الواجهة. يُرفض
                  أي ناتج فيه كلمات ليست في الالتقاط، ويبقى الاستخراج المحلي.
                </span>
              </span>
            </label>
          </Section>
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
