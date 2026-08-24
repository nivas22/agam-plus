"use client";

type Option = {
  value: string;
  label: string;
};

interface FilterSelectProps {
  label: string;
  icon?: any;
  value: string;
  onChange: (value: string) => void;
  options?: Option[];
}

export default function FilterSelect({
  label,
  icon: Icon,
  value,
  onChange,
  options = [],
}: FilterSelectProps) {
  return (
    <div>
      <label className="flex items-center gap-2 text-sm font-medium text-ink-700 mb-2">
        {Icon && <Icon className="w-4 h-4" />}
        {label}
      </label>
      <select
        className="border border-border p-2.5 rounded-lg w-full focus:ring-2 focus:ring-brand-violet focus:border-brand-violet"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
