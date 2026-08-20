// components/UpdateAppointmentsBottomSheet.tsx
'use client';

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { 
  X, 
  Calendar, 
  Clock, 
  Stethoscope, 
  User, 
  RotateCcw, 
  CheckCircle, 
  Ban, 
  CalendarPlus,
  FileText,
  Undo,
  Loader2
} from "lucide-react";
import { parse, format } from "date-fns";
import { AppointmentWithDetails } from "@/types/appointment";
import { Patient } from "@/types/patientNew";
import { Doctor } from "@/types/doctorNew";
import { useUpdateHospitalAppointmentStatus } from "@/hooks/useNewAppointmentsApi";
import { useDoctorSlots, useNextAvailableSlots } from "@/hooks/useDoctorSlots";


interface AppointmentDetailsProps {
  hospitalId: string | "";
  userRole?: string;
  updateAppointmentsMode: boolean;
  setUpdateAppointmentsMode: (mode: boolean) => void;
  selectedPatient: Patient | null;
  doctors: Doctor[];
  futureAppointments: { [key: string]: AppointmentWithDetails[] };
  selectedAppointmentsToUpdate: AppointmentWithDetails[];
  setSelectedAppointmentsToUpdate: (appointments: AppointmentWithDetails[]) => void;
  selectedDoctorForAppointments: Doctor | null;
  setSelectedDoctorForAppointments: (doctor: Doctor | null) => void;
  selectedApp: AppointmentWithDetails | null;
  updateSelectedAppointments: () => void;
  updateAllFutureAppointments: () => void;
  userId?: string;
}

type ActiveAction = "changeDoctor" | "cancel" | "reschedule" | "reopen" | "viewNotes";

interface ActionConfig {
  title: string;
  icon: any;
  description: string;
  action: () => Promise<void>;
  buttonText: string;
  enabled: boolean;
  availableStatuses: string[];
}

export default function AppointmentDetails({
  hospitalId,
  updateAppointmentsMode,
  setUpdateAppointmentsMode,
  selectedPatient,
  doctors,
  futureAppointments,
  selectedAppointmentsToUpdate,
  setSelectedAppointmentsToUpdate,
  selectedDoctorForAppointments,
  setSelectedDoctorForAppointments,
  selectedApp,
}: AppointmentDetailsProps) {
  const updateStatusMutation = useUpdateHospitalAppointmentStatus(hospitalId);
  const [updateScope, setUpdateScope] = useState<"selected" | "all">("selected");
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [activeAction, setActiveAction] = useState<ActiveAction>("changeDoctor");
  const [sessionNotes, setSessionNotes] = useState("");
  const [availableActions, setAvailableActions] = useState<ActiveAction[]>([]);

  // Wrapper function for updating appointment status
  const updateAppointmentStatus = async (
    appointmentId: string,
    status: string,
    sessionNotes?: string,
    appointmentData?: Partial<AppointmentWithDetails>
  ) => {
    await updateStatusMutation.mutateAsync({
      appointmentId,
      status,
      sessionNotes,
      appointmentData,
    });
  };

  // Use the new hooks for slots and next available
  const {
    data: slotsData,
    isLoading: slotsLoading,
    isError: slotsError,
    error: slotsErrorData,
  } = useDoctorSlots(hospitalId, selectedApp?.doctorProfileId, rescheduleDate);

  const {
    data: nextAvailableData,
    isLoading: nextAvailableLoading,
  } = useNextAvailableSlots(hospitalId,
    selectedApp?.doctorProfileId, 
    rescheduleDate, 
    selectedApp?.time
  );

  useEffect(() => {
    if (selectedApp) {
      const actions: ActiveAction[] = [];
      
      switch (selectedApp.status) {
        case "scheduled":
          actions.push("changeDoctor", "cancel", "reschedule");
          break;
        case "completed":
          actions.push("changeDoctor", "reopen", "viewNotes");
          break;
        case "cancelled":
          actions.push("reopen", "reschedule");
          break;
        case "no-show":
          actions.push("reopen", "reschedule");
          break;
        default:
          actions.push("changeDoctor", "cancel", "reschedule");
      }
      
      setAvailableActions(actions);
      
      // Set default action based on status
      if (selectedApp.status === "completed") {
        setActiveAction("viewNotes");
      } else if (selectedApp.status === "cancelled" || selectedApp.status === "no-show") {
        setActiveAction("reopen");
      } else {
        setActiveAction("changeDoctor");
      }
      
      // Pre-fill session notes for completed appointments
      if (selectedApp.status === "completed" && selectedApp.sessionNotes) {
        setSessionNotes(selectedApp.sessionNotes);
      }

      // Set initial reschedule date to current appointment date
      if (selectedApp.date) {
        setRescheduleDate(selectedApp.date);
      }
    }
  }, [selectedApp]);

  if (!updateAppointmentsMode || !selectedPatient || !selectedApp) {
    return null;
  }

  const getInitials = (name: string) => {
    return name
      ? name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase()
      : "D";
  };

  // Get appointments for the selected patient
  const patientAppointments = futureAppointments[selectedPatient.id] || [];

  // Get the selected appointment details
  const selectedAppointment = selectedApp;
  const updatedDoctors = doctors.filter((d) => d.id !== selectedApp.doctorProfileId);

  // Update the selected appointment only
  const updateSelectedAppointment = async () => {
    if (!selectedDoctorForAppointments) {
      toast.error("Please select a doctor");
      return;
    }

    try {
      await updateAppointmentStatus(selectedApp.id, selectedApp.status, "", {
        ...selectedApp,
        doctorProfileId: selectedDoctorForAppointments.id,
        doctorName: selectedDoctorForAppointments.name,
      });
      
      toast.success("Appointment doctor updated!");
      setUpdateAppointmentsMode(false);
      setSelectedAppointmentsToUpdate([]);
    } catch (err) {
      console.error(err);
      toast.error("Failed to update appointment");
    }
  };

  // Update all future appointments
  const updateAllFutureAppointments = async () => {
    if (!selectedDoctorForAppointments) {
      toast.error("Please select a doctor");
      return;
    }

    try {
      const appointments = futureAppointments[selectedPatient.id] || [];
      const updatePromises = appointments.map(appt => 
        updateAppointmentStatus(appt.id, appt.status, undefined, {
          ...selectedApp,
          doctorProfileId: selectedDoctorForAppointments.id,
          doctorName: selectedDoctorForAppointments.name,
        })
      );
      
      await Promise.all(updatePromises);
      toast.success("All future appointments updated!");
      setUpdateAppointmentsMode(false);
      setSelectedAppointmentsToUpdate([]);
    } catch (err) {
      console.error(err);
      toast.error("Failed to update all future appointments");
    }
  };

  // Cancel the selected appointment
  const cancelAppointment = async () => {
    try {
      await updateAppointmentStatus(selectedApp.id, "cancelled");
      toast.success("Appointment cancelled!");
      setUpdateAppointmentsMode(false);
      setSelectedAppointmentsToUpdate([]);
    } catch (err) {
      console.error(err);
      toast.error("Failed to cancel appointment");
    }
  };

  // Reschedule the appointment
  const rescheduleAppointment = async () => {
    if (!rescheduleDate || !rescheduleTime) {
      toast.error("Please select both date and time");
      return;
    }

    try {
      await updateAppointmentStatus(selectedApp.id, "scheduled", undefined, {
        ...selectedApp,
        rescheduleDate,
        rescheduleTime,
        rescheduledAt: new Date().toISOString(),
      });
      
      toast.success("Appointment rescheduled!");
      setUpdateAppointmentsMode(false);
      setSelectedAppointmentsToUpdate([]);
      setRescheduleDate("");
      setRescheduleTime("");
    } catch (err) {
      console.error(err);
      toast.error("Failed to reschedule appointment");
    }
  };

  // Reopen appointment (change status back to scheduled)
  const reopenAppointment = async () => {
    try {
      await updateAppointmentStatus(selectedApp.id, "scheduled", undefined, {
        ...selectedApp,
        reopenedAt: new Date().toISOString(),
      });
      
      toast.success("Appointment reopened!");
      setUpdateAppointmentsMode(false);
      setSelectedAppointmentsToUpdate([]);
    } catch (err) {
      console.error(err);
      toast.error("Failed to reopen appointment");
    }
  };

  // Update session notes for completed appointment
  const updateSessionNotes = async () => {
    try {
      await updateAppointmentStatus(selectedApp.id, "completed", sessionNotes);
      toast.success("Session notes updated!");
      setUpdateAppointmentsMode(false);
      setSelectedAppointmentsToUpdate([]);
    } catch (err) {
      console.error(err);
      toast.error("Failed to update session notes");
    }
  };

  // Action buttons configuration
  const actionConfig: Record<ActiveAction, ActionConfig> = {
    changeDoctor: {
      title: "Change Doctor",
      icon: <Stethoscope className="w-5 h-5 text-brand-violet" />,
      description: "Assign a different doctor to this appointment",
      action: updateScope === "selected" ? updateSelectedAppointment : updateAllFutureAppointments,
      buttonText: updateScope === "selected" ? "Update Doctor" : "Update All Appointments",
      enabled: !!selectedDoctorForAppointments && (updateScope === "all" || selectedAppointmentsToUpdate.length > 0),
      availableStatuses: ["scheduled", "completed"]
    },
    cancel: {
      title: "Cancel Appointment",
      icon: <Ban className="w-5 h-5 text-status-danger" />,
      description: "Cancel this appointment",
      action: cancelAppointment,
      buttonText: "Cancel Appointment",
      enabled: selectedAppointmentsToUpdate.length > 0,
      availableStatuses: ["scheduled"]
    },
    reschedule: {
      title: "Reschedule Appointment",
      icon: <CalendarPlus className="w-5 h-5 text-status-open" />,
      description: "Change the date and time of this appointment",
      action: rescheduleAppointment,
      buttonText: "Reschedule",
      enabled: selectedAppointmentsToUpdate.length > 0 && !!rescheduleDate && !!rescheduleTime,
      availableStatuses: ["scheduled", "cancelled", "no-show"]
    },
    reopen: {
      title: "Reopen Appointment",
      icon: <RotateCcw className="w-5 h-5 text-status-warning" />,
      description: "Reopen this appointment and change status back to scheduled",
      action: reopenAppointment,
      buttonText: "Reopen Appointment",
      enabled: selectedAppointmentsToUpdate.length > 0,
      availableStatuses: ["completed", "cancelled", "no-show"]
    },
    viewNotes: {
      title: "Session Notes",
      icon: <FileText className="w-5 h-5 text-brand-violet" />,
      description: "View and edit session notes for this completed appointment",
      action: updateSessionNotes,
      buttonText: "Update Notes",
      enabled: sessionNotes.trim().length > 0,
      availableStatuses: ["completed"]
    }
  };

  const timeDisplay = (time: string) => {
    try {
      const parsedTime = parse(time, "HH:mm", new Date()); 
      return format(parsedTime, "h:mm a");
    } catch {
      return time;
    }
  };

  const currentAction = actionConfig[activeAction];

  // Get status badge class
  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-status-open-soft text-status-open border-status-open/20";
      case "cancelled":
        return "bg-status-danger-soft text-status-danger border-status-danger/20";
      case "no-show":
        return "bg-surface-canvas text-ink-900 border-border";
      case "scheduled":
        return "bg-brand-violet-soft text-brand-violet border-brand-violet/20";
      default:
        return "bg-surface-canvas text-ink-900 border-border";
    }
  };

  // Get available slots from the hook
  const availableSlots = slotsData?.availableSlots || [];
  const nextAvailableSlot = nextAvailableData?.nextAvailableSlot;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-30 z-50 flex items-end justify-center sm:p-4"
      onClick={() => setUpdateAppointmentsMode(false)}
    >
      <div 
        className="bg-surface-paper rounded-t-2xl rounded-b-none sm:rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-violet-soft rounded-lg">
              {currentAction?.icon || <Stethoscope className="w-5 h-5 text-brand-violet" />}
            </div>
            <div>
              <h3 className="text-lg font-bold text-ink-900">
                {currentAction?.title || "Appointment Details"}
              </h3>
              <p className="text-sm text-ink-500">
                For {selectedPatient?.name || "Patient"}
              </p>
            </div>
          </div>
          <button
            onClick={() => setUpdateAppointmentsMode(false)}
            className="p-2 rounded-lg hover:bg-surface-canvas text-ink-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Status Badge */}
          <div className="mb-4">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getStatusBadgeClass(selectedApp.status)}`}>
              {selectedApp.status?.toUpperCase() || "UNKNOWN"}
            </span>
          </div>

          {/* Action Selection */}
          {availableActions.length > 1 && (
            <div className="flex gap-2 mb-6 bg-surface-canvas p-1 rounded-lg">
              {availableActions.map((action) => (
                <button
                  key={action}
                  onClick={() => setActiveAction(action)}
                  className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-1 ${
                    activeAction === action
                      ? "bg-surface-paper text-brand-violet shadow-sm"
                      : "text-ink-500 hover:text-ink-700"
                  }`}
                >
                  <span className="text-xs">{actionConfig[action]?.icon}</span>
                  <span className="hidden sm:inline">{actionConfig[action]?.title.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          )}

          {currentAction && (
            <>
              <p className="text-sm text-ink-700 mb-4">{currentAction.description}</p>

              {/* Selected Appointment Preview */}
              <div className="mb-6 p-4 bg-brand-violet-soft rounded-xl border border-brand-violet/20">
                <h4 className="font-medium text-brand-violet mb-2 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Appointment Details
                </h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        {new Date(selectedAppointment.date).toLocaleDateString([], {
                          weekday: 'long',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </p>
                      <p className="text-sm text-brand-violet">
                        {timeDisplay(selectedAppointment.time)}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-ink-500">
                    Doctor: {selectedAppointment.doctorName || "Not assigned"}
                  </p>
                  {selectedAppointment.status === "completed" && selectedAppointment.sessionNotes && (
                    <div className="mt-2 p-2 bg-surface-paper rounded-lg">
                      <p className="text-xs font-medium text-ink-700">Session Notes:</p>
                      <p className="text-xs text-ink-700 mt-1">{selectedAppointment.sessionNotes}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Doctor Selection (only for changeDoctor action) */}
              {activeAction === "changeDoctor" && (
                <>
                  <div className="mb-6">
                    <div className="flex items-center gap-2 text-sm font-medium text-ink-700 mb-3">
                      <Stethoscope className="w-4 h-4" />
                      Select a new doctor
                    </div>
                    
                    {/* Doctor Selection - Optimized for Mobile */}
                    <div className="space-y-3">
                      {/* Mobile: Horizontal scroll */}
                      <div className="block sm:hidden">
                        <div className="flex space-x-3 pb-4 overflow-x-auto scrollbar-hide -mx-1 px-1">
                          {updatedDoctors.map((doctor) => {
                            const firstName = doctor.name?.split(" ")[0] || doctor.name || "Doctor";
                            const isSelected = selectedDoctorForAppointments?.id === doctor.id;
                            
                            return (
                              <div
                                key={doctor.id}
                                onClick={() => setSelectedDoctorForAppointments(doctor)}
                                className={`flex-shrink-0 w-28 p-3 rounded-xl border transition-all cursor-pointer ${
                                  isSelected
                                    ? "bg-brand-violet-soft border-brand-violet shadow-sm ring-2 ring-brand-violet/20"
                                    : "border-border hover:border-border hover:bg-surface-canvas"
                                }`}
                              >
                                <div className="flex flex-col items-center text-center">
                                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold mb-2 ${
                                    isSelected ? "bg-brand-violet text-white" : "bg-brand-violet-soft text-brand-violet"
                                  }`}>
                                    {getInitials(firstName)}
                                  </div>
                                  <p className="text-xs font-medium text-ink-900 truncate w-full">
                                    Dr. {doctor.name}
                                  </p>
                                  {isSelected && (
                                    <CheckCircle className="w-3 h-3 text-brand-violet mt-1" />
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      
                      {/* Desktop: Grid layout */}
                      <div className="hidden sm:grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                        {updatedDoctors.map((doctor) => {
                          const firstName = doctor.name?.split(" ")[0] || doctor.name || "Doctor";
                          const isSelected = selectedDoctorForAppointments?.id === doctor.id;
                          
                          return (
                            <div
                              key={doctor.id}
                              onClick={() => setSelectedDoctorForAppointments(doctor)}
                              className={`flex flex-col items-center p-3 rounded-xl border transition-all cursor-pointer ${
                                isSelected
                                  ? "bg-brand-violet-soft border-brand-violet shadow-sm ring-2 ring-brand-violet/20"
                                  : "border-border hover:border-border hover:bg-surface-canvas"
                              }`}
                            >
                              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold mb-2 ${
                                isSelected ? "bg-brand-violet text-white" : "bg-brand-violet-soft text-brand-violet"
                              }`}>
                                {getInitials(firstName)}
                              </div>
                              <p className="text-sm font-medium text-ink-900 text-center truncate w-full">
                                Dr. {firstName}
                              </p>
                              {doctor.specialization && (
                                <p className="text-xs text-ink-500 text-center mt-1 truncate w-full">
                                  {doctor.specialization}
                                </p>
                              )}
                              {isSelected && (
                                <CheckCircle className="w-4 h-4 text-brand-violet mt-2" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    
                    {/* No doctors available state */}
                    {updatedDoctors.length === 0 && (
                      <div className="text-center py-8 bg-surface-canvas rounded-xl border border-border">
                        <Stethoscope className="w-8 h-8 text-ink-500 mx-auto mb-2" />
                        <p className="text-sm text-ink-700">No other doctors available</p>
                      </div>
                    )}
                    
                    {/* Selected doctor info */}
                    {selectedDoctorForAppointments && (
                      <div className="mt-4 p-3 bg-brand-violet-soft rounded-lg border border-brand-violet/20">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-brand-violet flex items-center justify-center text-white text-xs font-bold">
                            {getInitials(selectedDoctorForAppointments.name)}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-brand-violet">
                              Dr. {selectedDoctorForAppointments.name}
                            </p>
                            {selectedDoctorForAppointments.specialization && (
                              <p className="text-xs text-brand-violet">
                                {selectedDoctorForAppointments.specialization}
                              </p>
                            )}
                          </div>
                          <CheckCircle className="w-5 h-5 text-brand-violet" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Update Scope Selection (only for changeDoctor action) */}
                  {selectedApp.status === "scheduled" && (
                    <div className="mb-6">
                      <div className="flex items-center gap-2 text-sm font-medium text-ink-700 mb-3">
                        <User className="w-4 h-4" />
                        Update scope
                      </div>
                      
                      {/* Mobile: Stacked layout */}
                      <div className="block sm:hidden space-y-3">
                        <div
                          onClick={() => setUpdateScope("selected")}
                          className={`p-4 rounded-xl border cursor-pointer transition-colors ${
                            updateScope === "selected"
                              ? "bg-brand-violet-soft border-brand-violet ring-2 ring-brand-violet/20"
                              : "border-border hover:bg-surface-canvas"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                              updateScope === "selected" 
                                ? "bg-brand-violet border-brand-violet" 
                                : "border-border"
                            }`}>
                              {updateScope === "selected" && (
                                <CheckCircle className="w-3 h-3 text-white" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="font-medium text-sm block">This appointment only</span>
                              <p className="text-xs text-ink-500 mt-1">
                                Change doctor for just this appointment
                              </p>
                            </div>
                          </div>
                        </div>

                        <div
                          onClick={() => setUpdateScope("all")}
                          className={`p-4 rounded-xl border cursor-pointer transition-colors ${
                            updateScope === "all"
                              ? "bg-brand-violet-soft border-brand-violet ring-2 ring-brand-violet/20"
                              : "border-border hover:bg-surface-canvas"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                              updateScope === "all" 
                                ? "bg-brand-violet border-brand-violet" 
                                : "border-border"
                            }`}>
                              {updateScope === "all" && (
                                <CheckCircle className="w-3 h-3 text-white" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="font-medium text-sm block">All future appointments</span>
                              <p className="text-xs text-ink-500 mt-1">
                                Change doctor for all future appointments
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Desktop: Grid layout */}
                      <div className="hidden sm:grid grid-cols-2 gap-3">
                        <div
                          onClick={() => setUpdateScope("selected")}
                          className={`p-4 rounded-xl border cursor-pointer transition-colors ${
                            updateScope === "selected"
                              ? "bg-brand-violet-soft border-brand-violet ring-2 ring-brand-violet/20"
                              : "border-border hover:bg-surface-canvas"
                          }`}
                        >
                          <div className="flex items-center gap-3 mb-2">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                              updateScope === "selected" 
                                ? "bg-brand-violet border-brand-violet" 
                                : "border-border"
                            }`}>
                              {updateScope === "selected" && (
                                <CheckCircle className="w-3 h-3 text-white" />
                              )}
                            </div>
                            <span className="font-medium text-sm">This appointment only</span>
                          </div>
                          <p className="text-xs text-ink-500 ml-8">
                            Change doctor for just this appointment
                          </p>
                        </div>

                        <div
                          onClick={() => setUpdateScope("all")}
                          className={`p-4 rounded-xl border cursor-pointer transition-colors ${
                            updateScope === "all"
                              ? "bg-brand-violet-soft border-brand-violet ring-2 ring-brand-violet/20"
                              : "border-border hover:bg-surface-canvas"
                          }`}
                        >
                          <div className="flex items-center gap-3 mb-2">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                              updateScope === "all" 
                                ? "bg-brand-violet border-brand-violet" 
                                : "border-border"
                            }`}>
                              {updateScope === "all" && (
                                <CheckCircle className="w-3 h-3 text-white" />
                              )}
                            </div>
                            <span className="font-medium text-sm">All future appointments</span>
                          </div>
                          <p className="text-xs text-ink-500 ml-8">
                            Change doctor for all future appointments
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Future Appointments List (for reference) */}
                  {updateScope === "all" && selectedApp.status === "scheduled" && (
                    <div className="mb-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-ink-700 mb-3">
                        <Calendar className="w-4 h-4" />
                        Future appointments that will be updated ({patientAppointments.length})
                      </div>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {patientAppointments.map((appt) => (
                          <div
                            key={appt.id}
                            className="flex items-center gap-3 p-3 rounded-lg border border-border bg-surface-paper"
                          >
                            <Clock className="w-4 h-4 text-ink-500 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                <span className="text-sm font-medium text-ink-900">
                                  {timeDisplay(appt.time)}
                                </span>
                                <span className="text-xs text-ink-500">
                                  {new Date(appt.date).toLocaleDateString([], {
                                    weekday: "short",
                                    month: "short",
                                    day: "numeric",
                                  })}
                                </span>
                              </div>
                              {appt.doctorName && (
                                <p className="text-xs text-ink-500 mt-1">
                                  With: {appt.doctorName}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Reschedule Form (only for reschedule action) */}
              {activeAction === "reschedule" && (
                <div className="mb-6 p-4 bg-status-open-soft rounded-xl border border-status-open/20">
                  <h4 className="font-medium text-status-open mb-3 flex items-center gap-2">
                    <CalendarPlus className="w-4 h-4" />
                    Select new date and time
                  </h4>
                  
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-ink-700 mb-1">
                        Date
                      </label>
                      <input
                        type="date"
                        value={rescheduleDate}
                        onChange={(e) => setRescheduleDate(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full p-2 border border-border rounded-lg focus:ring-2 focus:ring-status-open focus:border-status-open"
                      />
                    </div>
                    
                    {rescheduleDate && (
                      <div>
                        <label className="block text-sm font-medium text-ink-700 mb-1">
                          Available Time Slots
                        </label>
                        {slotsLoading ? (
                          <div className="p-4 text-center text-ink-500 flex items-center justify-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Loading available slots...
                          </div>
                        ) : slotsError ? (
                          <div className="p-3 bg-status-danger-soft rounded-lg text-status-danger text-sm">
                            Error loading slots: {slotsErrorData?.message}
                          </div>
                        ) : availableSlots.length > 0 ? (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {availableSlots.map((slot) => (
                              <button
                                key={slot}
                                type="button"
                                onClick={() => setRescheduleTime(slot)}
                                className={`p-2 text-sm rounded-lg border transition-all ${
                                  rescheduleTime === slot
                                    ? "bg-status-open text-white border-status-open-hover shadow-sm"
                                    : "bg-surface-paper text-ink-700 border-border hover:bg-surface-canvas"
                                }`}
                              >
                                {timeDisplay(slot)}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="p-3 bg-surface-canvas rounded-lg text-ink-500 text-sm">
                            <p>No available slots for this date.</p>
                            {nextAvailableSlot && !nextAvailableLoading && (
                              <p className="mt-2 text-status-open font-medium">
                                Next available: {new Date(nextAvailableSlot.date).toLocaleDateString()} at {timeDisplay(nextAvailableSlot.time)}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {rescheduleDate && rescheduleTime && (
                    <div className="mt-4 p-3 bg-surface-paper rounded-lg border border-status-open/20">
                      <p className="text-sm font-medium text-status-open">
                        New appointment time:
                      </p>
                      <p className="text-sm">
                        {new Date(`${rescheduleDate}T${rescheduleTime}`).toLocaleString([], {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Session Notes Editor (only for viewNotes action) */}
              {activeAction === "viewNotes" && (
                <div className="mb-6 p-4 bg-brand-violet-soft rounded-xl border border-brand-violet/20">
                  <h4 className="font-medium text-brand-violet mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Session Notes
                  </h4>
                  
                  <textarea
                    value={sessionNotes}
                    onChange={(e) => setSessionNotes(e.target.value)}
                    placeholder="Enter session notes here..."
                    rows={4}
                    className="w-full p-3 border border-border rounded-lg focus:ring-2 focus:ring-brand-violet focus:border-brand-violet resize-none"
                  />
                  
                  <p className="text-xs text-ink-500 mt-2">
                    These notes will be visible to the patient and other healthcare providers.
                  </p>
                </div>
              )}

              {/* Cancel Warning (only for cancel action) */}
              {activeAction === "cancel" && (
                <div className="mb-6 p-4 bg-status-danger-soft rounded-xl border border-status-danger/20">
                  <h4 className="font-medium text-status-danger mb-2 flex items-center gap-2">
                    <Ban className="w-4 h-4" />
                    Confirm Cancellation
                  </h4>
                  <p className="text-sm text-status-danger">
                    Are you sure you want to cancel this appointment? This action cannot be undone.
                  </p>
                </div>
              )}

              {/* Reopen Warning (only for reopen action) */}
              {activeAction === "reopen" && (
                <div className="mb-6 p-4 bg-status-warning-soft rounded-xl border border-status-warning/20">
                  <h4 className="font-medium text-status-warning mb-2 flex items-center gap-2">
                    <Undo className="w-4 h-4" />
                    Confirm Reopening
                  </h4>
                  <p className="text-sm text-status-warning">
                    Are you sure you want to reopen this appointment? The status will be changed back to scheduled.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer with action buttons */}
        <div className="flex justify-between p-4 border-t border-border bg-surface-canvas rounded-b-xl">
          <button
            onClick={() => setUpdateAppointmentsMode(false)}
            className="px-4 py-2 rounded-lg border border-border hover:bg-surface-canvas text-ink-700"
          >
            Cancel
          </button>
          
          {currentAction && (
            <button
              onClick={currentAction.action}
              disabled={!currentAction.enabled}
              className={`px-6 py-2 rounded-lg text-white flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                activeAction === "changeDoctor" 
                  ? "bg-brand-violet hover:bg-brand-violet-hover" 
                  : activeAction === "cancel"
                  ? "bg-status-danger hover:bg-status-danger-hover"
                  : activeAction === "reschedule"
                  ? "bg-brand-violet hover:bg-brand-violet-hover"
                  : activeAction === "reopen"
                  ? "bg-status-warning hover:bg-status-warning-hover"
                  : "bg-brand-violet hover:bg-brand-violet-hover"
              }`}
            >
              <CheckCircle className="w-4 h-4" />
              {currentAction.buttonText}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
