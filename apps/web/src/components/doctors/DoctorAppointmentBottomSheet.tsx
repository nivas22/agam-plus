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
        return `${baseClasses} bg-green-100 text-green-700 border-green-200`;
      case "cancelled":
        return `${baseClasses} bg-red-100 text-red-700 border-red-200`;
      case "no-show":
        return `${baseClasses} bg-gray-100 text-gray-700 border-gray-200`;
      case "scheduled":
        return `${baseClasses} bg-blue-100 text-blue-700 border-blue-200`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-700 border-gray-200`;
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
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Handle */}
        <div className="flex justify-center p-3">
          <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-800">
            Appointment Details
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Patient Info */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold text-lg">
              {appointment.patientName?.[0]?.toUpperCase() || "P"}
            </div>
            <div>
              <h3 className="font-semibold text-gray-800 text-lg">
                {appointment.patientName}
              </h3>
              <p className="text-sm text-gray-500">
                {appointment.patientAge &&
                  `${appointment.patientAge} yrs • `}
                {appointment.patientGender}
              </p>
            </div>
          </div>

          {appointment.patientPhone && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Phone className="w-4 h-4" />
              <span>{appointment.patientPhone}</span>
            </div>
          )}
        </div>

        {/* Appointment Details */}
        <div className="p-4 border-b border-gray-200">
          <h4 className="font-medium text-gray-700 mb-3">
            Appointment Information
          </h4>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">Date</p>
                <p className="font-medium text-gray-800">
                  {format(appointmentDate, "EEE, MMM d, yyyy")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">Time</p>
                <p className="font-medium text-gray-800">
                  {format(appointmentDate, "h:mm a")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className={getStatusBadge(appointment.status)}>
                {appointment.status || "scheduled"}
              </div>
              {appointment.status === "scheduled" && isPast && (
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 border border-yellow-200">
                  Pending Update
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Notes */}
        {appointment.notes && (
          <div className="p-4 border-b border-gray-200">
            <h4 className="font-medium text-gray-700 mb-2">
              Patient Notes
            </h4>
            <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
              {appointment.notes}
            </p>
          </div>
        )}

        {/* Session Notes */}
        {appointment.sessionNotes && (
          <div className="p-4 border-b border-gray-200">
            <h4 className="font-medium text-gray-700 mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4 text-green-600" />
              Session Notes
            </h4>
            <p className="text-sm text-gray-600 bg-green-50 p-3 rounded-lg border border-green-100">
              {appointment.sessionNotes}
            </p>
          </div>
        )}

        {/* Actions */}
        {appointment.status === "scheduled" && (
          <div className="p-4">
            <h4 className="font-medium text-gray-700 mb-3">
              Update Status
            </h4>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => onOpenNotesModal(appointment)}
                className="flex items-center justify-center gap-2 p-3 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm font-medium">Complete</span>
              </button>

              <button
                onClick={() => onRequestConfirmation("cancelled")}
                className="flex items-center justify-center gap-2 p-3 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
              >
                <XCircle className="w-4 h-4" />
                <span className="text-sm font-medium">Cancel</span>
              </button>

              <button
                onClick={() => onRequestConfirmation("no-show")}
                className="flex items-center justify-center gap-2 p-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors col-span-2"
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
              className="w-full p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

