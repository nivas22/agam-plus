'use client';

import {
  CalendarDays,
  CheckCircle,
  Clock,
  Users,
  Star,
  Stethoscope,
} from "lucide-react";
import StatCard from "./StatCard";
import QuickStat from "./QuickStat";
import DashboardHeader from "./DashboardHeader";

interface DoctorDashboardProps {
  isLoading: boolean | undefined;
  formattedData: any;
  quickStats: any[] | undefined;
  error: any;
  upcomingAppointments?: Array<any>;
  recentActivity?: Array<any>;
  nextAppointment?: any;
}

export default function DoctorDashboardClient({
  isLoading,
  formattedData,
  quickStats,
  error,
  upcomingAppointments = [],
  recentActivity = [],
  nextAppointment,
}: DoctorDashboardProps) {

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
        Failed to load doctor dashboard data
      </div>
    );
  }

  if (!formattedData) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-canvas to-surface-canvas">
      <div className="max-w-7xl mx-auto space-y-8 px-4 sm:px-6 lg:px-8 py-8">
        <DashboardHeader
          title="Doctor Dashboard"
          subtitle="Overview of your appointments and patients"
          icon={<Stethoscope />}
          iconColor="text-status-open"
          bgColor="bg-status-open-soft"
        />

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            icon={<CalendarDays className="w-6 h-6 text-brand-violet" />}
            label="Today's Appointments"
            value={formattedData?.todaysAppointments || 0}
          />
          <StatCard
            icon={<CheckCircle className="w-6 h-6 text-status-open" />}
            label="Completed"
            value={formattedData?.completedAppointments || 0}
          />
          <StatCard
            icon={<Clock className="w-6 h-6 text-status-warning" />}
            label="Pending"
            value={formattedData?.pendingAppointments || 0}
          />
          <StatCard
            icon={<Users className="w-6 h-6 text-brand-violet" />}
            label="Total Patients"
            value={formattedData?.totalPatients || 0}
          />
        </div>

        {/* Average Rating */}
        <div className="bg-gradient-to-r from-status-warning-soft to-status-warning-soft p-6 rounded-xl shadow-sm border border-status-warning/20">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-surface-paper rounded-lg shadow-sm">
              <Star className="w-6 h-6 text-status-warning fill-status-warning" />
            </div>
            <div>
              <p className="text-sm text-ink-700 font-medium">Average Rating</p>
              <p className="text-2xl font-bold text-ink-900">
                {formattedData.averageRating || "N/A"}
              </p>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        {quickStats && quickStats.length > 0 && (
          <div className="bg-surface-paper rounded-xl shadow-sm border border-border p-6">
            <h3 className="font-display tracking-tight text-xl font-bold text-ink-900 mb-6 flex items-center gap-2">
              <div className="w-1 h-6 bg-status-open rounded-full"></div>
              Quick Stats
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {quickStats.map((stat, index) => (
                <QuickStat key={index} value={stat.value} label={stat.label} />
              ))}
            </div>
          </div>
        )}

        {/* Next Appointment */}
        {nextAppointment && (
          <div className="bg-gradient-to-r from-status-open-soft to-status-open-soft rounded-xl p-6 shadow-sm border border-status-open/20">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-surface-paper rounded-lg shadow-sm">
                <CalendarDays className="w-6 h-6 text-status-open" />
              </div>
              <div className="flex-1">
                <h3 className="font-display tracking-tight text-lg font-bold text-ink-900 mb-2">
                  Next Appointment
                </h3>
                <p className="text-ink-700 font-medium">
                  {nextAppointment.patientName}
                </p>
                <p className="text-sm text-ink-700 mt-1">
                  {nextAppointment.type} • {nextAppointment.time}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Upcoming Appointments */}
        {upcomingAppointments && upcomingAppointments.length > 0 && (
          <div className="bg-surface-paper rounded-xl shadow-sm border border-border p-6">
            <h3 className="font-display tracking-tight text-xl font-bold text-ink-900 mb-6 flex items-center gap-2">
              <div className="w-1 h-6 bg-status-open rounded-full"></div>
              Upcoming Appointments
            </h3>
            <div className="space-y-4">
              {upcomingAppointments.slice(0, 3).map((appointment, index) => (
                <div
                  key={index}
                  className="flex items-center gap-4 p-4 rounded-lg bg-gradient-to-r from-surface-canvas to-status-open-soft border border-border hover:border-status-open transition-all hover:shadow-md"
                >
                  <div className="w-14 h-14 bg-gradient-to-br from-status-open to-status-open rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
                    <span className="text-white font-bold text-lg">
                      {appointment.patientName?.charAt(0) || 'P'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-ink-900 text-base truncate">
                      {appointment.patientName}
                    </p>
                    <p className="text-sm text-ink-700 mt-1">{appointment.type}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-mono tabular text-sm font-semibold text-status-open">{appointment.time}</p>
                    <p className="font-mono tabular text-xs text-ink-500 mt-1">{appointment.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Activity */}
        {recentActivity.length > 0 && (
          <div className="bg-surface-paper rounded-xl shadow-sm border border-border p-6">
            <h3 className="font-display tracking-tight text-xl font-bold text-ink-900 mb-6 flex items-center gap-2">
              <div className="w-1 h-6 bg-brand-violet rounded-full"></div>
              Recent Activity
            </h3>
            <ul className="space-y-3">
              {recentActivity.map((activity, index) => (
                <li
                  key={index}
                  className="flex items-center gap-3 p-4 rounded-lg bg-surface-canvas hover:bg-surface-canvas transition-colors"
                >
                  <div className="w-2 h-2 bg-status-open rounded-full"></div>
                  <div className="flex-1">
                    <span className="font-semibold text-ink-900">{activity.patientName}</span>
                    <span className="text-ink-700"> • {activity.action}</span>
                  </div>
                  <span className="font-mono tabular text-sm text-ink-500">{activity.time}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
