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
const AGENT_STEPS: [string, "done" | "open"][] = [
  ["فحص المجلد", "done"],
  ["ثقة دائمة", "open"],
  ["ثقة لكل تشغيلة", "open"],
  ["تشغيل الجلسة", "open"],
];

function AgentBlock({ compact = false }: { compact?: boolean }) {
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
          className={`space-y-1.5 p-3 ${compact ? "h-40" : "h-48"}`}
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
      {/* transcript */}
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
    </div>
  );
}

/* ---- Shared detail containers ------------------------------------------- */

function StationResults() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
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

function DesignDualDesk() {
  const [tab, setTab] = useState<(typeof DRAWER)[number]>("التحليل");
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
      <section className="border border-dashed border-slate-400 bg-slate-50/80">
        <div
          role="tablist"
          className="flex flex-wrap gap-1 border-b border-dashed border-slate-400 p-2"
        >
          <span className="me-2 self-center bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-700">
            درج التفاصيل
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
          {tab === "نتائج المحطات" ? <StationResults /> : null}
          {tab === "التحليل" ? (
            <>
              <Heatmap />
              <div className="grid gap-3 md:grid-cols-2">
                <Savings />
                <Usage />
              </div>
            </>
          ) : null}
          {tab === "التكلفة" ? <Cost /> : null}
          {tab === "ملاحظات" ? <Footer /> : null}
        </div>
      </section>
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
] as const;

export function LayoutsLab() {
  const [active, setActive] = useState<1 | 2 | 3>(1);
  const design = DESIGNS.find((d) => d.id === active)!;
  const View = design.View;
  return (
    <main className="blueprint-grid min-h-screen px-4 pb-16 sm:px-7">
      <nav
        aria-label="التنقل بين التصاميم"
        className="sticky top-0 z-20 -mx-4 mb-5 border-b border-ink bg-[#f6f6f2]/95 px-4 py-3 backdrop-blur sm:-mx-7 sm:px-7"
      >
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2">
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
        </div>
      </nav>
      <div className="mx-auto max-w-5xl">
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
