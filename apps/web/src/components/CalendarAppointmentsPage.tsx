'use client';

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AppointmentWithDetails } from "@/types/appointment";
import { 
  CalendarDays, 
  ChevronLeft,
  ChevronRight,
  Plus
} from "lucide-react";
import { 
  format, 
  addDays, 
  startOfWeek,
  parse
} from "date-fns";
import { 
  getWeekDays, 
  groupAppointmentsByDateAndTime,
  getTimeSlots,
  statusColors
} from "@/utils/dateUtils";
import { useHospitalAppointmentsApi } from "@/hooks/useNewAppointmentsApi";
import { useHospitalPatients } from "@/hooks/useNewPatientApi";
import { useHospitalDoctors } from "@/hooks/useNewDoctorApi";
import AppointmentDetails from "./AppointmentDetails";
import DoctorAppointmentBottomSheet from "./DoctorAppointmentDetails";
import PageHeader from "./PageHeader";

interface CalendarAppointmentsPageProps {
  userRole: string | undefined;
  canEdit: boolean;
  hospitalId: string;
  userId?: string;
}

type ViewMode = 'day' | 'week' | 'month';

export default function CalendarAppointmentsPage({ 
  userRole, 
  canEdit,
  hospitalId,
  userId
}: CalendarAppointmentsPageProps) {
  const router = useRouter();
  
  // State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedApp, setSelectedApp] = useState<AppointmentWithDetails | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedAppointmentsToUpdate, setSelectedAppointmentsToUpdate] = useState<AppointmentWithDetails[]>([]);
  const [modalPatient, setModalPatient] = useState<any>(null);
  const [hoveredAppointment, setHoveredAppointment] = useState<AppointmentWithDetails | null>(null);
  const [hoverPosition, setHoverPosition] = useState<{ x: number; y: number } | null>(null);
  const [doctorFilter, setDoctorFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);

  // Get week start date (Monday)
  const weekStart = useMemo(() => 
    startOfWeek(currentDate, { weekStartsOn: 1 }), 
    [currentDate]
  );

  // Get calendar days for current view
  const calendarDays = useMemo(() => {
    if (viewMode === 'day') {
      return [{ 
        date: currentDate, 
        dateString: format(currentDate, 'yyyy-MM-dd'),
        dayOfWeek: format(currentDate, 'EEE'),
        dayNumber: currentDate.getDate(),
        isToday: format(currentDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd'),
        isWeekend: currentDate.getDay() === 0 || currentDate.getDay() === 6
      }];
    }
    return getWeekDays(weekStart);
  }, [viewMode, currentDate, weekStart]);

  // Create date range params
  const params = useMemo(() => {
    const searchParams = new URLSearchParams();
    const startDate = format(calendarDays[0].date, 'yyyy-MM-dd');
    const endDate = format(calendarDays[calendarDays.length - 1].date, 'yyyy-MM-dd');
    
    searchParams.append('startDate', startDate);
    searchParams.append('endDate', endDate);
    if (userRole) searchParams.append('userRole', userRole);
    if (userRole === 'doctor' && userId) searchParams.append('doctorId', userId);
    
    return searchParams;
  }, [calendarDays, userRole, userId]);

  // Fetch data
  const {
    appointments,
    isLoading: appointmentsLoading,
    refetchAppointments
  } = useHospitalAppointmentsApi(hospitalId, userRole, false, params);

  const { data: patientsData = { patients: [] } } = useHospitalPatients(hospitalId, undefined, true);
  const { data: doctorsData = { doctors: [] } } = useHospitalDoctors(hospitalId, undefined, true);

  // Filter appointments based on search, doctor, and status
  const filteredAppointments = useMemo(() => {
    if (!appointments || appointments.length === 0) return [];

    let results = [...appointments];
    const search = searchTerm.trim().toLowerCase();

    // Search filter
    if (search) {
      results = results.filter((appt) => {
        const patient = patientsData.patients.find((p) => p.id === appt.patientId);
        const patientName = appt.patientName?.toLowerCase() || "";
        const patientId = patient?.patientId?.toLowerCase() || "";
        const doctorName = appt.doctorName?.toLowerCase() || "";
        const status = appt.status?.toLowerCase() || "";
        const dateTime = new Date(appt.date).toLocaleString().toLowerCase();

        return (
          patientName.includes(search) ||
          patientId.includes(search) ||
          doctorName.includes(search) ||
          status.includes(search) ||
          dateTime.includes(search)
        );
      });
    }

    // Doctor filter
    if (doctorFilter !== "all") {
      results = results.filter((appt) => appt.doctorProfileId === doctorFilter);
    }

    // Status filter
    if (statusFilter !== "all") {
      results = results.filter((appt) => appt.status === statusFilter);
    }

    return results;
  }, [appointments, searchTerm, doctorFilter, statusFilter, patientsData.patients]);

  // Group appointments by date and time
  const groupedAppointments = useMemo(() => 
    groupAppointmentsByDateAndTime(filteredAppointments),
    [filteredAppointments]
  );

  // Time slots for calendar grid
  const timeSlots = useMemo(() => getTimeSlots(8, 20), []);

  // Navigation handlers
  const handlePrevious = useCallback(() => {
    if (viewMode === 'day') {
      setCurrentDate(prev => addDays(prev, -1));
    } else {
      setCurrentDate(prev => addDays(prev, -7));
    }
  }, [viewMode]);

  const handleNext = useCallback(() => {
    if (viewMode === 'day') {
      setCurrentDate(prev => addDays(prev, 1));
    } else {
      setCurrentDate(prev => addDays(prev, 7));
    }
  }, [viewMode]);

  const handleToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  const handleViewChange = useCallback((view: 'list' | 'calendar') => {
    if (view === 'list') {
      router.push(`/hospital/${hospitalId}/appointments`);
    }
    // If 'calendar', we're already on the calendar view, so do nothing
  }, [router, hospitalId]);

  const handleAppointmentClick = useCallback((appointment: AppointmentWithDetails) => {
    const patient = patientsData.patients.find((p) => p.id === appointment.patientId);
    setModalPatient(patient);
    setSelectedApp(appointment);
    setSelectedAppointmentsToUpdate([appointment]);
    setShowDetailsModal(true);
  }, [patientsData.patients]);

  const getInitials = useCallback((name: string) => {
    if (!name) return "U";
    const parts = name.split(" ");
    if (parts.length === 1) {
      return parts[0].substring(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }, []);

  // Handle hover events
  const handleMouseEnter = useCallback((appointment: AppointmentWithDetails, event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setHoveredAppointment(appointment);
    setHoverPosition({
      x: rect.right + 10,
      y: rect.top
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoveredAppointment(null);
    setHoverPosition(null);
  }, []);

  // Render appointment card
  const renderAppointmentCard = useCallback((appointment: AppointmentWithDetails) => {
    const parsedTime = parse(appointment.time, "HH:mm", new Date(2000, 0, 1));
    const formattedTime = format(parsedTime, "h:mm a");
    const patient = patientsData.patients.find((p) => p.id === appointment.patientId);
    
    return (
      <div
        key={appointment.id}
        onClick={() => handleAppointmentClick(appointment)}
        onMouseEnter={(e) => handleMouseEnter(appointment, e)}
        onMouseLeave={handleMouseLeave}
        className="mb-1 p-2 rounded-lg cursor-pointer transition-all hover:shadow-md border border-border bg-surface-paper hover:border-brand-violet"
      >
        <div className="flex items-start gap-2">
          <div className="w-8 h-8 rounded-full bg-brand-violet-soft flex items-center justify-center text-xs font-semibold text-brand-violet flex-shrink-0">
            {getInitials(appointment.doctorName)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-ink-900 truncate">
              Dr. {appointment.doctorName}
            </p>
            <p className="text-xs text-ink-700 truncate">
              {appointment.patientName}
              {patient?.patientId && (
                <span className="font-mono tabular text-ink-500 ml-1">#{patient.patientId}</span>
              )}
            </p>
            <p className="font-mono tabular text-xs text-ink-500">
              {formattedTime}
            </p>
            <div className="flex items-center gap-1 mt-1">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[appointment.status] || "bg-surface-canvas text-ink-900"}`}>
                {appointment.status}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }, [handleAppointmentClick, getInitials, handleMouseEnter, handleMouseLeave, patientsData.patients]);

  if (appointmentsLoading && appointments.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-violet"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:px-6 lg:px-8 pb-20 relative">
      {/* Header */}
      <PageHeader
        title="Appointments"
        type="appointment"
        search={searchTerm}
        setSearch={setSearchTerm}
        dataLength={filteredAppointments.length}
        showFilters={showFilters}
        setShowFilters={setShowFilters}
        icon={CalendarDays}
        filter={undefined}
        setFilter={undefined}
        refreshData={refetchAppointments}
        onCalendarClick={undefined}
        viewMode="calendar"
        onViewChange={handleViewChange}
      />

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-surface-paper rounded-xl p-4 shadow-sm border border-border">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Doctor Filter */}
            <select
              value={doctorFilter}
              onChange={(e) => setDoctorFilter(e.target.value)}
              className="px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-brand-violet focus:border-brand-violet bg-surface-paper"
            >
              <option value="all">All Doctors</option>
              {doctorsData.doctors.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  Dr. {doctor.name}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-brand-violet focus:border-brand-violet bg-surface-paper"
            >
              <option value="all">All Status</option>
              <option value="scheduled">Scheduled</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="no-show">No Show</option>
            </select>

            {/* Clear Filters Button */}
            {(searchTerm || doctorFilter !== "all" || statusFilter !== "all") && (
              <button
                onClick={() => {
                  setSearchTerm("");
                  setDoctorFilter("all");
                  setStatusFilter("all");
                }}
                className="px-4 py-2 text-sm text-ink-700 hover:text-ink-900 underline"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
      )}

      {/* Date Navigation and Calendar Container */}
      <div className="bg-surface-paper rounded-xl shadow-sm border border-border overflow-hidden">
        {/* Date Navigation */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <button
              onClick={handleToday}
              className="px-4 py-2 bg-brand-violet text-white rounded-lg hover:bg-brand-violet-hover transition-colors"
            >
              Today
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevious}
                className="p-2 hover:bg-surface-canvas rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={handleNext}
                className="p-2 hover:bg-surface-canvas rounded-lg transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            <h2 className="font-display tracking-tight text-lg font-semibold text-ink-900">
              {format(currentDate, 'MMMM yyyy')}
            </h2>
          </div>

          <div className="flex items-center gap-2 bg-surface-canvas rounded-lg p-1">
            <button
              onClick={() => setViewMode('day')}
              className={`px-4 py-2 rounded-md transition-colors ${
                viewMode === 'day' 
                  ? 'bg-surface-paper text-brand-violet shadow-sm' 
                  : 'text-ink-700 hover:text-ink-900'
              }`}
            >
              Day
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-4 py-2 rounded-md transition-colors ${
                viewMode === 'week' 
                  ? 'bg-surface-paper text-brand-violet shadow-sm' 
                  : 'text-ink-700 hover:text-ink-900'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`px-4 py-2 rounded-md transition-colors ${
                viewMode === 'month' 
                  ? 'bg-surface-paper text-brand-violet shadow-sm' 
                  : 'text-ink-700 hover:text-ink-900'
              }`}
            >
              Month
            </button>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-surface-paper rounded-xl shadow-sm border border-border overflow-hidden">
        {filteredAppointments.length > 0 ? (
          <div className="overflow-auto">
            <div className="min-w-max">
              {/* Day Headers */}
              <div className="sticky top-0 bg-surface-paper border-b border-border z-10">
                <div className="flex">
                  <div className="w-20 flex-shrink-0 border-r border-border"></div>
                  {calendarDays.map((day) => (
                    <div
                      key={day.dateString}
                      className="flex-1 min-w-[150px] p-4 text-center border-r border-border"
                    >
                      <div className="flex flex-col items-center">
                        <span className="text-sm font-medium text-ink-700">
                          {day.dayOfWeek}
                        </span>
                        <span
                          className={`mt-1 w-10 h-10 flex items-center justify-center rounded-full text-lg font-semibold ${
                            day.isToday
                              ? 'bg-brand-violet text-white'
                              : 'text-ink-900'
                          }`}
                        >
                          {day.dayNumber}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Time Grid */}
          <div className="relative">
            {timeSlots.map((timeSlot) => (
              <div key={timeSlot} className="flex border-b border-border">
                {/* Time Label */}
                <div className="w-20 flex-shrink-0 p-2 text-right text-sm text-ink-500 border-r border-border">
                  {format(parse(timeSlot, 'HH:mm', new Date(2000, 0, 1)), 'h a')}
                </div>

                {/* Day Columns */}
                {calendarDays.map((day) => {
                  const dayAppointments = groupedAppointments[day.dateString]?.[timeSlot] || [];
                  
                  return (
                    <div
                      key={`${day.dateString}-${timeSlot}`}
                      className="flex-1 min-w-[150px] min-h-[80px] p-2 border-r border-border bg-surface-paper hover:bg-surface-canvas transition-colors"
                    >
                      {dayAppointments.map((appointment) => 
                        renderAppointmentCard(appointment)
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-ink-500">
            <CalendarDays className="w-16 h-16 text-border mx-auto mb-4" />
            <p>No appointments to display</p>
          </div>
        )}
      </div>

      {/* Hover Popup */}
      {hoveredAppointment && hoverPosition && (() => {
        const patient = patientsData.patients.find((p) => p.id === hoveredAppointment.patientId);
        return (
          <div
            className="fixed z-50 pointer-events-none"
            style={{
              left: `${hoverPosition.x}px`,
              top: `${hoverPosition.y}px`,
            }}
          >
            <div className="bg-surface-paper rounded-xl shadow-2xl border border-border p-4 w-80 animate-fadeIn">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-brand-violet-soft flex items-center justify-center text-lg font-bold text-brand-violet">
                  {getInitials(hoveredAppointment.doctorName)}
                </div>
                <div className="flex-1">
                  <h3 className="font-display tracking-tight font-bold text-ink-900 text-lg">
                    Dr. {hoveredAppointment.doctorName}
                  </h3>
                  {hoveredAppointment.doctorSpecialization && (
                    <p className="text-sm text-ink-500">
                      {hoveredAppointment.doctorSpecialization}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2 border-t border-border pt-3">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-brand-violet-soft flex items-center justify-center text-sm font-semibold text-brand-violet">
                    {getInitials(hoveredAppointment.patientName)}
                  </div>
                  <div>
                    <p className="font-semibold text-ink-900">
                      {hoveredAppointment.patientName}
                      {patient?.patientId && (
                        <span className="font-mono tabular text-ink-500 ml-1 font-normal text-xs">#{patient.patientId}</span>
                      )}
                    </p>
                    {hoveredAppointment.patientAge && (
                      <p className="text-xs text-ink-500">
                        {hoveredAppointment.patientAge} years
                        {hoveredAppointment.patientGender && ` • ${hoveredAppointment.patientGender}`}
                      </p>
                    )}
                  </div>
                </div>

              <div className="flex items-center gap-2 text-sm text-ink-700 pt-2">
                <CalendarDays className="w-4 h-4" />
                <span className="font-mono tabular">
                  {format(new Date(hoveredAppointment.date), "EEE, MMM d, yyyy")}
                </span>
              </div>

              <div className="flex items-center gap-2 text-sm text-ink-700">
                <div className="w-4 h-4 flex items-center justify-center">⏰</div>
                <span className="font-mono tabular">
                  {format(parse(hoveredAppointment.time, "HH:mm", new Date(2000, 0, 1)), "h:mm a")}
                </span>
              </div>

              {hoveredAppointment.patientPhone && (
                <div className="flex items-center gap-2 text-sm text-ink-700">
                  <div className="w-4 h-4 flex items-center justify-center">📞</div>
                  <span className="font-mono tabular">{hoveredAppointment.patientPhone}</span>
                </div>
              )}

              <div className="pt-2">
                <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${statusColors[hoveredAppointment.status] || "bg-surface-canvas text-ink-900"}`}>
                  {hoveredAppointment.status}
                </span>
              </div>

              {hoveredAppointment.notes && (
                <div className="pt-2 border-t border-border">
                  <p className="text-xs text-ink-500 font-medium mb-1">Notes:</p>
                  <p className="text-sm text-ink-700">{hoveredAppointment.notes}</p>
                </div>
              )}
            </div>

            <div className="mt-3 pt-3 border-t border-border">
              <p className="text-xs text-ink-500 text-center">
                Click to view full details
              </p>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Floating Add Button */}
      {canEdit && (
        <button
          onClick={() => router.push(`/hospital/${hospitalId}/appointments/add`)}
          className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-brand-violet text-white flex items-center justify-center shadow-2xl hover:bg-brand-violet-hover transition-all transform hover:scale-110 z-20"
          aria-label="Add new appointment2"
        >
          <Plus size={24} />
        </button>
      )}

      {/* Appointment Details Modal */}
      {showDetailsModal && selectedApp && (
        userRole === "doctor" ? (
          <DoctorAppointmentBottomSheet
            appointment={selectedApp}
            onClose={() => {
              setShowDetailsModal(false);
              setSelectedApp(null);
            }}
            onRefetch={refetchAppointments}
          />
        ) : (
          <AppointmentDetails
            hospitalId={hospitalId}
            userRole={userRole}
            updateAppointmentsMode={showDetailsModal}
            setUpdateAppointmentsMode={setShowDetailsModal}
            selectedPatient={modalPatient}
            doctors={doctorsData.doctors || []}
            futureAppointments={{}}
            selectedAppointmentsToUpdate={selectedAppointmentsToUpdate}
            setSelectedAppointmentsToUpdate={setSelectedAppointmentsToUpdate}
            selectedDoctorForAppointments={null}
            setSelectedDoctorForAppointments={() => {}}
            updateSelectedAppointments={async () => {
              setShowDetailsModal(false);
              await refetchAppointments();
            }}
            updateAllFutureAppointments={async () => {
              setShowDetailsModal(false);
              await refetchAppointments();
            }}
            selectedApp={selectedApp}
          />
        )
      )}
    </div>
  );
}
