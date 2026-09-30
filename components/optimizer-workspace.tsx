"use client";

import {
  Check,
  Coins,
  Copy,
  Gauge,
  Info,
  Languages,
  Play,
  RotateCcw,
  Settings2,
  Sparkles,
  Wand2,
} from "lucide-react";
import { memo, useEffect, useState } from "react";
import {
  SettingsModal,
  dotClass,
  statusFromKeySignal,
  type KeyStatus,
} from "@/components/settings-modal";
import type { DualOptimization } from "@/lib/optimizer/llm-optimizer";
import {
  DEFAULT_MODEL,
  DEFAULT_PROVIDER,
  providers,
} from "@/lib/providers/registry";
import { runOptimization } from "@/lib/services/optimization-service";
import { estimateHeatmapSegments } from "@/lib/token-engine/bpe-estimator";
import { arabicRatio } from "@/lib/token-engine/token-engine";
import type {
  CostEstimate,
  GeminiUsage,
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

/** BYOK key lives in browser storage only — sent per request as a header. */
const USER_KEY_STORAGE = "toso.userGeminiKey";

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
  const [keyHydrated, setKeyHydrated] = useState(false);
  // Latest user-key signal: ok (served), user_key_* reason, or null (no
  // user-key evidence this run). Bound to the key value it describes.
  const [keySignal, setKeySignal] = useState<{
    key: string;
    signal: string;
  } | null>(null);

  // Hydrate the BYOK key once on mount, then mirror every change to storage.
  useEffect(() => {
    const stored = window.localStorage.getItem(USER_KEY_STORAGE);
    if (stored) setConfig((c) => ({ ...c, userKey: stored }));
    setKeyHydrated(true);
  }, []);
  useEffect(() => {
    if (!keyHydrated) return;
    if (config.userKey) {
      window.localStorage.setItem(USER_KEY_STORAGE, config.userKey);
    } else {
      window.localStorage.removeItem(USER_KEY_STORAGE);
    }
  }, [config.userKey, keyHydrated]);

  async function handleRun() {
    if (!prompt.trim() || running) return;
    setRunning(true);
    setReport(null);
    setDual(null);
    setOriginal(null);
    setOriginalRatio(null);
    setPhase("analyzing");
    try {
      const nextReport = await runOptimization(prompt, config, {
        onOriginalMeasured: (measurement) => {
          setOriginal(measurement);
          setOriginalRatio(arabicRatio(prompt));
          setPhase("optimizing");
        },
        onOptimized: (optimized) => {
          setDual(optimized);
          setPhase("measuring");
          setKeySignal(
            config.userKey
              ? optimized.source === "gemini" && optimized.viaUserKey
                ? { key: config.userKey, signal: "ok" }
                : optimized.fallbackReason?.startsWith("user_key_")
                  ? { key: config.userKey, signal: optimized.fallbackReason }
                  : null
              : null,
          );
        },
      });
      setReport(nextReport);
      setPhase("done");
    } finally {
      setRunning(false);
    }
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
  // Header dot mirrors the shared user-key signal; null hides it entirely.
  const savedKeyStatus: KeyStatus | null = config.userKey
    ? statusFromKeySignal(
        keySignal && keySignal.key === config.userKey ? keySignal.signal : null,
      )
    : null;
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
          <div className="flex items-center gap-2">
            {savedKeyStatus ? <KeyStatusHint status={savedKeyStatus} /> : null}
            <button
              onClick={() => setSettingsOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold shadow-sm hover:border-brand-400"
            >
              <Settings2 size={17} /> الإعدادات
            </button>
          </div>
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
            subtitle="تنقية محلية ثم إعادة صياغة عبر Gemini عند توفره"
            status={s2}
          >
            {dual ? (
              <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                <Wand2 className="shrink-0 text-brand-500" />
                <span className="flex-1">{dual.note}</span>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${dual.source === "gemini" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}
                >
                  {dual.source === "gemini"
                    ? `${dual.model ?? "Gemini"}${dual.viaUserKey ? " · مفتاحك" : ""}`
                    : "محلي"}
                </span>
              </div>
            ) : (
              <Placeholder
                active={s2 === "active"}
                text="تُنقّى العربية محلياً، ويُنشئ Gemini الترجمة عند توفره"
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
                chip={
                  report?.source === "mock" || dual?.source === "mock"
                    ? "تنقية محلية"
                    : "العربية"
                }
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
                unavailableReason={
                  report?.rejectedByGuard
                    ? "حُجبت الترجمة لأن مخرج Gemini لم يحفظ بعض الكيانات؛ عُرضت النسخة المحلية بدلاً منه."
                    : "الترجمة الإنجليزية غير متاحة في الوضع المحلي أو عند تعذّر Gemini."
                }
                report={report?.english ?? null}
              />
            </div>
          </div>

          {report && <TokenHeatmap report={report} />}
          {report && <OptimizationInsights report={report} />}
          {report && <OptimizationUsagePanel report={report} />}

          <Beam on={phase === "measuring"} done={report !== null} />
          <CostBar
            report={report}
            active={phase === "measuring"}
            modelLabel={modelLabel}
            onReset={reset}
          />
        </div>

        <footer className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-400">
          <Gauge size={15} /> القياس عبر Gemini countTokens عند توفره، وإلا
          بتقدير محلي · الترجمة تتطلب Gemini.
        </footer>
        <SettingsModal
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          config={config}
          onChange={setConfig}
          keySignal={keySignal}
          onSignal={setKeySignal}
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

/** Header dot + legend for the saved BYOK key's latest evidence. */
const keyStatusLegend: { status: KeyStatus; label: string }[] = [
  {
    status: "idle",
    label: "مفتاح محفوظ لم يُفحص بعد — اضغط «تحقق» في الإعدادات",
  },
  { status: "ok", label: "يعمل — آخر تشغيل أو فحص نجح على مفتاحك" },
  { status: "invalid", label: "مرفوض من Google في آخر محاولة" },
  { status: "quota", label: "حصة مفتاحك مستنزفة مؤقتاً" },
  { status: "unreachable", label: "تعذّر الفحص — الشبكة أو الخادم" },
];

function KeyStatusHint({ status }: { status: KeyStatus }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`h-2.5 w-2.5 rounded-full ${dotClass[status]}`}
        aria-hidden="true"
      />
      <details className="group relative">
        <summary
          className="flex cursor-pointer list-none items-center text-slate-400 transition hover:text-slate-600 [&::-webkit-details-marker]:hidden"
          aria-label="معنى ألوان حالة المفتاح"
        >
          <Info size={15} />
        </summary>
        <div className="absolute start-0 top-6 z-40 w-64 rounded-xl border border-slate-200 bg-white p-3 text-xs leading-5 text-slate-600 shadow-lg">
          <p className="mb-2 font-bold text-slate-700">حالة مفتاحك المحفوظ</p>
          <ul className="space-y-1.5">
            {keyStatusLegend.map((item) => (
              <li key={item.status} className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${dotClass[item.status]}`}
                  aria-hidden="true"
                />
                {item.label}
              </li>
            ))}
          </ul>
        </div>
      </details>
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
  unavailableReason,
  report,
  status,
}: {
  lang: "ar" | "en";
  title: string;
  chip: string;
  text: string | null;
  unavailable?: boolean;
  unavailableReason?: string;
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
            <span className="text-sm text-slate-400">{unavailableReason}</span>
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

const heatLevels = [
  {
    label: "خفيف · نحو 1",
    className: "bg-teal-50 text-teal-900 ring-teal-200",
  },
  {
    label: "متوسط · نحو 2–3",
    className: "bg-amber-100 text-amber-950 ring-amber-200",
  },
  {
    label: "مرتفع · نحو 4+",
    className: "bg-rose-100 text-rose-900 ring-rose-200",
  },
];

function heatLevel(tokens: number) {
  return tokens <= 1
    ? heatLevels[0]
    : tokens <= 3
      ? heatLevels[1]
      : heatLevels[2];
}

export const TokenHeatmap = memo(function TokenHeatmap({
  report,
}: {
  report: OptimizationReport;
}) {
  return (
    <section
      aria-labelledby="heatmap-title"
      className="mt-5 rounded-3xl border border-violet-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="heatmap-title" className="text-lg font-bold text-ink">
            خريطة ثقل المقاطع
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            شاهد مواضع الثقل التقريبي في النص الأصلي والمخرجات، من دون إرسال كل
            مقطع إلى مزود الخدمة.
          </p>
        </div>
        <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-800">
          تقدير محلي
        </span>
      </div>
      <div
        aria-label="مفتاح ألوان الخريطة الحرارية"
        className="mt-4 flex flex-wrap gap-2 text-xs"
      >
        {heatLevels.map(({ label, className }) => (
          <span
            key={label}
            className={`rounded-lg px-2.5 py-1.5 font-semibold ring-1 ring-inset ${className}`}
          >
            {label} توكن لكل مقطع
          </span>
        ))}
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <HeatmapVariant
          title="النص الأصلي"
          text={report.originalPrompt}
          direction="rtl"
        />
        <HeatmapVariant
          title="النسخة العربية"
          text={report.arabic.text}
          direction="rtl"
        />
        {report.english ? (
          <HeatmapVariant
            title="النسخة الإنجليزية"
            text={report.english.text}
            direction="ltr"
          />
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            <h3 className="font-bold text-slate-700">النسخة الإنجليزية</h3>
            <p className="mt-3">
              الإنجليزية غير متاحة في هذا التشغيل؛ لا توجد خريطة لنص غير موجود.
            </p>
          </div>
        )}
      </div>
      <p className="mt-4 rounded-xl bg-violet-50 px-4 py-3 text-xs leading-6 text-violet-900">
        الألوان تقدير لطول المقطع ونوع حروفه، وليست تفكيكاً رسمياً من Gemini. لا
        تجمع تقديرات المقاطع لتطابق إجمالي countTokens؛ الأرقام الرسمية والتكلفة
        المعروضة أعلاه/أدناه منفصلة عن هذه الخريطة.
      </p>
    </section>
  );
});

function HeatmapVariant({
  title,
  text,
  direction,
}: {
  title: string;
  text: string;
  direction: "rtl" | "ltr";
}) {
  const { segments, scoredSegments, truncated } = estimateHeatmapSegments(text);
  const heaviest = segments
    .filter(({ tokens }) => tokens !== null)
    .sort((a, b) => (b.tokens ?? 0) - (a.tokens ?? 0))
    .slice(0, 3);
  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50/60 p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold text-ink">{title}</h3>
        <span className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-slate-600">
          {scoredSegments} مقطع في المعاينة
        </span>
      </div>
      <div
        dir={direction}
        className="max-h-52 min-h-32 overflow-y-auto rounded-xl border border-slate-100 bg-white p-3 text-sm leading-9 whitespace-pre-wrap break-words"
      >
        {segments.map(({ text: part, tokens }, index) =>
          tokens === null ? (
            <span key={index}>{part}</span>
          ) : (
            <span
              key={index}
              dir="auto"
              title={`${part} — نحو ${tokens} توكن (تقدير محلي)`}
              aria-label={`${part}: نحو ${tokens} توكن بتقدير محلي`}
              className={`rounded-md px-1 py-0.5 ring-1 ring-inset ${heatLevel(tokens).className}`}
            >
              {part}
            </span>
          ),
        )}
        {truncated && <span aria-hidden="true">…</span>}
        {!segments.length && (
          <span className="text-slate-500">
            لا توجد مقاطع قصيرة قابلة للمعاينة.
          </span>
        )}
      </div>
      {truncated && (
        <p className="mt-2 text-xs font-medium text-amber-800">
          معاينة محدودة: أول {scoredSegments} مقطع ضمن 2000 حرف؛ بقية النص لم
          تُحلَّل بصرياً.
        </p>
      )}
      {heaviest.length > 0 && (
        <div className="mt-3 border-t border-slate-200 pt-3">
          <p className="mb-2 text-xs font-semibold text-slate-600">
            أثقل المقاطع في المعاينة
          </p>
          <div className="flex flex-wrap gap-1.5">
            {heaviest.map(({ text: part, tokens }, index) => (
              <span
                key={index}
                className="inline-flex max-w-full items-center gap-1 rounded-lg bg-white px-2 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200"
              >
                <span dir="auto" className="max-w-28 truncate">
                  {part}
                </span>
                <span dir="ltr" className="shrink-0 text-violet-800">
                  ~{tokens}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---- cost bar ------------------------------------------------------------ */

export function OptimizationInsights({
  report,
}: {
  report: OptimizationReport;
}) {
  const {
    originalMeasurement,
    normalizedMeasurement,
    arabic,
    english,
    entityChecks,
  } = report;
  if (!originalMeasurement || !arabic.measurement) return null;

  return (
    <div className="my-5 grid gap-4 md:grid-cols-2">
      <section className="rounded-3xl border border-teal-200 bg-white p-5 shadow-sm">
        <h2 className="font-bold text-ink">تفصيل التوفير في توكنز الإدخال</h2>
        <p className="mt-1 text-xs text-slate-500">
          مقارنة النص الأصلي بالمنقّح محلياً، ثم بالنسخة العربية النهائية.
        </p>
        <div className="mt-4 space-y-3">
          <MeasurementStep
            title="التنقية المحلية"
            before={originalMeasurement}
            after={normalizedMeasurement}
          />
          <MeasurementStep
            title={
              report.source === "gemini"
                ? "إعادة صياغة Gemini"
                : "تعديل إضافي محلي"
            }
            before={normalizedMeasurement}
            after={arabic.measurement}
          />
        </div>
        <details className="mt-4 rounded-xl border border-teal-100 bg-teal-50/50 p-3 text-xs">
          <summary className="cursor-pointer font-semibold text-teal-900">
            عرض النص بعد التنقية المحلية
          </summary>
          <p
            dir="auto"
            className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap break-words text-slate-700"
          >
            {report.normalizedPrompt}
          </p>
        </details>
        {english && (
          <p className="mt-3 text-xs text-slate-500">
            الإنجليزية بديل مستقل مقارنة بالنص الأصلي؛ لا تُضاف وفوراتها إلى
            العربية.
          </p>
        )}
      </section>
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-bold text-ink">فحص الكيانات والجودة الظاهرة</h2>
        {report.rejectedByGuard && (
          <p
            role="status"
            className="mt-3 rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-800"
          >
            رُفض مخرج Gemini لعدم اجتيازه فحوص السلامة المحلية. المعروض تنقية
            محلية، والترجمة محجوبة.
          </p>
        )}
        <div className="mt-3 space-y-2">
          <EntityStatus label="النسخة العربية" check={entityChecks.arabic} />
          {entityChecks.english ? (
            <EntityStatus
              label="النسخة الإنجليزية"
              check={entityChecks.english}
            />
          ) : (
            <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
              النسخة الإنجليزية غير متاحة للفحص.
            </p>
          )}
          <QualityStatus label="النسخة العربية" check={report.quality.arabic} />
          {report.quality.english && (
            <QualityStatus
              label="النسخة الإنجليزية"
              check={report.quality.english}
            />
          )}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          فحوص الكيانات والجودة تقيس عناصر ظاهرة قابلة للمطابقة (لغة، نفي، كلمات
          محتوى)؛ ليست ضماناً لحفظ المعنى أو جميع المتطلبات.
        </p>
      </section>
    </div>
  );
}

function MeasurementStep({
  title,
  before,
  after,
}: {
  title: string;
  before: TokenMeasurement;
  after: TokenMeasurement;
}) {
  const comparable = before.source === after.source;
  const saved = before.tokens - after.tokens;
  const percent = before.tokens
    ? Math.round((Math.abs(saved) / before.tokens) * 100)
    : 0;
  const difference = !comparable
    ? "لا يمكن حساب الفرق بدقة لاختلاف مصدر العد"
    : saved > 0
      ? `توفير ${saved} توكن (${percent}%)`
      : saved < 0
        ? `زيادة ${-saved} توكن (${percent}%)`
        : "لا تغير في عدد التوكنز";
  return (
    <div className="rounded-xl bg-slate-50 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-bold">{title}</span>
        <span dir="ltr" className="font-semibold tabular-nums">
          {before.tokens} → {after.tokens}
        </span>
      </div>
      <p
        className={`mt-1 text-xs ${comparable && saved > 0 ? "text-emerald-700" : "text-slate-600"}`}
      >
        {difference}
      </p>
      <p className="mt-1 text-[11px] text-slate-400">
        {comparable
          ? before.source === "provider"
            ? "Gemini countTokens"
            : "تقدير محلي"
          : "قياس بمصادر مختلفة: Gemini أو تقدير محلي"}
      </p>
    </div>
  );
}

function QualityStatus({
  label,
  check,
}: {
  label: string;
  check: OptimizationReport["quality"]["arabic"];
}) {
  const coverage = check.keywordCoverage;
  const clean = check.warnings.length === 0;
  return (
    <div
      className={`rounded-xl p-3 text-xs ${clean ? "bg-sky-50 text-sky-800" : "bg-amber-50 text-amber-800"}`}
    >
      <span className="font-bold">{label} — فحص الجودة: </span>
      {clean
        ? coverage !== null
          ? `سليم ظاهرياً — تغطية كلمات المحتوى ~${Math.round(coverage * 100)}%`
          : "سليم ظاهرياً"
        : check.warnings.join("؛ ")}
    </div>
  );
}

function EntityStatus({
  label,
  check,
}: {
  label: string;
  check: OptimizationReport["entityChecks"]["arabic"];
}) {
  const message = !check.checked
    ? "لا توجد كيانات مدعومة للفحص"
    : check.preserved
      ? `لم يُرصد فقد في ${check.checked} كيان قابل للفحص`
      : `تعذّر حفظ ${check.missing.length} من ${check.checked} كيان`;
  return (
    <div
      className={`rounded-xl p-3 text-xs ${check.checked && check.preserved ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}
    >
      <span className="font-bold">{label}: </span>
      {message}
      {check.missing.length > 0 && (
        <p dir="auto" className="mt-1 break-all">
          المفقود:{" "}
          {check.missing
            .slice(0, 5)
            .map(({ value }) => value)
            .join("، ")}
          {check.missing.length > 5 ? "…" : ""}
        </p>
      )}
    </div>
  );
}

const usageFields: { key: keyof GeminiUsage; label: string }[] = [
  { key: "total_input_tokens", label: "مدخلات الاستدعاء" },
  { key: "total_output_tokens", label: "المخرجات" },
  { key: "total_thought_tokens", label: "التفكير" },
  { key: "total_cached_tokens", label: "المخزّن مؤقتاً" },
  { key: "total_tool_use_tokens", label: "استخدام الأدوات" },
  { key: "total_tokens", label: "الإجمالي حسب Gemini" },
];

export function OptimizationUsagePanel({
  report,
}: {
  report: OptimizationReport;
}) {
  const usage = report.optimizationUsage;
  return (
    <section className="mb-5 rounded-3xl border border-blue-200 bg-white p-5 shadow-sm">
      <h2 className="font-bold text-ink">استهلاك استدعاء التحسين الفعلي</h2>
      {usage ? (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {usageFields
              .filter(({ key }) => usage[key] !== undefined)
              .map(({ key, label }) => (
                <Metric key={key} label={label} value={usage[key] ?? "—"} />
              ))}
          </div>
          {report.rejectedByGuard && (
            <p className="mt-3 text-xs text-amber-800">
              حدث استدعاء Gemini فعلي، لكن حارس الكيانات رفض مخرجه؛ الأرقام تخص
              الاستدعاء المرفوض.
            </p>
          )}
          <p className="mt-3 text-xs text-slate-500">
            أرقام Gemini لهذا الاستدعاء الناجح فقط؛ مدخلاته تشمل تعليمات النظام،
            وليست عدّ البرومبت وحده. الحقول التفصيلية لا تُجمع يدويًا؛ الإجمالي
            معروض كما أعاده Gemini.
          </p>
        </>
      ) : (
        <p className="mt-3 text-xs text-slate-500">
          لا تتوفر بيانات استهلاك فعلية لهذا التشغيل؛ لن نعرض رقماً مفترضاً.
        </p>
      )}
      <p className="mt-2 text-xs text-slate-500">
        تقدير التكلفة أدناه يخص استخدام النص الناتج لاحقاً، وليس فاتورة هذا
        الاستدعاء. لا تشمل هذه الأرقام طلبات عدّ التوكنز أو المحاولات الأخرى.
      </p>
    </section>
  );
}

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
        <>
          <div className="grid gap-3 md:grid-cols-2">
            <CostGroup
              label="النسخة العربية"
              cost={report.arabic.cost}
              comparable={
                report.originalMeasurement?.source ===
                report.arabic.measurement?.source
              }
            />
            {report.english ? (
              <CostGroup
                label="النسخة الإنجليزية"
                cost={report.english.cost}
                comparable={
                  report.originalMeasurement?.source ===
                  report.english.measurement?.source
                }
              />
            ) : (
              <div className="grid place-items-center rounded-2xl bg-white/70 p-3 text-center text-xs text-slate-400">
                توفير النسخة الإنجليزية يظهر مع الترجمة
              </div>
            )}
          </div>
          {report.originalMeasurement &&
            (report.originalMeasurement.source !==
              report.arabic.measurement?.source ||
              (report.english &&
                report.originalMeasurement.source !==
                  report.english.measurement?.source)) && (
              <p className="mt-3 text-xs text-amber-800">
                تختلف مصادر عد التوكنز بين المدخل والمخرج؛ أُخفيت نسبة التوفير
                لأنها غير قابلة للمقارنة بدقة.
              </p>
            )}
        </>
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

function CostGroup({
  label,
  cost,
  comparable = true,
}: {
  label: string;
  cost: CostEstimate;
  comparable?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-white p-3">
      <div className="mb-2 text-xs font-bold text-slate-500">{label}</div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <Metric label="قبل" value={formatCost(cost.original)} />
        <Metric label="بعد" value={formatCost(cost.optimized)} />
        <Metric
          label="التوفير"
          value={comparable ? `${cost.savingPercent}%` : "—"}
        />
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
