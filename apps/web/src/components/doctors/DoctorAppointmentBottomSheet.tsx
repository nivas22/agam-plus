// src/components/DoctorAppointmentBottomSheet.tsx
"use client";

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
} from "lucide-react";
import { AppointmentWithDetails } from "@/types/appointment";

interface DoctorAppointmentBottomSheetProps {
  appointment: AppointmentWithDetails;
  onClose: () => void;
  onUpdateStatus: (appointmentId: string, status: 'scheduled' | 'completed' | 'cancelled' | 'no-show', notes: string) => void;
  onOpenNotesModal: (appointment: AppointmentWithDetails) => void;
  onRequestConfirmation: (status: 'scheduled' | 'completed' | 'cancelled' | 'no-show') => void;
}

export default function DoctorAppointmentBottomSheet({
  appointment,
  onClose,
  onOpenNotesModal,
  onRequestConfirmation,
}: DoctorAppointmentBottomSheetProps) {
  const appointmentDate = new Date(appointment.date);
  const isPast = appointmentDate < new Date();

  const getStatusBadge = (status: string) => {
    const baseClasses =
      "px-3 py-1.5 rounded-full text-sm font-medium border";

    switch (status) {
      case "completed":
        return `${baseClasses} bg-status-open-soft text-status-open border-status-open/20`;
      case "cancelled":
        return `${baseClasses} bg-status-danger-soft text-status-danger border-status-danger/20`;
      case "no-show":
        return `${baseClasses} bg-surface-canvas text-ink-700 border-border`;
      case "scheduled":
        return `${baseClasses} bg-brand-violet-soft text-brand-violet border-brand-violet/20`;
      default:
        return `${baseClasses} bg-surface-canvas text-ink-700 border-border`;
    }
  };

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-40"
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
                {appointment.status || "scheduled"}
              </div>
              {appointment.status === "scheduled" && isPast && (
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
        {appointment.status === "scheduled" && (
          <div className="p-4">
            <h4 className="font-medium text-ink-700 mb-3">
              Update Status
            </h4>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => onOpenNotesModal(appointment)}
                className="flex items-center justify-center gap-2 p-3 bg-brand-violet-soft text-brand-violet rounded-lg hover:bg-brand-violet-soft transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm font-medium">Complete</span>
              </button>

              <button
                onClick={() => onRequestConfirmation("cancelled")}
                className="flex items-center justify-center gap-2 p-3 bg-status-danger-soft text-status-danger rounded-lg hover:bg-status-danger-soft transition-colors"
              >
                <XCircle className="w-4 h-4" />
                <span className="text-sm font-medium">Cancel</span>
              </button>

              <button
                onClick={() => onRequestConfirmation("no-show")}
                className="flex items-center justify-center gap-2 p-3 bg-surface-canvas text-ink-700 rounded-lg hover:bg-surface-canvas transition-colors col-span-2"
              >
                <User className="w-4 h-4" />
                <span className="text-sm font-medium">Mark as No Show</span>
              </button>
            </div>
          </div>
        )}

        {/* View-only actions */}
        {(appointment.status === "completed" ||
          appointment.status === "cancelled" ||
          appointment.status === "no-show") && (
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
    </div>
  );
}

