'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Calendar,
  Clock,
  User,
  Phone,
  Mail,
  MapPin,
  Plus,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { useHospitalAppointmentsApi } from '@/hooks/useNewAppointmentsApi';
import MobileLoadingSpinner from './MobileLoadingSpinner';

interface MobileAppointmentsPageProps {
  userRole: string | undefined;
  canEdit: boolean;
  hospitalId: string;
}

export default function MobileAppointmentsPage({ 
  userRole, 
  canEdit, 
  hospitalId 
}: MobileAppointmentsPageProps) {
  const router = useRouter();
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'upcoming' | 'completed' | 'cancelled'>('all');

  const { 
    appointments = [],
    isLoading,
    upcomingAppointments = []
  } = useHospitalAppointmentsApi(hospitalId, userRole, canEdit, undefined);

  // Calculate completed and cancelled appointments
  const completedAppointments = useMemo(() => 
    appointments.filter((apt: any) => apt.status?.toLowerCase() === 'completed'),
    [appointments]
  );

  const cancelledAppointments = useMemo(() => 
    appointments.filter((apt: any) => apt.status?.toLowerCase() === 'cancelled'),
    [appointments]
  );

  // Filter appointments based on selected filter
  const filteredAppointments = useMemo(() => {
    switch (selectedFilter) {
      case 'upcoming':
        return upcomingAppointments;
      case 'completed':
        return completedAppointments;
      case 'cancelled':
        return cancelledAppointments;
      default:
        return appointments;
    }
  }, [selectedFilter, appointments, upcomingAppointments, completedAppointments, cancelledAppointments]);

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return 'bg-status-open-soft text-status-open border-status-open/20';
      case 'cancelled':
        return 'bg-status-danger-soft text-status-danger border-status-danger/20';
      case 'scheduled':
      case 'confirmed':
        return 'bg-brand-violet-soft text-brand-violet border-brand-violet/20';
      default:
        return 'bg-surface-canvas text-ink-700 border-border';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return <CheckCircle size={14} />;
      case 'cancelled':
        return <XCircle size={14} />;
      default:
        return <AlertCircle size={14} />;
    }
  };

  return (
    <div className="min-h-screen bg-status-open-soft">
      {/* Header with Stats */}
      <div className="bg-gradient-to-r from-status-open to-status-open-hover px-4 py-6 shadow-lg">
        <h1 className="text-2xl font-bold text-white mb-4">Appointments</h1>
        
        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 border border-white/30">
            <p className="text-white/80 text-xs mb-1">Upcoming</p>
            <p className="text-white text-2xl font-bold">{upcomingAppointments.length}</p>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 border border-white/30">
            <p className="text-white/80 text-xs mb-1">Completed</p>
            <p className="text-white text-2xl font-bold">{completedAppointments.length}</p>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 border border-white/30">
            <p className="text-white/80 text-xs mb-1">Total</p>
            <p className="text-white text-2xl font-bold">{appointments.length}</p>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="bg-surface-paper border-b border-border px-4 py-3 sticky top-0 z-10">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[
            { key: 'all', label: 'All', count: appointments.length },
            { key: 'upcoming', label: 'Upcoming', count: upcomingAppointments.length },
            { key: 'completed', label: 'Completed', count: completedAppointments.length },
            { key: 'cancelled', label: 'Cancelled', count: cancelledAppointments.length },
          ].map((filter) => (
            <button
              key={filter.key}
              onClick={() => setSelectedFilter(filter.key as any)}
              className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                selectedFilter === filter.key
                  ? 'bg-status-open text-white shadow-md'
                  : 'bg-surface-canvas text-ink-700 hover:bg-border'
              }`}
            >
              {filter.label} ({filter.count})
            </button>
          ))}
        </div>
      </div>

      {/* Appointments List */}
      <div className="px-4 py-4 pb-24">
        {isLoading ? (
          <MobileLoadingSpinner message="Loading appointments..." variant="doctor" size="md" fullScreen={false} />
        ) : filteredAppointments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            {/* Animated Icon Container */}
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-gradient-to-r from-status-open to-status-open-hover rounded-full blur-2xl opacity-20 animate-pulse"></div>
              <div className="relative w-24 h-24 bg-status-open-soft rounded-3xl flex items-center justify-center shadow-lg border-4 border-white">
                <Calendar className="w-12 h-12 text-status-open" />
              </div>
            </div>

            {/* Title and Description */}
            <h3 className="text-xl font-bold text-ink-900 mb-2 text-center">
              {selectedFilter === 'all' ? 'No Appointments Yet' : `No ${selectedFilter.charAt(0).toUpperCase() + selectedFilter.slice(1)} Appointments`}
            </h3>
            <p className="text-sm text-ink-500 text-center max-w-xs mb-8 leading-relaxed">
              {selectedFilter === 'all' 
                ? 'Your appointment schedule is empty. New appointments will appear here.' 
                : `You don't have any ${selectedFilter} appointments at the moment.`}
            </p>

            {/* Decorative Elements */}
            <div className="grid grid-cols-3 gap-3 w-full max-w-sm">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-4 text-center border border-blue-200">
                <div className="w-10 h-10 bg-blue-500 rounded-xl mx-auto mb-2 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-white" />
                </div>
                <p className="text-xs font-semibold text-blue-900">Schedule</p>
              </div>
              <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-2xl p-4 text-center border border-emerald-200">
                <div className="w-10 h-10 bg-emerald-500 rounded-xl mx-auto mb-2 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-white" />
                </div>
                <p className="text-xs font-semibold text-emerald-900">Track</p>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl p-4 text-center border border-purple-200">
                <div className="w-10 h-10 bg-purple-500 rounded-xl mx-auto mb-2 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-white" />
                </div>
                <p className="text-xs font-semibold text-purple-900">Manage</p>
              </div>
            </div>

            {/* Helpful Tip */}
            <div className="mt-8 bg-status-open-soft rounded-2xl p-4 border border-status-open/20 w-full max-w-sm">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-status-open rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-lg">💡</span>
                </div>
                <div>
                  <p className="text-xs font-semibold text-status-open mb-1">Quick Tip</p>
                  <p className="text-xs text-status-open leading-relaxed">
                    Appointments will automatically appear here once they are scheduled by patients or added by the admin.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAppointments.map((appointment) => (
              <div
                key={appointment.id}
                className="bg-surface-paper rounded-2xl p-4 shadow-md border border-border hover:shadow-lg transition-all"
              >
                {/* Header with Status */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-status-open to-status-open-hover flex items-center justify-center text-white font-bold shadow-sm">
                        {appointment.patientName?.charAt(0) || 'P'}
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-ink-900">
                          {appointment.patientName || 'Unknown Patient'}
                        </h3>
                        <p className="text-xs text-ink-500">{(appointment as any).type || 'Consultation'}</p>
                      </div>
                    </div>
                  </div>
                  <span className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border ${getStatusColor(appointment.status)}`}>
                    {getStatusIcon(appointment.status)}
                    {appointment.status}
                  </span>
                </div>

                {/* Appointment Details */}
                <div className="space-y-2 bg-surface-canvas rounded-xl p-3">
                  {/* Date & Time */}
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar size={16} className="text-status-open flex-shrink-0" />
                    <span className="text-ink-700 font-medium">{appointment.date}</span>
                    <Clock size={16} className="text-status-open ml-2 flex-shrink-0" />
                    <span className="text-ink-700 font-medium">{appointment.time}</span>
                  </div>

                  {/* Doctor */}
                  {appointment.doctorName && (
                    <div className="flex items-center gap-2 text-sm">
                      <User size={16} className="text-ink-500 flex-shrink-0" />
                      <span className="text-ink-700">Dr. {appointment.doctorName}</span>
                    </div>
                  )}

                  {/* Contact Info */}
                  {appointment.patientPhone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone size={16} className="text-ink-500 flex-shrink-0" />
                      <span className="text-ink-700">{appointment.patientPhone}</span>
                    </div>
                  )}

                  {(appointment as any).patientEmail && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail size={16} className="text-ink-500 flex-shrink-0" />
                      <span className="text-ink-700 truncate">{(appointment as any).patientEmail}</span>
                    </div>
                  )}

                  {/* Location */}
                  {(appointment as any).location && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin size={16} className="text-ink-500 flex-shrink-0" />
                      <span className="text-ink-700">{(appointment as any).location}</span>
                    </div>
                  )}
                </div>

                {/* Notes */}
                {appointment.notes && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-xs text-ink-500 italic">"{appointment.notes}"</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating Add Button */}
      {canEdit && (
        <button
          onClick={() => router.push(`/mobile/hospital/${hospitalId}/appointments/add`)}
          className="fixed bottom-20 right-6 w-16 h-16 rounded-full bg-gradient-to-r from-status-open to-status-open-hover text-white flex items-center justify-center shadow-2xl hover:shadow-status-open/50 transition-all transform hover:scale-110 active:scale-95 z-20"
          aria-label="Add new appointment3"
        >
          <Plus size={28} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}
