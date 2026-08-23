// src/components/ConfirmationDialog.tsx
"use client";

import { X, AlertCircle } from "lucide-react";

interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  confirmColor?: "red" | "blue" | "green" | "gray";
  cancelText?: string;
}

export default function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  confirmColor = "blue",
  cancelText = "Cancel",
}: ConfirmationDialogProps) {
  if (!isOpen) return null;

  const colorClasses: Record<string, string> = {
    red: "bg-status-danger hover:bg-status-danger-hover focus:ring-status-danger",
    blue: "bg-brand-violet hover:bg-brand-violet-hover focus:ring-brand-violet",
    green: "bg-brand-violet hover:bg-brand-violet-hover focus:ring-brand-violet",
    gray: "bg-ink-700 hover:bg-ink-900 focus:ring-ink-500",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-trace-background bg-opacity-50">
      <div className="bg-surface-paper rounded-xl shadow-xl w-full max-w-md p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display tracking-tight text-lg font-semibold text-ink-900 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-status-warning" />
            {title}
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-surface-canvas rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-ink-500" />
          </button>
        </div>

        {/* Message */}
        <p className="text-ink-700 mb-6">{message}</p>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-border text-ink-700 rounded-lg hover:bg-surface-canvas transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${colorClasses[confirmColor]}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
