"use client";

import {
  Users,
  Clock,
  AlertCircle,
  Stethoscope,
  LayoutDashboard,
} from "lucide-react";
import React from "react";
interface DashboardProps {
  isLoading: boolean | undefined;
  formattedData: any;
  quickStats: any[] | undefined;
  error: any;
}

export default function AdminDashboardClient({
  isLoading,
  formattedData,
  quickStats,
  error
}: DashboardProps) {

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-violet"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-status-danger py-10">
        Failed to load dashboard data
      </div>
    );
  }

  if (!formattedData) return null;

  return (
    <div className="space-y-6 px-2 sm:px-6 lg:px-8 pb-10">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 bg-brand-violet-soft rounded-xl">
          <LayoutDashboard className="w-7 h-7 text-brand-violet" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Admin Dashboard</h1>
          <p className="text-ink-500 text-sm">
            Overview of your clinic performance
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Users className="w-5 h-5 text-brand-violet" />}
          label="Total Patients"
          value={Number(formattedData?.totalPatients) || 0}
          color="violet"
        />
        <StatCard
          icon={<Stethoscope className="w-5 h-5 text-status-open" />}
          label="Total Doctors"
          value={Number(formattedData?.totalDoctors) || 0}
          color="open"
        />
        <StatCard
          icon={<Clock className="w-5 h-5 text-brand-violet" />}
          label="Today's Appointments"
          value={Number(formattedData?.todayAppointments) || 0}
          color="violet"
        />
        <StatCard
          icon={<AlertCircle className="w-5 h-5 text-status-warning" />}
          label="Pending Doctors"
          value={Number(formattedData?.pendingDoctors) || 0}
          color="warning"
        />
      </div>

      {/* Quick Stats */}
      <div className="bg-surface-paper rounded-xl shadow-sm border border-border p-6">
        <h3 className="text-lg font-semibold text-ink-900 mb-4">
          Quick Statistics
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {
            quickStats && quickStats.length > 0 && 
            quickStats.map((stat, index) => (
              <QuickStat
                key={index}
                value={stat.value}
                label={stat.label}
              />
            ))
          }
        </div>
      </div>
    </div>
  );
}

type StatCardProps = {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: "violet" | "open" | "warning" | "danger";
};

const STAT_CARD_CHIP_BG: Record<StatCardProps["color"], string> = {
  violet: "bg-brand-violet-soft",
  open: "bg-status-open-soft",
  warning: "bg-status-warning-soft",
  danger: "bg-status-danger-soft",
};

function StatCard({ icon, label, value, color }: StatCardProps) {
  return (
    <div className="bg-surface-paper p-5 rounded-xl shadow-sm border border-border">
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 ${STAT_CARD_CHIP_BG[color]} rounded-lg`}>{icon}</div>
        <div>
          <p className="text-sm text-ink-500">{label}</p>
          <h2 className="text-2xl font-bold text-ink-900">{value}</h2>
        </div>
      </div>
    </div>
  );
}

type QuickStatProps = {
  value: number | string;
  label: string;
};

function QuickStat({ value, label }: QuickStatProps) {
  return (
    <div className="text-center p-4 bg-surface-canvas rounded-lg">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm text-ink-700">{label}</p>
    </div>
  );
}
