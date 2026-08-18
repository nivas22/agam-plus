"use client";

import { Mail, Phone, MapPin, Calendar, Award, ChevronRight } from 'lucide-react';
import { Doctor } from "@/types/doctorNew";

interface DoctorCardProps {
  doctor: Doctor;
  onClick: () => void;
  isUpdatingStatus?: boolean;
}

export default function DoctorCard({ 
  doctor,  
  onClick,  
  isUpdatingStatus = false,
}: DoctorCardProps) {
  const handleClick = () => {
    if (!isUpdatingStatus) {
      onClick();
    }
  };

  const availabilityDays = () => {
    if (doctor.availability) {
      return doctor.availability.map((slot) => {
        // 1st 3 chars of day name
        return slot.day.slice(0, 3);
      });
    }
    return [];
  }
  
  const getStatusConfig = (status: string) => {
    switch(status) {
      case 'approved': 
        return { 
          color: 'bg-emerald-500', 
          label: 'Approved',
          textColor: 'text-emerald-700',
          bgColor: 'bg-emerald-50'
        };
      case 'pending': 
        return { 
          color: 'bg-amber-500', 
          label: 'Pending',
          textColor: 'text-amber-700',
          bgColor: 'bg-amber-50'
        };
      case 'inactive': 
        return { 
          color: 'bg-gray-400', 
          label: 'Inactive',
          textColor: 'text-gray-700',
          bgColor: 'bg-gray-50'
        };
      default: 
        return { 
          color: 'bg-gray-400', 
          label: 'Unknown',
          textColor: 'text-gray-700',
          bgColor: 'bg-gray-50'
        };
    }
  };

  const statusConfig = getStatusConfig(doctor.status);

  return (
    <div
      className={`group relative bg-white rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100 ${
        isUpdatingStatus ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-blue-200 hover:-translate-y-1'
      }`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      aria-disabled={isUpdatingStatus}
    >
      {/* Decorative gradient bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
      
      {/* Header Section */}
      <div className="relative bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 px-2 py-2 border-b border-gray-100">
        <div className="flex items-start gap-3">
          {/* Avatar with gradient and shadow */}
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-600 flex items-center justify-center text-white font-bold text-xl shadow-lg ring-2 ring-white">
              {doctor.name[0]}
            </div>
            {/* Status indicator on avatar */}
            <div className={`absolute -bottom-1 -right-1 w-3 h-3 ${statusConfig.color} rounded-full border-2 border-white shadow-sm`} />
          </div>
          
          {/* Doctor Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold text-gray-900 truncate mb-0.5">
                  {doctor.name}
                </h3>
                {doctor.specialization && (
                  <p className="text-sm text-gray-600 truncate font-medium">
                    {doctor.specialization}
                  </p>
                )}
              </div>
              
              {/* Status badge */}
              <span className={`${statusConfig.bgColor} ${statusConfig.textColor} text-xs font-semibold px-2.5 py-1 rounded-full border ${statusConfig.color.replace('bg-', 'border-').replace('500', '200')}`}>
                {statusConfig.label}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="px-2 py-2 space-y-1.5">
        {/* Stats Pills */}
        {(doctor.experience || doctor.availability?.length > 0) && (
          <div className="flex items-center gap-2 flex-wrap">
            {doctor.experience && parseInt(doctor.experience) > 0 && (
              <div className="flex items-center gap-1.5 bg-gradient-to-r from-purple-50 to-pink-50 text-purple-700 px-3 py-1.5 rounded-lg font-semibold text-xs border border-purple-200 shadow-sm">
                <Award className="w-3.5 h-3.5" />
                <span>{doctor.experience} years</span>
              </div>
            )}
          
            {doctor.availability?.length > 0 && (
              <div className="flex items-center gap-1.5 bg-gradient-to-r from-blue-50 to-cyan-50 text-blue-700 px-3 py-1.5 rounded-lg font-semibold text-xs border border-blue-200 shadow-sm">
                <Calendar className="w-3.5 h-3.5" />
                <span> {availabilityDays().join(', ')}</span>
              </div>
            )}
          </div>
        )}

        {/* Contact Information */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-2.5 group/item">
            <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0 group-hover/item:bg-green-100 transition-colors">
              <Phone className="w-4 h-4 text-green-600" />
            </div>
            <span className="text-sm text-gray-700 font-medium">{doctor.phone}</span>
          </div>

          <div className="flex items-center gap-2.5 group/item">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 group-hover/item:bg-blue-100 transition-colors">
              <Mail className="w-4 h-4 text-blue-600" />
            </div>
            <span className="text-sm text-gray-700 truncate font-medium">{doctor.email}</span>
          </div>

          {doctor.address && (
            <div className="flex items-center gap-2.5 group/item">
              <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0 group-hover/item:bg-red-100 transition-colors">
                <MapPin className="w-4 h-4 text-red-600" />
              </div>
              <span className="text-sm text-gray-700 truncate font-medium">{doctor.address}</span>
            </div>
          )}
        </div>
      </div>

      {/* Hover Arrow Indicator */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <ChevronRight className="w-5 h-5 text-blue-500" />
      </div>
    </div>
  );
}
