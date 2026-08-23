'use client';

import React from 'react';

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
}

export default function StatCard({ icon, label, value }: StatCardProps) {
  return (
    <div className="bg-surface-paper p-6 rounded-xl shadow-sm border border-border hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-gradient-to-br from-surface-canvas to-surface-canvas rounded-lg">
          {icon}
        </div>
        <div className="flex-1">
          <p className="text-sm text-ink-700 font-medium mb-1">{label}</p>
          <h2 className="font-display tracking-tight text-3xl font-bold text-ink-900">{value}</h2>
        </div>
      </div>
    </div>
  );
}
