// hooks/useDoctorSlots.ts
'use client';

import { SlotsResponse, NextAvailableSlotResponse } from '@/types/appointment';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { apiUrl, fetchWithAuth } from '@/lib/api';


// Base API functions
const doctorSlotsApiFunctions = {
  // Fetch doctor availability slots
  fetchDoctorSlots: async (hospitalId: string, doctorId: string, date: string): Promise<SlotsResponse> => {
    const response = await fetchWithAuth(
      `${apiUrl(`/hospitals/${hospitalId}/doctors/${doctorId}/availability`)}?date=${date}`
    );
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch available slots');
    }

    return response.json();
  },

  // Fetch next available slots
  fetchNextAvailableSlots: async (hospitalId: string, doctorId: string, date: string, preferredTime?: string): Promise<NextAvailableSlotResponse> => {
    const params = new URLSearchParams({ date });
    if (preferredTime) params.append('preferredTime', preferredTime);

    const response = await fetchWithAuth(
      `${apiUrl(`/hospitals/${hospitalId}/doctors/${doctorId}/next-availability`)}?${params}`
    );
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch next available slots');
    }

    return response.json();
  },
};

// TanStack Query keys with hospital context
export const doctorSlotsKeys = {
  all: ['doctor-slots'] as const,
  hospital: (hospitalId: string) => [...doctorSlotsKeys.all, 'hospital', hospitalId] as const,
  doctor: (hospitalId: string, doctorId: string) => 
    [...doctorSlotsKeys.hospital(hospitalId), 'doctor', doctorId] as const,
  date: (hospitalId: string, doctorId: string, date: string) => 
    [...doctorSlotsKeys.doctor(hospitalId, doctorId), 'date', date] as const,
  nextAvailability: (hospitalId: string, doctorId: string, date: string, preferredTime?: string) => 
    [...doctorSlotsKeys.doctor(hospitalId, doctorId), 'next-availability', date, preferredTime] as const,
  workingHours: (hospitalId: string, doctorId: string) => 
    [...doctorSlotsKeys.doctor(hospitalId, doctorId), 'working-hours'] as const,
};

// Hook for fetching doctor slots
export const useDoctorSlots = (hospitalId: string, doctorId: string | undefined, date: string | undefined) => {
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);
  
  return useQuery({
    queryKey: doctorSlotsKeys.date(actualHospitalId, doctorId || '', date || ''),
    queryFn: () => doctorSlotsApiFunctions.fetchDoctorSlots(actualHospitalId, doctorId!, date!),
    enabled: !!doctorId && !!date,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Hook for fetching next available slots
export const useNextAvailableSlots = (
  hospitalId: string, 
  doctorId: string | undefined, 
  date: string | undefined, 
  preferredTime?: string
) => {
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);
  
  return useQuery({
    queryKey: doctorSlotsKeys.nextAvailability(actualHospitalId, doctorId || '', date || '', preferredTime),
    queryFn: () => doctorSlotsApiFunctions.fetchNextAvailableSlots(actualHospitalId, doctorId!, date!, preferredTime),
    enabled: !!doctorId && !!date,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
};
