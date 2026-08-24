// components/payments/PaymentActionDialogs.tsx
"use client";

import { format } from "date-fns";
import { Loader2, ReceiptText, RotateCcw, StickyNote } from "lucide-react";
import { useState } from "react";
import { useUpdatePayment, useRefundPayment } from "@/hooks/useNewPaymentApi";
import type { Payment } from "@/types/payment";
import { PAYMENT_METHOD } from "../../constants";
import {
  DialogShell,
  primaryBtn,
  secondaryBtn,
} from "../appointments/AppointmentActionDialogs";

function money(v: number): string {
  return `₹${Math.round(v).toLocaleString("en-IN")}`;
}

/* ---------------------------------------------------------------------- */
/*                               add UTR                                  */
/* ---------------------------------------------------------------------- */

interface AddUtrDialogProps {
  hospitalId: string;
  payment: Payment;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export function AddUtrDialog({
  hospitalId,
  payment,
  onClose,
  onSuccess,
}: AddUtrDialogProps) {
  const [utr, setUtr] = useState("");
  const [error, setError] = useState<string | null>(null);
  const updatePayment = useUpdatePayment(hospitalId);

  const submit = async () => {
    setError(null);
    try {
      await updatePayment.mutateAsync({
        paymentId: payment.id,
        updates: { upiReference: utr.trim() },
      });
      onSuccess(`UTR added to ${payment.invoiceNumber}`);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to add the reference",
      );
    }
  };

  return (
    <DialogShell
      icon={<ReceiptText className="w-4.5 h-4.5" />}
      iconTone="bg-brand-violet-soft text-brand-violet"
      title={`Add UPI reference — ${payment.invoiceNumber}`}
      subtitle={payment.patientName}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={secondaryBtn} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={`${primaryBtn} bg-brand-violet hover:bg-brand-violet-hover disabled:opacity-60`}
            disabled={!utr.trim() || updatePayment.isPending}
            onClick={submit}
          >
            {updatePayment.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin inline mr-1.5" />
            ) : null}
            Save reference
          </button>
        </>
      }
    >
      <div className="p-5">
        {error && (
          <div className="mb-3 text-sm text-status-danger">{error}</div>
        )}
        <label className="text-xs font-semibold text-ink-700 mb-1 block">
          UPI reference (UTR)
        </label>
        <input
          type="text"
          value={utr}
          onChange={(e) => setUtr(e.target.value)}
          placeholder="Last 6 digits from the patient's app"
          autoFocus
          className="w-full h-10 px-3 border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-violet/20 focus:border-brand-violet"
        />
        <p className="text-xs text-ink-500 mt-2">
          The only way to trace this payment if it's ever disputed.
        </p>
      </div>
    </DialogShell>
  );
}

/* ---------------------------------------------------------------------- */
/*                             collect due                                */
/* ---------------------------------------------------------------------- */

interface CollectDueDialogProps {
  hospitalId: string;
  payment: Payment;
  collectedByName?: string;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export function CollectDueDialog({
  hospitalId,
  payment,
  collectedByName,
  onClose,
  onSuccess,
}: CollectDueDialogProps) {
  const [method, setMethod] = useState<"cash" | "upi">("cash");
  const [amountTendered, setAmountTendered] = useState<number>(payment.total);
  const [upiReference, setUpiReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const updatePayment = useUpdatePayment(hospitalId);

  const submit = async () => {
    setError(null);
    if (method === "cash" && amountTendered < payment.total) {
      setError("Amount received is less than the total payable");
      return;
    }
    try {
      await updatePayment.mutateAsync({
        paymentId: payment.id,
        updates:
          method === "cash"
            ? {
                status: "paid",
                method: PAYMENT_METHOD.CASH,
                amountTendered,
                collectedBy: collectedByName,
              }
            : {
                status: "paid",
                method: PAYMENT_METHOD.UPI,
                upiReference: upiReference || undefined,
              },
      });
      onSuccess(
        `${money(payment.total)} collected from ${payment.patientName}`,
      );
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to record the collection",
      );
    }
  };

  return (
    <DialogShell
      icon={<ReceiptText className="w-4.5 h-4.5" />}
      iconTone="bg-status-open-soft text-status-open"
      title={`Collect ${money(payment.total)} — ${payment.patientName}`}
      subtitle={payment.invoiceNumber}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={secondaryBtn} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={`${primaryBtn} bg-brand-violet hover:bg-brand-violet-hover disabled:opacity-60`}
            disabled={updatePayment.isPending}
            onClick={submit}
          >
            {updatePayment.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin inline mr-1.5" />
            ) : null}
            Mark as paid
          </button>
        </>
      }
    >
      <div className="p-5">
        {error && (
          <div className="mb-3 text-sm text-status-danger">{error}</div>
        )}
        <div className="grid grid-cols-2 gap-1.5 mb-3.5">
          {(["cash", "upi"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMethod(m)}
              aria-pressed={method === m}
              className={`h-9 rounded-lg border text-sm font-medium capitalize ${
                method === m
                  ? "border-brand-violet bg-brand-violet-soft text-brand-violet"
                  : "border-border text-ink-700"
              }`}
            >
              {m === "upi" ? "UPI / GPay" : "Cash"}
            </button>
          ))}
        </div>
        {method === "cash" ? (
          <div>
            <label className="text-xs font-semibold text-ink-700 mb-1 block">
              Amount received
            </label>
            <input
              type="number"
              value={amountTendered}
              onChange={(e) => setAmountTendered(Number(e.target.value) || 0)}
              className="w-full h-10 px-3 border border-border rounded-lg text-sm"
            />
          </div>
        ) : (
          <div>
            <label className="text-xs font-semibold text-ink-700 mb-1 block">
              UPI reference (UTR)
            </label>
            <input
              type="text"
              value={upiReference}
              onChange={(e) => setUpiReference(e.target.value)}
              placeholder="Optional"
              className="w-full h-10 px-3 border border-border rounded-lg text-sm font-mono"
            />
          </div>
        )}
      </div>
    </DialogShell>
  );
}

/* ---------------------------------------------------------------------- */
/*                                refund                                  */
/* ---------------------------------------------------------------------- */

interface RefundDialogProps {
  hospitalId: string;
  payment: Payment;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export function RefundDialog({
  hospitalId,
  payment,
  onClose,
  onSuccess,
}: RefundDialogProps) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const refundPayment = useRefundPayment(hospitalId);

  const submit = async () => {
    if (!reason.trim()) {
      setError("A reason is required to refund this visit");
      return;
    }
    setError(null);
    try {
      const result = await refundPayment.mutateAsync({
        paymentId: payment.id,
        refundReason: reason.trim(),
      });
      onSuccess(
        result.requiresApproval
          ? `Refund on ${payment.invoiceNumber} sent to an admin for approval`
          : `${payment.invoiceNumber} refunded`,
      );
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to refund this payment",
      );
    }
  };

  return (
    <DialogShell
      icon={<RotateCcw className="w-4.5 h-4.5" />}
      iconTone="bg-status-danger-soft text-status-danger"
      title={`Refund ${money(payment.total)} — ${payment.patientName}`}
      subtitle={payment.invoiceNumber}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={secondaryBtn} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={`${primaryBtn} bg-status-danger hover:bg-status-danger-hover disabled:opacity-60`}
            disabled={!reason.trim() || refundPayment.isPending}
            onClick={submit}
          >
            {refundPayment.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin inline mr-1.5" />
            ) : null}
            Refund
          </button>
        </>
      }
    >
      <div className="p-5">
        {error && (
          <div className="mb-3 text-sm text-status-danger">{error}</div>
        )}
        <label className="text-xs font-semibold text-ink-700 mb-1 block">
          Reason
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          autoFocus
          placeholder="Why is this being refunded?"
          className="w-full p-3 border border-border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-status-danger/20 focus:border-status-danger"
        />
      </div>
    </DialogShell>
  );
}

/* ---------------------------------------------------------------------- */
/*                          receipt / refund note                         */
/* ---------------------------------------------------------------------- */

interface ReceiptDialogProps {
  payment: Payment;
  onClose: () => void;
}

export function ReceiptDialog({ payment, onClose }: ReceiptDialogProps) {
  const isRefunded = payment.status === "refunded";

  return (
    <DialogShell
      icon={
        isRefunded ? (
          <StickyNote className="w-4.5 h-4.5" />
        ) : (
          <ReceiptText className="w-4.5 h-4.5" />
        )
      }
      iconTone={
        isRefunded
          ? "bg-surface-canvas text-ink-500"
          : "bg-brand-violet-soft text-brand-violet"
      }
      title={payment.invoiceNumber}
      subtitle={`${payment.patientName} · ${format(new Date(payment.createdAt), "d MMM yyyy, h:mm a")}`}
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
        {isRefunded && (
          <div className="mb-4 px-3.5 py-2.5 rounded-lg bg-status-danger-soft border border-status-danger/20 text-sm text-status-danger">
            <b>Refunded</b>
            {payment.refundedAt &&
              ` on ${format(new Date(payment.refundedAt), "d MMM yyyy")}`}
            {payment.refundReason && (
              <div className="mt-1 text-ink-700">
                <span className="font-semibold">Reason:</span>{" "}
                {payment.refundReason}
              </div>
            )}
          </div>
        )}

        <div className="border border-border rounded-xl overflow-hidden mb-3">
          {payment.items.map((item, index) => (
            <div
              key={`${item.name}-${index}`}
              className={`grid grid-cols-[1fr_auto] gap-2 px-3 py-2 text-[13px] ${index > 0 ? "border-t border-border" : ""}`}
            >
              <span>
                {item.name} {item.quantity > 1 ? `× ${item.quantity}` : ""}
              </span>
              <span className="font-mono text-right">
                {money(item.quantity * item.unitPrice)}
              </span>
            </div>
          ))}
        </div>

        <div className="text-[13px] text-ink-700 space-y-1">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span className="font-mono">{money(payment.subtotal)}</span>
          </div>
          {payment.discount > 0 && (
            <div className="flex justify-between">
              <span>Discount</span>
              <span className="font-mono">− {money(payment.discount)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-semibold text-ink-900 pt-1.5 border-t border-border mt-1.5">
            <span>Total</span>
            <span className="font-mono">{money(payment.total)}</span>
          </div>
        </div>

        <div className="mt-4 text-xs text-ink-500 space-y-1">
          <div>Doctor: Dr. {payment.doctorName || "—"}</div>
          <div>
            Method:{" "}
            {payment.method === "split"
              ? `₹${payment.splitCashAmount} cash + ₹${payment.splitUpiAmount} UPI`
              : payment.method}
          </div>
          {payment.method === "cash" && payment.collectedBy && (
            <div>Collected by: {payment.collectedBy}</div>
          )}
          {payment.method === "upi" && (
            <div>UTR: {payment.upiReference || "not recorded"}</div>
          )}
        </div>
      </div>
    </DialogShell>
  );
}
