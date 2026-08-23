// components/reports/DateRangeTabs.tsx
"use client";

export interface DateRangeOption {
  key: string;
  label: string;
}

interface DateRangeTabsProps {
  options: DateRangeOption[];
  value: string;
  onChange: (key: string) => void;
}

export default function DateRangeTabs({
  options,
  value,
  onChange,
}: DateRangeTabsProps) {
  return (
    <div className="flex items-center bg-surface-canvas border border-border rounded-lg p-0.5">
      {options.map((opt) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => onChange(opt.key)}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            value === opt.key ? "bg-brand-violet text-white" : "text-ink-700"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
