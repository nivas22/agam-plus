// components/reports/InsightCallout.tsx
"use client";

interface InsightCalloutProps {
  text: string;
  tone?: "brand" | "warning" | "danger";
}

const TONE_BORDER: Record<string, string> = {
  brand: "border-l-brand-violet",
  warning: "border-l-status-warning",
  danger: "border-l-status-danger",
};

export default function InsightCallout({
  text,
  tone = "brand",
}: InsightCalloutProps) {
  return (
    <div
      className={`bg-surface-paper border border-border ${TONE_BORDER[tone]} border-l-[3px] rounded-lg px-3.5 py-3 text-[13px] text-ink-700 leading-relaxed mt-3.5`}
    >
      {text}
    </div>
  );
}
