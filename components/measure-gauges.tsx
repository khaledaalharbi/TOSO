"use client";

import { Check, Gauge, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import type { OptimizationReport } from "@/lib/types";
import { useI18n } from "@/components/i18n-provider";
import { tx } from "@/lib/i18n";

export const formatCost = (value: number) =>
  value === 0
    ? tx("مجاني")
    : value < 0.000001
      ? "< $\u00A00.000001"
      : `$\u00A0${value < 0.001 ? value.toFixed(6) : value.toFixed(3)}`;

/** Smallest 1·2·5 × 10ⁿ at or above `value` — a shared, readable dial scale. */
export function niceMax(value: number): number {
  if (!Number.isFinite(value) || value <= 10) return 10;
  const power = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 5, 10]) {
    if (step * power >= value) return step * power;
  }
  return 10 * power;
}

export interface GaugeData {
  before: number;
  after: number;
  /** Both dials share this scale, so their needles are comparable. */
  scaleMax: number;
  /** Saving in percent (negative = the text grew); null when not comparable. */
  percent: number | null;
  /** Before and after were counted by different sources. */
  mixedSources: boolean;
  /** Counts are estimates, not the provider's own. */
  estimated: boolean;
  costBefore: string | null;
  costAfter: string | null;
  entities: { ok: boolean; count: number } | null;
  quality: "ok" | "warn" | null;
}

/**
 * The few numbers worth a glance, from one report: the text the agent
 * receives (English when there is one) against the user's original.
 */
export function gaugeData(report: OptimizationReport): GaugeData {
  const variant = report.english ?? report.arabic;
  const beforeMeasure = report.originalMeasurement;
  const before = beforeMeasure?.tokens ?? report.original.tokens;
  const after = variant?.analysis.tokens ?? before;
  const mixedSources =
    Boolean(beforeMeasure && variant?.measurement) &&
    beforeMeasure!.source !== variant!.measurement!.source;
  const key = report.english ? "english" : "arabic";
  const entity = report.entityChecks[key];
  const quality = report.quality[key];
  return {
    before,
    after,
    scaleMax: niceMax(Math.max(before, after)),
    percent:
      mixedSources || !before
        ? null
        : Math.round(((before - after) / before) * 1000) / 10,
    mixedSources,
    estimated:
      (beforeMeasure?.source ?? "heuristic") !== "provider" ||
      (variant?.measurement?.source ?? "heuristic") !== "provider",
    costBefore: variant ? formatCost(variant.cost.original) : null,
    costAfter: variant ? formatCost(variant.cost.optimized) : null,
    entities: entity ? { ok: entity.preserved, count: entity.checked } : null,
    quality: quality
      ? quality.languageOk &&
        quality.negationKept !== false &&
        quality.warnings.length === 0
        ? "ok"
        : "warn"
      : null,
  };
}

/**
 * Semicircle dial. The needle and arc ease to `value` only once it changes
 * from 0, so a result "lands" after the quiet waiting state. While waiting,
 * a short still arc breathes at the start of the scale — no sweeping motion.
 */
function Dial({
  value,
  max,
  label,
  tone,
  state,
}: {
  value: number;
  max: number;
  label: string;
  tone: "before" | "after";
  state: "idle" | "waiting" | "done";
}) {
  const { t } = useI18n();
  const target = state === "done" ? Math.min(value, max) : 0;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => setShown(target), 40);
    return () => clearTimeout(timer);
  }, [target]);
  const ratio = max ? shown / max : 0;
  const angle = ratio * 180 - 90;
  return (
    <div
      className="gauge-dial"
      role="img"
      aria-label={
        state === "done"
          ? t("{label}: {value} توكن من {max}", { label, value, max })
          : t("{label}: لا قياس بعد", { label })
      }
    >
      <svg viewBox="0 0 120 78" className="gauge-svg" aria-hidden>
        <path
          d="M 12 62 A 48 48 0 0 1 108 62"
          className="gauge-track"
          pathLength={100}
        />
        {state === "waiting" ? (
          <path
            d="M 12 62 A 48 48 0 0 1 108 62"
            className="gauge-wait"
            pathLength={100}
            strokeDasharray="9 200"
          />
        ) : (
          <path
            d="M 12 62 A 48 48 0 0 1 108 62"
            className={`gauge-arc gauge-arc--${tone}`}
            pathLength={100}
            strokeDasharray={`${ratio * 100} 200`}
          />
        )}
        {[0, 25, 50, 75, 100].map((tick) => (
          <line
            key={tick}
            x1="60"
            y1="14"
            x2="60"
            y2="20"
            className="gauge-tick"
            transform={`rotate(${(tick / 100) * 180 - 90} 60 62)`}
          />
        ))}
        <g
          className="gauge-needle"
          style={{ transform: `rotate(${angle}deg)` }}
        >
          <line x1="60" y1="62" x2="60" y2="22" className="gauge-needle-line" />
          <circle cx="60" cy="62" r="3.5" className="gauge-needle-pin" />
        </g>
        <text x="12" y="75" className="gauge-scale" textAnchor="middle">
          0
        </text>
        <text x="108" y="75" className="gauge-scale" textAnchor="middle">
          {max}
        </text>
      </svg>
      <span className="gauge-num" dir="ltr">
        {state === "done" ? value : "—"}
      </span>
      <span className="gauge-label">
        {label} <em dir="ltr">tok</em>
      </span>
    </div>
  );
}

const chip =
  "inline-flex items-center gap-1.5 border px-2.5 py-1 text-[11.5px] font-bold";

/**
 * The measurement card: two dials (the original against what the agent
 * receives), the saving, the cost either side, and the safety checks —
 * the short version. The heat map and the long analysis live in the
 * details drawer below.
 */
export function MeasureGauges({
  data,
  running,
  progress,
  source,
  caption,
  children,
}: {
  data: GaugeData | null;
  running: boolean;
  progress: string | null;
  /** Who produced the text, e.g. "Gemini · مفتاحك". */
  source?: string;
  /** Which run this describes, e.g. "Codex · 12:15 ص". */
  caption?: string;
  children?: React.ReactNode;
}) {
  const { t, dir } = useI18n();
  const state: "idle" | "waiting" | "done" = running
    ? "waiting"
    : data
      ? "done"
      : "idle";
  const max = data?.scaleMax ?? 100;
  return (
    <section
      aria-label={t("عدّادات القياس")}
      className="border border-ink bg-white"
    >
      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
        <Gauge size={15} className="text-amber-600" />
        <h3 className="text-sm font-bold">{t("عدّادات القياس")}</h3>
        {caption && state === "done" ? (
          <span className="ms-auto text-[11px] text-slate-500">{caption}</span>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-2 px-3 pt-4">
        <Dial
          value={data?.before ?? 0}
          max={max}
          label={t("الأصل")}
          tone="before"
          state={state}
        />
        <Dial
          value={data?.after ?? 0}
          max={max}
          label={t("الناتج")}
          tone="after"
          state={state}
        />
      </div>
      <p role="status" className="px-4 pt-1 text-center text-xs text-slate-500">
        {state === "waiting"
          ? (progress ?? t("يقيس…"))
          : state === "idle"
            ? t("اكتب في مدخل أي وكيل ثم «معالجة» لتتحرك العدّادات.")
            : ""}
      </p>
      {data && state === "done" ? (
        <>
          <div
            className="flex flex-wrap items-baseline justify-center gap-3 px-4 pt-1 pb-3"
            dir={dir}
          >
            <span className="font-mono text-2xl font-bold text-sky-700">
              {data.before}
            </span>
            <span className="text-slate-400">{dir === "rtl" ? "←" : "→"}</span>
            <span className="font-mono text-2xl font-bold text-amber-600">
              {data.after}
            </span>
            {data.percent !== null ? (
              <span
                dir="ltr"
                className={`${chip} font-mono ${
                  data.percent > 0
                    ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                    : data.percent < 0
                      ? "border-amber-300 bg-amber-50 text-amber-800"
                      : "border-slate-300 bg-slate-50 text-slate-600"
                }`}
              >
                {data.percent > 0 ? "−" : data.percent < 0 ? "+" : ""}
                {Math.abs(data.percent)}%
              </span>
            ) : null}
          </div>
          {data.mixedSources ? (
            <p className="px-4 pb-3 text-center text-[11px] text-amber-800">
              {t("مصدر عدّ الأصل غير مصدر عدّ الناتج — النسبة غير محسوبة.")}
            </p>
          ) : data.estimated ? (
            <p className="px-4 pb-3 text-center text-[11px] text-slate-500">
              {t("أرقام تقديرية — لا قياس حقيقي من Gemini في هذا التشغيل.")}
            </p>
          ) : null}
          {data.costBefore && data.costAfter ? (
            <dl className="mx-4 mb-3 space-y-1.5 border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">{t("تكلفة الإرسال قبل")}</dt>
                <dd dir="ltr" className="font-mono font-bold text-ink">
                  {data.costBefore}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">{t("تكلفة الإرسال بعد")}</dt>
                <dd dir="ltr" className="font-mono font-bold text-ink">
                  {data.costAfter}
                </dd>
              </div>
            </dl>
          ) : null}
          <div className="flex flex-wrap gap-2 px-4 pb-4">
            {data.entities ? (
              <span
                className={`${chip} ${
                  data.entities.count === 0
                    ? "border-slate-300 bg-slate-50 text-slate-600"
                    : data.entities.ok
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                      : "border-amber-300 bg-amber-50 text-amber-800"
                }`}
              >
                {data.entities.count === 0 ? null : data.entities.ok ? (
                  <Check size={13} />
                ) : (
                  <TriangleAlert size={13} />
                )}
                {data.entities.count === 0
                  ? t("لا كيانات تحتاج حماية")
                  : data.entities.ok
                    ? t("الكيانات محفوظة ({v1})", { v1: data.entities.count })
                    : t("كيانات ناقصة")}
              </span>
            ) : null}
            {data.quality ? (
              <span
                className={`${chip} ${
                  data.quality === "ok"
                    ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                    : "border-amber-300 bg-amber-50 text-amber-800"
                }`}
              >
                {data.quality === "ok" ? (
                  <Check size={13} />
                ) : (
                  <TriangleAlert size={13} />
                )}
                {data.quality === "ok"
                  ? t("فحص الجودة: اجتاز")
                  : t("فحص الجودة: تنبيه")}
              </span>
            ) : null}
            {source ? (
              <span className={`${chip} border-sky-300 bg-sky-50 text-sky-800`}>
                {source}
              </span>
            ) : null}
          </div>
        </>
      ) : (
        <div className="pb-4" />
      )}
      {children}
    </section>
  );
}
