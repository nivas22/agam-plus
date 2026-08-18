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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-600 py-10">
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
        iconColor="text-blue-600"
        bgColor="bg-blue-100"
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Users className="w-5 h-5 text-blue-600" />}
          label="Total Patients"
          value={formattedData?.totalPatients || 0}
        />
        <StatCard
          icon={<Stethoscope className="w-5 h-5 text-green-600" />}
          label="Total Doctors"
          value={formattedData?.totalDoctors || 0}
        />
        <StatCard
          icon={<Clock className="w-5 h-5 text-purple-600" />}
          label="Today's Appointments"
          value={formattedData?.todayAppointments || 0}
        />
        <StatCard
          icon={<AlertCircle className="w-5 h-5 text-yellow-600" />}
          label="Pending Doctors"
          value={formattedData?.pendingDoctors || 0}
        />
      </div>

      {/* Quick Stats */}
      {quickStats?.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
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
