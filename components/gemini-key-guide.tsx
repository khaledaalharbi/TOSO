import {
  ChevronDown,
  Copy,
  ExternalLink,
  KeyRound,
  MousePointerClick,
  Plus,
  Settings2,
  ShieldCheck,
} from "lucide-react";

function GoogleKeyIcon({
  size = 14,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 -960 960 960"
      width={size}
      height={size}
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M280-400q-33 0-56.5-23.5T200-480q0-33 23.5-56.5T280-560q33 0 56.5 23.5T360-480q0 33-23.5 56.5T280-400Zm0 160q-100 0-170-70T40-480q0-100 70-170t170-70q67 0 121.5 33t86.5 87h352l120 120-180 180-80-60-80 60-85-60h-47q-32 54-86.5 87T280-240Zm0-80q56 0 98.5-34t56.5-86h125l58 41 82-61 71 55 75-75-40-40H435q-14-52-56.5-86T280-640q-66 0-113 47t-47 113q0 66 47 113t113 47Z" />
    </svg>
  );
}

const steps = [
  {
    icon: ExternalLink,
    title: "الانتقال إلى صفحة المفاتيح",
    body: (
      <>
        افتح صفحة المفاتيح في{" "}
        <a
          href="https://aistudio.google.com/app/apikey"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-brand-600 underline underline-offset-2"
          dir="ltr"
        >
          Google AI Studio
        </a>{" "}
        وسجّل الدخول بحساب Google إن طُلب منك.
      </>
    ),
  },
  {
    icon: MousePointerClick,
    title: "ابدأ الإنشاء",
    body: (
      <>
        اضغط زر{" "}
        <bdi dir="ltr">
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-2 py-0.5 font-semibold text-slate-700">
            <GoogleKeyIcon size={12} />
            Create API key
          </span>
        </bdi>{" "}
        في الزاوية العلوية من الصفحة.
      </>
    ),
  },
  {
    icon: Settings2,
    title: "إعداد المفتاح",
    body: (
      <>
        ستظهر نافذة{" "}
        <bdi dir="ltr" className="font-semibold">
          Create a new key
        </bdi>
        :
      </>
    ),
    sub: [
      <>أدخل اسماً للمفتاح (اختياري).</>,
      <>
        اختر مشروعك الحالي، أو اضغط{" "}
        <bdi dir="ltr">
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-2 py-0.5 font-semibold text-slate-700">
            <Plus size={12} />
            Create project
          </span>
        </bdi>{" "}
        إن لم يكن لديك مشروع — ستفتح نافذة{" "}
        <bdi dir="ltr" className="font-semibold">
          Create a new project
        </bdi>
        : أضف الاسم ثم اضغط{" "}
        <bdi dir="ltr">
          <span className="inline-flex items-center rounded-full border border-slate-300 bg-white px-2 py-0.5 font-semibold text-slate-700">
            Create project
          </span>
        </bdi>
        .
      </>,
      <>
        اضغط{" "}
        <bdi dir="ltr">
          <span className="inline-flex items-center rounded-full border border-slate-300 bg-white px-2 py-0.5 font-semibold text-slate-700">
            Create key
          </span>
        </bdi>
        .
      </>,
    ],
  },
  {
    icon: Copy,
    title: "انسخ وألصق",
    body: (
      <>
        انسخ المفتاح الظاهر لك — يبدأ عادةً بـ{" "}
        <bdi dir="ltr" className="font-semibold">
          AQ.
        </bdi>{" "}
        — ثم ألصقه في حقل «مفتاح Gemini» هنا؛ يعمل فوراً وتُحمَّل طلباتك على
        حصتك.
      </>
    ),
  },
];

export function GeminiKeyGuide() {
  return (
    <div className="space-y-3">
      <details className="group rounded-xl border border-slate-200 p-3 text-xs">
        <summary className="flex cursor-pointer list-none items-center justify-between font-semibold text-slate-600 [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2">
            <KeyRound size={14} className="text-brand-600" />
            كيف أحصل على مفتاح مجاني؟
          </span>
          <ChevronDown
            size={14}
            className="text-slate-400 transition-transform group-open:rotate-180"
          />
        </summary>
        <ol className="mt-3 space-y-3 border-t border-slate-100 pt-3 text-slate-600">
          {steps.map((step, index) => (
            <li key={index} className="flex gap-2 leading-5">
              <step.icon size={14} className="mt-0.5 shrink-0 text-brand-600" />
              <div>
                <p className="font-semibold text-slate-700">
                  {index + 1}. {step.title}
                </p>
                <p>{step.body}</p>
                {step.sub ? (
                  <ul className="mt-1 list-disc space-y-1 ps-4 marker:text-slate-300">
                    {step.sub.map((item, subIndex) => (
                      <li key={subIndex}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </details>
      <div className="flex gap-2 rounded-xl bg-emerald-50 p-3 text-xs leading-5 text-emerald-800">
        <ShieldCheck className="shrink-0" size={18} />
        <ul className="list-disc space-y-1 ps-4 marker:text-emerald-400">
          <li>
            يُخزَّن المفتاح محلياً في متصفحك (
            <span dir="ltr">localStorage</span>) فقط.
          </li>
          <li>
            يُرسل مع طلباتك إلى خادمك المحلي دون تسجيله أو تخزينه في الخادم.
          </li>
          <li>
            إذا تُرك فارغاً يُعتمد تلقائياً على مفتاح الخادم إن وُجد، وإلا تعمل
            التنقية المحلية.
          </li>
        </ul>
      </div>
    </div>
  );
}
