'use client';

import { FaEdit, FaTrash, FaGraduationCap, FaMapMarkerAlt } from "react-icons/fa";
import { X, Mail, Phone, UserCheck, UserX } from "lucide-react";
import { AvailabilitySlot } from "@/types/doctor";
import { Doctor } from "@/types/doctorNew";

interface DoctorDetailModalProps {
  doctor: Doctor | null;
  onClose: () => void;
  onDelete?: (doctor: Doctor) => void;
  statusBadge: React.ReactNode;
  updateStatus?: (id: string, status: 'pending' | 'approved' | 'rejected') => void;
  onEdit?: (doctor: Doctor) => void | undefined;
  canEdit?: boolean;
  isUpdatingStatus?: boolean;
}

export default function DoctorDetailModal({ 
  doctor, 
  onClose, 
  onDelete, 
  statusBadge, 
  updateStatus, 
  onEdit, 
  canEdit = false,
}: DoctorDetailModalProps) {
  if (!doctor) return null;

  const handleStatusChange = (status: 'approved' | 'rejected') => {
    if (canEdit && updateStatus && doctor.membershipId) {
      updateStatus(doctor.membershipId, status);
    }
    onClose();
  };

  const handleOnEdit = () => {
    if (canEdit && onEdit) onEdit(doctor);
  };

  const handleDelete = () => {
    if (canEdit && onDelete) onDelete(doctor);
  }

  // Function to group availability by time slots
  const groupAvailabilityByTime = (availability: AvailabilitySlot[] | undefined): Record<string, { days: string[]; startTime: string; endTime: string }> => {
    if (!availability || !Array.isArray(availability)) return {};
    
    const grouped: Record<string, { days: string[]; startTime: string; endTime: string }> = {};
    availability.forEach(item => {
      const timeKey = `${item.startTime}-${item.endTime}`;
      if (!grouped[timeKey]) {
        grouped[timeKey] = {
          days: [],
          startTime: item.startTime,
          endTime: item.endTime
        };
      }
      grouped[timeKey].days.push(item.day);
    });
    return grouped;
  };

  // Format day names for display
  const formatDayName = (day: string): string => {
    const dayMap: Record<string, string> = {
      'mon': 'Monday',
      'tue': 'Tuesday',
      'wed': 'Wednesday',
      'thu': 'Thursday',
      'fri': 'Friday',
      'sat': 'Saturday',
      'sun': 'Sunday'
    };
    return dayMap[day.toLowerCase()] || day;
  };

  // Sort days in order
  const sortDays = (days: string[]): string[] => {
    const dayOrder = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    return days.sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b));
  };

  // Format time for display (convert from 24h to 12h format)
  const formatTime = (time: string): string => {
    if (!time) return '';
    
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours);
    const period = h >= 12 ? 'PM' : 'AM';
    const displayHours = h % 12 || 12;
    return `${displayHours}:${minutes} ${period}`;
  };

  // Group the availability data
  const groupedAvailability = groupAvailabilityByTime(doctor.availability);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-end sm:items-center justify-center z-50">
      <div className="bg-surface-paper rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-md p-2 relative animate-slideUp max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 bg-surface-paper p-2 border-b border-border rounded-t-2xl">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-brand-violet-soft to-brand-violet-soft flex items-center justify-center text-2l font-bold text-brand-violet">
                {doctor.name ? doctor.name[0].toUpperCase() : "D"}
              </div>
              <div>
                <h2 className="font-display tracking-tight text-2m font-bold text-ink-900">Dr. {doctor.name}</h2>
                <p className="text-xs text-ink-500">{doctor.specialization || "General Practitioner"}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleOnEdit()}
                className="p-1 text-ink-500 hover:text-ink-700 hover:bg-surface-canvas rounded-lg transition-colors"
                title="Edit Doctor"
              >
                <FaEdit className="w-5 h-5" />
              </button>
              <button
                onClick={() => handleDelete()}
                className="p-1 text-status-danger hover:text-status-danger-hover hover:bg-status-danger-soft rounded-lg transition-colors"
                title="Delete Doctor"
              >
                <FaTrash className="w-5 h-5" />
              </button>
              <button
                onClick={onClose}
                className="p-1 hover:bg-surface-canvas rounded-lg transition-colors"
                title="Close"
              >
                <X className="w-5 h-5 text-ink-500" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <h3 className="font-display tracking-tight text-lg font-semibold text-ink-900">Contact Information</h3>
              <div className="space-y-3">
                {doctor.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-ink-500" />
                    <span className="text-ink-700">{doctor.email}</span>
                  </div>
                )}
                {doctor.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-ink-500" />
                    <span className="font-mono tabular text-ink-700">{doctor.phone}</span>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <span className="text-ink-700">{statusBadge}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-display tracking-tight text-lg font-semibold text-ink-900">Professional Details</h3>
              <div className="space-y-3">
                {doctor.experience && (
                  <div className="flex items-center gap-3">
                    <FaGraduationCap className="w-4 h-4 text-ink-500" />
                    <span className="text-ink-700">{doctor.experience} years experience</span>
                  </div>
                )}
                {doctor.location && (
                  <div className="flex items-center gap-3">
                    <FaMapMarkerAlt className="w-4 h-4 text-ink-500" />
                    <span className="text-ink-700">{doctor.location}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <h3 className="font-display tracking-tight text-lg font-semibold text-ink-900">Availability</h3>
              <div className="space-y-4 mt-3">
                {doctor.availability && doctor.availability.length > 0 ? (
                  Object.keys(groupedAvailability).length > 0 ? (
                    Object.values(groupedAvailability).map((slot, index) => (
                      <div key={index} className="bg-surface-canvas p-4 rounded-lg border border-border">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-ink-500">Days:</span>
                            <span className="text-sm font-medium text-ink-900">
                              {sortDays(slot.days).map(day => formatDayName(day)).join(', ')}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-ink-500">Time:</span>
                            <span className="font-mono tabular text-sm font-medium text-ink-900">
                              {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-ink-500 text-sm italic">No specific availability set</div>
                  )
                ) : (
                  <div className="text-ink-500 text-sm italic">No availability information</div>
                )}
              </div>
            </div>
          </div>

          {/* Approve / Reject */}
          {doctor.membershipStatus === "pending" && (
            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-border">
              <button
                onClick={() => handleStatusChange("approved")}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-brand-violet hover:bg-brand-violet-hover text-white rounded-lg transition-all shadow-sm hover:shadow-md w-full sm:w-auto"
              >
                <UserCheck className="w-4 h-4" />
                Approve
              </button>
              <button
                onClick={() => handleStatusChange("rejected")}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-status-danger hover:bg-status-danger-hover text-white rounded-lg transition-all shadow-sm hover:shadow-md w-full sm:w-auto"
              >
                <UserX className="w-4 h-4" />
                Reject
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
