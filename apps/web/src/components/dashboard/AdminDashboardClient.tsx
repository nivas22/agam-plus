'use client';

import {
  Users,
  Clock,
  AlertCircle,
  Stethoscope,
  LayoutDashboard,
} from "lucide-react";
import StatCard from "./StatCard";
import QuickStat from "./QuickStat";
import DashboardHeader from "./DashboardHeader";

interface DashboardProps {
  isLoading: boolean;
  formattedData: any;
  quickStats: any[];
  error: any;
}

export default function AdminDashboardClient({
  isLoading,
  formattedData,
  quickStats,
  error,
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
      <DashboardHeader
        title="Admin Dashboard"
        subtitle="Overview of your hospital performance"
        icon={<LayoutDashboard />}
        iconColor="text-brand-violet"
        bgColor="bg-brand-violet-soft"
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Users className="w-5 h-5 text-brand-violet" />}
          label="Total Patients"
          value={formattedData?.totalPatients || 0}
        />
        <StatCard
          icon={<Stethoscope className="w-5 h-5 text-status-open" />}
          label="Total Doctors"
          value={formattedData?.totalDoctors || 0}
        />
        <StatCard
          icon={<Clock className="w-5 h-5 text-brand-violet" />}
          label="Today's Appointments"
          value={formattedData?.todayAppointments || 0}
        />
        <StatCard
          icon={<AlertCircle className="w-5 h-5 text-status-warning" />}
          label="Pending Doctors"
          value={formattedData?.pendingDoctors || 0}
        />
      </div>

      {/* Quick Stats */}
      {quickStats?.length > 0 && (
        <div className="bg-surface-paper rounded-xl shadow-sm border border-border p-6">
          <h3 className="text-lg font-semibold text-ink-900 mb-4">
            Quick Statistics
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {quickStats.map((stat, index) => (
              <QuickStat key={index} value={stat.value} label={stat.label} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
