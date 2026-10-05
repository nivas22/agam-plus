// components/leave/ApplyForLeaveDialog.tsx
"use client";

import { useState } from "react";
import {
  useApplyForLeave,
  usePreviewLeaveImpact,
} from "@/hooks/useLeaveRequestsApi";

export default function ApplyForLeaveDialog({
  hospitalId,
  onClose,
  showImpact = true,
}: {
  hospitalId: string;
  onClose: () => void;
  // Only doctors have their own booked appointments; staff skip the
  // "Check impact" step.
  showImpact?: boolean;
}) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const previewImpact = usePreviewLeaveImpact(hospitalId);
  const applyForLeave = useApplyForLeave(hospitalId);

  const canPreview = !!startDate && !!endDate && endDate >= startDate;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-surface-paper rounded-xl border border-border w-full max-w-md">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-display tracking-tight text-base font-bold text-ink-900">Apply for leave</h3>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-semibold text-ink-500">
              From
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  previewImpact.reset();
                }}
                className="mt-1 w-full px-3 py-2 border border-border rounded-lg text-sm"
              />
            </label>
            <label className="text-xs font-semibold text-ink-500">
              To
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  previewImpact.reset();
                }}
                className="mt-1 w-full px-3 py-2 border border-border rounded-lg text-sm"
              />
            </label>
          </div>
          <label className="block text-xs font-semibold text-ink-500">
            Reason (optional)
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              className="mt-1 w-full px-3 py-2 border border-border rounded-lg text-sm"
            />
          </label>

          {previewImpact.data && (
            <div className="rounded-lg bg-status-warning-soft border border-status-warning/30 text-status-warning text-sm px-3 py-2">
              {previewImpact.data.affectedAppointmentCount} appointment(s) would
              need moving.
            </div>
          )}
          {applyForLeave.isSuccess && (
            <div className="rounded-lg bg-status-open-soft border border-status-open/30 text-status-open text-sm px-3 py-2">
              Leave request sent for approval.
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 px-5 py-4 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-lg border border-border text-sm font-medium text-ink-700 hover:bg-surface-canvas"
          >
            Close
          </button>
          <span className="flex-1" />
          {showImpact && (
            <button
              type="button"
              disabled={!canPreview || previewImpact.isPending}
              onClick={() => previewImpact.mutate({ startDate, endDate })}
              className="h-9 px-4 rounded-lg border border-border text-sm font-medium text-ink-700 hover:bg-surface-canvas disabled:opacity-50"
            >
              Check impact
            </button>
          )}
          <button
            type="button"
            disabled={
              !canPreview || applyForLeave.isPending || applyForLeave.isSuccess
            }
            onClick={() =>
              applyForLeave.mutate({
                startDate,
                endDate,
                reason: reason || undefined,
              })
            }
            className="h-9 px-4 rounded-lg bg-brand-violet hover:bg-brand-violet-hover text-white text-sm font-semibold disabled:opacity-50"
          >
            Submit request
          </button>
        </div>
      </div>
    </div>
  );
}
