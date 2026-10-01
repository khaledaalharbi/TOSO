import type { Phase } from "@/components/optimizer-workspace";

type StationState = "idle" | "active" | "done";

/**
 * Patent-drawing style radial map of the optimization cycle: four stations
 * around a measurement core. A solid marker packet travels only along the
 * spoke of the stage that is actually running — no timers, no simulated
 * progress. Station states derive from real pipeline evidence.
 */

const CX = 210;
const CY = 150;

const STATIONS = [
  {
    id: 1,
    ar: "قياس الأصل",
    en: "MEASURE.IN",
    x: 210,
    y: 52,
    labelY: { ar: 26, en: 16 },
    boxY: 71,
  },
  {
    id: 2,
    ar: "المعالجة",
    en: "PROCESS",
    x: 312,
    y: 150,
    labelY: { ar: 106, en: 96 },
    boxY: 169,
  },
  {
    id: 3,
    ar: "قياس الناتج",
    en: "MEASURE.OUT",
    x: 210,
    y: 244,
    labelY: { ar: 286, en: 295 },
    boxY: 225,
  },
  {
    id: 4,
    ar: "التقرير",
    en: "REPORT",
    x: 108,
    y: 150,
    labelY: { ar: 106, en: 96 },
    boxY: 169,
  },
] as const;

export function RadialPipeline({
  phase,
  hasOriginal,
  hasDual,
  hasReport,
  running,
}: {
  phase: Phase;
  hasOriginal: boolean;
  hasDual: boolean;
  hasReport: boolean;
  running: boolean;
}) {
  const states: StationState[] = [
    phase === "analyzing" ? "active" : hasOriginal ? "done" : "idle",
    phase === "optimizing" ? "active" : hasDual ? "done" : "idle",
    phase === "measuring" ? "active" : hasReport ? "done" : "idle",
    hasReport ? "done" : "idle",
  ];
  const activeIndex = states.indexOf("active");
  const current = activeIndex >= 0 ? STATIONS[activeIndex] : null;

  return (
    <div className="flex h-full flex-col">
      <svg
        viewBox="0 0 420 300"
        className="h-auto w-full select-none"
        role="img"
        aria-label="خريطة محطات دورة التحسين"
      >
        {/* guide circle through the stations — dashed, like a dimension ring */}
        <circle
          cx={CX}
          cy={CY}
          r="98"
          fill="none"
          stroke="#94a3b8"
          strokeWidth="1"
          strokeDasharray="2 6"
          opacity="0.7"
        />
        <circle
          cx={CX}
          cy={CY}
          r="44"
          fill="none"
          stroke="#cbd5e1"
          strokeWidth="1"
          opacity="0.7"
        />

        {/* spokes — hairline guides, the active one turns solid brand */}
        {STATIONS.map((s, i) => {
          const state = states[i];
          return (
            <line
              key={`spoke-${s.id}`}
              x1={CX}
              y1={CY}
              x2={s.x}
              y2={s.y}
              stroke={
                state === "active"
                  ? "#20b89a"
                  : state === "done"
                    ? "#0d1729"
                    : "#cbd5e1"
              }
              strokeWidth={state === "idle" ? 1 : 1.6}
              strokeDasharray={state === "active" ? "none" : "4 4"}
            />
          );
        })}

        {/* the measurement marker packet — only exists while a stage runs */}
        {current && running && (
          <path d="M0 -4.5 L4.5 0 L0 4.5 L-4.5 0 Z" fill="#20b89a">
            <animateMotion
              path={`M ${CX} ${CY} L ${current.x} ${current.y}`}
              dur="0.45s"
              repeatCount="indefinite"
            />
          </path>
        )}

        {/* central core — crosshair + rotating dash ring while running */}
        <g>
          <circle
            cx={CX}
            cy={CY}
            r="36"
            fill="#f6f6f2"
            stroke={running ? "#20b89a" : "#0d1729"}
            strokeWidth="1.4"
            strokeDasharray="5 5"
          >
            {running && (
              <animateTransform
                attributeName="transform"
                type="rotate"
                from={`0 ${CX} ${CY}`}
                to={`360 ${CX} ${CY}`}
                dur="24s"
                repeatCount="indefinite"
              />
            )}
          </circle>
          <circle
            cx={CX}
            cy={CY}
            r="25"
            fill="#ffffff"
            stroke="#0d1729"
            strokeWidth="1.2"
          />
          {/* crosshair ticks */}
          <line x1={CX} y1={CY - 20} x2={CX} y2={CY - 11} stroke="#94a3b8" />
          <line x1={CX} y1={CY + 11} x2={CX} y2={CY + 20} stroke="#94a3b8" />
          <line x1={CX - 20} y1={CY} x2={CX - 11} y2={CY} stroke="#94a3b8" />
          <line x1={CX + 20} y1={CY} x2={CX + 11} y2={CY} stroke="#94a3b8" />
          <path
            d={`M${CX} ${CY - 6.5} L${CX + 3.5} ${CY} L${CX} ${CY + 6.5} L${CX - 3.5} ${CY} Z`}
            fill={running ? "#20b89a" : "#0d1729"}
          />
          <text
            x={CX}
            y={CY + 53}
            textAnchor="middle"
            className="fill-ink text-[11px] font-bold"
          >
            نواة التحسين
          </text>
          <text
            x={CX}
            y={CY + 64}
            textAnchor="middle"
            className="fill-slate-400 font-mono text-[7.5px]"
          >
            OPTIMIZER.CORE
          </text>
        </g>

        {/* stations — ring + boxed spec number + bilingual callout label */}
        {STATIONS.map((s, i) => {
          const state = states[i];
          return (
            <g key={s.id}>
              <circle
                cx={s.x}
                cy={s.y}
                r="15"
                fill={state === "done" ? "#20b89a" : "#ffffff"}
                stroke={
                  state === "active"
                    ? "#20b89a"
                    : state === "done"
                      ? "#0d1729"
                      : "#94a3b8"
                }
                strokeWidth={state === "active" ? 2 : 1.3}
              />
              {state === "done" ? (
                <path
                  d={`M${s.x - 4.5} ${s.y} l3 3 l6 -6`}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="2"
                  strokeLinecap="square"
                />
              ) : (
                <circle
                  cx={s.x}
                  cy={s.y}
                  r="4"
                  fill={state === "active" ? "#20b89a" : "#cbd5e1"}
                >
                  {state === "active" && (
                    <animate
                      attributeName="r"
                      values="4;6;4"
                      dur="1.1s"
                      repeatCount="indefinite"
                    />
                  )}
                </circle>
              )}
              {/* boxed station number beside the spoke */}
              <rect
                x={s.x - 10}
                y={s.boxY}
                width="20"
                height="12.5"
                fill="#ffffff"
                stroke={state === "idle" ? "#cbd5e1" : "#0d1729"}
                strokeWidth="1"
              />
              <text
                x={s.x}
                y={s.boxY + 9.5}
                textAnchor="middle"
                className={`font-mono text-[8.5px] font-medium ${
                  state === "idle" ? "fill-slate-400" : "fill-ink"
                }`}
              >
                {String(s.id).padStart(2, "0")}
              </text>
              {/* bilingual callout label — positioned inside the viewBox */}
              <text
                x={s.x}
                y={s.labelY.ar}
                textAnchor="middle"
                className={`text-[12.5px] font-bold ${
                  state === "active"
                    ? "fill-brand-600"
                    : state === "done"
                      ? "fill-ink"
                      : "fill-slate-500"
                }`}
              >
                {s.ar}
              </text>
              <text
                x={s.x}
                y={s.labelY.en}
                textAnchor="middle"
                className="fill-slate-400 font-mono text-[8px]"
              >
                {s.en}
              </text>
            </g>
          );
        })}
      </svg>

      {/* status strip — reads like a spec line, not a spinner */}
      <div className="mt-auto flex w-full items-center justify-between border border-slate-900 bg-white px-3 py-2 text-xs">
        <span className="flex items-center gap-2">
          <span
            className={`h-2 w-2 ${
              running
                ? "bg-brand-500"
                : hasReport
                  ? "bg-ink"
                  : "border border-slate-300 bg-white"
            }`}
          />
          <span className="font-bold">
            {running && current
              ? `المحطة ${String(current.id).padStart(2, "0")}/04 — ${current.ar}`
              : hasReport
                ? "اكتملت الدورة — التقرير جاهز"
                : "الدورة في وضع الاستعداد"}
          </span>
        </span>
        <span className="font-mono text-[10px] text-slate-500" dir="ltr">
          {running && current
            ? `ST-0${current.id} · ${current.en}`
            : hasReport
              ? "CYCLE.COMPLETE"
              : "STANDBY"}
        </span>
      </div>
    </div>
  );
}
