'use client';

import { Phone, CheckCircle, XCircle, Mail, Loader2, ChevronRight, Calendar } from "lucide-react";
import { FaVenusMars, FaBirthdayCake, FaMapMarkerAlt } from "react-icons/fa";
import { calculateAge } from "@/utils/dateUtils";
import { Patient } from "@/types/patientNew";

interface FutureAppointments {
  [patientId: string]: any[];
}

interface PatientCardProps {
  patient: Patient;
  index: number;
  onClick: () => void;
  futureAppointments?: FutureAppointments;
  isUpdating?: boolean;
  className?: string;
}

// const gradients = [
//   "from-blue-50 via-blue-100 to-blue-50",
//   "from-green-50 via-green-100 to-green-50",
//   "from-purple-50 via-purple-100 to-purple-50",
//   "from-pink-50 via-pink-100 to-pink-50",
//   "from-orange-50 via-orange-100 to-orange-50",
//   "from-teal-50 via-teal-100 to-teal-50",
// ];

const gradients = [
  { bg: "from-blue-500 via-blue-600 to-indigo-600", light: "from-blue-50 via-indigo-50 to-purple-50" },
  { bg: "from-green-500 via-emerald-600 to-teal-600", light: "from-green-50 via-emerald-50 to-teal-50" },
  { bg: "from-purple-500 via-purple-600 to-pink-600", light: "from-purple-50 via-purple-50 to-pink-50" },
  { bg: "from-pink-500 via-rose-600 to-red-600", light: "from-pink-50 via-rose-50 to-red-50" },
  { bg: "from-orange-500 via-amber-600 to-yellow-600", light: "from-orange-50 via-amber-50 to-yellow-50" },
  { bg: "from-teal-500 via-cyan-600 to-blue-600", light: "from-teal-50 via-cyan-50 to-blue-50" },
];

export default function PatientCard({ 
  patient, 
  index, 
  onClick, 
  futureAppointments = {}, 
  isUpdating = false,
  className = ""
}: PatientCardProps) {
  const gradient = gradients[index % gradients.length];
  const pendingAppointments = futureAppointments[patient.id]?.length || 0;

  const getStatusConfig = (status: string) => {
    const isActive = status === "approved";
    return isActive ? {
      icon: CheckCircle,
      label: "Active",
      classes: "bg-emerald-50 text-emerald-700 border-emerald-200",
      dotColor: "bg-emerald-500"
    } : {
      icon: XCircle,
      label: "Inactive",
      classes: "bg-red-50 text-red-700 border-red-200",
      dotColor: "bg-red-500"
    };
  };

  const statusConfig = getStatusConfig(patient.status);
  const StatusIcon = statusConfig.icon;

  const handleClick = () => {
    if (!isUpdating) {
      onClick();
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`
        group relative cursor-pointer bg-white rounded-xl shadow-sm hover:shadow-xl 
        transition-all duration-300 overflow-hidden border border-gray-100
        ${isUpdating ? 'opacity-50 cursor-not-allowed' : 'hover:border-blue-200 hover:-translate-y-1'}
        ${className}
      `}
      aria-label={`View details for ${patient.name || 'patient'}`}
      role="button"
      tabIndex={isUpdating ? -1 : 0}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !isUpdating) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {/* Decorative gradient bar */}
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${gradient.bg}`} />

      {/* Loading Overlay */}
      {isUpdating && (
        <div 
          className="absolute inset-0 bg-white bg-opacity-90 rounded-xl flex items-center justify-center z-20"
          aria-label="Updating patient"
        >
          <div className="flex items-center gap-2 text-blue-600">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm font-semibold">Updating...</span>
          </div>
        </div>
      )}

      {/* Header Section */}
      <div className={`relative bg-gradient-to-br ${gradient.light} px-2 py-2 border-b border-gray-100`}>
        <div className="flex items-start gap-3">
          {/* Avatar with status indicator */}
          <div className="relative flex-shrink-0">
            <div
              className={`
                w-10 h-10 rounded-xl flex items-center justify-center 
                text-white font-bold text-xl shadow-lg ring-2 ring-white
                bg-gradient-to-br ${gradient.bg}
              `}
            >
              {patient.name ? patient.name[0].toUpperCase() : "P"}
            </div>
            {/* Status dot on avatar */}
            <div className={`absolute -bottom-1 -right-1 w-4 h-4 ${statusConfig.dotColor} rounded-full border-2 border-white shadow-sm`} />
          </div>

          {/* Patient Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="text-base font-bold text-gray-900 truncate">
                    {patient.name || "Unnamed Patient"}
                  </h3>
                  {patient.patientId && (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-md">
                      #{patient.patientId}
                    </span>
                  )}
                </div>
                {/* Gender & Age */}
                {(patient.gender || patient.dateOfBirth) && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 font-medium">
                    {patient.gender && (
                      <span className="flex items-center gap-1">
                        <FaVenusMars className="w-3.5 h-3.5 text-pink-500" />
                        {patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1).toLowerCase()}
                      </span>
                    )}
                    
                    {patient.dateOfBirth && (
                      <>
                        {patient.gender && <span className="text-gray-400">•</span>}
                        <span className="flex items-center gap-1">
                          <FaBirthdayCake className="w-3.5 h-3.5 text-blue-500" />
                          {calculateAge(patient.dateOfBirth)} yrs
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Status Badge */}
              <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${statusConfig.classes} flex-shrink-0`}>
                <StatusIcon size={12} />
                {statusConfig.label}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="px-2 py-2 space-y-1.5">
        {/* Appointments Badge */}
        {pendingAppointments > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-gradient-to-r from-blue-50 to-cyan-50 text-blue-700 px-3 py-1.5 rounded-lg font-semibold text-xs border border-blue-200 shadow-sm">
              <Calendar className="w-3.5 h-3.5" />
              <span>{pendingAppointments} upcoming appointment{pendingAppointments !== 1 ? 's' : ''}</span>
            </div>
          </div>
        )}

        {/* Contact Information */}
        <div className="space-y-1.5">
          {patient.email && (
            <div 
              className="flex items-center gap-2 group/item"
              title={patient.email}
            >
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 group-hover/item:bg-blue-100 transition-colors">
                <Mail className="w-4 h-4 text-blue-600" />
              </div>
              <span className="text-sm text-gray-700 truncate font-medium">{patient.email}</span>
            </div>
          )}
          
          {patient.phone && (
            <div className="flex items-center gap-2 group/item">
              <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0 group-hover/item:bg-green-100 transition-colors">
                <Phone className="w-4 h-4 text-green-600" />
              </div>
              <span className="text-sm text-gray-700 font-medium">{patient.phone}</span>
            </div>
          )}

          {patient.address && (
            <div 
              className="flex items-center gap-2 group/item"
              title={patient.address}
            >
              <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0 group-hover/item:bg-red-100 transition-colors">
                <FaMapMarkerAlt className="w-4 h-4 text-red-600" />
              </div>
              <span className="text-sm text-gray-700 truncate font-medium">{patient.address}</span>
            </div>
          )}
        </div>
      </div>

      {/* Hover Arrow Indicator */}
      {!isUpdating && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <ChevronRight className="w-5 h-5 text-blue-500" />
        </div>
      )}
    </div>
  );
}
