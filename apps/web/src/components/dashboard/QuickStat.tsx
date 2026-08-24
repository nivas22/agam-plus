'use client';

interface QuickStatProps {
  value: number | string;
  label: string;
}

export default function QuickStat({ value, label }: QuickStatProps) {
  return (
    <div className="text-center p-4 bg-surface-canvas rounded-lg hover:bg-surface-canvas transition">
      <p className="text-2xl font-bold text-ink-900">{value}</p>
      <p className="text-sm text-ink-700">{label}</p>
    </div>
  );
}
