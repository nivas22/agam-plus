"use client";

import { Check, Copy, KeyRound } from "lucide-react";
import { useState } from "react";

interface TempPasswordModalProps {
  name: string;
  tempPassword: string;
  onClose: () => void;
}

export default function TempPasswordModal({ name, tempPassword, onClose }: TempPasswordModalProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can fail (permissions, insecure context) — the
      // password is still shown on screen for manual copy either way.
    }
  };

  return (
    <div
      className="fixed inset-0 bg-trace-background bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-surface-paper rounded-xl max-w-md w-full p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-shrink-0 w-10 h-10 bg-brand-violet-soft rounded-full flex items-center justify-center">
            <KeyRound className="w-5 h-5 text-brand-violet" />
          </div>
          <h2 className="font-display tracking-tight text-lg font-semibold text-ink-900">
            New password for {name}
          </h2>
        </div>

        <p className="text-sm text-ink-700 mb-4 leading-relaxed">
          Share this with them directly — it won&apos;t be shown again. They&apos;ll be asked to change it the
          next time they sign in.
        </p>

        <div className="flex items-center gap-2 bg-surface-canvas border border-border rounded-lg px-4 py-3 mb-5">
          <span className="flex-1 font-mono text-lg tracking-wide text-ink-900">{tempPassword}</span>
          <button
            type="button"
            onClick={copy}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-xs font-semibold text-ink-700 hover:bg-surface-paper"
          >
            {copied ? <Check size={14} className="text-status-open" /> : <Copy size={14} />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 rounded-lg bg-brand-violet hover:bg-brand-violet-hover text-white text-sm font-semibold"
        >
          Done
        </button>
      </div>
    </div>
  );
}
