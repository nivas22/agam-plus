// components/AttendancePage.tsx
'use client';

import { useState, useCallback, useMemo } from "react";
import { FilterOption } from "@/types/filter";
import { format, parse } from "date-fns";
import { 
  Calendar, 
  CheckCircle, 
  XCircle, 
  Clock,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Stethoscope,
  X,
  CalendarDays,
} from "lucide-react";
import PageHeader from "./PageHeader";
import { getDateRange } from "@/utils/dateUtils";
import { useHospitalAppointmentsApi } from "@/hooks/useNewAppointmentsApi";
import { ROLE } from "@agam-plus/shared";

const dateFilterOptions: FilterOption[] = [
  { id: "today", label: "Today", shortLabel: "Today", color: "bg-blue-500", textColor: "text-blue-500" },
  { id: "week", label: "Past Week", shortLabel: "Week", color: "bg-purple-500", textColor: "text-purple-500" },
  { id: "month", label: "Past Month", shortLabel: "Month", color: "bg-pink-500", textColor: "text-pink-500" },
  { id: "3months", label: "Past 3 Months", shortLabel: "3M", color: "bg-orange-500", textColor: "text-orange-500" },
  { id: "6months", label: "Past 6 Months", shortLabel: "6M", color: "bg-green-500", textColor: "text-green-500" }
];
interface AttendancePageProps {
  canEdit?: boolean;
  userRole?: any;
  doctors: any[];
  patients: any[];
  hospitalId: string;
  userId?: string;
  isMobile?: boolean;
}

export default function AttendancePage({ canEdit = false, userRole, doctors, patients, hospitalId, userId, isMobile }: AttendancePageProps) {
  const [dateFilter, setDateFilter] = useState("today");
  const [statusFilter, setStatusFilter] = useState("all");
  const [patientFilter, setPatientFilter] = useState("all");
  const [doctorFilter, setDoctorFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showDateFilters, setShowDateFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const appointmentsPerPage = 10;

  console.log("userRole", userRole, canEdit);

  // Get current filter label
  const currentFilter = dateFilterOptions.find(opt => opt.id === dateFilter)?.label || "Today";

  // Fetch appointments when date filter changes
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
  // useEffect(() => {
  //   const { start, end } = getDateRange(dateFilter);
  //   fetchAppointments(start, end).catch(console.error);
  // }, [dateFilter, fetchAppointments]);

  // Filter appointments based on selected filters
  const filteredAppointments = appointments.filter(appt => {
    const matchesStatus = statusFilter === "all" || appt.status === statusFilter;
    const matchesPatient = patientFilter === "all" || appt.patientId === patientFilter;
    const matchesDoctor = doctorFilter === "all" || appt.doctorProfileId === doctorFilter;
    
    // Search term filter
    const patient = patients.find(p => p.id === appt.patientId);
    const matchesSearch = !searchTerm || 
      (patient && patient.name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    return matchesStatus && matchesPatient && matchesDoctor && matchesSearch;
  });

  // Pagination
  const indexOfLastAppointment = currentPage * appointmentsPerPage;
  const indexOfFirstAppointment = indexOfLastAppointment - appointmentsPerPage;
  const currentAppointments = filteredAppointments.slice(indexOfFirstAppointment, indexOfLastAppointment);
  const totalPages = Math.ceil(filteredAppointments.length / appointmentsPerPage);

  // Get status badge class
  const getStatusClass = useCallback((status: string) => {
    switch (status) {
      case "completed": return "bg-status-open-soft text-status-open";
      case "cancelled": return "bg-status-danger-soft text-status-danger";
      case "no-show": return "bg-status-warning-soft text-status-warning";
      default: return "bg-brand-violet-soft text-brand-violet";
    }
  }, []);

  // Get status icon
  const getStatusIcon = useCallback((status: string) => {
    switch (status) {
      case "completed": return <CheckCircle className="w-4 h-4" />;
      case "cancelled": return <XCircle className="w-4 h-4" />;
      case "no-show": return <XCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  }, []);

  // Format date for display
  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  }, []);

  // Format time for display from HH:mm format
  const formatTime = useCallback((timeString: string) => {
    if (!timeString) return '';
    try {
      const parsedTime = parse(timeString, "HH:mm", new Date(2000, 0, 1));
      return format(parsedTime, "h:mm a");
    } catch (error) {
      return timeString; // Return original if parsing fails
    }
  }, []);

  const clearFilters = useCallback(() => {
    setStatusFilter("all");
    setPatientFilter("all");
    setDoctorFilter("all");
    setSearchTerm("");
  }, []);

  if (appointmentsLoading && appointments.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-violet"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:px-6 lg:px-8 pb-20 relative">
      <PageHeader
        title="Attendance"
        type="attendance"
        search={searchTerm}
        setSearch={setSearchTerm}
        dataLength={filteredAppointments.length}
        showFilters={showFilters}
        setShowFilters={setShowFilters}
        icon={Calendar}
        filter={statusFilter}
        setFilter={setStatusFilter}
        refreshData={refetchAppointments}
        isMobile={isMobile}
      />
      {/* Search and Filter Toggle */}
        {/* <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search patients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
            />
          </div>
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2.5 rounded-xl border flex items-center shadow-sm ${
              showFilters ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-gray-300 text-gray-600'
            }`}
          >
            <Filter className="w-4 h-4" />
          </button>
        </div> */}

        {showFilters && (
          <div className="bg-surface-paper p-4 rounded-xl shadow-md border border-border mb-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-medium text-ink-700">Filters</h3>
              <div className="flex gap-2">
                <button
                  onClick={clearFilters}
                  className="text-sm text-brand-violet hover:text-brand-violet-hover font-medium"
                >
                  Clear All
                </button>
                <button
                  onClick={() => setShowFilters(false)}
                  className="text-ink-500 hover:text-ink-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full p-2.5 border border-border rounded-lg focus:ring-2 focus:ring-brand-violet focus:border-brand-violet shadow-sm"
                >
                  <option value="all">All Statuses</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="no-show">No Show</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1">Patient</label>
                <select
                  value={patientFilter}
                  onChange={(e) => setPatientFilter(e.target.value)}
                  className="w-full p-2.5 border border-border rounded-lg focus:ring-2 focus:ring-brand-violet focus:border-brand-violet shadow-sm"
                >
                  <option value="all">All Patients</option>
                  {patients.map(patient => (
                    <option key={patient.id} value={patient.id}>
                      {patient.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1">Doctor</label>
                <select
                  value={doctorFilter}
                  onChange={(e) => setDoctorFilter(e.target.value)}
                  className="w-full p-2.5 border border-border rounded-lg focus:ring-2 focus:ring-brand-violet focus:border-brand-violet shadow-sm"
                >
                  <option value="all">All Doctors</option>
                  {doctors.map(doctor => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Compact Date Filter */}
        <div className="bg-surface-paper p-2 rounded-xl shadow-md border border-border mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-ink-500" />
              <span className="text-sm font-medium text-ink-700">Date Range:</span>
              <span className="text-sm font-semibold text-brand-violet">{currentFilter}</span>
            </div>

            <button
              onClick={() => setShowDateFilters(!showDateFilters)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-canvas hover:bg-border transition-colors text-sm font-medium"
            >
              <span>Change</span>
              {showDateFilters ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Collapsible Date Options */}
          {showDateFilters && (
            <div className="mt-3 pt-2 border-t border-border">
              <div className="flex flex-wrap gap-2">
                {dateFilterOptions.map((range) => (
                  <button
                    key={range.id}
                    onClick={() => {
                      setDateFilter(range.id);
                      setCurrentPage(1);
                      setShowDateFilters(false);
                    }}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      dateFilter === range.id
                        ? `${range.color} text-white shadow-md`
                        : `bg-surface-paper text-ink-700 border border-border hover:${range.textColor} hover:border-current`
                    }`}
                  >
                    {range.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Stats Summary - Attractive Badge Style */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          {/* Completed Badge */}
          <div className="flex items-center gap-2 px-3 py-2 bg-status-open rounded-xl shadow-md hover:shadow-lg transition-all hover:scale-105">
            <CheckCircle className="w-4 h-4 text-white flex-shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-lg font-bold text-white leading-none">
                {filteredAppointments.filter(a => a.status === "completed").length}
              </span>
              <span className="text-[10px] font-medium text-white/80 mt-0.5 truncate">Done</span>
            </div>
          </div>
          
          {/* Cancelled Badge */}
          <div className="flex items-center gap-2 px-3 py-2 bg-status-danger rounded-xl shadow-md hover:shadow-lg transition-all hover:scale-105">
            <XCircle className="w-4 h-4 text-white flex-shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-lg font-bold text-white leading-none">
                {filteredAppointments.filter(a => a.status === "cancelled").length}
              </span>
              <span className="text-[10px] font-medium text-white/80 mt-0.5 truncate">Cancel</span>
            </div>
          </div>
          
          {/* No Show Badge */}
          <div className="flex items-center gap-2 px-3 py-2 bg-status-warning rounded-xl shadow-md hover:shadow-lg transition-all hover:scale-105">
            <Clock className="w-4 h-4 text-white flex-shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-lg font-bold text-white leading-none">
                {filteredAppointments.filter(a => a.status === "no-show").length}
              </span>
              <span className="text-[10px] font-medium text-white/80 mt-0.5 truncate">No Show</span>
            </div>
          </div>
        </div>

        {/* Appointment List */}
        <div className={`rounded-xl overflow-hidden mb-4`}>
          {currentAppointments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              {/* Animated Icon Container */}
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-status-open rounded-full blur-2xl opacity-20 animate-pulse"></div>
                <div className="relative w-24 h-24 bg-status-open-soft rounded-3xl flex items-center justify-center shadow-lg border-4 border-surface-paper">
                  <Calendar className="w-12 h-12 text-status-open" />
                </div>
              </div>

              {/* Title and Description */}
              <h3 className="text-xl font-bold text-ink-900 mb-2 text-center">
                No Attendance Records
              </h3>
              <p className="text-sm text-ink-500 text-center max-w-xs mb-8 leading-relaxed">
                Try adjusting your filters or select a different date range to view attendance records.
              </p>

              {/* Decorative Elements */}
              <div className="grid grid-cols-3 gap-3 w-full max-w-sm">
                <div className="bg-brand-violet-soft rounded-2xl p-4 text-center border border-brand-violet/20">
                  <div className="w-10 h-10 bg-brand-violet rounded-xl mx-auto mb-2 flex items-center justify-center">
                    <CalendarDays className="w-5 h-5 text-white" />
                  </div>
                  <p className="text-xs font-semibold text-brand-violet">Track</p>
                </div>
                <div className="bg-status-open-soft rounded-2xl p-4 text-center border border-status-open/20">
                  <div className="w-10 h-10 bg-status-open rounded-xl mx-auto mb-2 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-white" />
                  </div>
                  <p className="text-xs font-semibold text-status-open">Present</p>
                </div>
                <div className="bg-status-danger-soft rounded-2xl p-4 text-center border border-status-danger/20">
                  <div className="w-10 h-10 bg-status-danger rounded-xl mx-auto mb-2 flex items-center justify-center">
                    <XCircle className="w-5 h-5 text-white" />
                  </div>
                  <p className="text-xs font-semibold text-status-danger">Absent</p>
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
                      Attendance records are automatically tracked when appointments are marked as completed or cancelled.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {currentAppointments.map(appointment => {

                return (
                  <div key={appointment.id} className="p-4 hover:bg-surface-canvas transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-brand-violet-soft flex items-center justify-center text-brand-violet font-bold flex-shrink-0">
                          {appointment.patientName ? appointment.patientName.charAt(0).toUpperCase() : "P"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-ink-900 truncate">
                            {appointment.patientName || "Unknown Patient"}
                          </h3>
                          <p className="text-sm text-ink-700 flex items-center gap-1 truncate">
                            <Stethoscope className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">Dr. {appointment?.doctorName || "Not Assigned"}</span>
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-xs text-ink-500">
                              {formatDate(appointment.date)}
                            </p>
                            <span className="text-border">•</span>
                            <p className="text-xs text-ink-500">
                              {formatTime(appointment.time)}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <div className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getStatusClass(appointment.status)}`}>
                          {getStatusIcon(appointment.status)}
                          <span className="hidden sm:inline">
                            {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center bg-surface-paper p-3 rounded-xl shadow-sm border border-border">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg border border-border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-canvas"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="text-sm text-ink-700">
              Page {currentPage} of {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg border border-border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-canvas"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
    </div>
  );
}
