// components/reports/DuesAgingPage.tsx
"use client";

import { Download } from "lucide-react";
import { reportExportUrl, useDuesAgingReport } from "@/hooks/useReportsApi";
import HorizontalBars from "./charts/HorizontalBars";
import InsightCallout from "./InsightCallout";
import ReportsLayout from "./ReportsLayout";

interface DuesAgingPageProps {
  hospitalId: string;
}

function money(v: number): string {
  return `₹${Math.round(v).toLocaleString("en-IN")}`;
}

const BUCKET_COLORS: Record<string, string> = {
  "0-7 days": "#0D8F7C",
  "8-15 days": "#4F46E5",
  "16-30 days": "#B4600B",
  "31-60 days": "#C33A52",
  "Over 60 days": "#8E2438",
};

export default function DuesAgingPage({ hospitalId }: DuesAgingPageProps) {
  const { data: report, isLoading } = useDuesAgingReport(hospitalId);

  return (
    <ReportsLayout hospitalId={hospitalId}>
      <div className="flex flex-wrap items-end gap-4 mb-4">
        <div>
          <h1 className="text-xl font-bold text-ink-900 font-display tracking-tight">Dues aging</h1>
          <p className="text-sm text-ink-500 mt-0.5">
            Unpaid bills, sorted by how long they've been unpaid.{" "}
            {report ? `As of ${report.asOf}.` : ""}
          </p>
        </div>
        <div className="ml-auto">
          <a
            href={reportExportUrl("dues-aging", hospitalId)}
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
                Total outstanding
              </div>
              <div className="font-mono text-2xl font-bold text-status-danger mt-1">
                {money(report.tiles.totalOutstanding.amount)}
              </div>
              <div className="text-[11px] text-ink-500 mt-0.5">
                {report.tiles.totalOutstanding.billCount} bills ·{" "}
                {report.tiles.totalOutstanding.patientCount} patients
              </div>
            </div>
            <div className="rounded-xl p-4 bg-surface-paper border border-border shadow-sm">
              <div className="text-[11px] uppercase tracking-wide font-semibold text-ink-500">
                Under 15 days
              </div>
              <div className="font-mono text-2xl font-bold text-ink-900 mt-1">
                {money(report.tiles.under15.amount)}
              </div>
              <div className="text-[11px] text-ink-500 mt-0.5">
                usually recovers
              </div>
            </div>
            <div className="rounded-xl p-4 bg-surface-paper border border-border shadow-sm">
              <div className="text-[11px] uppercase tracking-wide font-semibold text-ink-500">
                Over 30 days
              </div>
              <div className="font-mono text-2xl font-bold text-status-warning mt-1">
                {money(report.tiles.over30.amount)}
              </div>
              <div className="text-[11px] text-ink-500 mt-0.5">
                {report.tiles.over30.billCount} bill
                {report.tiles.over30.billCount === 1 ? "" : "s"} · needs a call
              </div>
            </div>
            <div className="rounded-xl p-4 bg-surface-paper border border-border shadow-sm">
              <div className="text-[11px] uppercase tracking-wide font-semibold text-ink-500">
                Recovered this month
              </div>
              <div className="font-mono text-2xl font-bold text-status-open mt-1">
                {money(report.tiles.recovered.amount)}
              </div>
              <div className="text-[11px] text-ink-500 mt-0.5">
                {report.tiles.recovered.count} bill
                {report.tiles.recovered.count === 1 ? "" : "s"} settled
              </div>
            </div>
          </div>

          <div className="bg-surface-paper border border-border rounded-xl shadow-sm p-4 mt-3.5">
            <h2 className="text-sm font-semibold text-ink-900 mb-3 font-display tracking-tight">
              How old the money is
            </h2>
            {report.buckets.every((b) => b.amount === 0) ? (
              <div className="py-6 text-center text-sm text-ink-500">
                No unpaid bills right now.
              </div>
            ) : (
              <HorizontalBars
                rows={report.buckets.map((b) => ({
                  label: b.label,
                  value: b.amount,
                  color: BUCKET_COLORS[b.label],
                }))}
                formatValue={money}
              />
            )}
          </div>

          <div className="bg-surface-paper border border-border rounded-xl shadow-sm overflow-hidden mt-3.5">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h2 className="text-sm font-semibold text-ink-900 font-display tracking-tight">
                Oldest first
              </h2>
              <span className="text-[11.5px] text-ink-500">
                Showing {Math.min(50, report.table.length)} of{" "}
                {report.table.length}
              </span>
            </div>
            {report.table.length === 0 ? (
              <div className="py-10 px-6 text-center text-sm text-ink-500">
                No unpaid bills right now.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-ink-500 bg-surface-canvas/40">
                      <th className="px-4 py-2.5 font-semibold">Patient</th>
                      <th className="px-3 py-2.5 font-semibold">Doctor</th>
                      <th className="px-3 py-2.5 font-semibold">Invoice</th>
                      <th className="px-3 py-2.5 font-semibold text-right">
                        Amount
                      </th>
                      <th className="px-3 py-2.5 font-semibold text-right">
                        Age
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.table.slice(0, 50).map((r) => (
                      <tr key={r.paymentId} className="border-t border-border">
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <div className="font-medium text-ink-900">
                            {r.patientName || "—"}
                          </div>
                          <div className="text-[11px] text-ink-500 font-mono tabular">
                            {r.patientPhone}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-ink-700">
                          {r.doctorName || "—"}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap font-mono text-xs">
                          {r.invoiceNumber}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap">
                          {money(r.amount)}
                        </td>
                        <td
                          className={`px-3 py-2.5 text-right font-mono whitespace-nowrap ${
                            r.ageDays > 30
                              ? "text-status-danger"
                              : r.ageDays > 15
                                ? "text-status-warning"
                                : "text-ink-700"
                          }`}
                        >
                          {r.ageDays} day{r.ageDays === 1 ? "" : "s"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <InsightCallout text={report.insight} tone="warning" />
        </>
      )}
    </ReportsLayout>
  );
}
