"use client";

import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";

/* ---- Wireframe primitives ----------------------------------------------- */

type Zone = "work" | "detail";

const zoneTone: Record<Zone, string> = {
  work: "border-ink bg-white",
  detail: "border-slate-400 border-dashed bg-slate-50/80",
};

/** A named container. The name chip is the point of the wireframe. */
function Box({
  name,
  hint,
  zone = "work",
  className = "",
  children,
}: {
  name: string;
  hint?: string;
  zone?: Zone;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <section className={`border p-3 ${zoneTone[zone]} ${className}`}>
      <header className="mb-2 flex flex-wrap items-baseline gap-2">
        <span
          className={`px-2 py-0.5 text-xs font-bold ${
            zone === "work"
              ? "bg-ink text-white"
              : "bg-slate-200 text-slate-700"
          }`}
        >
          {name}
        </span>
        {hint ? (
          <span className="text-[11px] text-slate-500">{hint}</span>
        ) : null}
      </header>
      {children}
    </section>
  );
}

/** Grey bars standing in for content. */
function Lines({ n = 2, short = false }: { n?: number; short?: boolean }) {
  return (
    <div className="space-y-1.5" aria-hidden>
      {Array.from({ length: n }, (_, i) => (
        <div
          key={i}
          className="h-2 rounded-full bg-slate-200"
          style={{
            width: short
              ? `${40 + ((i * 17) % 30)}%`
              : `${70 + ((i * 13) % 30)}%`,
          }}
        />
      ))}
    </div>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="border border-slate-300 bg-white px-2 py-0.5 font-mono text-[11px] text-slate-600">
      {children}
    </span>
  );
}

/** A container that opens and closes — collapsed it still shows a summary. */
function Collapsible({
  name,
  summary,
  defaultOpen = false,
  zone = "detail",
  children,
}: {
  name: string;
  summary?: ReactNode;
  defaultOpen?: boolean;
  zone?: Zone;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`border ${zoneTone[zone]}`}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full flex-wrap items-center gap-2 p-3 text-start outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <span
          className={`px-2 py-0.5 text-xs font-bold ${
            zone === "work"
              ? "bg-ink text-white"
              : "bg-slate-200 text-slate-700"
          }`}
        >
          {name}
        </span>
        <span className="text-[11px] text-slate-500">
          {open ? "قابل للطي" : "مطوي — اضغط للتمديد"}
        </span>
        {!open && summary ? (
          <span className="flex gap-1.5">{summary}</span>
        ) : null}
        <ChevronDown
          size={16}
          className={`ms-auto text-slate-500 transition-transform motion-reduce:transition-none ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open ? (
        <div className="space-y-3 border-t border-slate-200 p-3">
          {children}
        </div>
      ) : null}
    </section>
  );
}

function ZoneLabel({ zone }: { zone: Zone }) {
  return (
    <div className="mt-7 mb-3 flex items-center gap-3">
      <span
        className={`text-sm font-black ${zone === "work" ? "text-ink" : "text-slate-500"}`}
      >
        {zone === "work" ? "منطقة العمل" : "منطقة التعليمات والتفاصيل"}
      </span>
      <span
        className={`h-px flex-1 ${zone === "work" ? "bg-ink" : "border-t border-dashed border-slate-400"}`}
      />
    </div>
  );
}

/* ---- Shared work containers --------------------------------------------- */

function Header({ thin = false }: { thin?: boolean }) {
  return (
    <Box
      name="رأس الصفحة"
      hint="الشعار، حالة المفتاح، زر الإعدادات، لغة الواجهة"
    >
      {thin ? null : <Lines n={1} short />}
    </Box>
  );
}

function PromptInput({ rows = 4 }: { rows?: number }) {
  return (
    <Box name="المدخلات" hint="حقل التلقينة + زر «تشغيل التحليل»">
      <div
        className="border border-slate-300 bg-slate-50 p-2"
        style={{ minHeight: rows * 18 }}
      >
        <Lines n={Math.max(1, rows - 2)} />
      </div>
      <div className="mt-2 flex">
        <span className="bg-brand-500 px-3 py-1.5 text-xs font-bold text-white">
          تشغيل التحليل
        </span>
      </div>
    </Box>
  );
}

const STEPS = ["قياس الأصل", "المعالجة", "قياس الناتج", "التقرير"];

function PipelineTrack({ vertical = false }: { vertical?: boolean }) {
  return (
    <Box name="مسار المعالجة" hint="أربع محطات يمشي عليها الضوء">
      <ol
        className={vertical ? "space-y-3" : "flex flex-wrap items-center gap-2"}
      >
        {STEPS.map((s, i) => (
          <li
            key={s}
            className="flex items-center gap-2 text-xs font-bold text-slate-600"
          >
            <span
              className={`grid h-5 w-5 place-items-center rounded-full font-mono text-[10px] ${
                i < 2
                  ? "bg-brand-500 text-white"
                  : "bg-slate-200 text-slate-500"
              }`}
            >
              {i + 1}
            </span>
            {s}
          </li>
        ))}
      </ol>
    </Box>
  );
}

function OutputCard({ lang }: { lang: "native" | "en" }) {
  return lang === "en" ? (
    <Box name="بطاقة English" hint="النص المرسل للوكيل — يبقى إنجليزياً دائماً">
      <div className="mb-2 flex flex-wrap gap-1.5">
        <Chip>الوكيل ▾</Chip>
        <Chip>إرسال: Gemini CLI</Chip>
        <Chip>نسخ</Chip>
      </div>
      <div dir="ltr">
        <Lines n={3} />
      </div>
    </Box>
  ) : (
    <Box name="بطاقة لغة المستخدم" hint="العربية اليوم — للقراءة والنسخ فقط">
      <div className="mb-2 flex gap-1.5">
        <Chip>نسخ</Chip>
      </div>
      <Lines n={3} />
    </Box>
  );
}

/* ---- The CLI agent section — kept identical in every layout ------------- */

const AGENTS = ["Gemini CLI", "Devin", "Hermes", "Claude Code", "OpenAI Codex"];
const DEFAULT_AGENT = "OpenAI Codex";
const AGENT_STEPS: [string, "done" | "open"][] = [
  ["فحص المجلد", "done"],
  ["ثقة دائمة", "open"],
  ["ثقة لكل تشغيلة", "open"],
  ["تشغيل الجلسة", "open"],
];

function AgentBlock({
  compact = false,
  transcript = true,
  tall = false,
  composer,
}: {
  compact?: boolean;
  /** false = the IN/OUT log lives in its own panel elsewhere on the page. */
  transcript?: boolean;
  /** A taller terminal — the agent column has the height to spare. */
  tall?: boolean;
  /** A per-agent prompt box rendered inside the block, under the terminal. */
  composer?: ReactNode;
}) {
  return (
    <div className="border-2 border-ink">
      <div className="bg-ink px-3 py-1.5 text-xs font-bold text-white">
        وكيل CLI — التصميم الحالي محفوظ كما هو
      </div>
      {/* tab strip */}
      <div
        dir="ltr"
        className="flex flex-wrap gap-1 border-b border-ink bg-white px-2 pt-2"
      >
        {AGENTS.map((a, i) => (
          <span
            key={a}
            className={`flex items-center gap-1.5 border border-b-0 px-2.5 py-1.5 font-mono text-[11px] font-bold ${
              i === 0
                ? "border-ink bg-ink text-white"
                : "border-slate-300 bg-white text-slate-600"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {a}
            {a === DEFAULT_AGENT ? (
              <span
                dir="rtl"
                className={`border px-1 text-[9px] ${
                  i === 0
                    ? "border-white/40 text-white"
                    : "border-emerald-400 text-emerald-700"
                }`}
              >
                الافتراضي
              </span>
            ) : null}
          </span>
        ))}
      </div>
      <div className="bg-white p-3">
        <span className="mb-2 inline-block bg-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-700">
          شريط تبويبات الوكلاء + لوحة المشروع والخطوات ①–④
        </span>
        <div
          dir="ltr"
          className="border border-slate-300 bg-slate-50 px-2 py-1.5 font-mono text-[11px] text-slate-500"
        >
          C:\MyProject\TargetApp
        </div>
        <div
          className={`mt-2 gap-2 ${compact ? "grid grid-cols-2" : "flex flex-wrap"}`}
        >
          {AGENT_STEPS.map(([s, state], i) => (
            <span
              key={s}
              className={`flex flex-1 basis-32 items-center gap-2 border px-2 py-1.5 text-[11px] font-bold ${
                state === "done"
                  ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                  : "border-slate-300 bg-white text-slate-600"
              }`}
            >
              <span
                className={`grid h-5 w-5 shrink-0 place-items-center rounded-full font-mono text-[10px] ${
                  state === "done"
                    ? "bg-emerald-600 text-white"
                    : "bg-ink text-white"
                }`}
              >
                {state === "done" ? "✓" : i + 1}
              </span>
              {s}
            </span>
          ))}
        </div>
      </div>
      {/* live terminal */}
      <div className="bg-[#14121f]">
        <div className="flex items-center gap-2 border-b border-white/10 px-3 py-1.5 text-[11px]">
          <span className="bg-emerald-200 px-1.5 font-bold text-emerald-900">
            حيّة
          </span>
          <span className="font-bold text-white/80">الطرفية الحية</span>
          <span className="ms-auto text-white/50">إعادة تشغيل · إيقاف</span>
        </div>
        <div
          dir="ltr"
          className={`space-y-1.5 p-3 ${tall ? "h-[30rem]" : compact ? "h-40" : "h-48"}`}
        >
          {[62, 80, 45, 70, 30].map((w, i) => (
            <div
              key={i}
              className="h-1.5 rounded-full bg-white/15"
              style={{ width: `${w}%` }}
            />
          ))}
        </div>
      </div>
      {composer}
      {/* transcript */}
      {transcript ? (
        <div className="grid grid-cols-2 gap-px border-t border-ink bg-slate-300">
          {[
            ["IN / OUT — لغة المستخدم", "rtl"],
            ["IN / OUT — English", "ltr"],
          ].map(([label, dir]) => (
            <div key={label} className="bg-white p-2.5">
              <span className="mb-1.5 inline-block bg-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                {label}
              </span>
              <div dir={dir}>
                <Lines n={2} short />
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ---- Shared detail containers ------------------------------------------- */

function StationResults({ stacked = false }: { stacked?: boolean }) {
  return (
    <div className={`grid gap-3 ${stacked ? "" : "sm:grid-cols-2"}`}>
      <Box
        name="ST-01 قياس الأصل"
        zone="detail"
        hint="توكنز · حروف · كلمات · نسبة العربية"
      >
        <Lines n={2} short />
      </Box>
      <Box
        name="ST-02 المعالجة"
        zone="detail"
        hint="ملاحظة Gemini + النموذج الذي خدم الرد"
      >
        <Lines n={2} short />
      </Box>
    </div>
  );
}

function Heatmap() {
  return (
    <Box
      name="الخريطة الحرارية"
      zone="detail"
      hint="أثقل المقاطع في الأصل والعربية والإنجليزية"
    >
      <div className="flex flex-wrap gap-1" aria-hidden>
        {[3, 5, 2, 6, 4, 1, 5, 3, 2, 4, 6, 2].map((h, i) => (
          <span
            key={i}
            className="h-3 rounded-sm"
            style={{
              width: 18 + h * 6,
              background: `rgba(32,184,154,${0.15 + h * 0.12})`,
            }}
          />
        ))}
      </div>
    </Box>
  );
}

const SAVINGS = "تفصيل التوفير + فحص الكيانات والجودة";

function Savings() {
  return (
    <Box
      name={SAVINGS}
      zone="detail"
      hint="الأصل → المنقّح → النهائي، والكيانات والنفي"
    >
      <Lines n={3} short />
    </Box>
  );
}

function Usage() {
  return (
    <Box
      name="استهلاك الاستدعاء"
      zone="detail"
      hint="توكنز Gemini الفعلية لاستدعاء التحسين"
    >
      <Lines n={1} short />
    </Box>
  );
}

function Cost() {
  return (
    <Box
      name="التكلفة"
      zone="detail"
      hint="تقدير تكلفة الإدخال قبل وبعد + إعادة الضبط"
    >
      <Lines n={2} short />
    </Box>
  );
}

function Footer() {
  return (
    <Box name="التذييل" zone="detail" hint="مصدر القياس وملاحظات الخصوصية">
      <Lines n={1} short />
    </Box>
  );
}

/* ---- Design 1 — Vertical pipeline -------------------------------------- */

function DesignVertical() {
  return (
    <>
      <Header />
      <ZoneLabel zone="work" />
      <div className="space-y-3">
        <div className="grid gap-3 md:grid-cols-[1fr_13rem]">
          <PromptInput rows={5} />
          <PipelineTrack vertical />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <OutputCard lang="native" />
          <OutputCard lang="en" />
        </div>
        <AgentBlock />
      </div>
      <ZoneLabel zone="detail" />
      <div className="space-y-2">
        <Collapsible
          name="نتائج المحطات"
          summary={
            <>
              <Chip>38 توكن</Chip>
              <Chip>Gemini 3.8</Chip>
            </>
          }
        >
          <StationResults />
        </Collapsible>
        <Collapsible
          name="التحليل"
          summary={
            <>
              <Chip>−37%</Chip>
              <Chip>كيانات ✓</Chip>
            </>
          }
        >
          <Heatmap />
          <Savings />
          <Usage />
        </Collapsible>
        <Collapsible
          name="التكلفة"
          summary={
            <Chip>
              <bdi dir="ltr">$0.00003 → $0.00002</bdi>
            </Chip>
          }
        >
          <Cost />
        </Collapsible>
        <Footer />
      </div>
    </>
  );
}

/* ---- Design 2 — Conversation (agent first, composer below) -------------- */

function DesignConversation() {
  const [tab, setTab] = useState<"en" | "native">("en");
  return (
    <>
      <Header thin />
      <ZoneLabel zone="work" />
      <div className="space-y-3">
        <AgentBlock />
        <Box
          name="منطقة التجهيز — المخرجات"
          hint="بطاقتا المخرجات في حاوية واحدة بتبويبين، والإرسال من الإنجليزية"
        >
          <div role="tablist" className="mb-2 flex gap-1">
            {(
              [
                ["en", "English"],
                ["native", "لغة المستخدم"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                role="tab"
                type="button"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={`border px-3 py-1 text-xs font-bold outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                  tab === id
                    ? "border-ink bg-ink text-white"
                    : "border-slate-300 bg-white text-slate-600"
                }`}
              >
                {label}
              </button>
            ))}
            {tab === "en" ? (
              <span className="ms-auto flex gap-1.5">
                <Chip>الوكيل ▾</Chip>
                <Chip>إرسال</Chip>
              </span>
            ) : null}
          </div>
          <div dir={tab === "en" ? "ltr" : "rtl"}>
            <Lines n={3} />
          </div>
        </Box>
        <Box
          name="المؤلِّف"
          hint="حقل التلقينة أسفل المحادثة كتطبيقات الدردشة، ومعه المسار وعدّاد التوكنز"
        >
          <div className="border border-slate-300 bg-slate-50 p-2">
            <Lines n={2} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="bg-brand-500 px-3 py-1.5 text-xs font-bold text-white">
              تشغيل التحليل
            </span>
            {STEPS.map((s, i) => (
              <span
                key={s}
                className={`px-1.5 py-0.5 text-[10px] font-bold ${
                  i < 2
                    ? "bg-brand-500/15 text-brand-600"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {s}
              </span>
            ))}
            <span className="ms-auto flex gap-1.5">
              <Chip>
                <bdi dir="ltr">38 → 24</bdi> توكن
              </Chip>
            </span>
          </div>
        </Box>
      </div>
      <ZoneLabel zone="detail" />
      <div className="grid gap-3 md:grid-cols-2">
        <Box
          name="نتائج المحطات"
          zone="detail"
          hint="ST-01 و ST-02 في بطاقة واحدة"
        >
          <Lines n={3} short />
        </Box>
        <Cost />
        <div className="md:col-span-2">
          <Heatmap />
        </div>
        <Savings />
        <Usage />
        <div className="md:col-span-2">
          <Footer />
        </div>
      </div>
    </>
  );
}

/* ---- Design 3 — Dual desk + tabbed details drawer ----------------------- */

const DRAWER = ["نتائج المحطات", "التحليل", "التكلفة", "ملاحظات"] as const;

/**
 * The tabbed details drawer. `rail` = the narrow sticky side column on very
 * wide screens: same tabs, contents stacked to fit the width.
 */
function DetailsDrawer({ rail = false }: { rail?: boolean }) {
  const [tab, setTab] = useState<(typeof DRAWER)[number]>("التحليل");
  return (
    <section className="border border-dashed border-slate-400 bg-slate-50/80">
      <div
        role="tablist"
        className="flex flex-wrap gap-1 border-b border-dashed border-slate-400 p-2"
      >
        <span className="me-2 self-center bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-700">
          {rail ? "شريط التفاصيل الجانبي" : "درج التفاصيل"}
        </span>
        {DRAWER.map((d) => (
          <button
            key={d}
            role="tab"
            type="button"
            aria-selected={tab === d}
            onClick={() => setTab(d)}
            className={`border px-3 py-1 text-xs font-bold outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
              tab === d
                ? "border-ink bg-ink text-white"
                : "border-slate-300 bg-white text-slate-600"
            }`}
          >
            {d}
          </button>
        ))}
      </div>
      <div className="space-y-3 p-3">
        {tab === "نتائج المحطات" ? <StationResults stacked={rail} /> : null}
        {tab === "التحليل" ? (
          <>
            <Heatmap />
            <div className={`grid gap-3 ${rail ? "" : "md:grid-cols-2"}`}>
              <Savings />
              <Usage />
            </div>
          </>
        ) : null}
        {tab === "التكلفة" ? <Cost /> : null}
        {tab === "ملاحظات" ? <Footer /> : null}
      </div>
    </section>
  );
}

function DesignDualDesk() {
  return (
    <>
      <Header thin />
      <ZoneLabel zone="work" />
      <div className="grid items-start gap-3 lg:grid-cols-[5fr_7fr]">
        <div className="space-y-3">
          <PromptInput rows={4} />
          <PipelineTrack />
          <OutputCard lang="en" />
          <Collapsible
            name="بطاقة لغة المستخدم"
            zone="work"
            summary={<Chip>مرافقة — مطوية افتراضياً</Chip>}
          >
            <Lines n={3} />
          </Collapsible>
        </div>
        <AgentBlock compact />
      </div>
      <ZoneLabel zone="detail" />
      <DetailsDrawer />
    </>
  );
}

/** Zone heading used INSIDE a wide-layout column (not a full-width divider). */
function ColumnZone({ zone }: { zone: Zone }) {
  return (
    <div
      className={`mb-2 flex items-center gap-2 text-xs font-black ${
        zone === "work" ? "text-ink" : "text-slate-500"
      }`}
    >
      {zone === "work" ? "منطقة العمل" : "منطقة التعليمات والتفاصيل"}
      <span
        className={`h-px flex-1 ${zone === "work" ? "bg-ink" : "border-t border-dashed border-slate-400"}`}
      />
    </div>
  );
}

/** Sticky only where the column really sits beside the work (≥1600px). */
const RAIL =
  "min-[1600px]:sticky min-[1600px]:top-20 min-[1600px]:max-h-[calc(100vh-6rem)] min-[1600px]:overflow-y-auto";

/* ---- Design 4 — Dual desk, widened ------------------------------------- */

function DesignDualDeskWide() {
  return (
    <>
      <Header thin />
      <div className="mt-5 grid items-start gap-4 xl:grid-cols-[5fr_7fr] min-[1600px]:grid-cols-[4fr_6fr_3.5fr]">
        <div className="space-y-3">
          <ColumnZone zone="work" />
          <PromptInput rows={4} />
          <PipelineTrack />
          <OutputCard lang="en" />
          <Collapsible
            name="بطاقة لغة المستخدم"
            zone="work"
            summary={<Chip>مرافقة — مطوية افتراضياً</Chip>}
          >
            <Lines n={3} />
          </Collapsible>
        </div>
        <div>
          <ColumnZone zone="work" />
          <AgentBlock compact />
        </div>
        <aside className={`xl:col-span-2 min-[1600px]:col-span-1 ${RAIL}`}>
          <ColumnZone zone="detail" />
          <DetailsDrawer rail />
        </aside>
      </div>
    </>
  );
}

/* ---- Design 5 — Conversation, widened ---------------------------------- */

function StagingOutputs() {
  const [tab, setTab] = useState<"en" | "native">("en");
  return (
    <Box
      name="منطقة التجهيز — المخرجات"
      hint="بطاقتا المخرجات بتبويبين، والإرسال من الإنجليزية"
    >
      <div role="tablist" className="mb-2 flex flex-wrap gap-1">
        {(
          [
            ["en", "English"],
            ["native", "لغة المستخدم"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`border px-3 py-1 text-xs font-bold outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
              tab === id
                ? "border-ink bg-ink text-white"
                : "border-slate-300 bg-white text-slate-600"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "en" ? (
        <div className="mb-2 flex gap-1.5">
          <Chip>الوكيل ▾</Chip>
          <Chip>إرسال</Chip>
        </div>
      ) : null}
      <div dir={tab === "en" ? "ltr" : "rtl"}>
        <Lines n={4} />
      </div>
    </Box>
  );
}

function Composer() {
  return (
    <Box
      name="المؤلِّف"
      hint="حقل التلقينة تحت المحادثة، ومعه المسار وعدّاد التوكنز"
    >
      <div className="border border-slate-300 bg-slate-50 p-2">
        <Lines n={2} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="bg-brand-500 px-3 py-1.5 text-xs font-bold text-white">
          تشغيل التحليل
        </span>
        {STEPS.map((s, i) => (
          <span
            key={s}
            className={`px-1.5 py-0.5 text-[10px] font-bold ${
              i < 2
                ? "bg-brand-500/15 text-brand-600"
                : "bg-slate-100 text-slate-500"
            }`}
          >
            {s}
          </span>
        ))}
        <span className="ms-auto">
          <Chip>
            <bdi dir="ltr">38 → 24</bdi> توكن
          </Chip>
        </span>
      </div>
    </Box>
  );
}

function DesignConversationWide() {
  return (
    <>
      <Header thin />
      <div className="mt-5 grid items-start gap-4 xl:grid-cols-[7fr_4fr] min-[1600px]:grid-cols-[3.5fr_7fr_3.5fr]">
        {/* RTL: on wide screens the staging column sits at the start (right). */}
        <div className="order-2 space-y-3 min-[1600px]:order-1">
          <ColumnZone zone="work" />
          <StagingOutputs />
        </div>
        <div className="order-1 space-y-3 min-[1600px]:order-2">
          <ColumnZone zone="work" />
          <AgentBlock />
          <Composer />
        </div>
        <aside
          className={`order-3 space-y-3 xl:col-span-2 min-[1600px]:col-span-1 ${RAIL}`}
        >
          <ColumnZone zone="detail" />
          <Collapsible
            name="نتائج المحطات"
            summary={<Chip>38 توكن</Chip>}
            defaultOpen
          >
            <StationResults stacked />
          </Collapsible>
          <Collapsible
            name="التحليل"
            summary={
              <>
                <Chip>−37%</Chip>
                <Chip>كيانات ✓</Chip>
              </>
            }
          >
            <Heatmap />
            <Savings />
            <Usage />
          </Collapsible>
          <Collapsible
            name="التكلفة"
            summary={
              <Chip>
                <bdi dir="ltr">$0.00003 → $0.00002</bdi>
              </Chip>
            }
          >
            <Cost />
          </Collapsible>
          <Footer />
        </aside>
      </div>
    </>
  );
}

/* ---- Design 6 — Agent centre, log + details column --------------------- */

/** The IN/OUT log as its own panel: IN/OUT tabs, the two languages side by side. */
function TranscriptPanel() {
  const [side, setSide] = useState<"in" | "out">("out");
  return (
    <section className="border border-ink bg-amber-50/60 p-3">
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <span className="bg-ink px-2 py-0.5 text-xs font-bold text-white">
          سجل IN / OUT
        </span>
        <span className="text-[11px] text-slate-500">
          أُخرج من قسم الوكيل ليقف بجانب الطرفية — كل دورة مرقّمة
        </span>
        <div role="tablist" dir="ltr" className="ms-auto flex gap-1">
          {(["in", "out"] as const).map((s) => (
            <button
              key={s}
              role="tab"
              type="button"
              aria-selected={side === s}
              onClick={() => setSide(s)}
              className={`border px-3 py-1 font-mono text-[11px] font-bold outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                side === s
                  ? "border-amber-500 bg-amber-100 text-amber-900"
                  : "border-slate-300 bg-white text-slate-600"
              }`}
            >
              {s.toUpperCase()}
            </button>
          ))}
        </div>
      </header>
      <div className="grid items-center gap-2 sm:grid-cols-[1fr_auto_1fr]">
        <div className="border border-slate-300 bg-white p-3">
          <span className="mb-2 block text-center text-xs font-bold text-slate-700">
            لغة المستخدم
          </span>
          <div className="min-h-32 border border-slate-200 bg-slate-50 p-2">
            <Lines n={2} short />
          </div>
          <span className="mt-1.5 block text-[10px] text-slate-500">
            {side === "out" ? "ترجمة رد الوكيل" : "ما كتبه المستخدم"}
          </span>
        </div>
        <span
          aria-hidden
          className="text-center text-lg font-bold text-slate-500"
        >
          ←
        </span>
        <div className="border border-slate-300 bg-white p-3" dir="ltr">
          <span className="mb-2 block text-center text-xs font-bold text-slate-700">
            English
          </span>
          <div className="min-h-32 border border-slate-200 bg-slate-50 p-2">
            <Lines n={2} short />
          </div>
          <span className="mt-1.5 block text-[10px] text-slate-500">
            {side === "out" ? "the agent's reply" : "what reached the agent"}
          </span>
        </div>
      </div>
    </section>
  );
}

function DesignAgentCentre() {
  return (
    <>
      <Header thin />
      <div className="mt-5 grid items-start gap-4 xl:grid-cols-[4fr_8fr] min-[1600px]:grid-cols-[3fr_6fr_6fr]">
        <div className="space-y-3">
          <ColumnZone zone="work" />
          <PromptInput rows={4} />
          <PipelineTrack />
          <OutputCard lang="en" />
          <Collapsible
            name="بطاقة لغة المستخدم"
            zone="work"
            summary={<Chip>مرافقة — مطوية افتراضياً</Chip>}
          >
            <Lines n={3} />
          </Collapsible>
        </div>
        <div>
          <ColumnZone zone="work" />
          <AgentBlock transcript={false} tall />
        </div>
        <div className="space-y-4 xl:col-span-2 min-[1600px]:col-span-1">
          <div>
            <ColumnZone zone="work" />
            <TranscriptPanel />
          </div>
          <div>
            <ColumnZone zone="detail" />
            <DetailsDrawer />
          </div>
        </div>
      </div>
    </>
  );
}

/* ---- Design 7 — The prompt lives inside the agent ---------------------- */

const SAMPLE_DRAFT =
  "من فضلك اشرح لي بإيجاز الفرق بين TCP و UDP مع مثال لكل منهما.";
const SAMPLE_READY =
  "Briefly explain the difference between TCP and UDP, with one example of each.";

type ComposerPhase = "draft" | "processing" | "ready";

/**
 * One agent's own prompt box. Processing replaces the draft with the English
 * polish in place; the original stays reachable until the text is sent, and
 * both go into the IN/OUT log on send. "Send right after processing" is a
 * per-agent switch here — where the action happens — not a global setting.
 */
function AgentComposer({
  agent,
  onSent,
}: {
  agent: string;
  onSent: () => void;
}) {
  const [phase, setPhase] = useState<ComposerPhase>("draft");
  const [text, setText] = useState(SAMPLE_DRAFT);
  const [original, setOriginal] = useState("");
  const [auto, setAuto] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [status, setStatus] = useState("اكتب بلغتك ثم اضغط «معالجة».");

  function send() {
    onSent();
    setPhase("draft");
    setText("");
    setOriginal("");
    setShowOriginal(false);
    setStatus(`أُرسل إلى ${agent} — الأصل والإنجليزية دخلا سجل IN / OUT.`);
  }

  function process() {
    if (!text.trim()) return;
    setOriginal(text);
    setPhase("processing");
    setStatus("يعالج… (المعالجة الفعلية تأخذ 7–37 ثانية)");
    setTimeout(() => {
      if (auto) {
        onSent();
        setPhase("draft");
        setText("");
        setOriginal("");
        setStatus(`عولج وأُرسل مباشرة إلى ${agent} — 38 → 24 توكن.`);
        return;
      }
      setText(SAMPLE_READY);
      setPhase("ready");
      setStatus("جاهز: 38 → 24 توكن. راجع الإنجليزية أو عدّلها ثم أرسل.");
    }, 1200);
  }

  function undo() {
    setText(original);
    setOriginal("");
    setShowOriginal(false);
    setPhase("draft");
    setStatus("عاد النص الأصلي — عدّله ثم عالجه من جديد.");
  }

  const ready = phase === "ready";
  return (
    <div className="border-t-2 border-ink bg-white p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="bg-ink px-2 py-0.5 text-xs font-bold text-white">
          مدخل {agent}
        </span>
        <span
          className={`border px-2 py-0.5 text-[11px] font-bold ${
            ready
              ? "border-emerald-500 bg-emerald-50 text-emerald-800"
              : "border-amber-400 bg-amber-50 text-amber-800"
          }`}
        >
          {ready ? "جاهز — English" : "مسودة — العربية"}
        </span>
        <label className="ms-auto flex cursor-pointer items-center gap-1.5 text-[11px] font-bold text-slate-700">
          <input
            type="checkbox"
            checked={auto}
            disabled={phase !== "draft"}
            onChange={(e) => setAuto(e.target.checked)}
            className="h-3.5 w-3.5 accent-brand-600"
          />
          إرسال مباشرة بعد المعالجة
        </label>
      </div>
      <textarea
        aria-label={`مدخل ${agent}`}
        dir={ready ? "ltr" : "rtl"}
        value={text}
        disabled={phase === "processing"}
        onChange={(e) => setText(e.target.value)}
        placeholder="اكتب تلقينتك بلغتك هنا"
        className="min-h-24 w-full resize-y border border-slate-300 bg-slate-50 p-2.5 text-sm leading-7 outline-none focus:border-ink disabled:opacity-60"
      />
      {showOriginal && original ? (
        <p className="mt-1.5 border border-dashed border-slate-300 bg-slate-50 p-2 text-xs text-slate-600">
          <b>الأصل:</b> {original}
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {ready ? (
          <>
            <button
              type="button"
              onClick={send}
              className="bg-brand-500 px-3 py-1.5 text-xs font-bold text-white outline-none hover:bg-brand-600 focus-visible:ring-2 focus-visible:ring-ink"
            >
              إرسال إلى {agent}
            </button>
            <button
              type="button"
              onClick={() => setShowOriginal((v) => !v)}
              className="border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:border-ink"
            >
              {showOriginal ? "إخفاء الأصل" : "عرض الأصل"}
            </button>
            <button
              type="button"
              onClick={undo}
              className="border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:border-ink"
            >
              تراجع
            </button>
            <span className="border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-500">
              إرسال أيضاً إلى… ▾
            </span>
          </>
        ) : (
          <button
            type="button"
            onClick={process}
            disabled={phase === "processing" || !text.trim()}
            className="bg-brand-500 px-3 py-1.5 text-xs font-bold text-white outline-none hover:bg-brand-600 focus-visible:ring-2 focus-visible:ring-ink disabled:opacity-50"
          >
            {phase === "processing"
              ? "يعالج…"
              : auto
                ? `معالجة وإرسال إلى ${agent}`
                : "معالجة"}
          </button>
        )}
      </div>
      <p
        role="status"
        className="mt-2 border-t border-slate-200 pt-1.5 text-[11px] text-slate-600"
      >
        {status}
      </p>
    </div>
  );
}

function DesignAgentComposer() {
  const [sent, setSent] = useState(0);
  return (
    <>
      <Header thin />
      <div className="mt-5 grid items-start gap-4 xl:grid-cols-[7fr_5fr]">
        <div className="space-y-3">
          <ColumnZone zone="work" />
          <AgentBlock
            transcript={false}
            composer={
              <AgentComposer
                agent={AGENTS[0]}
                onSent={() => setSent((n) => n + 1)}
              />
            }
          />
          <Collapsible
            name="بطاقة لغة المستخدم"
            zone="work"
            summary={<Chip>النسخة العربية المنقّحة — للقراءة والنسخ</Chip>}
          >
            <Lines n={3} />
          </Collapsible>
        </div>
        <div className="space-y-4">
          <div>
            <ColumnZone zone="work" />
            <TranscriptPanel />
            {sent ? (
              <p className="mt-1.5 text-[11px] font-bold text-emerald-700">
                دورات مرسلة في هذه التجربة: {sent}
              </p>
            ) : null}
          </div>
          <div>
            <ColumnZone zone="detail" />
            <DetailsDrawer />
          </div>
        </div>
      </div>
    </>
  );
}

/* ---- The lab ------------------------------------------------------------ */

const DESIGNS = [
  {
    id: 1,
    name: "المسار العمودي",
    idea: "الصفحة تُقرأ من الأعلى للأسفل بترتيب الخطوات نفسه: اكتب ← راقب المسار بجانبك ← قارن البطاقتين ← أرسل للوكيل. كل التفاصيل في الأسفل مطوية، ويظهر ملخصها بالأرقام دون فتحها.",
    fits: "المستخدم الجديد الذي يتعلم الأداة، وشاشات الحاسوب العادية.",
    View: DesignVertical,
  },
  {
    id: 2,
    name: "المحادثة",
    idea: "الوكيل في الأعلى كنافذة محادثة، والمؤلِّف في الأسفل كتطبيقات الدردشة، وبينهما منطقة تجهيز تجمع البطاقتين بتبويبين. التفاصيل بطاقات شبكية تحت الصفحة.",
    fits: "الاستخدام اليومي المتكرر: جلسة الوكيل مفتوحة طوال الوقت والتلقينات تتوالى.",
    View: DesignConversation,
  },
  {
    id: 3,
    name: "المكتب المزدوج",
    idea: "عمودان متجاوران: التلقينة ومخرجاتها في عمود، والوكيل في العمود الآخر، فترى ما ترسله وما يحدث في الطرفية معاً. بطاقة لغة المستخدم مطوية لأن الإرسال إنجليزي، والتفاصيل في درج واحد بتبويبات.",
    fits: "الشاشات العريضة والمستخدم المتمرس الذي يتابع الوكيل أثناء العمل.",
    View: DesignDualDesk,
  },
  {
    id: 4,
    name: "المكتب المزدوج الموسّع",
    idea: "التصميم 3 بعرض الشاشة كاملاً: على الشاشات الأوسع من 1600 بكسل يصبح ثلاثة أعمدة — التلقينة ومخرجاتها، ثم الوكيل، ثم شريط تفاصيل جانبي ثابت يبقى ظاهراً أثناء التمرير. بين 1280 و1600 عمودان والتفاصيل في الأسفل، وأصغر من ذلك تتكدس الحاويات.",
    fits: "الشاشات العريضة جداً: لا مساحة جانبية مهدرة، والتفاصيل في متناول العين دون تمرير.",
    View: DesignDualDeskWide,
  },
  {
    id: 5,
    name: "المحادثة الموسّعة",
    idea: "التصميم 2 بعرض الشاشة: الوكيل والمؤلِّف في المنتصف كمحادثة، ومنطقة التجهيز (المخرجات) عمود على اليمين، والتفاصيل أقسام قابلة للطي في عمود ثابت على اليسار. بين 1280 و1600 تنتقل التفاصيل للأسفل، وأصغر من ذلك تتكدس.",
    fits: "الاستخدام اليومي على شاشة عريضة: المحادثة في مركز النظر، وكل شيء آخر على الأطراف.",
    View: DesignConversationWide,
  },
  {
    id: 6,
    name: "الوكيل في المركز",
    idea: "ثلاثة أعمدة على الشاشات الأوسع من 1600 بكسل: عمود عمل ضيق (التلقينة ومخرجاتها)، ثم الوكيل في المنتصف بطرفية طويلة، ثم عمود يجمع سجل IN/OUT في أعلاه — خارج قسم الوكيل وبجانب الطرفية مباشرة — ودرج التفاصيل تحته. بين 1280 و1600 ينزل العمود الثالث تحت العمودين، وأصغر من ذلك تتكدس الحاويات.",
    fits: "متابعة حوار الوكيل: الطرفية بارتفاع مريح، والسجل المترجم أمامك دون تمرير.",
    View: DesignAgentCentre,
  },
  {
    id: 7,
    name: "المدخل داخل الوكيل",
    idea: "لكل وكيل مدخله الخاص تحت طرفيته، فما تكتبه في تبويب وكيل يذهب إليه هو — بلا قائمة «الوكيل ▾» ولا بطاقة English منفصلة. «معالجة» تستبدل مسودتك بالإنجليزية المختصرة في المكان نفسه، والأصل يبقى متاحاً بـ«عرض الأصل» و«تراجع» حتى الإرسال. عمودان: الوكيل بمدخله وبطاقة لغة المستخدم تحته، وسجل IN/OUT والتفاصيل بجانبه. جرّب المدخل فهو تفاعلي.",
    fits: "تقليل أخطاء الإرسال إلى أدنى حد: الهدف واضح من التبويب نفسه، وكل وكيل بمسودته وجلسته.",
    View: DesignAgentComposer,
  },
] as const;

/** Wide designs use the whole screen; the originals keep their 1024px frame. */
const WIDE = new Set([4, 5, 6, 7]);

export function LayoutsLab() {
  const [active, setActive] = useState<1 | 2 | 3 | 4 | 5 | 6 | 7>(1);
  const design = DESIGNS.find((d) => d.id === active)!;
  const View = design.View;
  const frame = WIDE.has(active) ? "max-w-[1840px]" : "max-w-5xl";
  return (
    <main className="blueprint-grid min-h-screen px-4 pb-16 sm:px-7">
      <nav
        aria-label="التنقل بين التصاميم"
        className="sticky top-0 z-20 -mx-4 mb-5 border-b border-ink bg-[#f6f6f2]/95 px-4 py-3 backdrop-blur sm:-mx-7 sm:px-7"
      >
        <div className={`mx-auto flex ${frame} flex-wrap items-center gap-2`}>
          <span className="me-3 text-sm font-black">مختبر التخطيطات</span>
          {DESIGNS.map((d) => (
            <button
              key={d.id}
              type="button"
              aria-pressed={active === d.id}
              onClick={() => {
                setActive(d.id);
                window.scrollTo({ top: 0 });
              }}
              className={`flex items-center gap-2 border px-3 py-1.5 text-sm font-bold outline-none transition focus-visible:ring-2 focus-visible:ring-brand-500 ${
                active === d.id
                  ? "border-ink bg-ink text-white shadow-hard-sm"
                  : "border-ink bg-white text-ink hover:bg-slate-50"
              }`}
            >
              <span className="font-mono text-xs opacity-70">{d.id}</span>
              {d.name}
            </button>
          ))}
          {WIDE.has(active) ? (
            <span className="ms-auto text-[11px] font-bold text-slate-500">
              <span className="xl:hidden">
                العرض الحالي: أعمدة متكدسة (&lt;1280)
              </span>
              <span className="hidden xl:inline min-[1600px]:hidden">
                العرض الحالي: عمودان (1280–1600)
              </span>
              <span className="hidden min-[1600px]:inline">
                العرض الحالي: ثلاثة أعمدة (&gt;1600)
              </span>
            </span>
          ) : null}
        </div>
      </nav>
      <div className={`mx-auto ${frame}`}>
        <section className="mb-2 border border-ink bg-white p-4 shadow-hard">
          <h1 className="text-lg font-black">
            التصميم {design.id}: {design.name}
          </h1>
          <p className="mt-1 max-w-[72ch] text-sm leading-7 text-slate-700">
            {design.idea}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            <b>يناسب:</b> {design.fits}
          </p>
          <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-5 border border-ink bg-white" /> حاوية عمل
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-5 border border-dashed border-slate-400 bg-slate-50" />{" "}
              حاوية تفاصيل
            </span>
            <span className="flex items-center gap-1.5">
              <ChevronDown size={12} /> حاوية قابلة للطي والتمديد — جرّبها
            </span>
          </div>
        </section>
        <View />
      </div>
    </main>
  );
}
