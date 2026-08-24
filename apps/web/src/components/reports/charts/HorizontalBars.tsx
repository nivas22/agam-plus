// components/reports/charts/HorizontalBars.tsx
"use client";

export interface BarRow {
  label: string;
  value: number;
  color?: string;
}

interface HorizontalBarsProps {
  rows: BarRow[];
  formatValue: (v: number) => string;
  barColor?: string;
}

// A single generic magnitude-ranking chart, reused for Doctor revenue's
// "Billed by doctor", Dues aging's "How old the money is", and No-shows'
// "By doctor"/"By lead time" bars. One hue (or a caller-provided per-row
// color for sequential/status bars) — values are always labeled directly so
// identity never depends on color alone.
export default function HorizontalBars({
  rows,
  formatValue,
  barColor = "#4F46E5",
}: HorizontalBarsProps) {
  const max = Math.max(1, ...rows.map((r) => r.value));

  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((row) => (
        <div
          key={row.label}
          className="grid grid-cols-[minmax(0,160px)_1fr_auto] gap-3 items-center"
        >
          <span
            className="text-[12.5px] text-ink-700 truncate"
            title={row.label}
          >
            {row.label}
          </span>
          <span className="h-4 rounded-md bg-surface-canvas overflow-hidden block">
            <span
              className="block h-full rounded-md"
              style={{
                width: `${Math.max(2, (row.value / max) * 100)}%`,
                background: row.color || barColor,
              }}
            />
          </span>
          <span className="font-mono text-xs text-ink-900 text-right whitespace-nowrap">
            {formatValue(row.value)}
          </span>
        </div>
      ))}
    </div>
  );
}
