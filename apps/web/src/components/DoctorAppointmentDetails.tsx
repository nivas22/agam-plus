// src/components/DoctorAppointmentBottomSheet.tsx
"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
  X,
  Calendar,
  Clock,
  User,
  CheckCircle,
  XCircle,
  FileText,
  Phone,
  Loader2,
  Stethoscope
} from "lucide-react";
import { AppointmentWithDetails } from "@/types/appointment";
import { useUpdateHospitalAppointmentStatus } from "@/hooks/useNewAppointmentsApi";
import { toast } from "react-hot-toast";
import { APPOINTMENT_STATUS, normalizeAppointmentStatus } from "../constants";

interface DoctorAppointmentBottomSheetProps {
  appointment: AppointmentWithDetails;
  onClose: () => void;
  onRefetch?: () => void;
}

export default function DoctorAppointmentBottomSheet({
  appointment,
  onClose,
  onRefetch,
}: DoctorAppointmentBottomSheetProps) {
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [sessionNotes, setSessionNotes] = useState(appointment.sessionNotes || "");
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);
  const [showConfirmNoShow, setShowConfirmNoShow] = useState(false);
  const [showConfirmNotAvailable, setShowConfirmNotAvailable] = useState(false);
  const updateStatusMutation = useUpdateHospitalAppointmentStatus();
  const appointmentDate = new Date(appointment.date);
  const isPast = appointmentDate < new Date();
  const status = normalizeAppointmentStatus(appointment.status);
  const isPreConsultation = status !== APPOINTMENT_STATUS.IN_CONSULTATION && [
    APPOINTMENT_STATUS.PENDING,
    APPOINTMENT_STATUS.CONFIRMED,
    APPOINTMENT_STATUS.CHECKED_IN,
    APPOINTMENT_STATUS.WAITING,
  ].includes(status);

  // Handle status updates
  const handleUpdateStatus = async (status: string, notes?: string) => {
    try {
      await updateStatusMutation.mutateAsync({
        appointmentId: appointment.id,
        status,
        sessionNotes: notes,
        appointmentData: appointment,
      });

      let message = "";
      switch (status) {
        case APPOINTMENT_STATUS.IN_CONSULTATION:
          message = "🩺 Consultation started";
          break;
        case APPOINTMENT_STATUS.COMPLETED:
          message = "✅ Appointment marked as completed";
          break;
        case APPOINTMENT_STATUS.CANCELLED:
          message = "🗑️ Appointment cancelled successfully";
          break;
        case APPOINTMENT_STATUS.NO_SHOW:
          message = "⏰ Appointment marked as no-show";
          break;
        case APPOINTMENT_STATUS.RESCHEDULED:
          message = "📅 Appointment flagged for rescheduling";
          break;
        default:
          message = "📝 Appointment status updated";
      }

      toast.success(message);

      if (onRefetch) {
        await onRefetch();
      }

      onClose();
    } catch (error) {
      console.error("Error updating appointment:", error);
      toast.error(error instanceof Error ? error.message : "❌ Failed to update appointment status");
    }
  };

  const handleStartConsultation = async () => {
    await handleUpdateStatus(APPOINTMENT_STATUS.IN_CONSULTATION);
  };

  const handleCompleteWithNotes = () => {
    setShowNotesModal(true);
  };

  const handleSaveNotesAndComplete = async () => {
    if (!sessionNotes.trim()) {
      toast.error("Please enter session notes");
      return;
    }
    await handleUpdateStatus(APPOINTMENT_STATUS.COMPLETED, sessionNotes);
    setShowNotesModal(false);
  };

  const handleCancelAppointment = async () => {
    setShowConfirmCancel(false);
    await handleUpdateStatus(APPOINTMENT_STATUS.CANCELLED);
  };

  const handleNoShowAppointment = async () => {
    setShowConfirmNoShow(false);
    await handleUpdateStatus(APPOINTMENT_STATUS.NO_SHOW);
  };

  // "Not available" flags the appointment as needing a new slot, rather than
  // a distinct backend status of its own.
  const handleDoctorIsNotAvailable = async () => {
    setShowConfirmNotAvailable(false);
    await handleUpdateStatus(APPOINTMENT_STATUS.RESCHEDULED);
  };

  const getStatusBadge = (rawStatus: string) => {
    const baseClasses =
      "px-3 py-1.5 rounded-full text-sm font-medium border";

    switch (normalizeAppointmentStatus(rawStatus)) {
      case APPOINTMENT_STATUS.COMPLETED:
        return `${baseClasses} bg-status-open-soft text-status-open border-status-open/20`;
      case APPOINTMENT_STATUS.CANCELLED:
        return `${baseClasses} bg-status-danger-soft text-status-danger border-status-danger/20`;
      case APPOINTMENT_STATUS.NO_SHOW:
        return `${baseClasses} bg-surface-canvas text-ink-700 border-border`;
      case APPOINTMENT_STATUS.PENDING:
      case APPOINTMENT_STATUS.RESCHEDULED:
        return `${baseClasses} bg-status-warning-soft text-status-warning border-status-warning/20`;
      case APPOINTMENT_STATUS.CHECKED_IN:
      case APPOINTMENT_STATUS.WAITING:
        return `${baseClasses} bg-brand-violet-soft text-brand-violet border-brand-violet/20`;
      case APPOINTMENT_STATUS.IN_CONSULTATION:
        return `${baseClasses} bg-brand-violet text-white border-brand-violet`;
      case APPOINTMENT_STATUS.CONFIRMED:
        return `${baseClasses} bg-brand-violet-soft text-brand-violet border-brand-violet/20`;
      default:
        return `${baseClasses} bg-surface-canvas text-ink-700 border-border`;
    }
  };

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-trace-background bg-opacity-40"
        onClick={onClose}
      />

      {/* Bottom Sheet */}
      <div className="absolute bottom-0 left-0 right-0 bg-surface-paper rounded-t-3xl shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Handle */}
        <div className="flex justify-center p-3">
          <div className="w-12 h-1.5 bg-border rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-display tracking-tight text-xl font-bold text-ink-900">
            Appointment Details
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface-canvas rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-ink-500" />
          </button>
        </div>

        {/* Patient Info */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-brand-violet-soft flex items-center justify-center text-brand-violet font-semibold text-lg">
              {appointment.patientName?.[0]?.toUpperCase() || "P"}
            </div>
            <div>
              <h3 className="font-display tracking-tight font-semibold text-ink-900 text-lg">
                {appointment.patientName}
              </h3>
              <p className="text-sm text-ink-500">
                {appointment.patientAge &&
                  `${appointment.patientAge} yrs • `}
                {appointment.patientGender}
              </p>
            </div>
          </div>

          {appointment.patientPhone && (
            <div className="flex items-center gap-2 text-sm text-ink-700">
              <Phone className="w-4 h-4" />
              <span className="font-mono tabular">{appointment.patientPhone}</span>
            </div>
          )}
        </div>

        {/* Appointment Details */}
        <div className="p-4 border-b border-border">
          <h4 className="font-medium text-ink-700 mb-3">
            Appointment Information
          </h4>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-brand-violet" />
              <div>
                <p className="text-sm text-ink-700">Date</p>
                <p className="font-mono tabular font-medium text-ink-900">
                  {format(appointmentDate, "EEE, MMM d, yyyy")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-brand-violet" />
              <div>
                <p className="text-sm text-ink-700">Time</p>
                <p className="font-mono tabular font-medium text-ink-900">
                  {format(appointmentDate, "h:mm a")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className={getStatusBadge(appointment.status)}>
                {appointment.status || "confirmed"}
              </div>
              {isPreConsultation && isPast && (
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-status-warning-soft text-status-warning border border-status-warning/20">
                  Pending Update
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Notes */}
        {appointment.notes && (
          <div className="p-4 border-b border-border">
            <h4 className="font-medium text-ink-700 mb-2">
              Patient Notes
            </h4>
            <p className="text-sm text-ink-700 bg-surface-canvas p-3 rounded-lg">
              {appointment.notes}
            </p>
          </div>
        )}

        {/* Session Notes */}
        {appointment.sessionNotes && (
          <div className="p-4 border-b border-border">
            <h4 className="font-medium text-ink-700 mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4 text-status-open" />
              Session Notes
            </h4>
            <p className="text-sm text-ink-700 bg-status-open-soft p-3 rounded-lg border border-status-open/20">
              {appointment.sessionNotes}
            </p>
          </div>
        )}

        {/* Actions */}
        {isPreConsultation && (
          <div className="p-4">
            <h4 className="font-medium text-ink-700 mb-3">
              Update Status
            </h4>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleStartConsultation}
                disabled={updateStatusMutation.isPending}
                className="flex items-center justify-center gap-2 p-3 bg-status-open-soft text-status-open rounded-lg hover:bg-status-open/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updateStatusMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                <span className="text-sm font-medium">Start Consultation</span>
              </button>

              <button
                onClick={() => setShowConfirmCancel(true)}
                disabled={updateStatusMutation.isPending}
                className="flex items-center justify-center gap-2 p-3 bg-status-danger-soft text-status-danger rounded-lg hover:bg-status-danger/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <XCircle className="w-4 h-4" />
                <span className="text-sm font-medium">Cancel</span>
              </button>

              <button
                onClick={() => setShowConfirmNoShow(true)}
                disabled={updateStatusMutation.isPending}
                className="flex items-center justify-center gap-2 p-3 bg-surface-canvas text-ink-700 rounded-lg hover:bg-border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <User className="w-4 h-4" />
                <span className="text-sm font-medium">Mark as No Show</span>
              </button>

              <button
                onClick={() => setShowConfirmNotAvailable(true)}
                disabled={updateStatusMutation.isPending}
                className="flex items-center justify-center gap-2 p-3 bg-status-warning-soft text-status-warning rounded-lg hover:bg-status-warning/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Stethoscope className="w-4 h-4" />
                <span className="text-sm font-medium">Not Available</span>
              </button>
            </div>
          </div>
        )}

        {status === APPOINTMENT_STATUS.IN_CONSULTATION && (
          <div className="p-4">
            <h4 className="font-medium text-ink-700 mb-3">
              Update Status
            </h4>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleCompleteWithNotes}
                disabled={updateStatusMutation.isPending}
                className="flex items-center justify-center gap-2 p-3 bg-status-open-soft text-status-open rounded-lg hover:bg-status-open/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updateStatusMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                <span className="text-sm font-medium">Complete</span>
              </button>

              <button
                onClick={() => setShowConfirmCancel(true)}
                disabled={updateStatusMutation.isPending}
                className="flex items-center justify-center gap-2 p-3 bg-status-danger-soft text-status-danger rounded-lg hover:bg-status-danger/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <XCircle className="w-4 h-4" />
                <span className="text-sm font-medium">Cancel</span>
              </button>
            </div>
          </div>
        )}

        {/* View-only actions */}
        {(status === APPOINTMENT_STATUS.COMPLETED ||
          status === APPOINTMENT_STATUS.CANCELLED ||
          status === APPOINTMENT_STATUS.NO_SHOW ||
          status === APPOINTMENT_STATUS.RESCHEDULED) && (
          <div className="p-4">
            <button
              onClick={onClose}
              className="w-full p-3 bg-brand-violet text-white rounded-lg hover:bg-brand-violet-hover transition-colors font-medium"
            >
              Close
            </button>
          </div>
        )}
      </div>

      {/* Session Notes Modal */}
      {showNotesModal && (
        <div className="fixed inset-0 bg-trace-background bg-opacity-40 flex items-center justify-center z-[60] p-4">
          <div className="bg-surface-paper rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-display tracking-tight text-lg font-semibold text-ink-900 mb-4">
              Session Notes for {appointment.patientName}
            </h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-ink-700 mb-2">
                Session Notes *
              </label>
              <textarea
                value={sessionNotes}
                onChange={(e) => setSessionNotes(e.target.value)}
                placeholder="Enter details about the session, treatment provided, observations, etc."
                rows={4}
                className="w-full p-3 border border-border rounded-lg focus:ring-2 focus:ring-status-open focus:border-status-open resize-none"
                required
              />
            </div>
            
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowNotesModal(false);
                  setSessionNotes(appointment.sessionNotes || "");
                }}
                className="px-4 py-2 border border-border text-ink-700 rounded-lg hover:bg-surface-canvas transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNotesAndComplete}
                disabled={!sessionNotes.trim() || updateStatusMutation.isPending}
                className="px-4 py-2 bg-brand-violet text-white rounded-lg hover:bg-brand-violet-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {updateStatusMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                Save Notes & Complete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {showConfirmCancel && (
        <div className="fixed inset-0 bg-trace-background bg-opacity-40 flex items-center justify-center z-[60] p-4">
          <div className="bg-surface-paper rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-display tracking-tight text-lg font-semibold text-ink-900 mb-4">
              Cancel Appointment
            </h3>
            <p className="text-ink-700 mb-6">
              Are you sure you want to cancel this appointment? This action cannot be undone.
            </p>
            
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirmCancel(false)}
                className="px-4 py-2 border border-border text-ink-700 rounded-lg hover:bg-surface-canvas transition-colors"
              >
                No, Keep It
              </button>
              <button
                onClick={handleCancelAppointment}
                disabled={updateStatusMutation.isPending}
                className="px-4 py-2 bg-status-danger text-white rounded-lg hover:bg-status-danger-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {updateStatusMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <XCircle className="w-4 h-4" />
                )}
                Yes, Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* No Show Confirmation Modal */}
      {showConfirmNoShow && (
        <div className="fixed inset-0 bg-trace-background bg-opacity-40 flex items-center justify-center z-[60] p-4">
          <div className="bg-surface-paper rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-display tracking-tight text-lg font-semibold text-ink-900 mb-4">
              Mark as No Show
            </h3>
            <p className="text-ink-700 mb-6">
              Are you sure you want to mark this appointment as no-show? This will indicate the patient did not arrive.
            </p>
            
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirmNoShow(false)}
                className="px-4 py-2 border border-border text-ink-700 rounded-lg hover:bg-surface-canvas transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleNoShowAppointment}
                disabled={updateStatusMutation.isPending}
                className="px-4 py-2 bg-ink-700 text-white rounded-lg hover:bg-ink-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {updateStatusMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <User className="w-4 h-4" />
                )}
                Yes, Mark as No Show
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Not Available Confirmation Modal */}
      {showConfirmNotAvailable && (
        <div className="fixed inset-0 bg-trace-background bg-opacity-40 flex items-center justify-center z-[60] p-4">
          <div className="bg-surface-paper rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-display tracking-tight text-lg font-semibold text-ink-900 mb-4">
              Mark as Not Available
            </h3>
            <p className="text-ink-700 mb-6">
              Are you sure you want to mark yourself as not available for this appointment? This will indicate you were unable to attend.
            </p>
            
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirmNotAvailable(false)}
                className="px-4 py-2 border border-border text-ink-700 rounded-lg hover:bg-surface-canvas transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDoctorIsNotAvailable}
                disabled={updateStatusMutation.isPending}
                className="px-4 py-2 bg-status-warning text-white rounded-lg hover:bg-status-warning-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {updateStatusMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <User className="w-4 h-4" />
                )}
                Yes, Not Available
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
