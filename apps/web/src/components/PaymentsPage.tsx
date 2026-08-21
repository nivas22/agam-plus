// components/PaymentsPage.tsx
"use client";

import { format } from "date-fns";
import {
  Clock,
  Download,
  Info,
  Search,
  Smartphone,
  SplitSquareHorizontal,
  Wallet,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  useCloseDay,
  useDayClose,
  useHospitalPayments,
} from "@/hooks/useNewPaymentApi";
import type { Payment } from "@/types/payment";
import { PAYMENT_METHOD, PAYMENT_STATUS } from "../constants";
import {
  AddUtrDialog,
  CollectDueDialog,
  ReceiptDialog,
  RefundDialog,
} from "./payments/PaymentActionDialogs";

interface PaymentsPageProps {
  hospitalId: string;
}

type Range = "today" | "week" | "month" | "custom";
type MethodFilter = "all" | "cash" | "upi" | "unpaid";
type DialogState = {
  kind: "utr" | "collect" | "refund" | "receipt";
  payment: Payment;
} | null;

function money(v: number): string {
  return `₹${Math.round(v).toLocaleString("en-IN")}`;
}

function toISODate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function daysAgo(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
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
    const start = new Date(today);
    start.setDate(start.getDate() - 29);
    return { start: toISODate(start), end: toISODate(today) };
  }
  return {
    start: customStart || toISODate(today),
    end: customEnd || toISODate(today),
  };
}

function escapeCsv(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportCsv(payments: Payment[]) {
  const header = [
    "Invoice",
    "Date",
    "Patient",
    "Phone",
    "Doctor",
    "Items",
    "Amount",
    "Method",
    "Status",
  ];
  const rows = payments.map((p) => [
    p.invoiceNumber,
    format(new Date(p.createdAt), "yyyy-MM-dd HH:mm"),
    p.patientName || "",
    p.patientPhone || "",
    p.doctorName || "",
    p.items.map((i) => i.name).join("; "),
    p.total,
    p.method,
    p.status,
  ]);
  const csv = [header, ...rows]
    .map((r) => r.map(escapeCsv).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `payments-${toISODate(new Date())}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Buckets amounts collected into 8 equal-width windows across the selected
// range, for the stat card's sparkline. Refunds/due amounts don't count as "collected".
function buildSparkline(payments: Payment[], start: Date, end: Date): number[] {
  const buckets = new Array(8).fill(0);
  const span = end.getTime() - start.getTime();
  if (span <= 0) return buckets;
  for (const p of payments) {
    if (p.status !== PAYMENT_STATUS.PAID) continue;
    const amt =
      p.method === PAYMENT_METHOD.SPLIT
        ? (p.splitCashAmount || 0) + (p.splitUpiAmount || 0)
        : p.total;
    const t = new Date(p.createdAt).getTime();
    const idx = Math.max(
      0,
      Math.min(7, Math.floor(((t - start.getTime()) / span) * 8)),
    );
    buckets[idx] += amt;
  }
  return buckets;
}

function MethodBadge({ payment }: { payment: Payment }) {
  if (payment.method === PAYMENT_METHOD.CASH)
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-ink-700">
        <Wallet className="w-3.5 h-3.5 text-status-open" /> Cash
      </span>
    );
  if (payment.method === PAYMENT_METHOD.UPI)
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-ink-700">
        <Smartphone className="w-3.5 h-3.5 text-brand-violet" /> UPI
      </span>
    );
  if (payment.method === PAYMENT_METHOD.SPLIT)
    return (
      <span className="inline-flex items-start gap-1.5 text-xs text-ink-700">
        <SplitSquareHorizontal className="w-3.5 h-3.5 text-status-warning mt-0.5" />
        <span>
          {money(payment.splitCashAmount || 0)} cash
          <br />+ {money(payment.splitUpiAmount || 0)} UPI
        </span>
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink-500">
      <Clock className="w-3.5 h-3.5" /> Not collected
    </span>
  );
}

function StatusPill({ payment }: { payment: Payment }) {
  if (payment.status === PAYMENT_STATUS.REFUNDED)
    return (
      <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold bg-surface-canvas text-ink-500">
        Refunded
      </span>
    );
  if (payment.status === PAYMENT_STATUS.DUE) {
    const days = daysAgo(payment.createdAt);
    return (
      <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold bg-status-danger-soft text-status-danger">
        Due {days} day{days === 1 ? "" : "s"}
      </span>
    );
  }
  if (payment.method === PAYMENT_METHOD.UPI && !payment.upiReference)
    return (
      <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold bg-status-warning-soft text-status-warning">
        No reference
      </span>
    );
  return (
    <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold bg-status-open-soft text-status-open">
      Paid
    </span>
  );
}

export default function PaymentsPage({ hospitalId }: PaymentsPageProps) {
  const { user } = useAuth();
  const [range, setRange] = useState<Range>("today");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState<MethodFilter>("all");
  const [dialog, setDialog] = useState<DialogState>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [openingFloat, setOpeningFloat] = useState(0);
  const [countedAmount, setCountedAmount] = useState<number | "">("");
  const [closeNote, setCloseNote] = useState("");
  const [closeError, setCloseError] = useState<string | null>(null);

  const today = toISODate(new Date());
  const rangeDates = useMemo(
    () => getRangeDates(range, customStart, customEnd),
    [range, customStart, customEnd],
  );

  const params = useMemo(() => {
    const p = new URLSearchParams();
    p.append("startDate", `${rangeDates.start}T00:00:00.000Z`);
    p.append("endDate", `${rangeDates.end}T23:59:59.999Z`);
    return p;
  }, [rangeDates]);

  const { data, isLoading, refetch } = useHospitalPayments(hospitalId, params);
  const payments = data?.payments || [];

  const { data: dayClose, refetch: refetchDayClose } = useDayClose(
    hospitalId,
    today,
  );
  const closeDayMutation = useCloseDay(hospitalId);

  useEffect(() => {
    if (dayClose && !dayClose.closed) {
      setOpeningFloat(dayClose.openingFloat || 0);
    }
  }, [dayClose]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const handleDialogSuccess = useCallback(
    async (message: string) => {
      showToast(message);
      await refetch();
      await refetchDayClose();
    },
    [showToast, refetch, refetchDayClose],
  );

  const stats = useMemo(() => {
    let cash = 0;
    let upi = 0;
    let unpaid = 0;
    let paidCount = 0;
    let oldestDueDays = 0;
    const unpaidPatients = new Set<string>();

    payments.forEach((p) => {
      if (p.status === PAYMENT_STATUS.PAID) {
        paidCount++;
        if (p.method === PAYMENT_METHOD.CASH) cash += p.total;
        else if (p.method === PAYMENT_METHOD.UPI) upi += p.total;
        else if (p.method === PAYMENT_METHOD.SPLIT) {
          cash += p.splitCashAmount || 0;
          upi += p.splitUpiAmount || 0;
        }
      } else if (p.status === PAYMENT_STATUS.DUE) {
        unpaid += p.total;
        unpaidPatients.add(p.patientId);
        oldestDueDays = Math.max(oldestDueDays, daysAgo(p.createdAt));
      }
    });

    const collected = cash + upi;
    return {
      collected,
      cash,
      upi,
      unpaid,
      paidCount,
      avg: paidCount ? Math.round(collected / paidCount) : 0,
      unpaidCount: unpaidPatients.size,
      oldestDueDays,
      awaitingReference: payments.filter(
        (p) =>
          p.status === PAYMENT_STATUS.PAID &&
          p.method === PAYMENT_METHOD.UPI &&
          !p.upiReference,
      ).length,
      inDrawerCount: payments.filter(
        (p) =>
          p.status === PAYMENT_STATUS.PAID &&
          (p.method === PAYMENT_METHOD.CASH ||
            p.method === PAYMENT_METHOD.SPLIT),
      ).length,
    };
  }, [payments]);

  const sparkline = useMemo(
    () =>
      buildSparkline(
        payments,
        new Date(`${rangeDates.start}T00:00:00.000Z`),
        new Date(`${rangeDates.end}T23:59:59.999Z`),
      ),
    [payments, rangeDates],
  );
  const sparkMax = Math.max(1, ...sparkline);

  const filtered = useMemo(() => {
    let results = payments;
    if (methodFilter === "cash")
      results = results.filter(
        (p) =>
          p.method === PAYMENT_METHOD.CASH || p.method === PAYMENT_METHOD.SPLIT,
      );
    else if (methodFilter === "upi")
      results = results.filter(
        (p) =>
          p.method === PAYMENT_METHOD.UPI || p.method === PAYMENT_METHOD.SPLIT,
      );
    else if (methodFilter === "unpaid")
      results = results.filter((p) => p.status === PAYMENT_STATUS.DUE);

    const q = search.trim().toLowerCase();
    if (q) {
      results = results.filter(
        (p) =>
          p.invoiceNumber.toLowerCase().includes(q) ||
          p.patientName?.toLowerCase().includes(q) ||
          p.patientPhone?.toLowerCase().includes(q),
      );
    }
    return [...results].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [payments, methodFilter, search]);

  const expectedDrawer =
    openingFloat +
    (dayClose?.cashCollected || 0) -
    (dayClose?.refundsPaidOut || 0);
  const variance = countedAmount === "" ? null : countedAmount - expectedDrawer;

  const submitCloseDay = async () => {
    setCloseError(null);
    if (countedAmount === "") {
      setCloseError("Enter what's actually in the drawer");
      return;
    }
    if (variance !== 0 && !closeNote.trim()) {
      setCloseError("A note is required when it doesn't match");
      return;
    }
    try {
      await closeDayMutation.mutateAsync({
        date: today,
        openingFloat,
        countedAmount,
        note: closeNote.trim() || undefined,
      });
      showToast("Day closed and entries locked");
    } catch (err) {
      setCloseError(
        err instanceof Error ? err.message : "Failed to close the day",
      );
    }
  };

  const rangeLabel =
    range === "today"
      ? "today"
      : range === "week"
        ? "this week"
        : range === "month"
          ? "this month"
          : "in range";

  return (
    <div className="pb-16">
      <div className="flex flex-wrap items-end gap-4 mb-4">
        <div>
          <h1 className="text-xl font-bold text-ink-900">Payments</h1>
          <p className="text-sm text-ink-500 mt-0.5">
            Every visit that was billed, and what is still owed.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center bg-surface-canvas border border-border rounded-lg p-0.5">
            {(["today", "week", "month", "custom"] as Range[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
                  range === r ? "bg-brand-violet text-white" : "text-ink-700"
                }`}
              >
                {r === "week" ? "This week" : r === "month" ? "Month" : r}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => exportCsv(filtered)}
            className="h-9 px-3.5 rounded-lg border border-border bg-surface-paper text-sm font-medium text-ink-700 hover:bg-surface-canvas transition-colors flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mb-4">
        <div className="rounded-xl p-4 bg-gradient-to-br from-status-open to-status-open-hover text-white shadow-sm">
          <div className="text-[11px] uppercase tracking-wide font-semibold text-white/75">
            Collected {rangeLabel}
          </div>
          <div className="font-mono text-2xl font-bold mt-1">
            {money(stats.collected)}
          </div>
          <div className="text-[11px] text-white/80 mt-0.5">
            {stats.paidCount} visit{stats.paidCount === 1 ? "" : "s"} billed ·
            avg {money(stats.avg)}
          </div>
          <div className="flex gap-1 items-end h-6 mt-2.5">
            {sparkline.map((v, i) => (
              <div
                key={i}
                className={`flex-1 rounded-sm ${v === sparkMax && v > 0 ? "bg-white" : "bg-white/35"}`}
                style={{ height: `${Math.max(10, (v / sparkMax) * 100)}%` }}
              />
            ))}
          </div>
        </div>
        <div className="rounded-xl p-4 bg-surface-paper border border-border shadow-sm">
          <div className="text-[11px] uppercase tracking-wide font-semibold text-ink-500">
            Cash
          </div>
          <div className="font-mono text-2xl font-bold text-ink-900 mt-1">
            {money(stats.cash)}
          </div>
          <div className="text-[11px] text-ink-500 mt-0.5">
            {stats.inDrawerCount} visits · in the drawer
          </div>
        </div>
        <div className="rounded-xl p-4 bg-surface-paper border border-border shadow-sm">
          <div className="text-[11px] uppercase tracking-wide font-semibold text-ink-500">
            UPI / GPay
          </div>
          <div className="font-mono text-2xl font-bold text-ink-900 mt-1">
            {money(stats.upi)}
          </div>
          <div className="text-[11px] text-ink-500 mt-0.5">
            {stats.awaitingReference > 0
              ? `${stats.awaitingReference} awaiting reference`
              : "all traced"}
          </div>
        </div>
        <div className="rounded-xl p-4 bg-surface-paper border border-border shadow-sm">
          <div className="text-[11px] uppercase tracking-wide font-semibold text-ink-500">
            Unpaid
          </div>
          <div className="font-mono text-2xl font-bold text-status-danger mt-1">
            {money(stats.unpaid)}
          </div>
          <div className="text-[11px] text-ink-500 mt-0.5">
            {stats.unpaidCount} patient{stats.unpaidCount === 1 ? "" : "s"}
            {stats.oldestDueDays > 0
              ? ` · oldest ${stats.oldestDueDays} day${stats.oldestDueDays === 1 ? "" : "s"}`
              : ""}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4 items-start">
        <div className="bg-surface-paper border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="flex flex-wrap items-center gap-2.5 px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold text-ink-900">
              {range === "today" ? "Today's transactions" : "Transactions"}
            </h2>
            <div className="ml-auto relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Patient, invoice or phone"
                className="h-9 pl-8 pr-3 rounded-lg border border-border bg-surface-canvas text-sm w-52 focus:outline-none focus:ring-2 focus:ring-brand-violet/20 focus:border-brand-violet"
              />
            </div>
            <div className="flex items-center bg-surface-canvas border border-border rounded-lg p-0.5">
              {(["all", "cash", "upi", "unpaid"] as MethodFilter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setMethodFilter(f)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
                    methodFilter === f
                      ? "bg-surface-paper text-brand-violet shadow-sm"
                      : "text-ink-700"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-violet" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-14 px-6 text-center text-sm text-ink-500">
              No transactions in this range.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-ink-500 bg-surface-canvas/40">
                    <th className="px-4 py-2.5 font-semibold">Invoice</th>
                    <th className="px-3 py-2.5 font-semibold">Patient</th>
                    <th className="px-3 py-2.5 font-semibold">Doctor</th>
                    <th className="px-3 py-2.5 font-semibold">Items</th>
                    <th className="px-3 py-2.5 font-semibold text-right">
                      Amount
                    </th>
                    <th className="px-3 py-2.5 font-semibold">Method</th>
                    <th className="px-3 py-2.5 font-semibold">Status</th>
                    <th className="px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.id} className="border-t border-border">
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <div className="font-mono text-xs font-semibold text-ink-900">
                          {p.invoiceNumber}
                        </div>
                        <div className="text-[11px] text-ink-500">
                          {format(new Date(p.createdAt), "h:mm a")}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="font-medium text-ink-900">
                          {p.patientName || "—"}
                        </div>
                        <div className="text-[11px] text-ink-500">
                          {p.patientPhone}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-ink-700">
                        Dr. {p.doctorName || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-ink-700 max-w-[220px]">
                        {p.items.map((i) => i.name).join(", ")}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap">
                        {money(p.total)}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <MethodBadge payment={p} />
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <StatusPill payment={p} />
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        {p.status === PAYMENT_STATUS.DUE ? (
                          <button
                            type="button"
                            onClick={() =>
                              setDialog({ kind: "collect", payment: p })
                            }
                            className="h-7 px-3 rounded-lg bg-brand-violet text-white text-xs font-semibold"
                          >
                            Collect
                          </button>
                        ) : p.status === PAYMENT_STATUS.REFUNDED ? (
                          <button
                            type="button"
                            onClick={() =>
                              setDialog({ kind: "receipt", payment: p })
                            }
                            className="h-7 px-3 rounded-lg border border-border text-xs font-medium text-ink-700"
                          >
                            Note
                          </button>
                        ) : p.method === PAYMENT_METHOD.UPI &&
                          !p.upiReference ? (
                          <button
                            type="button"
                            onClick={() =>
                              setDialog({ kind: "utr", payment: p })
                            }
                            className="h-7 px-3 rounded-lg border border-border text-xs font-medium text-ink-700"
                          >
                            Add UTR
                          </button>
                        ) : (
                          <div className="flex items-center gap-2 justify-end">
                            <button
                              type="button"
                              onClick={() =>
                                setDialog({ kind: "receipt", payment: p })
                              }
                              className="h-7 px-3 rounded-lg border border-border text-xs font-medium text-ink-700"
                            >
                              Receipt
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setDialog({ kind: "refund", payment: p })
                              }
                              className="text-xs text-status-danger hover:underline"
                            >
                              Refund
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-surface-paper border border-border rounded-xl shadow-sm p-4">
          <h2 className="text-sm font-semibold text-ink-900 mb-3">
            Close the day
          </h2>

          {!dayClose ? (
            <div className="text-sm text-ink-500">Loading…</div>
          ) : dayClose.closed ? (
            <div>
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-status-open-soft border border-status-open/20 text-sm text-status-open mb-3">
                Closed by {dayClose.closedBy}{" "}
                {dayClose.closedAt &&
                  `· ${format(new Date(dayClose.closedAt), "h:mm a")}`}
              </div>
              <Row label="Opening float" value={money(dayClose.openingFloat)} />
              <Row
                label="Cash collected"
                value={money(dayClose.cashCollected)}
              />
              <Row
                label="Refunds paid out"
                value={`− ${money(dayClose.refundsPaidOut)}`}
              />
              <Row
                label="Counted in drawer"
                value={money(dayClose.countedAmount || 0)}
                bold
              />
              {dayClose.variance !== 0 && dayClose.note && (
                <div className="mt-2 text-xs text-ink-500">
                  <span className="font-semibold text-ink-700">Note:</span>{" "}
                  {dayClose.note}
                </div>
              )}
            </div>
          ) : (
            <div>
              <Row
                label="Opening float"
                value={
                  <input
                    type="number"
                    value={openingFloat}
                    onChange={(e) =>
                      setOpeningFloat(Number(e.target.value) || 0)
                    }
                    className="w-24 text-right border border-border rounded-md px-1.5 py-0.5 text-xs font-mono"
                  />
                }
              />
              <Row
                label="Cash collected"
                value={money(dayClose.cashCollected)}
              />
              <Row
                label="Refunds paid out"
                value={`− ${money(dayClose.refundsPaidOut)}`}
              />
              <Row
                label="Drawer should hold"
                value={money(expectedDrawer)}
                bold
              />

              <div className="mt-3">
                <label className="text-xs font-semibold text-ink-700 mb-1 block">
                  Counted in the drawer
                </label>
                <input
                  type="number"
                  value={countedAmount}
                  onChange={(e) =>
                    setCountedAmount(
                      e.target.value === "" ? "" : Number(e.target.value),
                    )
                  }
                  className="w-full h-9 px-2.5 border border-border rounded-lg text-sm font-mono"
                />
              </div>

              {variance !== null && variance !== 0 && (
                <div className="mt-2 flex justify-between items-baseline px-3 py-2 rounded-lg bg-status-warning-soft border border-status-warning/20 text-xs text-status-warning">
                  <span>{variance > 0 ? "Over by" : "Short by"}</span>
                  <span className="font-mono font-semibold">
                    {money(Math.abs(variance))}
                  </span>
                </div>
              )}

              {variance !== null && variance !== 0 && (
                <div className="mt-3">
                  <label className="text-xs font-semibold text-ink-700 mb-1 block">
                    Note{" "}
                    <span className="font-normal text-ink-500">
                      required when it doesn't match
                    </span>
                  </label>
                  <input
                    type="text"
                    value={closeNote}
                    onChange={(e) => setCloseNote(e.target.value)}
                    placeholder="What happened?"
                    className="w-full h-9 px-2.5 border border-border rounded-lg text-sm"
                  />
                </div>
              )}

              {closeError && (
                <div className="mt-2 text-xs text-status-danger">
                  {closeError}
                </div>
              )}

              <button
                type="button"
                onClick={submitCloseDay}
                disabled={closeDayMutation.isPending}
                className="w-full mt-3 h-10 rounded-lg bg-brand-violet hover:bg-brand-violet-hover text-white text-sm font-semibold disabled:opacity-60"
              >
                {closeDayMutation.isPending
                  ? "Closing…"
                  : "Close day & lock entries"}
              </button>
              <p className="mt-2.5 text-[11px] text-ink-500 leading-relaxed flex gap-1.5">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                Once closed, today's invoices can't be edited — only refunded,
                with a reason.
              </p>
            </div>
          )}
        </div>
      </div>

      {dialog?.kind === "utr" && (
        <AddUtrDialog
          hospitalId={hospitalId}
          payment={dialog.payment}
          onClose={() => setDialog(null)}
          onSuccess={handleDialogSuccess}
        />
      )}
      {dialog?.kind === "collect" && (
        <CollectDueDialog
          hospitalId={hospitalId}
          payment={dialog.payment}
          collectedByName={user?.name}
          onClose={() => setDialog(null)}
          onSuccess={handleDialogSuccess}
        />
      )}
      {dialog?.kind === "refund" && (
        <RefundDialog
          hospitalId={hospitalId}
          payment={dialog.payment}
          onClose={() => setDialog(null)}
          onSuccess={handleDialogSuccess}
        />
      )}
      {dialog?.kind === "receipt" && (
        <ReceiptDialog
          payment={dialog.payment}
          onClose={() => setDialog(null)}
        />
      )}

      {toast && (
        <div className="fixed bottom-5 right-5 bg-ink-900 text-white px-4 py-3 rounded-lg shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: React.ReactNode;
  bold?: boolean;
}) {
  return (
    <div
      className={`flex justify-between items-center text-[13px] py-1 ${bold ? "font-semibold text-ink-900 border-t border-border mt-1 pt-2" : "text-ink-700"}`}
    >
      <span>{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}
