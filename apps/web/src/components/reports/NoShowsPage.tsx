// components/reports/NoShowsPage.tsx
"use client";

import { Download } from "lucide-react";
import { useMemo, useState } from "react";
import { reportExportUrl, useNoShowsReport } from "@/hooks/useReportsApi";
import Heatmap from "./charts/Heatmap";
import HorizontalBars from "./charts/HorizontalBars";
import DateRangeTabs from "./DateRangeTabs";
import InsightCallout from "./InsightCallout";
import ReportsLayout from "./ReportsLayout";

interface NoShowsPageProps {
  hospitalId: string;
}

type Range = "month" | "quarter" | "year";

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getRangeDates(range: Range): { start: string; end: string } {
  const today = new Date();
  const start = new Date(today);
  if (range === "month") start.setMonth(start.getMonth() - 1);
  else if (range === "quarter") start.setMonth(start.getMonth() - 3);
  else start.setFullYear(start.getFullYear() - 1);
  return { start: toISODate(start), end: toISODate(today) };
}

const RANGE_OPTIONS = [
  { key: "month", label: "This month" },
  { key: "quarter", label: "Last 3 months" },
  { key: "year", label: "Year" },
];

export default function NoShowsPage({ hospitalId }: NoShowsPageProps) {
  const [range, setRange] = useState<Range>("quarter");
  const rangeDates = useMemo(() => getRangeDates(range), [range]);
  const filters = useMemo(
    () => ({ startDate: rangeDates.start, endDate: rangeDates.end }),
    [rangeDates],
  );

  const { data: report, isLoading } = useNoShowsReport(hospitalId, filters);

  return (
    <ReportsLayout hospitalId={hospitalId}>
      <div className="flex flex-wrap items-end gap-4 mb-4">
        <div>
          <h1 className="text-xl font-bold text-ink-900">No-shows</h1>
          <p className="text-sm text-ink-500 mt-0.5">
            Booked slots nobody arrived for.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <DateRangeTabs
            options={RANGE_OPTIONS}
            value={range}
            onChange={(k) => setRange(k as Range)}
          />
          <a
            href={reportExportUrl("no-shows", hospitalId, filters)}
            className="h-9 px-3.5 rounded-lg border border-border bg-surface-paper text-sm font-medium text-ink-700 hover:bg-surface-canvas transition-colors flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </a>
        </div>
      </div>

      {isLoading || !report ? (
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-violet" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mb-1">
            <div className="rounded-xl p-4 bg-surface-paper border border-border shadow-sm">
              <div className="text-[11px] uppercase tracking-wide font-semibold text-ink-500">
                No-show rate
              </div>
              <div className="font-mono text-2xl font-bold text-status-danger mt-1">
                {report.tiles.noShowRate.rate}%
              </div>
              <div className="text-[11px] text-ink-500 mt-0.5">
                {report.tiles.noShowRate.noShowCount} of{" "}
                {report.tiles.noShowRate.totalCount} booked
              </div>
            </div>
            <div className="rounded-xl p-4 bg-surface-paper border border-border shadow-sm">
              <div className="text-[11px] uppercase tracking-wide font-semibold text-ink-500">
                Trend
              </div>
              <div className="font-mono text-2xl font-bold text-ink-900 mt-1">
                {report.tiles.trend.deltaPoints > 0
                  ? "↑"
                  : report.tiles.trend.deltaPoints < 0
                    ? "↓"
                    : "→"}{" "}
                {Math.abs(report.tiles.trend.deltaPoints)}pt
              </div>
              <div className="text-[11px] text-ink-500 mt-0.5">
                was {report.tiles.trend.previousRate}% before
              </div>
            </div>
            <div className="rounded-xl p-4 bg-surface-paper border border-border shadow-sm">
              <div className="text-[11px] uppercase tracking-wide font-semibold text-ink-500">
                Slots lost
              </div>
              <div className="font-mono text-2xl font-bold text-status-warning mt-1">
                {report.tiles.slotsLost.hours}h
              </div>
              <div className="text-[11px] text-ink-500 mt-0.5">
                roughly ₹
                {Math.round(
                  report.tiles.slotsLost.valueEstimate,
                ).toLocaleString("en-IN")}{" "}
                of capacity
              </div>
            </div>
            <div className="rounded-xl p-4 bg-surface-paper border border-border shadow-sm">
              <div className="text-[11px] uppercase tracking-wide font-semibold text-ink-500">
                Repeat offenders
              </div>
              <div className="font-mono text-2xl font-bold text-ink-900 mt-1">
                {report.tiles.repeatOffenders.count}
              </div>
              <div className="text-[11px] text-ink-500 mt-0.5">
                patients with 3 or more
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 mt-3.5">
            <div className="bg-surface-paper border border-border rounded-xl shadow-sm p-4">
              <h2 className="text-sm font-semibold text-ink-900 mb-3">
                By doctor
              </h2>
              {report.byDoctor.length === 0 ? (
                <div className="py-6 text-center text-sm text-ink-500">
                  Not enough bookings yet.
                </div>
              ) : (
                <HorizontalBars
                  rows={report.byDoctor.map((d) => ({
                    label: d.name,
                    value: d.rate,
                  }))}
                  formatValue={(v) => `${v}%`}
                  barColor="#C33A52"
                />
              )}
            </div>
            <div className="bg-surface-paper border border-border rounded-xl shadow-sm p-4">
              <h2 className="text-sm font-semibold text-ink-900 mb-3">
                By how far ahead it was booked
              </h2>
              <HorizontalBars
                rows={report.byLeadTime.map((b) => ({
                  label: b.bucket,
                  value: b.rate,
                }))}
                formatValue={(v) => `${v}%`}
                barColor="#B4600B"
              />
              <div className="text-[11.5px] text-ink-500 mt-2.5 leading-relaxed">
                Same-day bookings almost always turn up. Longer-lead bookings
                are where reminders matter most.
              </div>
            </div>
          </div>

          <div className="bg-surface-paper border border-border rounded-xl shadow-sm p-4 mt-3.5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-ink-900">
                When they happen
              </h2>
              <span className="text-[11.5px] text-ink-500">
                Darker means more no-shows
              </span>
            </div>
            <Heatmap
              days={report.heatmap.days}
              slots={report.heatmap.slots}
              cells={report.heatmap.cells}
            />
          </div>

          <InsightCallout text={report.insight} />
        </>
      )}
    </ReportsLayout>
  );
}
