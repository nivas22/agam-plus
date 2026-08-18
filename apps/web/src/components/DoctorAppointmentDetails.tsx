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

  // Handle status updates
  const handleUpdateStatus = async (
    status: 'scheduled' | 'completed' | 'cancelled' | 'no-show' | 'not-available',
    notes?: string
  ) => {
    try {
      await updateStatusMutation.mutateAsync({
        appointmentId: appointment.id,
        status,
        sessionNotes: notes,
        appointmentData: appointment,
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
      
      toast.success(message);
      
      if (onRefetch) {
        await onRefetch();
      }
      
      onClose();
    } catch (error) {
      console.error("Error updating appointment:", error);
      toast.error("❌ Failed to update appointment status");
    }
  };

  const handleCompleteWithNotes = () => {
    setShowNotesModal(true);
  };

  const handleSaveNotesAndComplete = async () => {
    if (!sessionNotes.trim()) {
      toast.error("Please enter session notes");
      return;
    }
    await handleUpdateStatus("completed", sessionNotes);
    setShowNotesModal(false);
  };

  const handleCancelAppointment = async () => {
    setShowConfirmCancel(false);
    await handleUpdateStatus("cancelled");
  };

  const handleNoShowAppointment = async () => {
    setShowConfirmNoShow(false);
    await handleUpdateStatus("no-show");
  };

  const handleDoctorIsNotAvailable = async () => {
    setShowConfirmNotAvailable(false);
    await handleUpdateStatus("not-available");
  };

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
                onClick={handleCompleteWithNotes}
                disabled={updateStatusMutation.isPending}
                className="flex items-center justify-center gap-2 p-3 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                className="flex items-center justify-center gap-2 p-3 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <XCircle className="w-4 h-4" />
                <span className="text-sm font-medium">Cancel</span>
              </button>

              <button
                onClick={() => setShowConfirmNoShow(true)}
                disabled={updateStatusMutation.isPending}
                className="flex items-center justify-center gap-2 p-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <User className="w-4 h-4" />
                <span className="text-sm font-medium">Mark as No Show</span>
              </button>

              <button
                onClick={() => setShowConfirmNotAvailable(true)}
                disabled={updateStatusMutation.isPending}
                className="flex items-center justify-center gap-2 p-3 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Stethoscope className="w-4 h-4" />
                <span className="text-sm font-medium">Not Available</span>
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

      {/* Session Notes Modal */}
      {showNotesModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Session Notes for {appointment.patientName}
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
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
                required
              />
            </div>
            
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowNotesModal(false);
                  setSessionNotes(appointment.sessionNotes || "");
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNotesAndComplete}
                disabled={!sessionNotes.trim() || updateStatusMutation.isPending}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Cancel Appointment
            </h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to cancel this appointment? This action cannot be undone.
            </p>
            
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirmCancel(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                No, Keep It
              </button>
              <button
                onClick={handleCancelAppointment}
                disabled={updateStatusMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Mark as No Show
            </h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to mark this appointment as no-show? This will indicate the patient did not arrive.
            </p>
            
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirmNoShow(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleNoShowAppointment}
                disabled={updateStatusMutation.isPending}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Mark as Not Available
            </h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to mark yourself as not available for this appointment? This will indicate you were unable to attend.
            </p>
            
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirmNotAvailable(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDoctorIsNotAvailable}
                disabled={updateStatusMutation.isPending}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
