import type { Phase } from "@/components/optimizer-workspace";

type StationState = "idle" | "active" | "done";

/**
 * Linear circuit-trace of the optimization cycle, living inside the input
 * card beside the run button. A solid marker packet travels only toward the
 * station that is actually running — no timers, no simulated progress.
 * Station 01 sits rightmost so the beam flows right→left with RTL reading.
 */

const TRACK_Y = 18;
const STATIONS = [
  { id: 1, ar: "قياس الأصل", x: 516 },
  { id: 2, ar: "المعالجة", x: 372 },
  { id: 3, ar: "قياس الناتج", x: 228 },
  { id: 4, ar: "التقرير", x: 84 },
] as const;

const LINE_START = 56;
const LINE_END = 552;

export function PipelineTrack({
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
  // the packet travels from the previous station (or the button-side edge
  // for station 01) toward the station that is actually running
  const travelFrom = current
    ? activeIndex === 0
      ? LINE_END + 12
      : STATIONS[activeIndex - 1].x
    : null;

  return (
    <svg
      viewBox="0 0 592 56"
      className="h-14 w-full select-none"
      role="img"
      aria-label="مسار محطات دورة التحسين"
    >
      {/* the trace — hairline, solid ink where stages are done */}
      <line
        x1={LINE_START}
        y1={TRACK_Y}
        x2={LINE_END}
        y2={TRACK_Y}
        stroke="#cbd5e1"
        strokeWidth="1.2"
        strokeDasharray="4 4"
      />
      {STATIONS.map((s, i) => {
        const next =
          i > 0 ? STATIONS[i - 1].x : LINE_END + 4;
        const segDone = states[i] === "done" && i > 0 && states[i - 1] === "done";
        return segDone ? (
          <line
            key={`seg-${s.id}`}
            x1={s.x}
            y1={TRACK_Y}
            x2={next}
            y2={TRACK_Y}
            stroke="#0d1729"
            strokeWidth="1.4"
          />
        ) : null;
      })}
      {current && states[activeIndex] === "active" && (
        <line
          x1={travelFrom ?? LINE_END}
          y1={TRACK_Y}
          x2={current.x}
          y2={TRACK_Y}
          stroke="#20b89a"
          strokeWidth="1.4"
        />
      )}

      {/* marker packet — exists only while a stage genuinely runs */}
      {current && running && travelFrom !== null && (
        <path d="M0 -4 L4 0 L0 4 L-4 0 Z" fill="#20b89a">
          <animateMotion
            path={`M ${travelFrom} ${TRACK_Y} L ${current.x} ${TRACK_Y}`}
            dur="0.45s"
            repeatCount="indefinite"
          />
        </path>
      )}

      {/* stations — ring carries state, label carries spec number + name */}
      {STATIONS.map((s, i) => {
        const state = states[i];
        return (
          <g key={s.id}>
            <circle
              cx={s.x}
              cy={TRACK_Y}
              r="13"
              fill={state === "done" ? "#20b89a" : "#ffffff"}
              stroke={
                state === "active"
                  ? "#20b89a"
                  : state === "done"
                    ? "#0d1729"
                    : "#94a3b8"
              }
              strokeWidth={state === "active" ? 1.8 : 1.3}
            />
            {state === "done" ? (
              <path
                d={`M${s.x - 4} ${TRACK_Y} l2.8 2.8 l5.6 -5.6`}
                fill="none"
                stroke="#ffffff"
                strokeWidth="1.8"
                strokeLinecap="square"
              />
            ) : (
              <circle
                cx={s.x}
                cy={TRACK_Y}
                r="3.5"
                fill={state === "active" ? "#20b89a" : "#cbd5e1"}
              />
            )}
            {state === "active" && (
              <circle
                cx={s.x}
                cy={TRACK_Y}
                r="13"
                fill="none"
                stroke="#20b89a"
                strokeWidth="1.3"
                opacity="0.8"
              >
                <animate
                  attributeName="r"
                  values="13;18;13"
                  dur="1.1s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.8;0.15;0.8"
                  dur="1.1s"
                  repeatCount="indefinite"
                />
              </circle>
            )}
            <text
              x={s.x}
              y={TRACK_Y + 26}
              textAnchor="middle"
              className={`text-[11px] font-bold ${
                state === "active"
                  ? "fill-brand-600"
                  : state === "done"
                    ? "fill-ink"
                    : "fill-slate-500"
                }`}
            >
              <tspan
                className={`font-mono text-[9px] font-medium ${
                  state === "idle" ? "fill-slate-400" : "fill-brand-600"
                }`}
              >
                {String(s.id).padStart(2, "0")}
                {"\u00A0"}
              </tspan>
              {s.ar}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
