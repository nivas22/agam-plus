// components/reports/charts/StackedDayBars.tsx
"use client";

export interface DayBarDatum {
  date: string;
  cash: number;
  upi: number;
  packageSales: number;
  closed: boolean;
}

// Cash/UPI reuse the app's existing status-open/brand-violet tokens; package
// sales gets a third hue the design system doesn't define elsewhere (the app
// has no third categorical token) — validated against the other two with
// dataviz's validate_palette.js (all checks pass in light mode).
const COLORS = { cash: "#0D8F7C", upi: "#4F46E5", packageSales: "#A6337B" };

function money(v: number): string {
  return `₹${Math.round(v).toLocaleString("en-IN")}`;
}

function dayOfMonth(dateIso: string): number {
  return new Date(`${dateIso}T00:00:00.000Z`).getUTCDate();
}

export default function StackedDayBars({ days }: { days: DayBarDatum[] }) {
  const max = Math.max(1, ...days.map((d) => d.cash + d.upi + d.packageSales));
  const width = 1000;
  const height = 170;
  const pad = 28;
  const barGap = 6;
  const bw = (width - pad * 2) / days.length - barGap;

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height + 24}`}
        className="w-full h-auto"
        role="img"
        aria-label="Daily collection split into cash, UPI, and package sales"
      >
        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const y = pad + (height - pad) * (1 - f);
          return (
            <g key={f}>
              <line x1={pad} x2={width - 4} y1={y} y2={y} stroke="#E9EBF4" />
              <text
                x={0}
                y={y + 3.5}
                fontSize={9}
                fill="#7D849E"
                fontFamily="monospace"
              >
                {Math.round((max * f) / 1000)}k
              </text>
            </g>
          );
        })}
        {days.map((d, i) => {
          const total = d.cash + d.upi + d.packageSales;
          const x = pad + i * ((width - pad * 2) / days.length) + barGap / 2;
          let y = pad + (height - pad);
          const segments = [
            { value: d.cash, color: COLORS.cash, label: "Cash" },
            { value: d.upi, color: COLORS.upi, label: "UPI" },
            {
              value: d.packageSales,
              color: COLORS.packageSales,
              label: "Package sales",
            },
          ];

          return (
            <g key={d.date}>
              {total > 0 &&
                segments.map((seg) => {
                  if (!seg.value) return null;
                  const segHeight = (height - pad) * (seg.value / max);
                  y -= segHeight;
                  return (
                    <rect
                      key={seg.label}
                      x={x}
                      y={y}
                      width={Math.max(1, bw)}
                      height={segHeight}
                      fill={seg.color}
                      rx={2}
                    >
                      <title>
                        {d.date} · {seg.label}: {money(seg.value)}
                      </title>
                    </rect>
                  );
                })}
              <text
                x={x + bw / 2}
                y={pad + height - pad + 15}
                fontSize={8.5}
                fill={total === 0 ? "#C3C8DB" : "#7D849E"}
                textAnchor="middle"
                fontFamily="monospace"
              >
                {total === 0 ? "off" : dayOfMonth(d.date)}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="flex gap-4 text-[11.5px] text-ink-500 mt-1">
        <Legend color={COLORS.cash} label="Cash" />
        <Legend color={COLORS.upi} label="UPI" />
        <Legend color={COLORS.packageSales} label="Package sales" />
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <i
        className="w-2.5 h-2.5 rounded-sm inline-block"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}
