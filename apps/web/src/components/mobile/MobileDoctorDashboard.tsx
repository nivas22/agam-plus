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
      <div className="flex items-center justify-center h-screen bg-status-danger-soft p-4">
        <div className="text-center bg-surface-paper rounded-2xl p-8 shadow-lg">
          <div className="w-16 h-16 bg-status-danger-soft rounded-full flex items-center justify-center mx-auto mb-4">
            <Activity className="w-8 h-8 text-status-danger" />
          </div>
          <h3 className="text-lg font-bold text-ink-900 mb-2">Unable to Load</h3>
          <p className="text-ink-700 text-sm">Failed to load dashboard data</p>
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
      color: 'from-brand-violet to-brand-violet-hover',
      bgColor: 'bg-brand-violet-soft',
      textColor: 'text-brand-violet',
    },
    {
      icon: <CheckCircle className="w-4 h-4" />,
      label: 'Completed',
      value: formattedData?.completedAppointments || '0',
      color: 'from-status-open to-status-open-hover',
      bgColor: 'bg-status-open-soft',
      textColor: 'text-status-open',
    },
    {
      icon: <Clock className="w-4 h-4" />,
      label: 'Pending',
      value: formattedData?.pendingAppointments || '0',
      color: 'from-status-warning to-status-warning-hover',
      bgColor: 'bg-status-warning-soft',
      textColor: 'text-status-warning',
    }
  ];

  return (
    <div className="min-h-screen bg-status-open-soft pb-20">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-status-open to-status-open-hover px-4 pt-6 pb-8 rounded-b-3xl shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Welcome</h1>
            <p className="text-status-open-soft text-sm">
              Dr. {doctorProfile?.name || user?.name}
            </p>
            {doctorProfile?.specialization && (
              <p className="text-status-open-soft text-xs mt-1">
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
            <div className="w-12 h-12 bg-brand-violet rounded-xl flex items-center justify-center shadow-lg">
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
              className="bg-surface-paper rounded-2xl p-4 shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
            >
              <div className={`w-12 h-12 ${stat.bgColor} rounded-xl flex items-center justify-center mb-3`}>
                <div className={stat.textColor}>{stat.icon}</div>
              </div>
              <p className="text-2xl font-bold text-ink-900 mb-1">{stat.value}</p>
              <p className="text-xs text-ink-700 font-medium">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="bg-surface-paper rounded-2xl p-4 shadow-md mb-6">
          <h3 className="text-base font-semibold text-ink-900 mb-3">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => router.push(`/mobile/hospital/${hospitalId}/patients`)}
              className="flex items-center gap-2 p-3 rounded-xl bg-brand-violet-soft text-brand-violet border border-brand-violet/20 hover:bg-brand-violet-soft transition-all active:scale-95"
            >
              <Users size={18} />
              <span className="text-sm font-medium">Patients</span>
            </button>
            <button
              onClick={() => router.push(`/mobile/hospital/${hospitalId}/appointments`)}
              className="flex items-center gap-2 p-3 rounded-xl bg-brand-violet-soft text-brand-violet border border-brand-violet/20 hover:bg-brand-violet-soft transition-all active:scale-95"
            >
              <Calendar size={18} />
              <span className="text-sm font-medium">Bookings</span>
            </button>
            <button
              onClick={() => router.push(`/mobile/hospital/${hospitalId}/appointments/add`)}
              className="flex items-center gap-2 p-3 rounded-xl bg-status-open-soft text-status-open border border-status-open/20 hover:bg-status-open-soft transition-all active:scale-95"
            >
              <UserPlus size={18} />
              <span className="text-sm font-medium">New Booking</span>
            </button>
            <button
              onClick={() => router.push(`/mobile/hospital/${hospitalId}/attendance`)}
              className="flex items-center gap-2 p-3 rounded-xl bg-status-warning-soft text-status-warning border border-status-warning/20 hover:bg-status-warning-soft transition-all active:scale-95"
            >
              <Activity size={18} />
              <span className="text-sm font-medium">History</span>
            </button>
          </div>
        </div>

        {/* Availability Section */}
        <div className="bg-surface-paper rounded-2xl p-4 shadow-md mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-ink-900">My Availability</h3>
            {availabilityData?.availability && availabilityData.availability.length > 0 && (
              <button
                onClick={() => router.push(`/mobile/hospital/${hospitalId}/doctors/${doctorId}/add/availability`)}
                className="text-status-open text-sm font-medium hover:text-status-open-hover"
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
                  className="flex items-center justify-between p-3 bg-status-open-soft rounded-xl border border-status-open/20"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-status-open rounded-lg flex items-center justify-center">
                      <Clock className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-ink-900 capitalize">{slot.day}</p>
                      <p className="text-xs text-ink-700">
                        {slot.startTime} - {slot.endTime}
                      </p>
                    </div>
                  </div>
                  <div className="px-2 py-1 bg-status-open-soft rounded-md">
                    <p className="text-xs font-medium text-status-open">
                      {availabilityData.appointmentDuration || 30} min
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-status-warning-soft rounded-full flex items-center justify-center mx-auto mb-3">
                <AlertCircle className="w-8 h-8 text-status-warning" />
              </div>
              <p className="text-sm font-medium text-ink-900 mb-2">No Availability Set</p>
              <p className="text-xs text-ink-500 mb-4">
                Set your availability to start accepting appointments
              </p>
              <button
                onClick={() => router.push(`/mobile/hospital/${hospitalId}/doctors/${doctorId}/add/availability`)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-brand-violet text-white rounded-xl font-medium hover:bg-brand-violet-hover transition-all active:scale-95"
              >
                <Plus size={18} />
                <span>Add Availability</span>
              </button>
            </div>
          )}
        </div>

        {/* Next Appointment Card */}
        {nextAppointment && (
          <div className="bg-gradient-to-br from-status-open to-status-open-hover rounded-2xl p-5 mb-6 shadow-lg">
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
          <div className="bg-surface-paper rounded-2xl p-5 shadow-md mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-ink-900">Upcoming Appointments</h3>
              <ChevronRight className="w-5 h-5 text-ink-500" />
            </div>
            <div className="space-y-3">
              {upcomingAppointments.slice(0, 3).map((appointment, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 bg-gradient-to-r from-surface-canvas to-status-open-soft rounded-xl border border-border hover:border-status-open/20 transition-colors"
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-status-open to-status-open-hover rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
                    <span className="text-white font-bold text-sm">
                      {appointment.patientName?.charAt(0) || 'P'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-ink-900 text-sm truncate">
                      {appointment.patientName}
                    </p>
                    <p className="text-xs text-ink-700 mt-0.5">{appointment.type}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-semibold text-status-open">{appointment.time}</p>
                    <p className="text-xs text-ink-500 mt-0.5">{appointment.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Activity */}
        {recentActivity && recentActivity.length > 0 && (
          <div className="bg-surface-paper rounded-2xl p-5 shadow-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-ink-900">Recent Activity</h3>
              <div className="w-2 h-2 bg-status-open rounded-full animate-pulse"></div>
            </div>
            <div className="space-y-3">
              {recentActivity.slice(0, 4).map((activity, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-3 bg-surface-canvas rounded-xl hover:bg-border transition-colors"
                >
                  <div className="w-8 h-8 bg-gradient-to-br from-status-open to-status-open-hover rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CheckCircle className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ink-900">
                      <span className="font-semibold">{activity.patientName}</span>
                      <span className="text-ink-700"> • {activity.action}</span>
                    </p>
                    <p className="text-xs text-ink-500 mt-1">{activity.time}</p>
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
