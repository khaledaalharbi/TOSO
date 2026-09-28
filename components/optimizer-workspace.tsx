"use client";

import {
  Check,
  Coins,
  Copy,
  Gauge,
  Languages,
  Play,
  RotateCcw,
  Settings2,
  Sparkles,
  Wand2,
} from "lucide-react";
import { useState } from "react";
import { SettingsModal } from "@/components/settings-modal";
import type { DualOptimization } from "@/lib/optimizer/llm-optimizer";
import {
  DEFAULT_MODEL,
  DEFAULT_PROVIDER,
  providers,
} from "@/lib/providers/registry";
import { runOptimization } from "@/lib/services/optimization-service";
import { arabicRatio } from "@/lib/token-engine/token-engine";
import type {
  CostEstimate,
  OptimizationReport,
  ProviderConfig,
  TokenMeasurement,
  VariantReport,
} from "@/lib/types";

const sample =
  "من فضلك أريد منك أن تحلل لي أداء الشركة خلال آخر ستة أشهر بشكل مفصل جدا، مع ذكر أهم الاتجاهات والمخاطر والتوصيات.";
const initialConfig: ProviderConfig = {
  provider: DEFAULT_PROVIDER,
  model: DEFAULT_MODEL,
};

const formatCost = (value: number) =>
  value === 0
    ? "مجاني"
    : `$${value < 0.001 ? value.toFixed(5) : value.toFixed(3)}`;

type Phase = "idle" | "analyzing" | "optimizing" | "measuring" | "done";
type NodeStatus = "idle" | "active" | "done";

const runLabel: Record<Exclude<Phase, "idle" | "done">, string> = {
  analyzing: "يقيس الـTokens…",
  optimizing: "يفهم ويعيد الصياغة…",
  measuring: "يقيس الناتج…",
};

export function OptimizerWorkspace() {
  const [prompt, setPrompt] = useState(sample);
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [original, setOriginal] = useState<TokenMeasurement | null>(null);
  const [originalRatio, setOriginalRatio] = useState<number | null>(null);
  const [dual, setDual] = useState<DualOptimization | null>(null);
  const [report, setReport] = useState<OptimizationReport | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [config, setConfig] = useState<ProviderConfig>(initialConfig);

  async function handleRun() {
    if (!prompt.trim() || running) return;
    setRunning(true);
    setReport(null);
    setDual(null);
    setOriginal(null);
    setOriginalRatio(null);
    setPhase("analyzing");
    const nextReport = await runOptimization(prompt, config, {
      onOriginalMeasured: (measurement) => {
        setOriginal(measurement);
        setOriginalRatio(arabicRatio(prompt));
        setPhase("optimizing");
      },
      onOptimized: (optimized) => {
        setDual(optimized);
        setPhase("measuring");
      },
    });
    setReport(nextReport);
    setPhase("done");
    setRunning(false);
  }
  function reset() {
    setReport(null);
    setDual(null);
    setOriginal(null);
    setOriginalRatio(null);
    setPhase("idle");
    setPrompt("");
  }

  const modelLabel = providers[config.provider].models.find(
    (item) => item.id === config.model,
  )?.label;
  const s1: NodeStatus =
    phase === "analyzing" ? "active" : original ? "done" : "idle";
  const s2: NodeStatus =
    phase === "optimizing" ? "active" : dual ? "done" : "idle";
  const s3: NodeStatus =
    phase === "measuring" ? "active" : report ? "done" : "idle";
  const englishUnavailable = dual !== null && dual.english === null;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_80%_0%,#d9faf2,transparent_27%),radial-gradient(circle_at_10%_35%,#e5efff,transparent_24%)] px-4 py-8 sm:px-7">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex items-center justify-between">
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold shadow-sm hover:border-brand-400"
          >
            <Settings2 size={17} /> الإعدادات
          </button>
          <div className="text-right">
            <div className="flex items-center gap-2 text-xl font-black">
              <Sparkles className="text-brand-500" /> مُحسّن البرومبت العربي
            </div>
            <p className="mt-1 text-sm text-slate-500">
              فهم النية، إعادة الصياغة، والترجمة للإنجليزية لتوفير الـTokens
            </p>
          </div>
        </header>

        {/* INPUT */}
        <section className="rounded-3xl bg-ink p-5 text-white shadow-glow sm:p-7">
          <div className="mb-4 flex items-center justify-between">
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs">
              {modelLabel}
            </span>
            <h1 className="text-xl font-bold">اكتب طلبك بالعربية</h1>
          </div>
          <textarea
            id="prompt"
            name="prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="مثال: حلّل لي أداء الشركة خلال آخر ستة أشهر..."
            className="min-h-32 w-full resize-y rounded-2xl border border-white/10 bg-white/10 p-4 leading-8 text-white placeholder:text-slate-400 outline-none transition focus:border-brand-400 focus:bg-white/15"
          />
          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="text-xs text-slate-400">
              يُرسَل النص إلى Gemini للفهم وإعادة الصياغة — المفتاح يبقى على
              الخادم
            </span>
            <button
              disabled={!prompt.trim() || running}
              onClick={handleRun}
              className="flex items-center gap-2 rounded-xl bg-brand-400 px-5 py-3 font-bold text-ink transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {running
                ? (runLabel[phase as keyof typeof runLabel] ?? "جارٍ المعالجة…")
                : "تشغيل التحليل"}
              <Play size={17} fill="currentColor" />
            </button>
          </div>
        </section>

        {/* PIPELINE — containers are fixed; the traveling light shows progress */}
        <div className="mt-6">
          <Beam on={phase === "analyzing"} done={s1 === "done"} />
          <Node
            number={1}
            title="Token Analysis"
            subtitle="قياس النص الأصلي"
            status={s1}
          >
            {original ? (
              <div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <Metric
                    label={
                      original.source === "provider"
                        ? "Tokens حقيقية"
                        : "Tokens تقديرية"
                    }
                    value={original.tokens}
                  />
                  <Metric label="كلمة" value={original.words} />
                  <Metric label="حرف" value={original.characters} />
                </div>
                {originalRatio !== null && (
                  <div className="mt-3 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs">
                    <span className="font-bold text-slate-500">
                      نسبة العربية
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-brand-500 transition-all"
                        style={{
                          width: `${Math.round(originalRatio * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="font-black text-ink">
                      {Math.round(originalRatio * 100)}%
                    </span>
                  </div>
                )}
                <SourceBadge
                  source={original.source}
                  providerLabel={modelLabel}
                />
              </div>
            ) : (
              <Placeholder
                active={s1 === "active"}
                text="ستظهر قياسات النص الأصلي هنا"
              />
            )}
          </Node>

          <Beam on={phase === "optimizing"} done={s2 === "done"} />
          <Node
            number={2}
            title="Processing / Optimization"
            subtitle="فهم النية وإعادة الصياغة والترجمة عبر Gemini"
            status={s2}
          >
            {dual ? (
              <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                <Wand2 className="shrink-0 text-brand-500" />
                <span className="flex-1">{dual.note}</span>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${dual.source === "gemini" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}
                >
                  {dual.source === "gemini" ? (dual.model ?? "Gemini") : "محلي"}
                </span>
              </div>
            ) : (
              <Placeholder
                active={s2 === "active"}
                text="يفهم Gemini النية ويُنتج نسختين: عربية منقّحة وإنجليزية مترجمة"
              />
            )}
          </Node>

          {/* fork into the two output branches */}
          <Beam on={phase === "measuring"} done={dual !== null} />
          <div
            className={`mx-auto h-[3px] w-1/2 rounded-full transition-colors ${s3 === "idle" ? "bg-slate-200" : "bg-brand-500/60"}`}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Beam on={phase === "measuring"} done={dual !== null} short />
              <OutputCard
                lang="ar"
                title="Optimized Output"
                chip="العربية"
                status={s3}
                text={report?.arabic.text ?? dual?.arabic ?? null}
                report={report?.arabic ?? null}
              />
            </div>
            <div>
              <Beam on={phase === "measuring"} done={dual !== null} short />
              <OutputCard
                lang="en"
                title="Optimized Output"
                chip="English"
                status={s3}
                text={report?.english?.text ?? dual?.english ?? null}
                unavailable={englishUnavailable}
                report={report?.english ?? null}
              />
            </div>
          </div>

          <Beam on={phase === "measuring"} done={report !== null} />
          <CostBar
            report={report}
            active={phase === "measuring"}
            modelLabel={modelLabel}
            onReset={reset}
          />
        </div>

        <footer className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-400">
          <Gauge size={15} /> القياس حقيقي عبر Gemini countTokens · الفهم
          والترجمة عبر Gemini · الطبقات قابلة للتوسع للغات أخرى.
        </footer>
        <SettingsModal
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          config={config}
          onChange={setConfig}
        />
      </div>
    </main>
  );
}

/* ---- pipeline plumbing -------------------------------------------------- */

function Beam({
  on,
  done,
  short,
}: {
  on: boolean;
  done: boolean;
  short?: boolean;
}) {
  return (
    <div
      className={`relative mx-auto my-1 w-[3px] overflow-hidden rounded-full bg-slate-200 ${short ? "h-5" : "h-8"}`}
    >
      {on ? (
        <div className="beam absolute inset-0" />
      ) : done ? (
        <div className="absolute inset-0 bg-brand-500/70" />
      ) : null}
    </div>
  );
}

function Node({
  number,
  title,
  subtitle,
  status,
  children,
}: {
  number: number;
  title: string;
  subtitle: string;
  status: NodeStatus;
  children: React.ReactNode;
}) {
  const active = status === "active";
  const done = status === "done";
  return (
    <section
      className={`mx-auto max-w-3xl rounded-3xl border-2 p-5 transition ${active ? "border-brand-400 bg-white shadow-glow" : done ? "border-brand-400/50 bg-white" : "border-slate-200 bg-white/70"}`}
    >
      <div className="mb-4 flex items-center gap-3">
        <span
          className={`grid h-9 w-9 place-items-center rounded-full font-bold ${active ? "node-active bg-brand-500 text-white" : done ? "bg-brand-500 text-white" : "bg-slate-100 text-slate-400"}`}
        >
          {done ? <Check size={18} /> : number}
        </span>
        <div>
          <h2 className="font-bold">{title}</h2>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
        {active && (
          <span className="ms-auto h-2.5 w-2.5 animate-ping rounded-full bg-brand-400" />
        )}
      </div>
      {children}
    </section>
  );
}

function Placeholder({ active, text }: { active: boolean; text: string }) {
  return (
    <div
      className={`rounded-2xl border border-dashed p-4 text-center text-sm ${active ? "border-brand-400/60 text-slate-500" : "border-slate-200 text-slate-400"}`}
    >
      {active ? "جارٍ المعالجة…" : text}
    </div>
  );
}

/* ---- output containers -------------------------------------------------- */

function OutputCard({
  lang,
  title,
  chip,
  text,
  unavailable,
  report,
  status,
}: {
  lang: "ar" | "en";
  title: string;
  chip: string;
  text: string | null;
  unavailable?: boolean;
  report: VariantReport | null;
  status: NodeStatus;
}) {
  const emerald = lang === "ar";
  const frame = emerald
    ? "border-emerald-200 bg-emerald-50/70"
    : "border-blue-200 bg-blue-50/70";
  const chipCls = emerald
    ? "bg-emerald-100 text-emerald-700"
    : "bg-blue-100 text-blue-700";
  const active = status === "active";
  return (
    <section
      className={`rounded-3xl border-2 p-5 transition ${active ? `${frame} shadow-glow` : frame}`}
    >
      <div className="mb-4 flex items-center gap-2">
        <span
          className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${chipCls}`}
        >
          <Languages size={14} />
          {chip}
        </span>
        <h2 className="font-bold">{title}</h2>
        <div className="ms-auto">{text && <CopyButton text={text} />}</div>
      </div>
      <div
        dir={lang === "en" ? "ltr" : "rtl"}
        className={`min-h-56 rounded-2xl bg-white/85 p-4 leading-8 text-slate-700 whitespace-pre-wrap ${lang === "en" ? "text-left" : "text-right"}`}
      >
        {text ??
          (unavailable ? (
            <span className="text-sm text-slate-400">
              الترجمة الإنجليزية تتطلب مفتاح Gemini في{" "}
              <code dir="ltr">.env.local</code> — النسخة العربية تعمل محليًا.
            </span>
          ) : (
            <span className="text-sm text-slate-400">
              {active ? "تُستكمل القياسات…" : "الناتج المحسّن سيظهر هنا"}
            </span>
          ))}
      </div>
      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="font-bold text-slate-600">
          {report ? `${report.analysis.tokens} Tokens` : "— Tokens"}
          {report?.analysis.arabicRatio !== undefined && (
            <span className="ms-2 font-normal text-slate-400">
              {Math.round(report.analysis.arabicRatio * 100)}% عربي
            </span>
          )}
        </span>
        {report?.measurement && (
          <span
            className={`flex items-center gap-1.5 font-bold ${report.measurement.source === "provider" ? "text-emerald-600" : "text-amber-600"}`}
          >
            <span
              className={`h-2 w-2 rounded-full ${report.measurement.source === "provider" ? "bg-emerald-500" : "bg-amber-500"}`}
            />
            {report.measurement.source === "provider"
              ? "قياس حقيقي"
              : report.measurement.source === "bpe"
                ? "BPE محلي"
                : "تقدير"}
          </span>
        )}
      </div>
    </section>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard unavailable */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs font-bold text-slate-600 shadow-sm transition hover:text-ink"
    >
      {copied ? (
        <Check size={14} className="text-emerald-600" />
      ) : (
        <Copy size={14} />
      )}
      {copied ? "نُسخ!" : "نسخ"}
    </button>
  );
}

/* ---- cost bar ------------------------------------------------------------ */

function CostBar({
  report,
  active,
  modelLabel,
  onReset,
}: {
  report: OptimizationReport | null;
  active: boolean;
  modelLabel?: string;
  onReset: () => void;
}) {
  return (
    <section className="rounded-3xl border-2 border-amber-200 bg-amber-50/80 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold">
          <Coins className="text-amber-500" size={18} /> Cost Analysis{" "}
          <span className="hidden text-xs font-normal text-slate-500 sm:inline">
            تقدير تكلفة الإدخال · {modelLabel}
          </span>
        </div>
        {report && (
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 text-sm font-bold text-slate-600 hover:text-ink"
          >
            <RotateCcw size={15} /> بدء جديد
          </button>
        )}
      </div>
      {report ? (
        <div className="grid gap-3 md:grid-cols-2">
          <CostGroup label="النسخة العربية" cost={report.arabic.cost} />
          {report.english ? (
            <CostGroup label="النسخة الإنجليزية" cost={report.english.cost} />
          ) : (
            <div className="grid place-items-center rounded-2xl bg-white/70 p-3 text-center text-xs text-slate-400">
              توفير النسخة الإنجليزية يظهر مع الترجمة
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl bg-white/70 p-4 text-center text-sm text-slate-400">
          {active
            ? "يُحسب التقدير…"
            : "سيظهر تحليل التكلفة هنا بعد تشغيل التحسين"}
        </div>
      )}
    </section>
  );
}

function CostGroup({ label, cost }: { label: string; cost: CostEstimate }) {
  return (
    <div className="rounded-2xl bg-white p-3">
      <div className="mb-2 text-xs font-bold text-slate-500">{label}</div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <Metric label="قبل" value={formatCost(cost.original)} />
        <Metric label="بعد" value={formatCost(cost.optimized)} />
        <Metric label="التوفير" value={`${cost.savingPercent}%`} />
      </div>
    </div>
  );
}

/* ---- shared bits --------------------------------------------------------- */

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-slate-50 px-2 py-3">
      <div className="text-lg font-black text-ink">{value}</div>
      <div className="mt-1 text-[11px] text-slate-500">{label}</div>
    </div>
  );
}

function SourceBadge({
  source,
  providerLabel,
}: {
  source?: TokenMeasurement["source"];
  providerLabel?: string;
}) {
  if (!source) return null;
  const live = source === "provider";
  const label = live
    ? `مقياس حقيقي · ${providerLabel ?? "Gemini"}`
    : source === "bpe"
      ? "تقدير BPE محلي"
      : "تقدير تجريبي";
  return (
    <div
      className={`mt-3 flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold ${live ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
    >
      <span
        className={`h-2 w-2 rounded-full ${live ? "bg-emerald-500" : "bg-amber-500"}`}
      />
      {label}
    </div>
  );
}
