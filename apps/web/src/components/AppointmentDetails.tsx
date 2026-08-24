// components/UpdateAppointmentsBottomSheet.tsx
"use client";

import { format, parse } from "date-fns";
import {
  ArrowLeft,
  Ban,
  Calendar,
  CalendarPlus,
  CheckCircle,
  Clock,
  FileText,
  Loader2,
  Pill,
  RotateCcw,
  Stethoscope,
  Undo,
  User,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { useDoctorSlots, useNextAvailableSlots } from "@/hooks/useDoctorSlots";
import { useUpdateHospitalAppointmentStatus } from "@/hooks/useNewAppointmentsApi";
import { usePaymentForAppointment } from "@/hooks/useNewPaymentApi";
import { usePrescription } from "@/hooks/usePrescriptionApi";
import type { AppointmentWithDetails } from "@/types/appointment";
import type { Doctor } from "@/types/doctorNew";
import type { Patient } from "@/types/patientNew";
import { APPOINTMENT_STATUS, normalizeAppointmentStatus } from "../constants";

function money(v: number): string {
  return `₹${Math.round(v).toLocaleString("en-IN")}`;
}

interface AppointmentDetailsProps {
  hospitalId: string | "";
  userRole?: string;
  updateAppointmentsMode: boolean;
  setUpdateAppointmentsMode: (mode: boolean) => void;
  selectedPatient: Patient | null;
  doctors: Doctor[];
  futureAppointments: { [key: string]: AppointmentWithDetails[] };
  selectedAppointmentsToUpdate: AppointmentWithDetails[];
  setSelectedAppointmentsToUpdate: (
    appointments: AppointmentWithDetails[],
  ) => void;
  selectedDoctorForAppointments: Doctor | null;
  setSelectedDoctorForAppointments: (doctor: Doctor | null) => void;
  selectedApp: AppointmentWithDetails | null;
  updateSelectedAppointments: () => void;
  updateAllFutureAppointments: () => void;
  userId?: string;
}

type ActiveAction =
  | "changeDoctor"
  | "cancel"
  | "noShow"
  | "reschedule"
  | "reopen"
  | "viewNotes";

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
  const { data: prescriptionData } = usePrescription(
    selectedApp?.id || "",
    hospitalId || undefined,
  );
  const prescription = prescriptionData?.prescription;
  const [updateScope, setUpdateScope] = useState<"selected" | "all">(
    "selected",
  );
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [activeAction, setActiveAction] =
    useState<ActiveAction>("changeDoctor");
  const [sessionNotes, setSessionNotes] = useState("");
  const [availableActions, setAvailableActions] = useState<ActiveAction[]>([]);

  // Wrapper function for updating appointment status
  const updateAppointmentStatus = async (
    appointmentId: string,
    status: string,
    sessionNotes?: string,
    appointmentData?: Partial<AppointmentWithDetails>,
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

  const { data: nextAvailableData, isLoading: nextAvailableLoading } =
    useNextAvailableSlots(
      hospitalId,
      selectedApp?.doctorProfileId,
      rescheduleDate,
      selectedApp?.time,
    );

  const { data: visitPayment, isLoading: visitPaymentLoading } =
    usePaymentForAppointment(
      hospitalId || undefined,
      selectedApp &&
        normalizeAppointmentStatus(selectedApp.status) ===
          APPOINTMENT_STATUS.COMPLETED
        ? selectedApp.id
        : undefined,
    );

  useEffect(() => {
    if (selectedApp) {
      const actions: ActiveAction[] = [];
      const normalizedStatus = normalizeAppointmentStatus(selectedApp.status);

      // Check-in / start waiting / start consultation / complete are one-click
      // "advance" actions on the appointments list row itself — this modal only
      // covers the secondary actions (reassign, cancel, reschedule, reopen).
      switch (normalizedStatus) {
        case APPOINTMENT_STATUS.PENDING:
          actions.push("cancel");
          break;
        case APPOINTMENT_STATUS.CONFIRMED:
          actions.push("changeDoctor", "cancel", "noShow", "reschedule");
          break;
        case APPOINTMENT_STATUS.CHECKED_IN:
        case APPOINTMENT_STATUS.WAITING:
        case APPOINTMENT_STATUS.IN_CONSULTATION:
          actions.push("cancel");
          break;
        case APPOINTMENT_STATUS.COMPLETED:
          actions.push("reopen", "viewNotes");
          break;
        case APPOINTMENT_STATUS.CANCELLED:
        case APPOINTMENT_STATUS.NO_SHOW:
          actions.push("reopen");
          break;
        case APPOINTMENT_STATUS.RESCHEDULED:
          actions.push("reschedule", "cancel");
          break;
        default:
          actions.push("changeDoctor", "cancel", "reschedule");
      }

      setAvailableActions(actions);

      // Set default action based on status
      if (normalizedStatus === APPOINTMENT_STATUS.COMPLETED) {
        setActiveAction("viewNotes");
      } else if (
        normalizedStatus === APPOINTMENT_STATUS.CANCELLED ||
        normalizedStatus === APPOINTMENT_STATUS.NO_SHOW ||
        normalizedStatus === APPOINTMENT_STATUS.RESCHEDULED
      ) {
        setActiveAction(
          normalizedStatus === APPOINTMENT_STATUS.RESCHEDULED
            ? "reschedule"
            : "reopen",
        );
      } else if (normalizedStatus === APPOINTMENT_STATUS.CONFIRMED) {
        setActiveAction("changeDoctor");
      } else {
        setActiveAction("cancel");
      }

      // Pre-fill session notes for completed appointments
      if (
        normalizedStatus === APPOINTMENT_STATUS.COMPLETED &&
        selectedApp.sessionNotes
      ) {
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
  const updatedDoctors = doctors.filter(
    (d) => d.id !== selectedApp.doctorProfileId,
  );

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
      const updatePromises = appointments.map((appt) =>
        updateAppointmentStatus(appt.id, appt.status, undefined, {
          ...selectedApp,
          doctorProfileId: selectedDoctorForAppointments.id,
          doctorName: selectedDoctorForAppointments.name,
        }),
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
      await updateAppointmentStatus(
        selectedApp.id,
        APPOINTMENT_STATUS.CANCELLED,
      );
      toast.success("Appointment cancelled!");
      setUpdateAppointmentsMode(false);
      setSelectedAppointmentsToUpdate([]);
    } catch (err) {
      console.error(err);
      toast.error("Failed to cancel appointment");
    }
  };

  // Mark the selected appointment as a no-show
  const markNoShow = async () => {
    try {
      await updateAppointmentStatus(selectedApp.id, APPOINTMENT_STATUS.NO_SHOW);
      toast.success("Appointment marked as no-show!");
      setUpdateAppointmentsMode(false);
      setSelectedAppointmentsToUpdate([]);
    } catch (err) {
      console.error(err);
      toast.error("Failed to update appointment");
    }
  };

  // Reschedule the appointment
  const rescheduleAppointment = async () => {
    if (!rescheduleDate || !rescheduleTime) {
      toast.error("Please select both date and time");
      return;
    }

    try {
      // Only send the fields that actually changed — spreading the whole
      // `selectedApp` here re-sends its unchanged doctorProfileId, which makes
      // the backend treat this as a doctor reassignment and 404 on a stale
      // hospitalId check ("Doctor not found in this hospital").
      await updateAppointmentStatus(
        selectedApp.id,
        APPOINTMENT_STATUS.CONFIRMED,
        undefined,
        {
          rescheduleDate,
          rescheduleTime,
          rescheduledAt: new Date().toISOString(),
        },
      );

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

  // Reopen appointment (change status back to confirmed)
  const reopenAppointment = async () => {
    try {
      // Don't spread `selectedApp` — its unchanged doctorProfileId would make
      // the backend treat this as a doctor reassignment and 404 on a stale
      // hospitalId check ("Doctor not found in this hospital").
      await updateAppointmentStatus(
        selectedApp.id,
        APPOINTMENT_STATUS.CONFIRMED,
        undefined,
        {
          reopenedAt: new Date().toISOString(),
        },
      );

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
      await updateAppointmentStatus(
        selectedApp.id,
        APPOINTMENT_STATUS.COMPLETED,
        sessionNotes,
      );
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
      action:
        updateScope === "selected"
          ? updateSelectedAppointment
          : updateAllFutureAppointments,
      buttonText:
        updateScope === "selected"
          ? "Update Doctor"
          : "Update All Appointments",
      enabled:
        !!selectedDoctorForAppointments &&
        (updateScope === "all" || selectedAppointmentsToUpdate.length > 0),
      availableStatuses: [APPOINTMENT_STATUS.CONFIRMED],
    },
    cancel: {
      title: "Cancel Appointment",
      icon: <Ban className="w-5 h-5 text-status-danger" />,
      description: "Cancel this appointment",
      action: cancelAppointment,
      buttonText: "Cancel Appointment",
      enabled: selectedAppointmentsToUpdate.length > 0,
      availableStatuses: [
        APPOINTMENT_STATUS.PENDING,
        APPOINTMENT_STATUS.CONFIRMED,
        APPOINTMENT_STATUS.CHECKED_IN,
        APPOINTMENT_STATUS.WAITING,
        APPOINTMENT_STATUS.IN_CONSULTATION,
        APPOINTMENT_STATUS.RESCHEDULED,
      ],
    },
    noShow: {
      title: "Mark No-show",
      icon: <Ban className="w-5 h-5 text-status-danger" />,
      description: "The patient did not arrive for this appointment",
      action: markNoShow,
      buttonText: "Mark No-show",
      enabled: selectedAppointmentsToUpdate.length > 0,
      availableStatuses: [APPOINTMENT_STATUS.CONFIRMED],
    },
    reschedule: {
      title: "Reschedule Appointment",
      icon: <CalendarPlus className="w-5 h-5 text-status-open" />,
      description: "Change the date and time of this appointment",
      action: rescheduleAppointment,
      buttonText: "Reschedule",
      enabled:
        selectedAppointmentsToUpdate.length > 0 &&
        !!rescheduleDate &&
        !!rescheduleTime,
      availableStatuses: [
        APPOINTMENT_STATUS.CONFIRMED,
        APPOINTMENT_STATUS.CANCELLED,
        APPOINTMENT_STATUS.NO_SHOW,
        APPOINTMENT_STATUS.RESCHEDULED,
      ],
    },
    reopen: {
      title: "Reopen Appointment",
      icon: <RotateCcw className="w-5 h-5 text-status-warning" />,
      description:
        "Reopen this appointment and change status back to confirmed",
      action: reopenAppointment,
      buttonText: "Reopen Appointment",
      enabled: selectedAppointmentsToUpdate.length > 0,
      availableStatuses: [
        APPOINTMENT_STATUS.COMPLETED,
        APPOINTMENT_STATUS.CANCELLED,
        APPOINTMENT_STATUS.NO_SHOW,
      ],
    },
    viewNotes: {
      title: "Visit Record",
      icon: <FileText className="w-5 h-5 text-brand-violet" />,
      description: "Session notes and details for this completed visit",
      action: updateSessionNotes,
      buttonText: "Update Notes",
      enabled: sessionNotes.trim().length > 0,
      availableStatuses: [APPOINTMENT_STATUS.COMPLETED],
    },
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
  const isCompletedFlow =
    normalizeAppointmentStatus(selectedApp.status) ===
    APPOINTMENT_STATUS.COMPLETED;
  const completedAtDisplay = (() => {
    if (!selectedApp.completedAt) return null;
    try {
      return format(new Date(selectedApp.completedAt), "d MMM yyyy, h:mm a");
    } catch {
      return null;
    }
  })();

  // "What happened" only shows events we actually have a timestamp for —
  // check-in and consultation-start aren't tracked as separate fields today,
  // so this is a partial timeline, not the full lifecycle.
  const whatHappened = (() => {
    const safeDate = (iso?: string) => {
      if (!iso) return null;
      const d = new Date(iso);
      return Number.isNaN(d.getTime()) ? null : d;
    };
    const events: { at: Date; label: string; detail?: string }[] = [];
    const createdAt = safeDate(selectedApp.createdAt);
    if (createdAt) events.push({ at: createdAt, label: "Booked" });
    const reopenedAt = safeDate(selectedApp.reopenedAt);
    if (reopenedAt) events.push({ at: reopenedAt, label: "Reopened" });
    const completedAt = safeDate(selectedApp.completedAt);
    if (completedAt) events.push({ at: completedAt, label: "Completed" });
    const paidAt = safeDate(visitPayment?.settledAt || visitPayment?.createdAt);
    if (paidAt && visitPayment) {
      events.push({
        at: paidAt,
        label: visitPayment.status === "due" ? "Billed" : "Paid",
        detail: [
          money(visitPayment.total),
          visitPayment.method,
          visitPayment.collectedBy ? `by ${visitPayment.collectedBy}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
      });
    }
    return events.sort((a, b) => a.at.getTime() - b.at.getTime());
  })();

  const visitDateTimeLabel = (() => {
    try {
      return `${format(new Date(selectedApp.date), "EEE d MMM yyyy")}, ${timeDisplay(selectedApp.time)}`;
    } catch {
      return `${selectedApp.date} ${selectedApp.time}`;
    }
  })();

  const visitSubtitleParts = [
    visitDateTimeLabel,
    selectedApp.doctorName ? `Dr. ${selectedApp.doctorName}` : null,
    selectedApp.doctorSpecialization || null,
    selectedPatient?.patientId ? `UHID ${selectedPatient.patientId}` : null,
  ].filter(Boolean);

  // Get status badge class
  const getStatusBadgeClass = (status: string) => {
    switch (normalizeAppointmentStatus(status)) {
      case APPOINTMENT_STATUS.COMPLETED:
        return "bg-status-open-soft text-status-open border-status-open/20";
      case APPOINTMENT_STATUS.CANCELLED:
        return "bg-status-danger-soft text-status-danger border-status-danger/20";
      case APPOINTMENT_STATUS.NO_SHOW:
        return "bg-surface-canvas text-ink-900 border-border";
      case APPOINTMENT_STATUS.PENDING:
      case APPOINTMENT_STATUS.RESCHEDULED:
        return "bg-status-warning-soft text-status-warning border-status-warning/20";
      case APPOINTMENT_STATUS.CHECKED_IN:
      case APPOINTMENT_STATUS.WAITING:
        return "bg-brand-violet-soft text-brand-violet border-brand-violet/20";
      case APPOINTMENT_STATUS.IN_CONSULTATION:
        return "bg-brand-violet text-white border-brand-violet";
      case APPOINTMENT_STATUS.CONFIRMED:
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
      className="fixed inset-0 bg-black bg-opacity-30 z-50 flex items-center justify-center p-4"
      onClick={() => setUpdateAppointmentsMode(false)}
    >
      <div
        className="bg-surface-paper rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — same layout for every tab: avatar + title + rich subtitle on the
            left, status badge + close on the right, all on one row. */}
        <div className="flex justify-between items-start gap-3 p-4 border-b border-border">
          <div className="flex items-start gap-3 min-w-0">
            <span className="w-9 h-9 rounded-lg bg-brand-violet text-white font-bold text-sm flex items-center justify-center shrink-0">
              {getInitials(selectedPatient?.name || "Patient")}
            </span>
            <div className="min-w-0">
              <h3 className="font-display tracking-tight text-base font-bold text-ink-900 truncate">
                {activeAction === "viewNotes"
                  ? "Visit record"
                  : currentAction?.title || "Appointment"}
                {" — "}
                {selectedPatient?.name || "Patient"}
              </h3>
              <p className="text-xs text-ink-500 mt-0.5 truncate">
                {visitSubtitleParts.join(" · ")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-semibold whitespace-nowrap ${getStatusBadgeClass(selectedApp.status)}`}
            >
              {isCompletedFlow && <CheckCircle className="w-3 h-3" />}
              {selectedApp.status?.toUpperCase() || "UNKNOWN"}
              {isCompletedFlow && completedAtDisplay
                ? ` ${format(new Date(selectedApp.completedAt as string), "h:mm a")}`
                : ""}
            </span>
            <button
              onClick={() => setUpdateAppointmentsMode(false)}
              className="p-2 rounded-lg hover:bg-surface-canvas text-ink-500"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Back to visit record (only when a completed appointment has drilled into
              change-doctor / reopen off the visit record footer buttons) */}
          {isCompletedFlow && activeAction !== "viewNotes" && (
            <button
              type="button"
              onClick={() => setActiveAction("viewNotes")}
              className="mb-4 text-sm font-medium text-brand-violet hover:text-brand-violet-hover flex items-center gap-1"
            >
              <ArrowLeft className="w-4 h-4" /> Back to visit record
            </button>
          )}

          {/* Action Selection */}
          {availableActions.length > 1 && !isCompletedFlow && (
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
                  <span className="hidden sm:inline">
                    {actionConfig[action]?.title.split(" ")[0]}
                  </span>
                </button>
              ))}
            </div>
          )}

          {currentAction && (
            <>
              {activeAction !== "viewNotes" && (
                <>
                  <p className="text-sm text-ink-700 mb-4">
                    {currentAction.description}
                  </p>

                  {/* Selected Appointment Preview */}
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-ink-900 mb-2 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-brand-violet" />
                      Appointment Details
                    </h4>
                    <div className="p-4 bg-brand-violet-soft rounded-xl border border-brand-violet/20 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-mono tabular text-sm font-medium">
                            {new Date(
                              selectedAppointment.date,
                            ).toLocaleDateString([], {
                              weekday: "long",
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </p>
                          <p className="font-mono tabular text-sm text-brand-violet">
                            {timeDisplay(selectedAppointment.time)}
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-ink-500">
                        Doctor:{" "}
                        {selectedAppointment.doctorName || "Not assigned"}
                      </p>
                      {selectedAppointment.status === "completed" &&
                        selectedAppointment.sessionNotes && (
                          <div className="mt-2 p-2 bg-surface-paper rounded-lg">
                            <p className="text-xs font-medium text-ink-700">
                              Session Notes:
                            </p>
                            <p className="text-xs text-ink-700 mt-1">
                              {selectedAppointment.sessionNotes}
                            </p>
                          </div>
                        )}
                    </div>
                  </div>
                </>
              )}

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
                            const firstName =
                              doctor.name?.split(" ")[0] ||
                              doctor.name ||
                              "Doctor";
                            const isSelected =
                              selectedDoctorForAppointments?.id === doctor.id;

                            return (
                              <div
                                key={doctor.id}
                                onClick={() =>
                                  setSelectedDoctorForAppointments(doctor)
                                }
                                className={`flex-shrink-0 w-28 p-3 rounded-xl border transition-all cursor-pointer ${
                                  isSelected
                                    ? "bg-brand-violet-soft border-brand-violet shadow-sm ring-2 ring-brand-violet/20"
                                    : "border-border hover:border-border hover:bg-surface-canvas"
                                }`}
                              >
                                <div className="flex flex-col items-center text-center">
                                  <div
                                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold mb-2 ${
                                      isSelected
                                        ? "bg-brand-violet text-white"
                                        : "bg-brand-violet-soft text-brand-violet"
                                    }`}
                                  >
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
                          const firstName =
                            doctor.name?.split(" ")[0] ||
                            doctor.name ||
                            "Doctor";
                          const isSelected =
                            selectedDoctorForAppointments?.id === doctor.id;

                          return (
                            <div
                              key={doctor.id}
                              onClick={() =>
                                setSelectedDoctorForAppointments(doctor)
                              }
                              className={`flex flex-col items-center p-3 rounded-xl border transition-all cursor-pointer ${
                                isSelected
                                  ? "bg-brand-violet-soft border-brand-violet shadow-sm ring-2 ring-brand-violet/20"
                                  : "border-border hover:border-border hover:bg-surface-canvas"
                              }`}
                            >
                              <div
                                className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold mb-2 ${
                                  isSelected
                                    ? "bg-brand-violet text-white"
                                    : "bg-brand-violet-soft text-brand-violet"
                                }`}
                              >
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
                        <p className="text-sm text-ink-700">
                          No other doctors available
                        </p>
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
                  {normalizeAppointmentStatus(selectedApp.status) ===
                    APPOINTMENT_STATUS.CONFIRMED && (
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
                            <div
                              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                updateScope === "selected"
                                  ? "bg-brand-violet border-brand-violet"
                                  : "border-border"
                              }`}
                            >
                              {updateScope === "selected" && (
                                <CheckCircle className="w-3 h-3 text-white" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="font-medium text-sm block">
                                This appointment only
                              </span>
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
                            <div
                              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                updateScope === "all"
                                  ? "bg-brand-violet border-brand-violet"
                                  : "border-border"
                              }`}
                            >
                              {updateScope === "all" && (
                                <CheckCircle className="w-3 h-3 text-white" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="font-medium text-sm block">
                                All future appointments
                              </span>
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
                            <div
                              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                updateScope === "selected"
                                  ? "bg-brand-violet border-brand-violet"
                                  : "border-border"
                              }`}
                            >
                              {updateScope === "selected" && (
                                <CheckCircle className="w-3 h-3 text-white" />
                              )}
                            </div>
                            <span className="font-medium text-sm">
                              This appointment only
                            </span>
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
                            <div
                              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                updateScope === "all"
                                  ? "bg-brand-violet border-brand-violet"
                                  : "border-border"
                              }`}
                            >
                              {updateScope === "all" && (
                                <CheckCircle className="w-3 h-3 text-white" />
                              )}
                            </div>
                            <span className="font-medium text-sm">
                              All future appointments
                            </span>
                          </div>
                          <p className="text-xs text-ink-500 ml-8">
                            Change doctor for all future appointments
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Future Appointments List (for reference) */}
                  {updateScope === "all" &&
                    normalizeAppointmentStatus(selectedApp.status) ===
                      APPOINTMENT_STATUS.CONFIRMED && (
                      <div className="mb-4">
                        <div className="flex items-center gap-2 text-sm font-medium text-ink-700 mb-3">
                          <Calendar className="w-4 h-4" />
                          Future appointments that will be updated (
                          {patientAppointments.length})
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
                                  <span className="font-mono tabular text-sm font-medium text-ink-900">
                                    {timeDisplay(appt.time)}
                                  </span>
                                  <span className="font-mono tabular text-xs text-ink-500">
                                    {new Date(appt.date).toLocaleDateString(
                                      [],
                                      {
                                        weekday: "short",
                                        month: "short",
                                        day: "numeric",
                                      },
                                    )}
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
                        min={new Date().toISOString().split("T")[0]}
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
                                key={slot.time}
                                type="button"
                                onClick={() => setRescheduleTime(slot.time)}
                                className={`p-2 text-sm rounded-lg border transition-all ${
                                  rescheduleTime === slot.time
                                    ? "bg-status-open text-white border-status-open-hover shadow-sm"
                                    : "bg-surface-paper text-ink-700 border-border hover:bg-surface-canvas"
                                }`}
                              >
                                {timeDisplay(slot.time)}
                                {slot.capacity > 1 && (
                                  <span
                                    className={`block text-[10px] ${rescheduleTime === slot.time ? "text-white/80" : "text-ink-500"}`}
                                  >
                                    {slot.remaining} of {slot.capacity} left
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="p-3 bg-surface-canvas rounded-lg text-ink-500 text-sm">
                            <p>No available slots for this date.</p>
                            {nextAvailableSlot && !nextAvailableLoading && (
                              <p className="mt-2 text-status-open font-medium">
                                Next available:{" "}
                                {new Date(
                                  nextAvailableSlot.date,
                                ).toLocaleDateString()}{" "}
                                at {timeDisplay(nextAvailableSlot.time)}
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
                      <p className="font-mono tabular text-sm">
                        {new Date(
                          `${rescheduleDate}T${rescheduleTime}`,
                        ).toLocaleString([], {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Visit Record (only for viewNotes action, i.e. a completed appointment) —
                  each block's heading sits outside its boxed content, not sharing a border
                  with it, so the section title and the data it labels read as separate. */}
              {activeAction === "viewNotes" && (
                <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <h4 className="text-sm font-semibold text-ink-900 mb-2 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-brand-violet" />
                      Session Notes
                    </h4>

                    <textarea
                      value={sessionNotes}
                      onChange={(e) => setSessionNotes(e.target.value)}
                      placeholder="Enter session notes here..."
                      rows={6}
                      className="w-full p-3 border border-border rounded-xl focus:ring-2 focus:ring-brand-violet focus:border-brand-violet resize-none bg-surface-paper"
                    />

                    <p className="text-xs text-ink-500 mt-2">
                      {selectedApp.doctorName
                        ? `Written by Dr. ${selectedApp.doctorName}`
                        : "Written by the attending doctor"}
                      {completedAtDisplay ? ` · ${completedAtDisplay}` : ""}
                    </p>
                    <p className="text-xs text-ink-500 mt-1">
                      These notes will be visible to the patient and other
                      healthcare providers.
                    </p>
                  </div>

                  <div className="space-y-5">
                    {/* Bill */}
                    <div>
                      <div className="flex items-baseline justify-between gap-2 mb-2">
                        <h4 className="text-sm font-semibold text-ink-900">
                          Bill
                        </h4>
                        {visitPayment?.invoiceNumber && (
                          <span className="text-[11px] font-mono text-ink-500 shrink-0">
                            INV-{visitPayment.invoiceNumber}
                          </span>
                        )}
                      </div>
                      {visitPaymentLoading ? (
                        <p className="text-xs text-ink-500 flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" /> Loading
                          bill…
                        </p>
                      ) : visitPayment ? (
                        <>
                          <div className="border border-border rounded-xl bg-surface-paper divide-y divide-border overflow-hidden">
                            {visitPayment.items.map((item, i) => (
                              <div
                                key={`${item.name}-${i}`}
                                className={`flex items-center justify-between gap-2 px-3 py-2 text-xs ${
                                  item.isPackageCovered
                                    ? "bg-brand-violet-soft/60"
                                    : ""
                                }`}
                              >
                                <span className="truncate text-ink-700">
                                  {item.name}
                                  {item.quantity > 1
                                    ? ` × ${item.quantity}`
                                    : ""}
                                  {item.isPackageCovered && (
                                    <span className="ml-1.5 text-[10px] font-semibold text-brand-violet">
                                      (package)
                                    </span>
                                  )}
                                </span>
                                <span className="font-mono text-ink-900 shrink-0">
                                  {item.isPackageCovered
                                    ? money(0)
                                    : money(item.quantity * item.unitPrice)}
                                </span>
                              </div>
                            ))}
                            <div className="flex items-baseline justify-between px-3 py-2.5 bg-surface-canvas/60">
                              <span className="text-xs font-semibold text-ink-700">
                                {visitPayment.status === "due"
                                  ? "Payable"
                                  : "Paid"}
                              </span>
                              <span className="font-mono font-bold text-lg text-ink-900">
                                {money(visitPayment.total)}
                              </span>
                            </div>
                          </div>
                          <div
                            className={`flex items-center gap-2 mt-2 px-3 py-2 rounded-xl border text-xs ${
                              visitPayment.status === "paid"
                                ? "bg-status-open-soft border-status-open/20 text-status-open"
                                : visitPayment.status === "refunded"
                                  ? "bg-status-danger-soft border-status-danger/20 text-status-danger"
                                  : "bg-status-warning-soft border-status-warning/20 text-status-warning"
                            }`}
                          >
                            <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                            <span className="flex-1">
                              {visitPayment.method.toUpperCase()}
                              {visitPayment.collectedBy
                                ? `, taken by ${visitPayment.collectedBy}`
                                : ""}
                            </span>
                            <span className="font-semibold shrink-0">
                              {visitPayment.status.toUpperCase()}
                            </span>
                          </div>
                        </>
                      ) : (
                        <p className="text-xs text-ink-500">
                          No bill recorded for this visit.
                        </p>
                      )}
                    </div>

                    {/* Prescription */}
                    {hospitalId && selectedApp && (
                      <div>
                        <div className="flex items-baseline justify-between gap-2 mb-2">
                          <h4 className="text-sm font-semibold text-ink-900">
                            Prescription
                          </h4>
                          {prescription && (
                            <span
                              className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                                prescription.status === "signed"
                                  ? "bg-status-open-soft text-status-open"
                                  : "bg-status-warning-soft text-status-warning"
                              }`}
                            >
                              {prescription.status === "signed"
                                ? "Signed"
                                : "Draft"}
                            </span>
                          )}
                        </div>
                        {prescription ? (
                          <div className="flex items-center gap-3 border border-border rounded-xl bg-surface-paper px-3 py-2.5">
                            <span className="w-7 h-7 rounded-lg bg-brand-violet-soft text-brand-violet flex items-center justify-center shrink-0">
                              <Pill className="w-3.5 h-3.5" />
                            </span>
                            <p className="text-xs text-ink-700 flex-1">
                              {prescription.items.length} medicine
                              {prescription.items.length === 1 ? "" : "s"}
                              {prescription.items[0]
                                ? ` · ${prescription.items[0].medicineName}`
                                : ""}
                              {prescription.items.length > 1
                                ? ` +${prescription.items.length - 1} more`
                                : ""}
                            </p>
                            <Link
                              href={`/hospital/${hospitalId}/appointments/${selectedApp.id}/prescription`}
                              className="text-xs font-semibold text-brand-violet shrink-0"
                            >
                              View / Print
                            </Link>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-2 border border-dashed border-border rounded-xl px-3 py-2.5">
                            <p className="text-xs text-ink-500">
                              No prescription written for this visit.
                            </p>
                            <Link
                              href={`/hospital/${hospitalId}/appointments/${selectedApp.id}/prescription`}
                              className="text-xs font-semibold text-brand-violet shrink-0"
                            >
                              Write prescription
                            </Link>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Package */}
                    {selectedApp.packageId && (
                      <div>
                        <h4 className="text-sm font-semibold text-ink-900 mb-2">
                          Package
                        </h4>
                        <div className="flex items-center gap-3 border border-border rounded-xl bg-surface-paper px-3 py-2.5">
                          <span className="w-7 h-7 rounded-lg bg-brand-violet-soft text-brand-violet flex items-center justify-center shrink-0">
                            <Calendar className="w-3.5 h-3.5" />
                          </span>
                          <p className="text-xs text-ink-700">
                            {selectedApp.packageVisitNumber
                              ? `Visit ${selectedApp.packageVisitNumber} of this package`
                              : "Part of a package"}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* What happened */}
                    {whatHappened.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-ink-900 mb-2">
                          What happened
                        </h4>
                        <div className="space-y-2">
                          {whatHappened.map((event, i) => (
                            <div
                              key={`${event.label}-${i}`}
                              className="flex items-start gap-2"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-status-open mt-1.5 shrink-0" />
                              <div className="min-w-0">
                                <p className="text-xs text-ink-900">
                                  <span className="font-medium">
                                    {event.label}
                                  </span>
                                  <span className="font-mono tabular text-ink-500">
                                    {" "}
                                    · {format(event.at, "d MMM, h:mm a")}
                                  </span>
                                </p>
                                {event.detail && (
                                  <p className="text-[11px] text-ink-500">
                                    {event.detail}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Cancel Warning (only for cancel action) — heading sits outside the
                  boxed warning message, matching the visit-record block styling */}
              {activeAction === "cancel" && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-status-danger mb-2 flex items-center gap-2">
                    <Ban className="w-4 h-4" />
                    Confirm Cancellation
                  </h4>
                  <div className="p-4 bg-status-danger-soft rounded-xl border border-status-danger/20">
                    <p className="text-sm text-status-danger">
                      Are you sure you want to cancel this appointment? This
                      action cannot be undone.
                    </p>
                  </div>
                </div>
              )}

              {/* No-show Warning (only for noShow action) */}
              {activeAction === "noShow" && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-status-danger mb-2 flex items-center gap-2">
                    <Ban className="w-4 h-4" />
                    Confirm No-show
                  </h4>
                  <div className="p-4 bg-status-danger-soft rounded-xl border border-status-danger/20">
                    <p className="text-sm text-status-danger">
                      Mark this appointment as a no-show? Use this once it's
                      clear the patient won't be arriving.
                    </p>
                  </div>
                </div>
              )}

              {/* Reopen Warning (only for reopen action) */}
              {activeAction === "reopen" && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-status-warning mb-2 flex items-center gap-2">
                    <Undo className="w-4 h-4" />
                    Confirm Reopening
                  </h4>
                  <div className="p-4 bg-status-warning-soft rounded-xl border border-status-warning/20">
                    <p className="text-sm text-status-warning">
                      Are you sure you want to reopen this appointment? The
                      status will be changed back to scheduled.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer with action buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-t border-border bg-surface-canvas rounded-b-xl">
          {activeAction === "viewNotes" ? (
            <div>
              <button
                type="button"
                onClick={() => setActiveAction("reopen")}
                className="h-9 px-4 rounded-lg border border-status-danger/40 text-status-danger text-sm font-medium hover:bg-status-danger-soft flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" /> Reopen visit
              </button>
              <p className="text-[11px] text-ink-500 mt-1 max-w-[220px]">
                Reopening unlocks the bill and notes — it&apos;s recorded
                against your name.
              </p>
            </div>
          ) : (
            <button
              onClick={() => setUpdateAppointmentsMode(false)}
              className="h-10 px-4 rounded-lg border border-border hover:bg-surface-canvas text-ink-700"
            >
              Cancel
            </button>
          )}

          <div className="flex items-center gap-2 shrink-0">
            {activeAction === "viewNotes" && (
              <button
                type="button"
                onClick={() => setUpdateAppointmentsMode(false)}
                className="h-10 px-4 rounded-lg border border-border hover:bg-surface-paper text-ink-700 text-sm"
              >
                Cancel
              </button>
            )}
            {currentAction && (
              <button
                onClick={currentAction.action}
                disabled={!currentAction.enabled}
                className={`h-10 px-6 rounded-lg text-white flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                  activeAction === "changeDoctor"
                    ? "bg-brand-violet hover:bg-brand-violet-hover"
                    : activeAction === "cancel" || activeAction === "noShow"
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
    </div>
  );
}
