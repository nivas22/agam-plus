'use client';

import { useRouter, useParams } from 'next/navigation';
import {
  CalendarDays,
  CheckCircle,
  Clock,
  Users,
  ChevronRight,
  Activity,
  Award,
  UserPlus,
  Calendar,
  Plus,
  AlertCircle,
} from 'lucide-react';
import { useAvailability } from '@/hooks/useAvailability';
import MobileLoadingSpinner from './MobileLoadingSpinner';

interface MobileDoctorDashboardProps {
  user: any;
  currentHospital?: any;
  doctorProfile?: any;
  isLoading: boolean | undefined;
  formattedData: any;
  quickStats?: any[] | undefined;
  error: any;
  upcomingAppointments?: Array<any>;
  recentActivity?: Array<any>;
  nextAppointment?: any;
}

export default function MobileDoctorDashboard({
  user,
  doctorProfile,
  isLoading,
  formattedData,
  error,
  upcomingAppointments = [],
  recentActivity = [],
  nextAppointment,
}: MobileDoctorDashboardProps) {
  const router = useRouter();
  const params = useParams();
  const hospitalId = params.id as string;
  const doctorId = user?.id;

  // Fetch doctor availability
  const { data: availabilityData, isLoading: isLoadingAvailability } = useAvailability(
    hospitalId,
    doctorId || ''
  );

  if (isLoading) {
    return <MobileLoadingSpinner message="Loading dashboard..." variant="doctor" size="lg" />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-red-50 to-pink-50 p-4">
        <div className="text-center bg-white rounded-2xl p-8 shadow-lg">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Activity className="w-8 h-8 text-red-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">Unable to Load</h3>
          <p className="text-gray-600 text-sm">Failed to load dashboard data</p>
        </div>
      </div>
    );
  }

  // Allow rendering even if formattedData is not available yet
  // This prevents blank screen and shows the UI structure

  const statCards = [
    {
      icon: <CalendarDays className="w-4 h-4" />,
      label: "Scheduled",
      value: formattedData?.todaysAppointments || '0',
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600',
    },
    {
      icon: <CheckCircle className="w-4 h-4" />,
      label: 'Completed',
      value: formattedData?.completedAppointments || '0',
      color: 'from-emerald-500 to-emerald-600',
      bgColor: 'bg-emerald-50',
      textColor: 'text-emerald-600',
    },
    {
      icon: <Clock className="w-4 h-4" />,
      label: 'Pending',
      value: formattedData?.pendingAppointments || '0',
      color: 'from-amber-500 to-amber-600',
      bgColor: 'bg-amber-50',
      textColor: 'text-amber-600',
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-emerald-50 to-green-50 pb-20">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-emerald-600 to-green-600 px-4 pt-6 pb-8 rounded-b-3xl shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Welcome</h1>
            <p className="text-emerald-100 text-sm">
              Dr. {doctorProfile?.name || user?.name}
            </p>
            {doctorProfile?.specialization && (
              <p className="text-emerald-200 text-xs mt-1">
                {doctorProfile.specialization}
              </p>
            )}
          </div>
          <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
            <Activity className="w-6 h-6 text-white" />
          </div>
        </div>

        {/* Experience Card */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-400 rounded-xl flex items-center justify-center shadow-lg">
              <Award className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-white/80 text-xs font-medium mb-1">Experience</p>
              <p className="text-2xl font-bold text-white">
                {doctorProfile?.experience || 'N/A'}
              </p>
            </div>
            <div className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full">
              <p className="text-white text-xs font-semibold">Years</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-4">
        {/* Stats Grid - Square Cards */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          {statCards.map((stat, index) => (
            <div
              key={index}
              className="bg-white rounded-2xl p-4 shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
            >
              <div className={`w-12 h-12 ${stat.bgColor} rounded-xl flex items-center justify-center mb-3`}>
                <div className={stat.textColor}>{stat.icon}</div>
              </div>
              <p className="text-2xl font-bold text-gray-900 mb-1">{stat.value}</p>
              <p className="text-xs text-gray-600 font-medium">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-2xl p-4 shadow-md mb-6">
          <h3 className="text-base font-semibold text-gray-900 mb-3">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => router.push(`/mobile/hospital/${hospitalId}/patients`)}
              className="flex items-center gap-2 p-3 rounded-xl bg-purple-50 text-purple-600 border border-purple-200 hover:bg-purple-100 transition-all active:scale-95"
            >
              <Users size={18} />
              <span className="text-sm font-medium">Patients</span>
            </button>
            <button
              onClick={() => router.push(`/mobile/hospital/${hospitalId}/appointments`)}
              className="flex items-center gap-2 p-3 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 transition-all active:scale-95"
            >
              <Calendar size={18} />
              <span className="text-sm font-medium">Bookings</span>
            </button>
            <button
              onClick={() => router.push(`/mobile/hospital/${hospitalId}/appointments/add`)}
              className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 transition-all active:scale-95"
            >
              <UserPlus size={18} />
              <span className="text-sm font-medium">New Booking</span>
            </button>
            <button
              onClick={() => router.push(`/mobile/hospital/${hospitalId}/attendance`)}
              className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100 transition-all active:scale-95"
            >
              <Activity size={18} />
              <span className="text-sm font-medium">History</span>
            </button>
          </div>
        </div>

        {/* Availability Section */}
        <div className="bg-white rounded-2xl p-4 shadow-md mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-gray-900">My Availability</h3>
            {availabilityData?.availability && availabilityData.availability.length > 0 && (
              <button
                onClick={() => router.push(`/mobile/hospital/${hospitalId}/doctors/${doctorId}/add/availability`)}
                className="text-emerald-600 text-sm font-medium hover:text-emerald-700"
              >
                Edit
              </button>
            )}
          </div>

          {isLoadingAvailability ? (
            <MobileLoadingSpinner message="Loading availability..." variant="doctor" size="sm" fullScreen={false} />
          ) : availabilityData?.availability && availabilityData.availability.length > 0 ? (
            <div className="space-y-2">
              {availabilityData.availability.map((slot, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl border border-emerald-100"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center">
                      <Clock className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 capitalize">{slot.day}</p>
                      <p className="text-xs text-gray-600">
                        {slot.startTime} - {slot.endTime}
                      </p>
                    </div>
                  </div>
                  <div className="px-2 py-1 bg-emerald-100 rounded-md">
                    <p className="text-xs font-medium text-emerald-700">
                      {availabilityData.appointmentDuration || 30} min
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <AlertCircle className="w-8 h-8 text-amber-500" />
              </div>
              <p className="text-sm font-medium text-gray-900 mb-2">No Availability Set</p>
              <p className="text-xs text-gray-500 mb-4">
                Set your availability to start accepting appointments
              </p>
              <button
                onClick={() => router.push(`/mobile/hospital/${hospitalId}/doctors/${doctorId}/add/availability`)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-all active:scale-95"
              >
                <Plus size={18} />
                <span>Add Availability</span>
              </button>
            </div>
          )}
        </div>

        {/* Next Appointment Card */}
        {nextAppointment && (
          <div className="bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl p-5 mb-6 shadow-lg">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                  <CalendarDays className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-white/80 text-xs font-medium">Next Appointment</p>
                  <p className="text-white text-sm font-semibold">{nextAppointment.date} {nextAppointment.time}</p>
                </div>
              </div>
              <div className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full">
                <p className="text-white text-xs font-semibold">{nextAppointment.category}</p>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20">
              <p className="text-white font-semibold text-base mb-1">
                {nextAppointment.patientName}
              </p>
              <p className="text-white/80 text-sm">{nextAppointment.type}</p>
            </div>
          </div>
        )}

        {/* Upcoming Appointments */}
        {upcomingAppointments && upcomingAppointments.length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-md mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Upcoming Appointments</h3>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </div>
            <div className="space-y-3">
              {upcomingAppointments.slice(0, 3).map((appointment, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 bg-gradient-to-r from-gray-50 to-emerald-50 rounded-xl border border-gray-100 hover:border-emerald-200 transition-colors"
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
                    <span className="text-white font-bold text-sm">
                      {appointment.patientName?.charAt(0) || 'P'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">
                      {appointment.patientName}
                    </p>
                    <p className="text-xs text-gray-600 mt-0.5">{appointment.type}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-semibold text-emerald-600">{appointment.time}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{appointment.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Activity */}
        {recentActivity && recentActivity.length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Recent Activity</h3>
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            </div>
            <div className="space-y-3">
              {recentActivity.slice(0, 4).map((activity, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CheckCircle className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900">
                      <span className="font-semibold">{activity.patientName}</span>
                      <span className="text-gray-600"> • {activity.action}</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
