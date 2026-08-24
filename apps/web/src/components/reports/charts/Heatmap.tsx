// components/reports/charts/Heatmap.tsx
"use client";

import { Fragment } from "react";

export interface HeatmapCell {
  total: number;
  noShows: number;
  rate: number;
}

interface HeatmapProps {
  days: string[];
  slots: string[];
  cells: HeatmapCell[][];
}

// Sequential magnitude encoding — one hue (status-danger), light-to-dark by
// no-show rate. Every cell is directly labeled with its %, so the color
// alone never carries the only signal.
export default function Heatmap({ days, slots, cells }: HeatmapProps) {
  return (
    <div className="overflow-x-auto">
      <div
        className="grid gap-1 min-w-[520px]"
        style={{
          gridTemplateColumns: `72px repeat(${days.length}, minmax(0, 1fr))`,
        }}
      >
        <div />
        {days.map((d) => (
          <div
            key={d}
            className="text-[10.5px] font-semibold text-ink-500 uppercase text-center"
          >
            {d}
          </div>
        ))}
        {slots.map((slot, slotIdx) => (
          <Fragment key={slot}>
            <div className="text-[10.5px] text-ink-500 flex items-center justify-end pr-1.5 text-right font-mono tabular">
              {slot}
            </div>
            {days.map((d, dayIdx) => {
              const cell = cells[slotIdx]?.[dayIdx] || {
                total: 0,
                noShows: 0,
                rate: 0,
              };
              const alpha =
                cell.total === 0
                  ? 0
                  : 0.08 + Math.min(1, cell.rate / 100) * 0.72;
              const light = alpha > 0.5;
              return (
                <div
                  key={`${slot}-${d}`}
                  className="h-8 rounded-md flex items-center justify-center text-[10.5px] font-mono"
                  style={{
                    background:
                      cell.total === 0
                        ? "#FAFBFE"
                        : `rgba(195, 58, 82, ${alpha})`,
                    color: light ? "#fff" : "#4A5170",
                  }}
                  title={`${d} ${slot}: ${cell.noShows} of ${cell.total} no-shows (${cell.rate}%)`}
                >
                  {cell.total > 0 ? `${cell.rate}%` : ""}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
