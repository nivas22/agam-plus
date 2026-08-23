// components/payments/PackageActionDialogs.tsx
"use client";

import { format } from "date-fns";
import {
  AlertCircle,
  BookOpen,
  CalendarPlus,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { useState } from "react";
import {
  useExtendPackage,
  usePackageLedger,
  useRefundPackage,
} from "@/hooks/useNewPackageApi";
import type { PackageRecord } from "@/types/package";
import {
  DialogShell,
  primaryBtn,
  secondaryBtn,
} from "../appointments/AppointmentActionDialogs";

function money(v: number): string {
  return `₹${Math.round(v).toLocaleString("en-IN")}`;
}

function dateLabel(dateStr: string): string {
  return format(new Date(`${dateStr}T00:00:00`), "d MMM yyyy");
}

/* ---------------------------------------------------------------------- */
/*                                ledger                                  */
/* ---------------------------------------------------------------------- */

interface LedgerDialogProps {
  hospitalId: string;
  pkg: PackageRecord;
  onClose: () => void;
}

export function LedgerDialog({ hospitalId, pkg, onClose }: LedgerDialogProps) {
  const { data, isLoading } = usePackageLedger(hospitalId, pkg.id);
  const visits = data?.visits || [];

  return (
    <DialogShell
      icon={<BookOpen className="w-4.5 h-4.5" />}
      iconTone="bg-brand-violet-soft text-brand-violet"
      title={`${pkg.patientName || "Patient"} — package ledger`}
      subtitle={`${pkg.totalVisits} visits · Dr. ${pkg.doctorName || "—"}`}
      onClose={onClose}
      footer={
        <button
          type="button"
          className={`${primaryBtn} bg-brand-violet hover:bg-brand-violet-hover`}
          onClick={onClose}
        >
          Close
        </button>
      }
    >
      <div className="p-5 overflow-y-auto flex-1">
        <div className="grid grid-cols-3 gap-2.5 mb-4">
          <div className="rounded-lg border border-border p-2.5">
            <div className="text-[10.5px] uppercase tracking-wide text-ink-500 font-semibold">
              Used
            </div>
            <div className="font-mono text-lg font-bold text-ink-900">
              {pkg.usedVisits} / {pkg.totalVisits}
            </div>
          </div>
          <div className="rounded-lg border border-border p-2.5">
            <div className="text-[10.5px] uppercase tracking-wide text-ink-500 font-semibold">
              Value left
            </div>
            <div className="font-mono text-lg font-bold text-ink-900">
              {money(pkg.valueLeft)}
            </div>
          </div>
          <div className="rounded-lg border border-border p-2.5">
            <div className="text-[10.5px] uppercase tracking-wide text-ink-500 font-semibold">
              Expires
            </div>
            <div className="font-mono text-sm font-bold text-ink-900 mt-1">
              {dateLabel(pkg.validUntil)}
            </div>
          </div>
        </div>

        <h4 className="text-sm font-semibold text-ink-900 mb-2">Visits</h4>
        {isLoading ? (
          <div className="py-8 text-center text-sm text-ink-500 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : visits.length === 0 ? (
          <div className="py-8 text-center text-sm text-ink-500 border border-border rounded-xl">
            No visits booked from this package yet.
          </div>
        ) : (
          <div className="border border-border rounded-xl overflow-hidden">
            {visits.map((v, i) => (
              <div
                key={v.id}
                className={`grid grid-cols-[24px_1fr_100px] gap-2 items-center px-3.5 py-2.5 text-[13px] ${i > 0 ? "border-t border-border" : ""}`}
              >
                <span className="font-mono text-[11px] text-ink-500">
                  {v.packageVisitNumber ?? i + 1}
                </span>
                <span className="font-mono">
                  {dateLabel(v.date)} · {v.time}
                </span>
                <span
                  className={`text-[10.5px] font-semibold rounded-md px-2 py-0.5 text-center capitalize ${
                    v.status === "completed"
                      ? "bg-status-open-soft text-status-open"
                      : v.status === "cancelled" || v.status === "no-show"
                        ? "bg-status-danger-soft text-status-danger"
                        : "bg-surface-canvas text-ink-700"
                  }`}
                >
                  {v.status.replace("-", " ")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </DialogShell>
  );
}

/* ---------------------------------------------------------------------- */
/*                                extend                                  */
/* ---------------------------------------------------------------------- */

const EXTEND_OPTIONS = [1, 3, 6];

interface ExtendDialogProps {
  hospitalId: string;
  pkg: PackageRecord;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export function ExtendDialog({
  hospitalId,
  pkg,
  onClose,
  onSuccess,
}: ExtendDialogProps) {
  const [months, setMonths] = useState(3);
  const [error, setError] = useState<string | null>(null);
  const extendPackage = useExtendPackage(hospitalId);

  const submit = async () => {
    setError(null);
    try {
      await extendPackage.mutateAsync({ packageId: pkg.id, months });
      onSuccess(`Extended ${months} month${months === 1 ? "" : "s"}`);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to extend the package",
      );
    }
  };

  return (
    <DialogShell
      icon={<CalendarPlus className="w-4.5 h-4.5" />}
      iconTone="bg-status-warning-soft text-status-warning"
      title={`Extend package — ${pkg.patientName || "Patient"}`}
      subtitle={`${pkg.remainingVisits} visits unused · currently expires ${dateLabel(pkg.validUntil)}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={secondaryBtn} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={`${primaryBtn} bg-brand-violet hover:bg-brand-violet-hover disabled:opacity-60`}
            disabled={extendPackage.isPending}
            onClick={submit}
          >
            {extendPackage.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin inline mr-1.5" />
            ) : null}
            Extend by {months} month{months === 1 ? "" : "s"}
          </button>
        </>
      }
    >
      <div className="p-5">
        {error && (
          <div className="mb-3 flex items-start gap-2 px-3.5 py-2.5 rounded-lg bg-status-danger-soft border border-status-danger/20 text-sm text-status-danger">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            {error}
          </div>
        )}
        <div className="text-xs font-semibold text-ink-700 mb-1.5">
          Extend by
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {EXTEND_OPTIONS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMonths(m)}
              aria-pressed={months === m}
              className={`h-10 rounded-lg border text-sm font-medium ${
                months === m
                  ? "border-brand-violet bg-brand-violet-soft text-brand-violet"
                  : "border-border text-ink-700"
              }`}
            >
              {m} month{m === 1 ? "" : "s"}
            </button>
          ))}
        </div>
        <p className="text-xs text-ink-500 mt-3">
          New expiry:{" "}
          <span className="font-mono font-medium text-ink-900">
            {dateLabel(
              (() => {
                const base = new Date();
                const current = new Date(`${pkg.validUntil}T00:00:00`);
                const start = current > base ? current : base;
                start.setMonth(start.getMonth() + months);
                const y = start.getFullYear();
                const mo = String(start.getMonth() + 1).padStart(2, "0");
                const d = String(start.getDate()).padStart(2, "0");
                return `${y}-${mo}-${d}`;
              })(),
            )}
          </span>
        </p>
      </div>
    </DialogShell>
  );
}

/* ---------------------------------------------------------------------- */
/*                        lapsed: refund or extend                        */
/* ---------------------------------------------------------------------- */

interface RefundOrExtendDialogProps {
  hospitalId: string;
  pkg: PackageRecord;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onChooseExtend: () => void;
}

export function RefundOrExtendDialog({
  hospitalId,
  pkg,
  onClose,
  onSuccess,
  onChooseExtend,
}: RefundOrExtendDialogProps) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refundPackage = useRefundPackage(hospitalId);

  const submitRefund = async () => {
    setError(null);
    try {
      await refundPackage.mutateAsync(pkg.id);
      onSuccess(`${money(pkg.valueLeft)} refunded to ${pkg.patientName}`);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to refund this package",
      );
    }
  };

  return (
    <DialogShell
      icon={<RotateCcw className="w-4.5 h-4.5" />}
      iconTone="bg-status-danger-soft text-status-danger"
      title={`Lapsed package — ${pkg.patientName || "Patient"}`}
      subtitle={`${pkg.remainingVisits} visits · ${money(pkg.valueLeft)} unused · expired ${dateLabel(pkg.validUntil)}`}
      onClose={onClose}
      footer={
        confirming ? (
          <>
            <button
              type="button"
              className={secondaryBtn}
              onClick={() => setConfirming(false)}
            >
              Back
            </button>
            <button
              type="button"
              className={`${primaryBtn} bg-status-danger hover:bg-status-danger-hover disabled:opacity-60`}
              disabled={refundPackage.isPending}
              onClick={submitRefund}
            >
              {refundPackage.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin inline mr-1.5" />
              ) : null}
              Confirm refund of {money(pkg.valueLeft)}
            </button>
          </>
        ) : (
          <button type="button" className={secondaryBtn} onClick={onClose}>
            Cancel
          </button>
        )
      }
    >
      <div className="p-5">
        {error && (
          <div className="mb-3 flex items-start gap-2 px-3.5 py-2.5 rounded-lg bg-status-danger-soft border border-status-danger/20 text-sm text-status-danger">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            {error}
          </div>
        )}
        <p className="text-sm text-ink-700 mb-4">
          This package expired with {pkg.remainingVisits} visit
          {pkg.remainingVisits === 1 ? "" : "s"} unused. Give the patient more
          time, or settle the unused value as a refund.
        </p>
        {!confirming ? (
          <div className="grid grid-cols-1 gap-2">
            <button
              type="button"
              onClick={onChooseExtend}
              className="text-left border border-border rounded-xl p-3.5 hover:border-brand-violet hover:bg-brand-violet-soft/40 transition-colors"
            >
              <div className="text-sm font-semibold text-ink-900">
                Extend validity
              </div>
              <div className="text-xs text-ink-500 mt-0.5">
                Give the patient more time to use the remaining{" "}
                {pkg.remainingVisits} visit
                {pkg.remainingVisits === 1 ? "" : "s"}.
              </div>
            </button>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="text-left border border-status-danger/30 rounded-xl p-3.5 hover:bg-status-danger-soft transition-colors"
            >
              <div className="text-sm font-semibold text-status-danger">
                Refund {money(pkg.valueLeft)}
              </div>
              <div className="text-xs text-ink-500 mt-0.5">
                Closes the package and records the unused value as refunded.
              </div>
            </button>
          </div>
        ) : (
          <div className="px-3.5 py-3 rounded-lg bg-status-danger-soft border border-status-danger/20 text-sm text-status-danger">
            <b className="font-mono tabular">{money(pkg.valueLeft)}</b> will be marked refunded and this
            package closed. This can't be undone.
          </div>
        )}
      </div>
    </DialogShell>
  );
}
