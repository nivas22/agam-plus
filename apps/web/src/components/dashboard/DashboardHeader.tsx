'use client';

import React from "react";

interface DashboardHeaderProps {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  iconColor?: string; // e.g. "text-brand-violet"
  bgColor?: string;   // e.g. "bg-brand-violet-soft"
}

export default function DashboardHeader({
  title,
  subtitle,
  icon,
  iconColor = "text-brand-violet",
  bgColor = "bg-brand-violet-soft",
}: DashboardHeaderProps) {
  return (
    <div className="flex items-center gap-3">
      <div className={`p-3 rounded-xl ${bgColor}`}>
        <div className={`w-7 h-7 ${iconColor}`}>{icon}</div>
      </div>
      <div>
        <h1 className="font-display tracking-tight text-2xl font-bold text-ink-900">{title}</h1>
        {subtitle && <p className="text-ink-500 text-sm">{subtitle}</p>}
      </div>
    </div>
  );
}
