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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-600 py-10">
        Failed to load doctor dashboard data
      </div>
    );
  }

  if (!formattedData) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-7xl mx-auto space-y-8 px-4 sm:px-6 lg:px-8 py-8">
        <DashboardHeader
          title="Doctor Dashboard"
          subtitle="Overview of your appointments and patients"
          icon={<Stethoscope />}
          iconColor="text-emerald-600"
          bgColor="bg-emerald-50"
        />

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            icon={<CalendarDays className="w-6 h-6 text-blue-600" />}
            label="Today's Appointments"
            value={formattedData?.todaysAppointments || 0}
          />
          <StatCard
            icon={<CheckCircle className="w-6 h-6 text-emerald-600" />}
            label="Completed"
            value={formattedData?.completedAppointments || 0}
          />
          <StatCard
            icon={<Clock className="w-6 h-6 text-amber-600" />}
            label="Pending"
            value={formattedData?.pendingAppointments || 0}
          />
          <StatCard
            icon={<Users className="w-6 h-6 text-purple-600" />}
            label="Total Patients"
            value={formattedData?.totalPatients || 0}
          />
        </div>

        {/* Average Rating */}
        <div className="bg-gradient-to-r from-amber-50 to-yellow-50 p-6 rounded-xl shadow-sm border border-amber-200">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white rounded-lg shadow-sm">
              <Star className="w-6 h-6 text-amber-500 fill-amber-500" />
            </div>
            <div>
              <p className="text-sm text-gray-600 font-medium">Average Rating</p>
              <p className="text-2xl font-bold text-gray-900">
                {formattedData.averageRating || "N/A"}
              </p>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        {quickStats && quickStats.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <div className="w-1 h-6 bg-emerald-500 rounded-full"></div>
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
          <div className="bg-gradient-to-r from-emerald-50 to-green-50 rounded-xl p-6 shadow-sm border border-emerald-200">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-white rounded-lg shadow-sm">
                <CalendarDays className="w-6 h-6 text-emerald-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  Next Appointment
                </h3>
                <p className="text-gray-700 font-medium">
                  {nextAppointment.patientName}
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  {nextAppointment.type} • {nextAppointment.time}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Upcoming Appointments */}
        {upcomingAppointments && upcomingAppointments.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <div className="w-1 h-6 bg-emerald-500 rounded-full"></div>
              Upcoming Appointments
            </h3>
            <div className="space-y-4">
              {upcomingAppointments.slice(0, 3).map((appointment, index) => (
                <div
                  key={index}
                  className="flex items-center gap-4 p-4 rounded-lg bg-gradient-to-r from-gray-50 to-emerald-50 border border-gray-200 hover:border-emerald-300 transition-all hover:shadow-md"
                >
                  <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
                    <span className="text-white font-bold text-lg">
                      {appointment.patientName?.charAt(0) || 'P'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-base truncate">
                      {appointment.patientName}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">{appointment.type}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-emerald-600">{appointment.time}</p>
                    <p className="text-xs text-gray-500 mt-1">{appointment.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Activity */}
        {recentActivity.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <div className="w-1 h-6 bg-purple-500 rounded-full"></div>
              Recent Activity
            </h3>
            <ul className="space-y-3">
              {recentActivity.map((activity, index) => (
                <li 
                  key={index} 
                  className="flex items-center gap-3 p-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                  <div className="flex-1">
                    <span className="font-semibold text-gray-900">{activity.patientName}</span>
                    <span className="text-gray-600"> • {activity.action}</span>
                  </div>
                  <span className="text-sm text-gray-500">{activity.time}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
