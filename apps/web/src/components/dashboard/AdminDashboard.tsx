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
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 bg-blue-100 rounded-xl">
          <LayoutDashboard className="w-7 h-7 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Admin Dashboard</h1>
          <p className="text-gray-500 text-sm">
            Overview of your clinic performance
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Users className="w-5 h-5 text-blue-600" />}
          label="Total Patients"
          value={Number(formattedData?.totalPatients) || 0}
          color="blue"
        />
        <StatCard
          icon={<Stethoscope className="w-5 h-5 text-green-600" />}
          label="Total Doctors"
          value={Number(formattedData?.totalDoctors) || 0}
          color="green"
        />
        <StatCard
          icon={<Clock className="w-5 h-5 text-purple-600" />}
          label="Today's Appointments"
          value={Number(formattedData?.todayAppointments) || 0}
          color="purple"
        />
        <StatCard
          icon={<AlertCircle className="w-5 h-5 text-yellow-600" />}
          label="Pending Doctors"
          value={Number(formattedData?.pendingDoctors) || 0}
          color="yellow"
        />
      </div>

      {/* Quick Stats */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
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
  color: string;
};

function StatCard({ icon, label, value, color }: StatCardProps) {
  return (
    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 bg-${color}-100 rounded-lg`}>{icon}</div>
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <h2 className="text-2xl font-bold text-gray-800">{value}</h2>
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
    <div className="text-center p-4 bg-gray-50 rounded-lg">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm text-gray-600">{label}</p>
    </div>
  );
}
