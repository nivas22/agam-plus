"use client";

import { AlertTriangle, Loader2, Phone, X } from "lucide-react";
import Link from "next/link";
import type React from "react";

export interface DuplicateMatch {
  id: string;
  name: string;
  phone: string;
  patientId?: string;
  specialization?: string;
  status?: string;
}

interface DuplicateWarningModalProps {
  entityLabel: "patient" | "doctor" | "team member";
  phone: string;
  matches: DuplicateMatch[];
  onCancel: () => void;
  onConfirm: () => void;
  isSubmitting?: boolean;
  viewHrefFor?: (id: string) => string;
}

export default function DuplicateWarningModal({
  entityLabel,
  phone,
  matches,
  onCancel,
  onConfirm,
  isSubmitting = false,
  viewHrefFor,
}: DuplicateWarningModalProps) {
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isSubmitting) onCancel();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" && !isSubmitting) onCancel();
  };

  return (
    <div
      className="fixed inset-0 bg-trace-background bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="duplicate-modal-title"
    >
      <div className="bg-surface-paper rounded-xl max-w-md w-full p-6 animate-in fade-in-90 zoom-in-90">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-shrink-0 w-10 h-10 bg-status-warning-soft rounded-full flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-status-warning" />
          </div>
          <div className="flex-1">
            <h2
              id="duplicate-modal-title"
              className="font-display tracking-tight text-lg font-semibold text-ink-900"
            >
              Possible duplicate {entityLabel}
            </h2>
          </div>
          {!isSubmitting && (
            <button
              type="button"
              onClick={onCancel}
              className="flex-shrink-0 w-8 h-8 rounded-full hover:bg-surface-canvas flex items-center justify-center transition-colors"
              aria-label="Close dialog"
            >
              <X className="w-4 h-4 text-ink-500" />
            </button>
          )}
        </div>

        <p className="text-ink-700 mb-4 text-sm leading-relaxed">
          {matches.length === 1 ? "A" : matches.length} {entityLabel}
          {matches.length === 1 ? "" : "s"} already{" "}
          {matches.length === 1 ? "has" : "have"} the phone number{" "}
          <span className="font-mono font-medium text-ink-900">{phone}</span> in
          this hospital. Double-check before adding another record.
        </p>

        <div className="space-y-2 mb-6 max-h-56 overflow-y-auto">
          {matches.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-canvas px-3 py-2.5"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium text-ink-900 truncate">
                  {m.name || "Unnamed"}
                </div>
                <div className="text-xs text-ink-500 flex items-center gap-1">
                  <Phone className="w-3 h-3 shrink-0" />
                  <span className="font-mono">{m.phone}</span>
                  {m.patientId && (
                    <span className="font-mono"> · #{m.patientId}</span>
                  )}
                  {m.specialization && <span> · {m.specialization}</span>}
                  {m.status && (
                    <span className="capitalize"> · {m.status}</span>
                  )}
                </div>
              </div>
              {viewHrefFor && (
                <Link
                  href={viewHrefFor(m.id)}
                  target="_blank"
                  className="text-xs font-medium text-brand-violet hover:underline shrink-0"
                >
                  View
                </Link>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex-1 py-3 px-4 rounded-lg font-medium transition-all duration-200 bg-ink-700 text-white hover:bg-ink-900 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Go back
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="flex-1 py-3 px-4 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 bg-status-warning text-white hover:bg-status-warning-hover active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create anyway"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
