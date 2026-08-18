'use client';

import React from "react";

interface DashboardHeaderProps {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  iconColor?: string; // e.g. "text-blue-600"
  bgColor?: string;   // e.g. "bg-blue-100"
}

export default function DashboardHeader({
  title,
  subtitle,
  icon,
  iconColor = "text-blue-600",
  bgColor = "bg-blue-100",
}: DashboardHeaderProps) {
  return (
    <div className="flex items-center gap-3">
      <div className={`p-3 rounded-xl ${bgColor}`}>
        <div className={`w-7 h-7 ${iconColor}`}>{icon}</div>
      </div>
      <div>
        <h1 className="text-2xl font-bold text-gray-800">{title}</h1>
        {subtitle && <p className="text-gray-500 text-sm">{subtitle}</p>}
      </div>
    </div>
  );
}
