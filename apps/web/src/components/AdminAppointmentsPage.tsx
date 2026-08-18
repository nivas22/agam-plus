// components/AppointmentsPage.tsx - Fixed version
'use client';

import { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppointmentWithDetails } from "@/types/appointment";
import { 
  CalendarDays, 
  ChevronDown, 
  ChevronUp, 
  Plus,
  CheckCircle,
  Clock
} from "lucide-react";
import PageHeader from "./PageHeader";
import { format, parse } from "date-fns";
import { getDateRange, groupAppointmentsByWeek, isCurrentWeek, statusColors } from "@/utils/dateUtils";
import CompactDateFilter from "./CompactDateFilter";
import ConfirmationDialog from "./ConfirmationDialog";
import { FilterOption } from "@/types/filter";
import AppointmentDetails from "./AppointmentDetails";
import DoctorAppointmentBottomSheet from "./DoctorAppointmentDetails";
import { Doctor } from "@/types/doctorNew";
import NewFiltersPanel from "./NewFilterPanel";
import { useHospitalAppointmentsApi, useUpdateHospitalAppointmentStatus } from "@/hooks/useNewAppointmentsApi";
import { useHospitalPatients } from "@/hooks/useNewPatientApi";
import { useHospitalDoctors } from "@/hooks/useNewDoctorApi";
import { ROLE } from "@/constants";

const dateFilterOptions: FilterOption[] = [
  { id: "today", label: "Today", shortLabel: "Today", color: "bg-blue-500", textColor: "text-blue-500" },
  { id: "f_week", label: "This Week", shortLabel: "Week", color: "bg-purple-500", textColor: "text-purple-500" },
  { id: "f_month", label: "This Month", shortLabel: "Month", color: "bg-pink-500", textColor: "text-pink-500" },
  { id: "f_3months", label: "Next 3 Months", shortLabel: "Nxt_3M", color: "bg-orange-500", textColor: "text-orange-500" },
  { id: "f_6months", label: "Next 6 Months", shortLabel: "6M", color: "bg-green-500", textColor: "text-green-500" }
];

interface AppointmentsPageProps {
  userRole: string | undefined;
  canEdit: boolean;
  hospitalId: string;
  userId?: string;
  isMobile?: boolean;
}

export default function AppointmentsPage({ 
  userRole, 
  canEdit,
  hospitalId,
  userId,
  isMobile
}: AppointmentsPageProps) {
  const router = useRouter();

  const ADD_APPOINTMENT_PATH = isMobile ? `/mobile/hospital/${hospitalId}/appointments/add` : `/hospital/${hospitalId}/appointments/add`;
  
  // State for date filtering
  const [dateFilter, setDateFilter] = useState("today");
  const [currentFilter, setCurrentFilter] = useState("Today");
  const [showDateFilters, setShowDateFilters] = useState(false);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [doctorFilter, setDoctorFilter] = useState("all");
  const [patientFilter, setPatientFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Modal and selection states
  const [selectedApp, setSelectedApp] = useState<AppointmentWithDetails | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: "cancel" | "no-show"; appointment: AppointmentWithDetails } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [updateAppointmentsMode, setUpdateAppointmentsMode] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [sessionNotes, setSessionNotes] = useState("");

  // Batch update states
  const [selectedDoctorForAppointments, setSelectedDoctorForAppointments] = useState<Doctor | null>(null);
  const [selectedAppointmentsToUpdate, setSelectedAppointmentsToUpdate] = useState<AppointmentWithDetails[]>([]);
  const [futureAppointments, setFutureAppointments] = useState<{ [key: string]: AppointmentWithDetails[] }>({});
  const [modalPatient, setModalPatient] = useState<any>(null);
  const [expandedWeeks, setExpandedWeeks] = useState<{ [key: string]: boolean }>({});

  // Get date range based on current filter
  const { start: startDate, end: endDate } = getDateRange(dateFilter);
  
  // Create URLSearchParams for the API call
  const params = useMemo(() => {
    const searchParams = new URLSearchParams();
    if (startDate) searchParams.append('startDate', startDate);
    if (endDate) searchParams.append('endDate', endDate);
    if (userRole) searchParams.append('userRole', userRole);
    if(userRole == ROLE.DOCTOR && userId) searchParams.append('doctorId', userId);
    return searchParams;
  }, [startDate, endDate]);

  // TanStack Query hooks
   const {
    appointments,
    isLoading: appointmentsLoading,
    refetchAppointments
  } = useHospitalAppointmentsApi(
    hospitalId, // hospitalId (optional - will use URL params if not provided)
    userRole, // userRole (optional, defaults to 'admin'),
    false,
    params,
  );

  const updateStatusMutation = useUpdateHospitalAppointmentStatus();
  const { data: patientsData = { patients: []}, isLoading: patientsLoading, } = useHospitalPatients(hospitalId, undefined, true);
  const { data: doctorsData = { doctors : []}, isLoading: doctorsLoading } = useHospitalDoctors(hospitalId, undefined, true);

  // Process future appointments when appointments change
  useEffect(() => {
    if (appointments.length > 0) {
      const futureMap: { [key: string]: AppointmentWithDetails[] } = {};
      const now = new Date();
      
      appointments.forEach((appt) => {
        const appointmentDate = new Date(appt.date);
        if (appointmentDate >= now) {
          if (!futureMap[appt.patientId]) futureMap[appt.patientId] = [];
          futureMap[appt.patientId].push(appt);
        }
      });
      
      setFutureAppointments(futureMap);
    }
  }, [appointments]);


  // Filter appointments with useMemo (client-side filtering on already fetched data)
  const filteredAppointments = useMemo(() => {
    if (!appointments || appointments.length === 0) return [];

    let results = [...appointments];
    const search = searchTerm.trim().toLowerCase();

    if (search) {
      results = results.filter((appt) => {
        const patient = patientsData.patients.find(p => p.id === appt.patientId);
        const doctor = doctorsData.doctors.find(d => d.id === appt.doctorProfileId);
        
        const patientName = patient?.name?.toLowerCase() || appt.patientName?.toLowerCase() || "";
        const doctorName = doctor?.name?.toLowerCase() || appt.doctorName?.toLowerCase() || "";
        const status = appt.status?.toLowerCase() || "";
        const dateTime = new Date(appt.date).toLocaleString().toLowerCase();

        return (
          patientName.includes(search) ||
          doctorName.includes(search) ||
          status.includes(search) ||
          dateTime.includes(search)
        );
      });
    }

    if (statusFilter !== "all") {
      results = results.filter((appt) => appt.status === statusFilter);
    }

    if (doctorFilter !== "all") {
      results = results.filter((appt) => appt.doctorProfileId === doctorFilter);
    }

    if (patientFilter !== "all") {
      results = results.filter((appt) => appt.patientId === patientFilter);
    }

    return results;
  }, [appointments, searchTerm, statusFilter, doctorFilter, patientFilter, patientsData.patients, doctorsData.doctors]);

  const groupedAppointments = useMemo(() => 
    groupAppointmentsByWeek(filteredAppointments),
    [filteredAppointments]
  );

  const handleUpdateAppointmentStatus = useCallback(async (
    appointmentId: string, 
    status: 'scheduled' | 'completed' | 'cancelled' | 'no-show', 
    notes: string = ""
  ) => {
    try {
      await updateStatusMutation.mutateAsync({
        appointmentId,
        status,
        sessionNotes: notes,
        appointmentData: selectedApp || undefined
      });
      
      let message = "";
      switch(status) {
        case "completed":
          message = "✅ Appointment marked as completed";
          break;
        case "cancelled":
          message = "🗑️ Appointment cancelled successfully";
          break;
        case "no-show":
          message = "⏰ Appointment marked as no-show";
          break;
        default:
          message = "📝 Appointment status updated";
      }
      
      showToast(message);
      
      if (status === "completed" && notes) {
        setShowNotesModal(false);
        setSessionNotes("");
      }
      
      setConfirmAction(null);
      setSelectedApp(null);
      
      // Refetch appointments to get updated data
      await refetchAppointments();
    } catch (error) {
      console.error("Error updating appointment:", error);
      showToast("❌ Failed to update appointment status");
    }
  }, [updateStatusMutation, selectedApp, refetchAppointments]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, []);

  // const clearFilters = useCallback(() => {
  //   setSearchTerm("");
  //   setStatusFilter("all");
  //   setDoctorFilter("all");
  //   setPatientFilter("all");
  // }, []);

  // const hasActiveFilters = useMemo(() => 
  //   searchTerm ||
  //   statusFilter !== "all" ||
  //   doctorFilter !== "all" ||
  //   patientFilter !== "all",
  //   [searchTerm, statusFilter, doctorFilter, patientFilter]
  // );

  const openModalForPatient = useCallback((patientId: string, appointment: AppointmentWithDetails) => {
    const patient = patientsData.patients.find((p) => p.id === patientId);
    setModalPatient(patient);
    setSelectedAppointmentsToUpdate(appointment ? [appointment] : []);
    setSelectedDoctorForAppointments(null);
    setUpdateAppointmentsMode(true);
    setSelectedApp(appointment || null);
  }, [patientsData.patients]);

  // const handleConfirmAction = useCallback((type: "cancel" | "no-show", appointment: AppointmentWithDetails) => {
  //   if (!canEdit) return;
  //   setConfirmAction({ type, appointment });
  // }, [canEdit]);

  const executeAction = useCallback(async () => {
    if (!confirmAction) return;

    const { type, appointment } = confirmAction;
    if (type === "cancel") {
      await handleUpdateAppointmentStatus(appointment.id, "cancelled");
    } else if (type === "no-show") {
      await handleUpdateAppointmentStatus(appointment.id, "no-show");
    }
  }, [confirmAction, handleUpdateAppointmentStatus]);

  const toggleWeekExpansion = useCallback((weekKey: string) => {
    setExpandedWeeks(prev => ({
      ...prev,
      [weekKey]: !prev[weekKey]
    }));
  }, []);

  const updateSelectedAppointments = useCallback(async () => {
    setUpdateAppointmentsMode(false);
    showToast("✅ Appointments updated successfully");
    
    // Refetch appointments after update
    await refetchAppointments();
  }, [refetchAppointments]);

  const updateAllFutureAppointments = useCallback(async () => {
    const allFutureIds = futureAppointments[modalPatient?.id]?.map(a => a.id) || [];
    console.log("Updating all future appointments:", allFutureIds, "with doctor:", selectedDoctorForAppointments);
    setUpdateAppointmentsMode(false);
    showToast("✅ All future appointments updated");
    
    // Refetch appointments after update
    await refetchAppointments();
  }, [futureAppointments, modalPatient, selectedDoctorForAppointments, refetchAppointments]);

  const getInitials = useCallback((name: string) => {
    return name
      ? name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase()
      : "U";
  }, []);

  // const handleEditAppointment = useCallback((appointment: AppointmentWithDetails) => {
  //   if (!canEdit) return;
  //   router.push(`/admin/appointments/edit/${appointment.id}`);
  // }, [canEdit, router]);

  const handleDateFilterChange = useCallback((val: string) => {
    setDateFilter(val);
    setCurrentFilter(dateFilterOptions.find((o) => o.id === val)?.label || "Today");
    // The useNewAppointments hook will automatically refetch when params change
  }, []);

  const handleViewChange = useCallback((view: 'list' | 'calendar') => {
    if (view === 'calendar') {
      router.push(`/hospital/${hospitalId}/appointments/calendar`);
    }
    // If 'list', we're already on the list view, so do nothing
  }, [router, hospitalId]);

  // Combined loading state
  const isDataLoading = appointmentsLoading || patientsLoading || doctorsLoading;

  if (isDataLoading && appointments.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:px-6 lg:px-8 pb-20 relative">
      {/* Header */}
      <PageHeader
        title="Bookings"
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
        viewMode="list"
        onViewChange={handleViewChange}
        isMobile={isMobile}
      />

      {/* Date Filter */}
      <CompactDateFilter
        currentFilter={currentFilter}
        showDateFilters={showDateFilters}
        setShowDateFilters={setShowDateFilters}
        dateFilter={dateFilter}
        setDateFilter={handleDateFilterChange}
        dateFilterOptions={dateFilterOptions}
        setCurrentPage={() => {}}
      />

      {/* Filters Panel */}
      {showFilters && (
        <NewFiltersPanel
          title="appointments"
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          doctors={doctorsData.doctors}
          doctorFilter={doctorFilter}
          setDoctorFilter={setDoctorFilter}
          patients={patientsData.patients}
          patientFilter={patientFilter}
          setPatientFilter={setPatientFilter}
          onClose={() => setShowFilters(false)}
          filterType=""
          filters={{
            statusFilter: false,
            doctorFilter: true && userRole !== ROLE.DOCTOR,
            frequencyFilter: false,
            genderFilter: false,
            patientFilter: true,
            dateFilter: false,
          }}
          frequencyFilter=""
          setFrequencyFilter={() => {}}
          genderFilter=""
          setGenderFilter={() => {}}
          dateFilter=""
          setDateFilter={() => {}}
          onClear={() => {}}
        />
      )}

      {/* Weekly Grouped List */}
      {Object.keys(groupedAppointments).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 px-4">
          {/* Animated Icon Container */}
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-green-500 rounded-full blur-2xl opacity-20 animate-pulse"></div>
            <div className="relative w-24 h-24 bg-gradient-to-br from-emerald-50 to-green-50 rounded-3xl flex items-center justify-center shadow-lg border-4 border-white">
              <CalendarDays className="w-12 h-12 text-emerald-600" />
            </div>
          </div>

          {/* Title and Description */}
          <h3 className="text-xl font-bold text-gray-900 mb-2 text-center">
            No Appointments Found
          </h3>
          <p className="text-sm text-gray-500 text-center max-w-xs mb-8 leading-relaxed">
            {searchTerm || statusFilter !== "all" || doctorFilter !== "all" || patientFilter !== "all"
              ? "Try adjusting your filters or select a different date range" 
              : "Your appointment schedule is empty. New appointments will appear here."}
          </p>

          {/* Decorative Elements */}
          <div className="grid grid-cols-3 gap-3 w-full max-w-sm">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-4 text-center border border-blue-200">
              <div className="w-10 h-10 bg-blue-500 rounded-xl mx-auto mb-2 flex items-center justify-center">
                <CalendarDays className="w-5 h-5 text-white" />
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
          <div className="mt-8 bg-gradient-to-r from-emerald-50 to-green-50 rounded-2xl p-4 border border-emerald-200 w-full max-w-sm">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-white text-lg">💡</span>
              </div>
              <div>
                <p className="text-xs font-semibold text-emerald-900 mb-1">Quick Tip</p>
                <p className="text-xs text-emerald-700 leading-relaxed">
                  Appointments will automatically appear here once they are scheduled by patients or added by the admin.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(groupedAppointments).map(([week, weekAppointments]) => {
            const isExpanded = expandedWeeks[week] === true;
            const weekStartDate = new Date(week.split(" - ")[0] + " " + new Date().getFullYear());
            const currentWeek = isCurrentWeek(weekStartDate);

            return (
              <div key={week} className="rounded-xl border border-gray-200 overflow-hidden bg-white shadow-sm">
                {/* Week Header */}
                <div 
                  className="flex justify-between items-center p-4 cursor-pointer"
                  onClick={() => toggleWeekExpansion(week)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-10 rounded-full ${currentWeek ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                    <div>
                      <h3 className="font-bold text-gray-800">{week}</h3>
                      <p className="text-sm text-gray-500">
                        {weekAppointments.length} appointment{weekAppointments.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {currentWeek && (
                      <span className="bg-blue-100 text-blue-700 text-xs font-medium px-2.5 py-1 rounded-full">
                        This Week
                      </span>
                    )}
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-gray-500" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-500" />
                    )}
                  </div>
                </div>
                
                {/* Week Appointments */}
                {isExpanded && (
                  <div className="border-t border-gray-100 divide-y divide-gray-100">
                    {weekAppointments.map((appt) => {

                      // const patient = patientsData.patients && patientsData.patients.length > 0 && patientsData.patients.find((p) => p.id === appt.patientId);
                      // const doctor = doctorsData.doctors.find((d) => d.id === appt.doctorId);
                      const appointmentDate = new Date(appt.date);
                      const parsedTime = parse(appt.time, "HH:mm", new Date()); 
                      const formattedTime = format(parsedTime, "h:mm a");

                      return (
                        <div
                          key={appt.id}
                          className="p-4 cursor-pointer transition-colors hover:bg-gray-50"
                          onClick={() => openModalForPatient(appt.patientId, appt)}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0">
                              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-lg font-bold text-blue-600">
                                  {getInitials(appt.patientName)}
                                </div>
                            </div>

                            <div className="flex-grow">
                              <div className="flex justify-between">
                                <p className="font-semibold text-gray-800">{appt.patientName}</p>
                                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[appt.status] || "bg-gray-100 text-gray-800"}`}>
                                  {appt.status}
                                </span>
                              </div>
                              <p className="text-gray-600 text-sm mt-1">Dr. {appt.doctorName}</p>
                              <div className="flex items-center gap-2 text-sm text-gray-500 mt-2">
                                <CalendarDays className="w-4 h-4" />
                                <span>{format(appointmentDate, "EEE, MMM d")}</span>
                                <span className="mx-1">•</span>
                                <span>{formattedTime}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {/* {!isDataLoading && filteredAppointments.length === 0 && (
        <NoDataFound
          searchQuery={searchTerm}
          hasFilters={hasActiveFilters}
          onClearFilters={clearFilters}
        />
      )} */}

      {/* Floating Add Button */}
      {canEdit && (
        <button
          onClick={() => router.push(ADD_APPOINTMENT_PATH)}
          className="fixed bottom-20 right-6 w-14 h-14 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-2xl hover:bg-blue-700 transition-all transform hover:scale-110 z-10"
          aria-label="Add new appointment1"
        >
          <Plus size={24} />
        </button>
      )}

      {/* Appointment Details Modal - Conditional based on role */}
      {updateAppointmentsMode && selectedApp && (
        userRole === "doctor" ? (
          <DoctorAppointmentBottomSheet
            appointment={selectedApp}
            onClose={() => {
              setUpdateAppointmentsMode(false);
              setSelectedApp(null);
            }}
            onRefetch={refetchAppointments}
          />
        ) : (
          <AppointmentDetails
            hospitalId={hospitalId}
            userRole={userRole}
            updateAppointmentsMode={updateAppointmentsMode}
            setUpdateAppointmentsMode={setUpdateAppointmentsMode}
            selectedPatient={modalPatient}
            doctors={doctorsData.doctors || []}
            futureAppointments={futureAppointments}
            selectedAppointmentsToUpdate={selectedAppointmentsToUpdate}
            setSelectedAppointmentsToUpdate={setSelectedAppointmentsToUpdate}
            selectedDoctorForAppointments={selectedDoctorForAppointments}
            setSelectedDoctorForAppointments={setSelectedDoctorForAppointments}
            updateSelectedAppointments={updateSelectedAppointments}
            updateAllFutureAppointments={updateAllFutureAppointments}
            selectedApp={selectedApp}
          />
        )
      )}

      {/* Session Notes Modal */}
      {showNotesModal && selectedApp && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Session Notes for {selectedApp.patientName}
            </h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Session Notes *
              </label>
              <textarea
                value={sessionNotes}
                onChange={(e) => setSessionNotes(e.target.value)}
                placeholder="Enter details about the session, treatment provided, observations, etc."
                rows={4}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                required
              />
            </div>
            
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowNotesModal(false);
                  setSessionNotes("");
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleUpdateAppointmentStatus(selectedApp.id, "completed", sessionNotes)}
                disabled={!sessionNotes.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save Notes & Complete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmAction && (
        <ConfirmationDialog
          isOpen={true}
          onClose={() => setConfirmAction(null)}
          onConfirm={executeAction}
          title={confirmAction.type === "cancel" ? "Cancel Appointment" : "Mark as No Show"}
          message={
            confirmAction.type === "cancel" 
              ? "Are you sure you want to cancel this appointment? This action cannot be undone."
              : "Are you sure you want to mark this appointment as no-show? This will indicate the patient did not arrive."
          }
          confirmText={confirmAction.type === "cancel" ? "Yes, Cancel" : "Yes, Mark as No Show"}
          confirmColor={confirmAction.type === "cancel" ? "red" : "gray"}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg animate-fadeIn z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
