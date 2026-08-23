// components/approvals/ApprovalModal.tsx
"use client";

import { AlertTriangle, Loader2, X } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useApproveRequest, useDeclineRequest } from "@/hooks/useApprovalsApi";
import type { ApprovalRequest } from "@/types/audit";

export const MONEY_ACTIONS = new Set(["issue_refund", "close_day", "apply_discount"]);

export const ACTION_LABELS: Record<string, string> = {
  issue_refund: "Issue a refund",
  close_day: "Close the day",
  extend_expired_package: "Extend an expired package",
  sell_package: "Sell a package",
  collect_payment: "Collect payment",
  book_reschedule: "Book / reschedule",
  cancel_no_show: "Cancel / mark no-show",
  delete_appointment: "Delete an appointment",
};

// Same lookup ApprovalModal uses for its own "Amount" row — kept here so the
// dashboard's approval list can show the same figure without duplicating the
// (slightly odd) payload shape knowledge in two places.
export function getApprovalAmount(approval: ApprovalRequest): number | undefined {
  return approval.payload?.body?.refundReason !== undefined || approval.payload?.body?.total
    ? approval.payload?.body?.total
    : undefined;
}

interface ApprovalModalProps {
  hospitalId: string;
  approval: ApprovalRequest;
  onClose: () => void;
}

export default function ApprovalModal({ hospitalId, approval, onClose }: ApprovalModalProps) {
  const { user } = useAuth();
  const [pin, setPin] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const approveMutation = useApproveRequest(hospitalId);
  const declineMutation = useDeclineRequest(hospitalId);

  const isSelf = approval.requestedBy.userId === user?.id;
  const isMoney = MONEY_ACTIONS.has(approval.action);
  const label = ACTION_LABELS[approval.action] || approval.action.replace(/_/g, " ");
  const amount = getApprovalAmount(approval);

  const approve = async () => {
    setError(null);
    try {
      await approveMutation.mutateAsync({ approvalId: approval.id, pin: pin || undefined, note: note || undefined });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve this request");
    }
  };

  const decline = async () => {
    setError(null);
    try {
      await declineMutation.mutateAsync({ approvalId: approval.id, note: note || undefined });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to decline this request");
    }
  };

  const busy = approveMutation.isPending || declineMutation.isPending;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink-900/35 p-4">
      <div className="w-full max-w-[560px] bg-surface-paper rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-5.5 pt-4.5 pb-3.5 border-b border-border flex items-start gap-3">
          <div>
            <h2 className="text-lg font-bold text-ink-900">{label}</h2>
            <div className="text-xs text-ink-500 mt-0.5">
              Requested by {approval.requestedBy.name} ({approval.requestedBy.role.replace("_", " ")})
            </div>
          </div>
          <div className="flex-1" />
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-surface-canvas text-ink-500">
            <X size={18} />
          </button>
        </div>

        <div className="px-5.5 py-4.5 space-y-4">
          {error && <div className="text-sm text-status-danger">{error}</div>}

          <div className="flex gap-2.5 items-start bg-status-warning-soft border border-status-warning/30 rounded-lg p-3 text-sm text-status-warning">
            <span className="font-bold w-6 h-6 rounded-lg bg-status-warning text-white grid place-items-center text-xs flex-none">
              {approval.requestedBy.name.slice(0, 2).toUpperCase()}
            </span>
            <span>
              <b>{approval.requestedBy.name}</b> requested this{" "}
              {new Date(approval.requestedAt).toLocaleString()}
              {approval.reason ? <><br />&quot;{approval.reason}&quot;</> : null}
            </span>
          </div>

          {typeof amount === "number" && (
            <div className="flex justify-between border-t border-border pt-2.5 text-sm">
              <span className="text-ink-500">Amount</span>
              <b className="font-mono text-status-danger">₹{amount}</b>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-ink-700 mb-1 block">
              Your note <span className="font-normal text-ink-500">recorded against your name</span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="w-full p-3 border border-border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-violet/20 focus:border-brand-violet"
            />
          </div>

          {isMoney && (
            <div>
              <label className="text-xs font-semibold text-ink-700 mb-1 block">Confirm with your PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                className="w-28 tracking-[6px] text-center font-mono text-lg px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-violet/20 focus:border-brand-violet"
                placeholder="••••"
              />
              <p className="text-[11px] text-ink-500 mt-1.5">Only asked if you've set a cash-handling PIN.</p>
            </div>
          )}

          {isSelf && (
            <div className="flex gap-2 bg-status-danger-soft border border-status-danger/30 text-status-danger rounded-lg px-3 py-2.5 text-xs">
              <AlertTriangle size={16} className="flex-none" />
              <span>You can&apos;t approve a request you raised yourself. Ask another admin to review it.</span>
            </div>
          )}
        </div>

        <div className="px-5.5 py-3.5 border-t border-border flex items-center gap-2.5">
          <span className="text-[11px] text-ink-500 flex-1">Both names go on the audit entry.</span>
          <button type="button" onClick={decline} disabled={busy} className="px-4 py-2 rounded-lg border border-border text-sm font-semibold text-ink-700 disabled:opacity-60">
            Decline
          </button>
          <button
            type="button"
            onClick={approve}
            disabled={busy || isSelf}
            className="px-4 py-2 rounded-lg bg-status-danger hover:bg-status-danger-hover text-white text-sm font-semibold disabled:opacity-60 flex items-center gap-1.5"
          >
            {approveMutation.isPending && <Loader2 size={14} className="animate-spin" />}
            Approve
          </button>
        </div>
      </div>
    </div>
  );
}
