// components/reports/DailyCollectionPage.tsx
"use client";

import { Download } from "lucide-react";
import { useMemo, useState } from "react";
import {
  reportExportUrl,
  useDailyCollectionReport,
} from "@/hooks/useReportsApi";
import StackedDayBars from "./charts/StackedDayBars";
import DateRangeTabs from "./DateRangeTabs";
import InsightCallout from "./InsightCallout";
import ReportsLayout from "./ReportsLayout";

interface DailyCollectionPageProps {
  hospitalId: string;
}

type Range = "today" | "week" | "month" | "custom";

function money(v: number): string {
  return `₹${Math.round(v).toLocaleString("en-IN")}`;
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getRangeDates(
  range: Range,
  customStart: string,
  customEnd: string,
): { start: string; end: string } {
  const today = new Date();
  if (range === "today")
    return { start: toISODate(today), end: toISODate(today) };
  if (range === "week") {
    const start = new Date(today);
    start.setDate(start.getDate() - 6);
    return { start: toISODate(start), end: toISODate(today) };
  }
  if (range === "month") {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return { start: toISODate(start), end: toISODate(today) };
  }
  return {
    start: customStart || toISODate(today),
    end: customEnd || toISODate(today),
  };
}

const RANGE_OPTIONS = [
  { key: "today", label: "Today" },
  { key: "week", label: "Week" },
  { key: "month", label: "This month" },
  { key: "custom", label: "Custom" },
];

export default function DailyCollectionPage({
  hospitalId,
}: DailyCollectionPageProps) {
  const [range, setRange] = useState<Range>("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const rangeDates = useMemo(
    () => getRangeDates(range, customStart, customEnd),
    [range, customStart, customEnd],
  );
  const filters = useMemo(
    () => ({ startDate: rangeDates.start, endDate: rangeDates.end }),
    [rangeDates],
  );

  const { data: report, isLoading } = useDailyCollectionReport(
    hospitalId,
    filters,
  );

  const collectedEarnedNote =
    report && report.tiles.earned.amount !== report.tiles.collected.amount
      ? "Collected and Earned aren't the same number, and shouldn't be. Earned reflects services actually delivered in this range — Collected reflects cash that changed hands, including new package sales not yet used and excluding package credit spent from packages sold earlier."
      : null;

  return (
    <ReportsLayout hospitalId={hospitalId}>
      <div className="flex flex-wrap items-end gap-4 mb-4">
        <div>
          <h1 className="text-xl font-bold text-ink-900 font-display tracking-tight">Daily collection</h1>
          <p className="text-sm text-ink-500 mt-0.5">
            Money that came in, how it came in, and who took it.{" "}
            {rangeDates.start} – {rangeDates.end}.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <DateRangeTabs
            options={RANGE_OPTIONS}
            value={range}
            onChange={(k) => setRange(k as Range)}
          />
          <a
            href={reportExportUrl("daily-collection", hospitalId, filters)}
            className="h-9 px-3.5 rounded-lg border border-border bg-surface-paper text-sm font-medium text-ink-700 hover:bg-surface-canvas transition-colors flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </a>
        </div>
      </div>

      {range === "custom" && (
        <div className="flex items-center gap-2 mb-4">
          <input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="h-9 px-3 rounded-lg border border-border text-sm"
          />
          <span className="text-ink-500 text-sm">to</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="h-9 px-3 rounded-lg border border-border text-sm"
          />
        </div>
      )}

      {isLoading || !report ? (
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-violet" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mb-1">
            <div className="rounded-xl p-4 bg-gradient-to-br from-status-open to-status-open-hover text-white shadow-sm">
              <div className="text-[11px] uppercase tracking-wide font-semibold text-white/75">
                Collected
              </div>
              <div className="font-mono text-2xl font-bold mt-1">
                {money(report.tiles.collected.amount)}
              </div>
              <div className="text-[11px] text-white/80 mt-0.5">
                cash in the door, {report.tiles.collected.activeDays} active day
                {report.tiles.collected.activeDays === 1 ? "" : "s"}
              </div>
            </div>
            <div className="rounded-xl p-4 bg-surface-paper border border-border shadow-sm">
              <div className="text-[11px] uppercase tracking-wide font-semibold text-ink-500">
                Earned
              </div>
              <div className="font-mono text-2xl font-bold text-ink-900 mt-1">
                {money(report.tiles.earned.amount)}
              </div>
              <div className="text-[11px] text-ink-500 mt-0.5">
                services actually delivered
              </div>
            </div>
            <div className="rounded-xl p-4 bg-surface-paper border border-border shadow-sm">
              <div className="text-[11px] uppercase tracking-wide font-semibold text-ink-500">
                Raised but unpaid
              </div>
              <div className="font-mono text-2xl font-bold text-status-warning mt-1">
                {money(report.tiles.raisedButUnpaid.amount)}
              </div>
              <div className="text-[11px] text-ink-500 mt-0.5">
                {report.tiles.raisedButUnpaid.patientCount} patient
                {report.tiles.raisedButUnpaid.patientCount === 1 ? "" : "s"} ·
                see Dues aging
              </div>
            </div>
            <div className="rounded-xl p-4 bg-surface-paper border border-border shadow-sm">
              <div className="text-[11px] uppercase tracking-wide font-semibold text-ink-500">
                Refunded
              </div>
              <div className="font-mono text-2xl font-bold text-status-danger mt-1">
                {money(report.tiles.refunded.amount)}
              </div>
              <div className="text-[11px] text-ink-500 mt-0.5">
                {report.tiles.refunded.count} refund
                {report.tiles.refunded.count === 1 ? "" : "s"}
              </div>
            </div>
          </div>

          {collectedEarnedNote && <InsightCallout text={collectedEarnedNote} />}

          <div className="bg-surface-paper border border-border rounded-xl shadow-sm p-4 mt-3.5">
            <h2 className="text-sm font-semibold text-ink-900 mb-3 font-display tracking-tight">
              Every day in range
            </h2>
            <StackedDayBars days={report.chart.days} />
          </div>

          <div className="bg-surface-paper border border-border rounded-xl shadow-sm overflow-hidden mt-3.5">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h2 className="text-sm font-semibold text-ink-900 font-display tracking-tight">
                Who collected it
              </h2>
              <span className="text-[11.5px] text-ink-500">
                Drawer variance is the number to watch
              </span>
            </div>
            {report.byUser.length === 0 ? (
              <div className="py-10 px-6 text-center text-sm text-ink-500">
                No payments collected in this range.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-ink-500 bg-surface-canvas/40">
                      <th className="px-4 py-2.5 font-semibold">Member</th>
                      <th className="px-3 py-2.5 font-semibold text-right">
                        Cash
                      </th>
                      <th className="px-3 py-2.5 font-semibold text-right">
                        UPI
                      </th>
                      <th className="px-3 py-2.5 font-semibold text-right">
                        Total
                      </th>
                      <th className="px-3 py-2.5 font-semibold text-right">
                        Payments
                      </th>
                      <th className="px-3 py-2.5 font-semibold text-right">
                        Drawer variance
                      </th>
                      <th className="px-3 py-2.5 font-semibold">Days closed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.byUser.map((u) => (
                      <tr key={u.userId} className="border-t border-border">
                        <td className="px-4 py-2.5 whitespace-nowrap font-medium text-ink-900">
                          {u.name}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap">
                          {money(u.cash)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap">
                          {money(u.upi)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap">
                          {money(u.total)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap">
                          {u.paymentCount}
                        </td>
                        <td
                          className={`px-3 py-2.5 text-right font-mono whitespace-nowrap ${
                            u.drawerVariance === 0
                              ? "text-ink-700"
                              : "text-status-warning"
                          }`}
                        >
                          {u.drawerVariance === 0
                            ? "₹0"
                            : `${u.drawerVariance > 0 ? "+" : "−"}${money(Math.abs(u.drawerVariance))}`}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span
                            className={`inline-block rounded-md px-2 py-0.5 text-[10.5px] font-semibold ${
                              u.activeDays > 0 && u.closedDays === u.activeDays
                                ? "bg-status-open-soft text-status-open"
                                : "bg-status-warning-soft text-status-warning"
                            }`}
                          >
                            {u.closedDays} of {u.activeDays}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-surface-canvas/40 border-t border-border font-semibold">
                      <td className="px-4 py-2.5">Total</td>
                      <td className="px-3 py-2.5 text-right font-mono">
                        {money(report.totals.cash)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono">
                        {money(report.totals.upi)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono">
                        {money(report.totals.cash + report.totals.upi)}
                      </td>
                      <td className="px-3 py-2.5" />
                      <td
                        className={`px-3 py-2.5 text-right font-mono ${
                          report.totals.drawerVariance === 0
                            ? ""
                            : "text-status-warning"
                        }`}
                      >
                        {report.totals.drawerVariance === 0
                          ? "₹0"
                          : `${report.totals.drawerVariance > 0 ? "+" : "−"}${money(Math.abs(report.totals.drawerVariance))}`}
                      </td>
                      <td className="px-3 py-2.5" />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          <InsightCallout
            text={report.insight}
            tone={report.unclosedDates.length > 0 ? "warning" : "brand"}
          />
        </>
      )}
    </ReportsLayout>
  );
}
