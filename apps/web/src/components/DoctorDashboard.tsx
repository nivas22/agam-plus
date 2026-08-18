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
    today: "bg-blue-100 text-blue-700 border-blue-200",
    tomorrow: "bg-orange-100 text-orange-700 border-orange-200",
    upcoming: "bg-gray-100 text-gray-700 border-gray-200",
    completed: "bg-green-100 text-green-700 border-green-200",
    scheduled: "bg-blue-100 text-blue-700 border-blue-200",
    cancelled: "bg-red-100 text-red-700 border-red-200"
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500">Doctor data not found</p>
        </div>
      </div>
    );
  }

  const { doctorData, totalPatients, todayAppointments, upcomingAppointments, recentPatients, appointmentStats } = data;
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-7xl mx-auto space-y-8 px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl shadow-sm">
            <Stethoscope className="w-8 h-8 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Doctor Dashboard</h1>
            <p className="text-gray-600 text-base mt-1">Welcome back, Dr. {doctorData.name}</p>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Patients */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center gap-4 mb-3">
              <div className="p-3 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600 font-medium mb-1">My Patients</p>
                <h2 className="text-3xl font-bold text-gray-900">{totalPatients}</h2>
              </div>
            </div>
            <p className="text-xs text-gray-500 ml-1">Under your care</p>
          </div>

          {/* Today's Appointments */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center gap-4 mb-3">
              <div className="p-3 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg">
                <Calendar className="w-6 h-6 text-emerald-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600 font-medium mb-1">Today's Appointments</p>
                <h2 className="text-3xl font-bold text-gray-900">{todayAppointments}</h2>
              </div>
            </div>
            <p className="text-xs text-gray-500 ml-1">Scheduled for today</p>
          </div>

          {/* Completed Appointments */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center gap-4 mb-3">
              <div className="p-3 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg">
                <Clock className="w-6 h-6 text-purple-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600 font-medium mb-1">Completed</p>
                <h2 className="text-3xl font-bold text-gray-900">{appointmentStats.completed}</h2>
              </div>
            </div>
            <p className="text-xs text-gray-500 ml-1">Total completed sessions</p>
          </div>

          {/* Scheduled Appointments */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center gap-4 mb-3">
              <div className="p-3 bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600 font-medium mb-1">Scheduled</p>
                <h2 className="text-3xl font-bold text-gray-900">{appointmentStats.scheduled}</h2>
              </div>
            </div>
            <p className="text-xs text-gray-500 ml-1">Upcoming sessions</p>
          </div>
        </div>

        {/* Upcoming Appointments & Recent Patients */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upcoming Appointments */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-1 h-8 bg-blue-500 rounded-full"></div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Upcoming Appointments</h3>
                  <p className="text-sm text-gray-500">Next 7 days</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {upcomingAppointments.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Calendar className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="font-medium text-gray-700">No upcoming appointments</p>
                  <p className="text-sm mt-1">You are all caught up!</p>
                </div>
              ) : (
                upcomingAppointments.map((appt) => {
                  const status = getAppointmentStatus(appt.appointmentDate);
                  return (
                    <div key={appt.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:shadow-sm hover:border-blue-200 transition-all duration-200">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{appt.patientName}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Phone className="w-3.5 h-3.5 text-gray-400" />
                          <p className="text-sm text-gray-600 truncate">{appt.patientPhone || "No phone"}</p>
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-sm font-semibold text-gray-900 whitespace-nowrap">
                          {format(appt.appointmentDate, "MMM dd")}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
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
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-1 h-8 bg-emerald-500 rounded-full"></div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">My Patients</h3>
                  <p className="text-sm text-gray-500">{totalPatients} total</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {recentPatients.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Users className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="font-medium text-gray-700">No patients assigned yet</p>
                </div>
              ) : (
                recentPatients.map((patient) => (
                  <div key={patient.id} className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg hover:shadow-sm hover:border-emerald-200 transition-all duration-200 cursor-pointer group">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center text-blue-700 font-bold text-lg shadow-sm">
                      {patient.name?.[0]?.toUpperCase() || "P"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{patient.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Phone className="w-3.5 h-3.5 text-gray-400" />
                        <p className="text-sm text-gray-600 truncate">{patient.phone || "No phone"}</p>
                      </div>
                      {patient.address && (
                        <div className="flex items-center gap-2 mt-1">
                          <MapPin className="w-3.5 h-3.5 text-gray-400" />
                          <p className="text-xs text-gray-500 truncate">{patient.address}</p>
                        </div>
                      )}
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-emerald-600 transition-colors" />
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
