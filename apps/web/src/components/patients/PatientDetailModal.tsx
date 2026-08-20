// components/PatientDetailModal.tsx
'use client';

import { useState, useEffect, useCallback } from "react";
import { X, Mail, Phone, Calendar, Clock, Stethoscope } from "lucide-react";
import { FaEdit, FaTrash, FaUserMd } from "react-icons/fa";
import { calculateAge, formatAppointmentDate } from "@/utils/dateUtils";
import { Patient } from "@/types/patientNew";
import { Appointment } from "@/types/appointment";

interface PatientDetailModalProps {
  patient: Patient | null;
  onClose: () => void;
  onEdit?: (patient: Patient) => void;
  onDelete?: (patient: Patient) => void;
  onAssignDoctor?: () => void;
  onUpdateAppointments?: () => void;
  futureAppointments?: Appointment[];
  canEdit?: boolean;
}

export default function PatientDetailModal({
  patient,
  onClose,
  onEdit,
  onDelete,
  onAssignDoctor,
  onUpdateAppointments,
  futureAppointments = [],
  canEdit = true
}: PatientDetailModalProps) {
  const [nextAppointments, setNextAppointments] = useState<Appointment[]>([]);
  const [nextAppointment, setNextAppointment] = useState<Appointment | null>(null);

  // Memoized edit handler
  const handleOnEdit = useCallback(() => {
    if (canEdit && patient && onEdit) {
      onEdit(patient);
    }
  }, [canEdit, onEdit, patient]);

  // Memoized delete handler
  const handleOnDelete = useCallback(() => {
    if (canEdit && patient && onDelete) {
      onDelete(patient);
    }
  }, [canEdit, onDelete, patient]);

  useEffect(() => {
    if (!patient?.id) return;

    // Only filter appointments when patient.id or futureAppointments length changes
    const patientAppointments = futureAppointments
      .filter(appt => appt.patientId === patient.id)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (patientAppointments.length > 0) {
      setNextAppointment(patientAppointments[0]);
      setNextAppointments(patientAppointments);
    } else {
      setNextAppointment(null);
      setNextAppointments([]);
    }
  }, [patient?.id, futureAppointments.length]); 
  // ✅ using patient?.id + futureAppointments.length prevents unnecessary triggers

  // const getFrequencyTag = (frequency: string) => {
  //   const styles = {
  //     Daily: "bg-green-100 text-green-700 border border-green-200",
  //     Weekly: "bg-blue-100 text-blue-700 border border-blue-200",
  //     Monthly: "bg-purple-100 text-purple-700 border border-purple-200",
  //   };
    
  //   const style = styles[frequency as keyof typeof styles] || "bg-gray-100 text-gray-700 border border-gray-200";
    
  //   return (
  //     <span className={`px-2 py-1 rounded-full text-xs font-medium ${style}`}>
  //       {frequency}
  //     </span>
  //   );
  // };

  if (!patient) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-end sm:items-center justify-center z-50 sm:p-4">
      <div className="bg-surface-paper rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-md p-2 relative animate-slideUp max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 bg-surface-paper p-2 border-b border-border rounded-t-2xl">
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-brand-violet-soft flex items-center justify-center text-xl font-bold text-brand-violet">
                {patient.name ? patient.name[0].toUpperCase() : "P"}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-ink-900">{patient.name || "Unnamed Patient"}</h2>
                  {patient.patientId && (
                    <span className="px-2 py-0.5 bg-brand-violet-soft text-brand-violet text-xs font-semibold rounded-md">
                      #{patient.patientId}
                    </span>
                  )}
                </div>
                <p className="text-sm text-ink-700">
                  {patient.gender || "Unknown"} • {`${calculateAge(patient.dateOfBirth)} yrs` || "Unknown age"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {canEdit && onEdit && (
                <button
                  onClick={handleOnEdit}
                  className="p-2 text-brand-violet hover:bg-brand-violet-soft rounded-lg transition-colors"
                  title="Edit Patient"
                >
                  <FaEdit className="w-4 h-4" />
                </button>
              )}

              {canEdit && onDelete && (
                <button
                  onClick={handleOnDelete}
                  className="p-2 text-status-danger hover:bg-status-danger-soft rounded-lg transition-colors"
                  title="Delete Patient"
                >
                  <FaTrash className="w-4 h-4" />
                </button>
              )}

              <button
                onClick={onClose}
                className="p-2 text-ink-500 hover:bg-surface-canvas rounded-lg transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Contact Info */}
          <div className="flex flex-wrap gap-4 text-sm">
            {patient.email && (
              <div className="flex items-center gap-1.5">
                <Mail className="w-4 h-4 text-brand-violet" />
                <span className="text-ink-700">{patient.email}</span>
              </div>
            )}
            {patient.phone && (
              <div className="flex items-center gap-1.5">
                <Phone className="w-4 h-4 text-status-open" />
                <span className="text-ink-700">{patient.phone}</span>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Next Appointment Card */}
          {nextAppointment ? (
            <div className="mb-6 p-4 bg-brand-violet-soft rounded-lg border border-brand-violet/20">
              <h4 className="font-semibold text-brand-violet mb-3 flex items-center">
                <Calendar className="mr-2 h-4 w-4" /> Next Appointment
              </h4>

              <div className="flex items-center mb-2">
                <div className="bg-surface-paper p-2 rounded-lg shadow-sm mr-3">
                  <div className="text-brand-violet font-bold text-lg text-center">
                    {formatAppointmentDate(nextAppointment.date).day}
                  </div>
                  <div className="text-brand-violet text-xs uppercase text-center">
                    {formatAppointmentDate(nextAppointment.date).month}
                  </div>
                </div>

                <div>
                  <div className="font-medium text-ink-900">
                    {formatAppointmentDate(nextAppointment.date).date}
                  </div>
                  <div className="text-ink-700 text-sm flex items-center">
                    <Clock className="mr-1 text-brand-violet" size={12} />
                    {nextAppointment.time}
                  </div>
                </div>
              </div>

              {nextAppointment.doctor?.name && (
                <div className="mt-3 pt-3 border-t border-brand-violet/20 flex items-center text-sm">
                  <Stethoscope className="mr-2 text-brand-violet h-4 w-4" />
                  <span className="text-ink-700">With Dr. {nextAppointment.doctor.name}</span>
                  {nextAppointment.doctor.specialization && (
                    <span className="text-ink-500 text-xs ml-2">({nextAppointment.doctor.specialization})</span>
                  )}
                </div>
              )}

              {nextAppointment.notes && (
                <div className="mt-2 text-sm text-ink-700 bg-surface-paper p-2 rounded border border-border">
                  📝 {nextAppointment.notes}
                </div>
              )}
            </div>
          ) : (
            <div className="mb-6 p-4 bg-surface-canvas rounded-lg border border-border text-center">
              <Calendar className="mx-auto text-ink-500 mb-2 h-6 w-6" />
              <p className="text-ink-500">No upcoming appointments</p>
            </div>
          )}

          {/* Patient Details */}
          <div className="space-y-4 mb-6">
            <h4 className="font-semibold text-ink-900">Patient Details</h4>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              {/* {patient.dateOfBirth && (
                <div>
                  <p className="text-gray-500">Date of Birth</p>
                  <p className="text-gray-800">{new Date(patient.dateOfBirth).toLocaleDateString()}</p>
                </div>
              )} */}
              
              {/* {patient.assignedDoctor?.name && (
                <div>
                  <p className="text-gray-500">Assigned Doctor</p>
                  <p className="text-gray-800">Dr. {patient.assignedDoctor.name}</p>
                </div>
              )} */}
              
              {/* {patient.frequency && (
                <div>
                  <p className="text-gray-500">Frequency</p>
                  <p className="text-gray-800">{getFrequencyTag(patient.frequency)}</p>
                </div>
              )} */}
              
              {patient.address && (
                <div className="col-span-2">
                  <p className="text-ink-500">Address</p>
                  <p className="text-ink-900">{patient.address}</p>
                </div>
              )}
              
              {/* {patient.startDate && (
                <div>
                  <p className="text-gray-500">Start Date</p>
                  <p className="text-gray-800">{new Date(patient.startDate).toLocaleDateString()}</p>
                </div>
              )}
              
              {patient.endDate && (
                <div>
                  <p className="text-gray-500">End Date</p>
                  <p className="text-gray-800">{new Date(patient.endDate).toLocaleDateString()}</p>
                </div>
              )} */}
            </div>
          </div>

          {/* Medical History */}
          {/* {patient.medicalHistory && (
            <div className="mb-6">
              <h4 className="font-semibold text-gray-800 mb-2">Medical History</h4>
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-700">{patient.medicalHistory}</p>
              </div>
            </div>
          )} */}

          {/* Notes */}
          {patient.notes && (
            <div className="mb-6">
              <h4 className="font-semibold text-ink-900 mb-2">Notes</h4>
              <div className="bg-status-warning-soft p-3 rounded-lg border border-status-warning/20">
                <p className="text-sm text-ink-700">{patient.notes}</p>
              </div>
            </div>
          )}

          {/* Future Appointments List */}
          {nextAppointments.length > 1 && (
            <div className="mb-6">
              <h4 className="font-semibold text-ink-700 mb-3 flex items-center">
                <Calendar className="h-4 w-4 mr-2 text-brand-violet" />
                Future Appointments ({nextAppointments.length - 1})
              </h4>
              <div className="space-y-2">
                {nextAppointments.slice(1, 4).map((appt, index) => (
                  <div key={appt.id || index} className="p-3 bg-surface-canvas rounded-lg border border-border">
                    <div className="font-medium text-ink-900">
                      {formatAppointmentDate(appt.date).date}
                    </div>
                    <div className="text-ink-700 text-sm flex items-center mt-1">
                      <Clock className="mr-1 text-ink-500" size={12} />
                      {appt.time}
                      {appt.doctor?.name && ` • Dr. ${appt.doctor.name}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {canEdit && (
            <div className="flex flex-col gap-2">
              {onAssignDoctor && (
                <button
                  onClick={onAssignDoctor}
                  className="w-full px-4 py-2 bg-brand-violet hover:bg-brand-violet-hover text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <FaUserMd className="w-4 h-4" />
                  Assign Doctor
                </button>
              )}
              
              {nextAppointments.length > 0 && onUpdateAppointments && (
                <button
                  onClick={onUpdateAppointments}
                  className="w-full px-4 py-2 bg-brand-violet hover:bg-brand-violet-hover text-white rounded-lg transition-colors"
                >
                  Update Appointments
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
