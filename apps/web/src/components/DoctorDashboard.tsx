'use client';

import { format, isToday, isTomorrow } from "date-fns";
import {
  Users,
  Calendar,
  Clock,
  Stethoscope,
  Phone,
  MapPin,
  AlertCircle,
  ChevronRight
} from "lucide-react";

import { useDoctorDashboard } from '@/hooks/useDoctorDashboard';

export default function DoctorDashboard() {
  const { data, isLoading, error } = useDoctorDashboard();

  // const { user: currentUser } = useAuth();
  // const [doctorData, setDoctorData] = useState<any>(null);
  // const [totalPatients, setTotalPatients] = useState<number>(0);
  // const [todayAppointments, setTodayAppointments] = useState<number>(0);
  // const [upcomingAppointments, setUpcomingAppointments] = useState<Appointment[]>([]);
  // const [recentPatients, setRecentPatients] = useState<Patient[]>([]);
  // const [appointmentStats, setAppointmentStats] = useState<AppointmentStats>({
  //   completed: 0,
  //   scheduled: 0,
  //   cancelled: 0
  // });
  // const [loading, setLoading] = useState<boolean>(true);

  const getAppointmentStatus = (date: Date) => {
    if (isToday(date)) return "today";
    if (isTomorrow(date)) return "tomorrow";
    return "upcoming";
  };

  const statusColors: Record<string, string> = {
    today: "bg-brand-violet-soft text-brand-violet border-brand-violet/20",
    tomorrow: "bg-status-warning-soft text-status-warning border-status-warning/20",
    upcoming: "bg-surface-canvas text-ink-700 border-border",
    completed: "bg-status-open-soft text-status-open border-status-open/20",
    scheduled: "bg-brand-violet-soft text-brand-violet border-brand-violet/20",
    cancelled: "bg-status-danger-soft text-status-danger border-status-danger/20"
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-violet"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-ink-500 mx-auto mb-3" />
          <p className="text-ink-500">Doctor data not found</p>
        </div>
      </div>
    );
  }

  const { doctorData, totalPatients, todayAppointments, upcomingAppointments, recentPatients, appointmentStats } = data;
  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-canvas to-surface-canvas">
      <div className="max-w-7xl mx-auto space-y-8 px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="p-4 bg-gradient-to-br from-status-open-soft to-status-open-soft rounded-2xl shadow-sm">
            <Stethoscope className="w-8 h-8 text-status-open" />
          </div>
          <div>
            <h1 className="font-display tracking-tight text-3xl font-bold text-ink-900">Doctor Dashboard</h1>
            <p className="text-ink-700 text-base mt-1">Welcome back, Dr. {doctorData.name}</p>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Patients */}
          <div className="bg-surface-paper p-6 rounded-xl shadow-sm border border-border hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center gap-4 mb-3">
              <div className="p-3 bg-gradient-to-br from-brand-violet-soft to-brand-violet-soft rounded-lg">
                <Users className="w-6 h-6 text-brand-violet" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-ink-700 font-medium mb-1">My Patients</p>
                <h2 className="font-display tracking-tight text-3xl font-bold text-ink-900">{totalPatients}</h2>
              </div>
            </div>
            <p className="text-xs text-ink-500 ml-1">Under your care</p>
          </div>

          {/* Today's Appointments */}
          <div className="bg-surface-paper p-6 rounded-xl shadow-sm border border-border hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center gap-4 mb-3">
              <div className="p-3 bg-gradient-to-br from-status-open-soft to-status-open-soft rounded-lg">
                <Calendar className="w-6 h-6 text-status-open" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-ink-700 font-medium mb-1">Today's Appointments</p>
                <h2 className="font-display tracking-tight text-3xl font-bold text-ink-900">{todayAppointments}</h2>
              </div>
            </div>
            <p className="text-xs text-ink-500 ml-1">Scheduled for today</p>
          </div>

          {/* Completed Appointments */}
          <div className="bg-surface-paper p-6 rounded-xl shadow-sm border border-border hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center gap-4 mb-3">
              <div className="p-3 bg-gradient-to-br from-brand-violet-soft to-brand-violet-soft rounded-lg">
                <Clock className="w-6 h-6 text-brand-violet" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-ink-700 font-medium mb-1">Completed</p>
                <h2 className="font-display tracking-tight text-3xl font-bold text-ink-900">{appointmentStats.completed}</h2>
              </div>
            </div>
            <p className="text-xs text-ink-500 ml-1">Total completed sessions</p>
          </div>

          {/* Scheduled Appointments */}
          <div className="bg-surface-paper p-6 rounded-xl shadow-sm border border-border hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center gap-4 mb-3">
              <div className="p-3 bg-gradient-to-br from-status-warning-soft to-status-warning-soft rounded-lg">
                <Clock className="w-6 h-6 text-status-warning" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-ink-700 font-medium mb-1">Scheduled</p>
                <h2 className="font-display tracking-tight text-3xl font-bold text-ink-900">{appointmentStats.scheduled}</h2>
              </div>
            </div>
            <p className="text-xs text-ink-500 ml-1">Upcoming sessions</p>
          </div>
        </div>

        {/* Upcoming Appointments & Recent Patients */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upcoming Appointments */}
          <div className="bg-surface-paper rounded-xl shadow-sm border border-border p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-1 h-8 bg-brand-violet rounded-full"></div>
                <div>
                  <h3 className="font-display tracking-tight text-xl font-bold text-ink-900">Upcoming Appointments</h3>
                  <p className="text-sm text-ink-500">Next 7 days</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {upcomingAppointments.length === 0 ? (
                <div className="text-center py-12 text-ink-500">
                  <div className="w-16 h-16 bg-surface-canvas rounded-full flex items-center justify-center mx-auto mb-4">
                    <Calendar className="w-8 h-8 text-ink-500" />
                  </div>
                  <p className="font-medium text-ink-700">No upcoming appointments</p>
                  <p className="text-sm mt-1">You are all caught up!</p>
                </div>
              ) : (
                upcomingAppointments.map((appt) => {
                  const status = getAppointmentStatus(appt.appointmentDate);
                  return (
                    <div key={appt.id} className="flex items-center justify-between p-4 border border-border rounded-lg hover:shadow-sm hover:border-brand-violet/20 transition-all duration-200">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-ink-900 truncate">{appt.patientName}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Phone className="w-3.5 h-3.5 text-ink-500" />
                          <p className="font-mono tabular text-sm text-ink-700 truncate">{appt.patientPhone || "No phone"}</p>
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <p className="font-mono tabular text-sm font-semibold text-ink-900 whitespace-nowrap">
                          {format(appt.appointmentDate, "MMM dd")}
                        </p>
                        <p className="font-mono tabular text-xs text-ink-500 mt-0.5">
                          {format(appt.appointmentDate, "h:mm a")}
                        </p>
                        <span className={`inline-block text-xs px-2.5 py-1 rounded-full border mt-2 font-medium ${statusColors[status]}`}>
                          {status}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Recent Patients */}
          <div className="bg-surface-paper rounded-xl shadow-sm border border-border p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-1 h-8 bg-status-open rounded-full"></div>
                <div>
                  <h3 className="font-display tracking-tight text-xl font-bold text-ink-900">My Patients</h3>
                  <p className="text-sm text-ink-500">{totalPatients} total</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {recentPatients.length === 0 ? (
                <div className="text-center py-12 text-ink-500">
                  <div className="w-16 h-16 bg-surface-canvas rounded-full flex items-center justify-center mx-auto mb-4">
                    <Users className="w-8 h-8 text-ink-500" />
                  </div>
                  <p className="font-medium text-ink-700">No patients assigned yet</p>
                </div>
              ) : (
                recentPatients.map((patient) => (
                  <div key={patient.id} className="flex items-center gap-4 p-4 border border-border rounded-lg hover:shadow-sm hover:border-status-open/20 transition-all duration-200 cursor-pointer group">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-violet-soft to-brand-violet-soft flex items-center justify-center text-brand-violet font-bold text-lg shadow-sm">
                      {patient.name?.[0]?.toUpperCase() || "P"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-ink-900 truncate">{patient.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Phone className="w-3.5 h-3.5 text-ink-500" />
                        <p className="font-mono tabular text-sm text-ink-700 truncate">{patient.phone || "No phone"}</p>
                      </div>
                      {patient.address && (
                        <div className="flex items-center gap-2 mt-1">
                          <MapPin className="w-3.5 h-3.5 text-ink-500" />
                          <p className="text-xs text-ink-500 truncate">{patient.address}</p>
                        </div>
                      )}
                    </div>
                    <ChevronRight className="w-5 h-5 text-ink-500 group-hover:text-status-open transition-colors" />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
