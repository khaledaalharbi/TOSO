"use client";

import { KeyRound, ShieldCheck, Trash2, X } from "lucide-react";
import { providers } from "@/lib/providers/registry";
import type { ProviderConfig } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  config: ProviderConfig;
  onChange: (config: ProviderConfig) => void;
}

export function SettingsModal({ open, onClose, config, onChange }: Props) {
  if (!open) return null;
  const options = providers.google.models;
  const userKey = config.userKey ?? "";
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
            <div className="flex items-center justify-between rounded-xl bg-sky-50 px-3 py-2 text-xs text-sky-800">
              <span>
                مفتاح محفوظ في متصفحك — تُحمَّل الطلبات على حصتك (
                <span dir="ltr">••••{userKey.slice(-4)}</span>)
              </span>
              <button
                type="button"
                onClick={() => onChange({ ...config, userKey: undefined })}
                className="flex items-center gap-1 font-bold text-rose-600 hover:text-rose-700"
              >
                <Trash2 size={14} />
                مسح
              </button>
            </div>
          ) : null}
          <div className="flex gap-2 rounded-xl bg-emerald-50 p-3 text-xs leading-5 text-emerald-800">
            <ShieldCheck className="shrink-0" size={18} />
            <span>
              أنشئ مفتاحاً مجانياً من <span dir="ltr">aistudio.google.com</span>
              . يُحفظ في localStorage بجهازك ويُرسل إلى خادمك المحلي مع كل طلب —
              لا يُخزَّن ولا يُسجَّل في الخادم. بدونه يُستخدم مفتاح الخادم إن
              وُجد، وإلا تعمل التنقية المحلية.
            </span>
          </div>
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
