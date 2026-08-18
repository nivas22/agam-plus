'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TimeSlot } from '@/types/appointment';
import { apiUrl, fetchWithAuth } from '@/lib/api';

// Types
interface AvailabilityData {
  availability: TimeSlot[];
  appointmentDuration: number;
}

interface SaveAvailabilityParams {
  hospitalId: string;
  doctorId: string;
  availability: TimeSlot[];
  appointmentDuration: number;
}

interface GetAvailabilityParams {
  hospitalId: string;
  doctorId: string;
}

interface GetAvailableSlotsParams {
  hospitalId: string;
  doctorId: string;
  date: string;
}

interface AvailableSlotsResponse {
  availableSlots: string[];
  doctor: {
    id: string;
    name: string;
    specialization: string;
    appointmentDuration: number;
  };
}

// Base API functions
const availabilityApiFunctions = {
  saveAvailability: async (params: SaveAvailabilityParams): Promise<{ success: boolean; message: string }> => {
    const { hospitalId, doctorId, availability, appointmentDuration } = params;
    
    const response = await fetchWithAuth(apiUrl(`/hospitals/${hospitalId}/doctors/${doctorId}/availability`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ availability, appointmentDuration }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to save availability');
    }

    return response.json();
  },

  getAvailability: async (params: GetAvailabilityParams): Promise<AvailabilityData> => {
    const { hospitalId, doctorId } = params;
    
    const response = await fetchWithAuth(apiUrl(`/hospitals/${hospitalId}/doctors/${doctorId}/availability`));

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch availability');
    }

    return response.json();
  },

  getAvailableSlots: async (params: GetAvailableSlotsParams): Promise<AvailableSlotsResponse> => {
    const { hospitalId, doctorId, date } = params;
    
    const response = await fetchWithAuth(
      `${apiUrl(`/hospitals/${hospitalId}/doctors/${doctorId}/availability`)}?date=${date}`
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch available slots');
    }

    return response.json();
  },
};

// TanStack Query keys
export const availabilityKeys = {
  all: ['availability'] as const,
  lists: () => [...availabilityKeys.all, 'list'] as const,
  detail: (hospitalId: string, doctorId: string) => 
    [...availabilityKeys.all, 'detail', hospitalId, doctorId] as const,
  slots: (hospitalId: string, doctorId: string, date: string) => 
    [...availabilityKeys.all, 'slots', hospitalId, doctorId, date] as const,
};

// Query hooks
export const useAvailability = (hospitalId: string, doctorId: string) => {
  return useQuery({
    queryKey: availabilityKeys.detail(hospitalId, doctorId),
    queryFn: () => availabilityApiFunctions.getAvailability({ hospitalId, doctorId }),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!hospitalId && !!doctorId,
  });
};

export const useAvailableSlots = (hospitalId: string, doctorId: string, date: string) => {
  return useQuery({
    queryKey: availabilityKeys.slots(hospitalId, doctorId, date),
    queryFn: () => availabilityApiFunctions.getAvailableSlots({ hospitalId, doctorId, date }),
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: !!hospitalId && !!doctorId && !!date,
  });
};

// Mutation hooks
export const useSaveAvailability = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: SaveAvailabilityParams) => 
      availabilityApiFunctions.saveAvailability(params),
    onSuccess: (_, variables) => {
      // Invalidate the specific availability query
      queryClient.invalidateQueries({ 
        queryKey: availabilityKeys.detail(variables.hospitalId, variables.doctorId) 
      });
      // Invalidate all slots queries for this doctor
      queryClient.invalidateQueries({ 
        queryKey: availabilityKeys.all 
      });
    },
  });
};

// Main convenience hook
export const useAvailabilityApi = (hospitalId: string, doctorId: string) => {
  const availability = useAvailability(hospitalId, doctorId);
  const saveMutation = useSaveAvailability();

  // Wrapper function for easier usage
  const saveAvailability = async (
    availabilityData: TimeSlot[],
    appointmentDuration: number
  ) => {
    return saveMutation.mutateAsync({
      hospitalId,
      doctorId,
      availability: availabilityData,
      appointmentDuration,
    });
  };

  return {
    // Query data
    availability: availability.data,
    
    // Loading states
    isLoading: availability.isLoading,
    isSaving: saveMutation.isPending,
    
    // Error states
    error: availability.error,
    saveError: saveMutation.error,
    
    // Mutation functions
    saveAvailability,
    
    // Direct mutation function (for object-style usage)
    _saveAvailabilityMutation: saveMutation.mutateAsync,
    
    // Refetch function
    refetchAvailability: availability.refetch,
    
    // Success state
    isSaveSuccess: saveMutation.isSuccess,
  };
};
