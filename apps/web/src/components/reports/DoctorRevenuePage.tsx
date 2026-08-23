// components/reports/DoctorRevenuePage.tsx
"use client";

import { Download } from "lucide-react";
import { useMemo, useState } from "react";
import { reportExportUrl, useDoctorRevenueReport } from "@/hooks/useReportsApi";
import HorizontalBars from "./charts/HorizontalBars";
import DateRangeTabs from "./DateRangeTabs";
import InsightCallout from "./InsightCallout";
import ReportsLayout from "./ReportsLayout";

interface DoctorRevenuePageProps {
  hospitalId: string;
}

type Range = "week" | "month" | "quarter";

function money(v: number): string {
  return `₹${Math.round(v).toLocaleString("en-IN")}`;
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getRangeDates(range: Range): { start: string; end: string } {
  const today = new Date();
  if (range === "week") {
    const start = new Date(today);
    start.setDate(start.getDate() - 6);
    return { start: toISODate(start), end: toISODate(today) };
  }
  if (range === "quarter") {
    const start = new Date(today);
    start.setMonth(start.getMonth() - 3);
    return { start: toISODate(start), end: toISODate(today) };
  }
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  return { start: toISODate(start), end: toISODate(today) };
}

const RANGE_OPTIONS = [
  { key: "week", label: "Week" },
  { key: "month", label: "This month" },
  { key: "quarter", label: "Quarter" },
];

export default function DoctorRevenuePage({
  hospitalId,
}: DoctorRevenuePageProps) {
  const [range, setRange] = useState<Range>("month");
  const rangeDates = useMemo(() => getRangeDates(range), [range]);
  const filters = useMemo(
    () => ({ startDate: rangeDates.start, endDate: rangeDates.end }),
    [rangeDates],
  );

  const { data: report, isLoading } = useDoctorRevenueReport(
    hospitalId,
    filters,
  );

  return (
    <ReportsLayout hospitalId={hospitalId}>
      <div className="flex flex-wrap items-end gap-4 mb-4">
        <div>
          <h1 className="text-xl font-bold text-ink-900 font-display tracking-tight">Doctor revenue</h1>
          <p className="text-sm text-ink-500 mt-0.5">
            What each doctor billed, what actually came in, and how full their
            diary was.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <DateRangeTabs
            options={RANGE_OPTIONS}
            value={range}
            onChange={(k) => setRange(k as Range)}
          />
          <a
            href={reportExportUrl("doctor-revenue", hospitalId, filters)}
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
          <div className="bg-surface-paper border border-border rounded-xl shadow-sm p-4">
            <h2 className="text-sm font-semibold text-ink-900 mb-3 font-display tracking-tight">
              Billed by doctor
            </h2>
            {report.chart.doctors.length === 0 ? (
              <div className="py-6 text-center text-sm text-ink-500">
                No bills in this range.
              </div>
            ) : (
              <HorizontalBars
                rows={report.chart.doctors.map((d) => ({
                  label: d.name,
                  value: d.billed,
                }))}
                formatValue={money}
              />
            )}
          </div>

          <div className="bg-surface-paper border border-border rounded-xl shadow-sm overflow-hidden mt-3.5">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="text-sm font-semibold text-ink-900 font-display tracking-tight">The detail</h2>
            </div>
            {report.table.length === 0 ? (
              <div className="py-10 px-6 text-center text-sm text-ink-500">
                No doctors billed in this range.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-ink-500 bg-surface-canvas/40">
                      <th className="px-4 py-2.5 font-semibold">Doctor</th>
                      <th className="px-3 py-2.5 font-semibold text-right">
                        Visits
                      </th>
                      <th className="px-3 py-2.5 font-semibold text-right">
                        Billed
                      </th>
                      <th className="px-3 py-2.5 font-semibold text-right">
                        Collected
                      </th>
                      <th className="px-3 py-2.5 font-semibold text-right">
                        Outstanding
                      </th>
                      <th className="px-3 py-2.5 font-semibold text-right">
                        From packages
                      </th>
                      <th className="px-3 py-2.5 font-semibold text-right">
                        Avg / visit
                      </th>
                      <th className="px-3 py-2.5 font-semibold">Diary full</th>
                      <th className="px-3 py-2.5 font-semibold text-right">
                        No-show
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.table.map((r) => (
                      <tr
                        key={r.doctorProfileId}
                        className="border-t border-border"
                      >
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <div className="font-medium text-ink-900">
                            {r.name}
                          </div>
                          {r.specialization && (
                            <div className="text-[11px] text-ink-500">
                              {r.specialization}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap">
                          {r.visits}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap">
                          {money(r.billed)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap">
                          {money(r.collected)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap text-status-warning">
                          {money(r.outstanding)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap">
                          {money(r.fromPackages)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap">
                          {money(r.avgPerVisit)}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          {r.diaryFullPct === null ? (
                            <span className="text-ink-500 text-xs">—</span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="w-16 h-1.5 rounded-full bg-surface-canvas overflow-hidden block">
                                <span
                                  className="block h-full rounded-full"
                                  style={{
                                    width: `${Math.min(100, r.diaryFullPct)}%`,
                                    background:
                                      r.diaryFullPct >= 85
                                        ? "#0D8F7C"
                                        : "#4F46E5",
                                  }}
                                />
                              </span>
                              <span className="font-mono text-[11.5px]">
                                {r.diaryFullPct}%
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap">
                          {r.noShowPct === null ? "—" : `${r.noShowPct}%`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-surface-canvas/40 border-t border-border font-semibold">
                      <td className="px-4 py-2.5">All doctors</td>
                      <td className="px-3 py-2.5 text-right font-mono">
                        {report.totals.visits}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono">
                        {money(report.totals.billed)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono">
                        {money(report.totals.collected)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-status-warning">
                        {money(report.totals.outstanding)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono">
                        {money(report.totals.fromPackages)}
                      </td>
                      <td className="px-3 py-2.5" colSpan={3} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          <InsightCallout text={report.insight} />
        </>
      )}
    </ReportsLayout>
  );
}
