"use client";

import { KeyRound, ShieldCheck, X } from "lucide-react";
import { providers } from "@/lib/providers/registry";
import type { ProviderConfig, ProviderId } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  config: ProviderConfig;
  onChange: (config: ProviderConfig) => void;
}

export function SettingsModal({ open, onClose, config, onChange }: Props) {
  if (!open) return null;
  const options = providers[config.provider].models;
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
              اختيار تجريبي لحساب التكلفة
            </p>
          </div>
        </div>
        <div className="space-y-4">
          <label className="block text-sm font-semibold">
            المزوّد
            <select
              id="provider"
              name="provider"
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 outline-none focus:border-brand-500"
              value={config.provider}
              onChange={(event) => {
                const provider = event.target.value as ProviderId;
                onChange({ provider, model: providers[provider].models[0].id });
              }}
            >
              {Object.entries(providers).map(([id, provider]) => (
                <option key={id} value={id}>
                  {provider.label}
                </option>
              ))}
            </select>
          </label>
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
            مفتاح API{" "}
            <span className="font-normal text-slate-400">
              اختياري في النموذج الأولي
            </span>
            <div className="relative mt-2">
              <KeyRound
                className="absolute right-3 top-3 text-slate-400"
                size={18}
              />
              <input
                id="api-key"
                name="api-key"
                type="password"
                autoComplete="off"
                placeholder="لن يُخزّن أو يُرسل"
                className="w-full rounded-xl border border-slate-200 py-3 pr-10 pl-3 outline-none focus:border-brand-500"
              />
            </div>
          </label>
          <div className="flex gap-2 rounded-xl bg-emerald-50 p-3 text-xs leading-5 text-emerald-800">
            <ShieldCheck className="shrink-0" size={18} />
            <span>
              المفتاح محفوظ في خادم التطوير فقط (.env.local) ولا يُرسل للمتصفح.
              القياس يتم عبر واجهة Google الرسمية.
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
