// components/prescriptions/PatientContextBar.tsx
"use client";

import { AlertTriangle } from "lucide-react";

interface PatientContextBarProps {
  allergies: string[];
  conditions: string[];
  flags: string[];
}

// Sits above the editor — allergy warnings in red (safety-critical, always
// first), then manually-entered condition/flag badges for general context.
export default function PatientContextBar({
  allergies,
  conditions,
  flags,
}: PatientContextBarProps) {
  if (allergies.length === 0 && conditions.length === 0 && flags.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {allergies.map((a) => (
        <span
          key={`allergy-${a}`}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold bg-status-danger-soft text-status-danger"
        >
          <AlertTriangle className="w-3 h-3" />
          ALLERGIC — {a.toUpperCase()}
        </span>
      ))}
      {conditions.map((c) => (
        <span
          key={`condition-${c}`}
          className="inline-block rounded-lg px-2.5 py-1 text-xs font-bold bg-status-warning-soft text-status-warning"
        >
          {c.toUpperCase()}
        </span>
      ))}
      {flags.map((f) => (
        <span
          key={`flag-${f}`}
          className="inline-block rounded-lg px-2.5 py-1 text-xs font-bold bg-status-open-soft text-status-open"
        >
          {f.toUpperCase()}
        </span>
      ))}
    </div>
  );
}
