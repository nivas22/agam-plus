'use client';

interface QuickStatProps {
  value: number | string;
  label: string;
}

export default function QuickStat({ value, label }: QuickStatProps) {
  return (
    <div className="text-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-600">{label}</p>
    </div>
  );
}
