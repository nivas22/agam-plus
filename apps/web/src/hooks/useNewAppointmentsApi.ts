// hooks/useNewAppointmentsApi.ts
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { AppointmentFormData, AppointmentResponse, AppointmentWithDetails } from '@/types/appointment';
import { apiUrl, fetchWithAuth } from '@/lib/api';
import { APPOINTMENT_STATUS, ACTIVE_APPOINTMENT_STATUSES } from '@agam-plus/shared';

// Base API functions with hospital context
const appointmentsApiFunctions = {
  // Fetch appointments for a specific hospital
  fetchHospitalAppointments: async (
    hospitalId: string, 
    params: URLSearchParams, 
    userRole: string
  ): Promise<AppointmentResponse> => {
    const endpoint = apiUrl(`/hospitals/${hospitalId}/appointments`);
    const response = await fetchWithAuth(`${endpoint}?${params.toString()}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! while fetching appointments for ${userRole} status: ${response.status}`);
    }
    
    return response.json();
  },

  // Delete appointment in hospital context
  deleteHospitalAppointment: async (
    hospitalId: string, 
    appointmentId: string, 
    canEdit: boolean
  ): Promise<void> => {
    if (!canEdit) throw new Error("Unauthorized: User does not have edit permissions");
    
    const response = await fetchWithAuth(apiUrl(`/hospitals/${hospitalId}/appointments/${appointmentId}`), {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
  },

  // Update appointment status in hospital context
  updateHospitalAppointmentStatus: async (
    hospitalId: string,
    appointmentId: string,
    status: string,
    sessionNotes?: string,
    appointmentData?: Partial<AppointmentWithDetails>
  ): Promise<void> => {
    const response = await fetchWithAuth(apiUrl(`/hospitals/${hospitalId}/appointments`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appointmentId, status, sessionNotes, appointmentData }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update appointment');
    }
  },

  // Add appointment in hospital context
  addHospitalAppointment: async (
    hospitalId: string,
    appointmentData: Partial<AppointmentFormData>
  ): Promise<AppointmentWithDetails> => {
    const response = await fetchWithAuth(apiUrl(`/hospitals/${hospitalId}/appointments`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(appointmentData),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create appointment');
    }
    
    return response.json();
  },

  // Search appointments in hospital
  searchHospitalAppointments: async (
    hospitalId: string,
    searchTerm: string,
    userRole: string
  ): Promise<{ appointments: AppointmentWithDetails[]; total: number }> => {
    const endpoint = userRole === 'admin'
      ? apiUrl(`/hospitals/${hospitalId}/appointments/search`)
      : apiUrl(`/hospitals/${hospitalId}/doctor/appointments/search`);

    const response = await fetchWithAuth(`${endpoint}?q=${encodeURIComponent(searchTerm)}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  },
};

// TanStack Query keys with hospital context
export const appointmentsKeys = {
  all: ['appointments'] as const,
  hospital: (hospitalId: string) => [...appointmentsKeys.all, 'hospital', hospitalId] as const,
  hospitalList: (hospitalId: string, filters?: any) => 
    [...appointmentsKeys.hospital(hospitalId), 'list', { filters }] as const,
  hospitalDetail: (hospitalId: string, appointmentId: string) => 
    [...appointmentsKeys.hospital(hospitalId), 'detail', appointmentId] as const,
  hospitalSearch: (hospitalId: string, searchTerm: string) => 
    [...appointmentsKeys.hospital(hospitalId), 'search', searchTerm] as const,
  upcoming: (hospitalId: string) => [...appointmentsKeys.hospital(hospitalId), 'upcoming'] as const,
  today: (hospitalId: string) => [...appointmentsKeys.hospital(hospitalId), 'today'] as const,
};

// Individual query hooks with hospital context
export const useHospitalAppointments = (
  hospitalId?: string,
  params?: URLSearchParams,
  userRole: string = 'admin'
) => {
  const queryParams = useParams();
  const actualHospitalId = hospitalId || (queryParams.id as string);
  const queryParamsObj = params ? Object.fromEntries(params.entries()) : {};
  
  return useQuery({
    queryKey: appointmentsKeys.hospitalList(actualHospitalId, { userRole, ...queryParamsObj }),
    queryFn: () => appointmentsApiFunctions.fetchHospitalAppointments(
      actualHospitalId, 
      params || new URLSearchParams(), 
      userRole
    ),
    staleTime: 2 * 60 * 1000,
    enabled: !!actualHospitalId && !!userRole,
    select: (data) => ({
      ...data,
      appointments: data.appointments || [],
    }),
  });
};

export const useTodayHospitalAppointments = (hospitalId?: string, userRole: string = 'admin') => {
  const queryParams = useParams();
  const actualHospitalId = hospitalId || (queryParams.id as string);
  const today = new Date().toISOString().split("T")[0];

  const params = new URLSearchParams();
  params.append("startDate", today);
  params.append("endDate", today);

  return useQuery({
    queryKey: appointmentsKeys.today(actualHospitalId),
    queryFn: () => appointmentsApiFunctions.fetchHospitalAppointments(
      actualHospitalId, 
      params, 
      userRole
    ),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    enabled: !!actualHospitalId && !!userRole,
    select: (data) => ({
      ...data,
      appointments: data.appointments || [],
    }),
  });
};

export const useUpcomingHospitalAppointments = (
  hospitalId?: string, 
  userRole: string = 'admin',
  limit?: number
) => {
  const queryParams = useParams();
  const actualHospitalId = hospitalId || (queryParams.id as string);

  const params = new URLSearchParams();
  params.append('status', 'upcoming');
  if (limit) params.append('limit', limit.toString());
  
  return useQuery({
    queryKey: appointmentsKeys.upcoming(actualHospitalId),
    queryFn: () => appointmentsApiFunctions.fetchHospitalAppointments(
      actualHospitalId, 
      params, 
      userRole
    ),
    staleTime: 1 * 60 * 1000,
    enabled: !!actualHospitalId && !!userRole,
    select: (data) => ({
      ...data,
      appointments: data.appointments || [],
    }),
  });
};

// Search hook
export const useSearchHospitalAppointments = (
  hospitalId?: string, 
  searchTerm?: string, 
  userRole: string = 'admin'
) => {
  const queryParams = useParams();
  const actualHospitalId = hospitalId || (queryParams.id as string);

  return useQuery({
    queryKey: appointmentsKeys.hospitalSearch(actualHospitalId, searchTerm || ''),
    queryFn: () => appointmentsApiFunctions.searchHospitalAppointments(
      actualHospitalId, 
      searchTerm || '', 
      userRole
    ),
    enabled: !!actualHospitalId && !!searchTerm && searchTerm.length >= 2,
    staleTime: 1 * 60 * 1000,
  });
};

// Mutation hooks with hospital context
export const useDeleteHospitalAppointment = (hospitalId?: string, canEdit: boolean = false) => {
  const queryClient = useQueryClient();
  const queryParams = useParams();
  const actualHospitalId = hospitalId || (queryParams.id as string);

  return useMutation({
    mutationFn: (appointmentId: string) => 
      appointmentsApiFunctions.deleteHospitalAppointment(actualHospitalId, appointmentId, canEdit),
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: appointmentsKeys.hospital(actualHospitalId) 
      });
    },
  });
};

export const useUpdateHospitalAppointmentStatus = (hospitalId?: string) => {
  const queryClient = useQueryClient();
  const queryParams = useParams();
  const actualHospitalId = hospitalId || (queryParams.id as string);

  return useMutation({
    mutationFn: (variables: {
      appointmentId: string;
      status: string;
      sessionNotes?: string;
      appointmentData?: Partial<AppointmentWithDetails>;
    }) => appointmentsApiFunctions.updateHospitalAppointmentStatus(
      actualHospitalId,
      variables.appointmentId, 
      variables.status, 
      variables.sessionNotes, 
      variables.appointmentData
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: appointmentsKeys.hospital(actualHospitalId) 
      });
    },
  });
};

export const useAddHospitalAppointment = (hospitalId?: string) => {
  const queryClient = useQueryClient();
  const queryParams = useParams();
  const actualHospitalId = hospitalId || (queryParams.id as string);

  return useMutation({
    mutationFn: (appointmentData: Partial<AppointmentWithDetails>) => 
      appointmentsApiFunctions.addHospitalAppointment(actualHospitalId, appointmentData),
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: appointmentsKeys.hospital(actualHospitalId) 
      });
    },
  });
};

// Main convenience hook with hospital support
export interface UseHospitalAppointmentsApiReturn {
  // Query data
  appointments: AppointmentWithDetails[];
  todayAppointments: AppointmentWithDetails[];
  upcomingAppointments: AppointmentWithDetails[];
  
  // Loading states
  isLoading: boolean;
  isTodayLoading: boolean;
  isUpcomingLoading: boolean;
  
  // Error states
  error: Error | null;
  todayError: Error | null;
  upcomingError: Error | null;
  
  // Mutation functions
  deleteAppointment: (appointmentId: string) => Promise<void>;
  updateAppointmentStatus: (
    appointmentId: string,
    status: string,
    sessionNotes?: string,
    appointmentData?: Partial<AppointmentWithDetails>
  ) => Promise<void>;
  addAppointment: (appointmentData: Partial<AppointmentFormData>) => Promise<AppointmentWithDetails>;
  
  // Mutation states
  isDeleting: boolean;
  isUpdatingStatus: boolean;
  isAdding: boolean;
  
  // Utility functions
  refetchAppointments: () => Promise<void>;
  refetchTodayAppointments: () => Promise<void>;
  refetchUpcomingAppointments: () => Promise<void>;
  invalidateAppointments: () => void;
}

export function useHospitalAppointmentsApi(
  hospitalId?: string,
  userRole: string = 'admin',
  canEdit: boolean = false,
  params?: URLSearchParams,
): UseHospitalAppointmentsApiReturn {
  const queryClient = useQueryClient();
  const queryParams = useParams();
  const actualHospitalId = hospitalId || (queryParams.id as string);

  // Queries
  const {
    data: appointmentData,
    isLoading: appointmentLoading,
    error: appointmentErrorMessage,
    refetch
} = useHospitalAppointments(actualHospitalId, params, userRole);

 const {
    data: todayAppointmentsData,
    isLoading: isTodayLoading,
    error: todayError,
    refetch: refetchTodayAppointments
} = useTodayHospitalAppointments(actualHospitalId, userRole);

//   const todayAppointments = useTodayHospitalAppointments(actualHospitalId, userRole);
  const {
    data: upcomingAppointmentsData,
    isLoading: isUpcomingLoading,
    error: upcomingError,
    refetch: refetchUpcomingAppointments
} =  useUpcomingHospitalAppointments(actualHospitalId, userRole, 10);

  // Mutations
  const deleteMutation = useDeleteHospitalAppointment(actualHospitalId, canEdit);
  const updateStatusMutation = useUpdateHospitalAppointmentStatus(actualHospitalId);
  const addAppointmentMutation = useAddHospitalAppointment(actualHospitalId);

  // Wrapper function for individual parameters
  const updateAppointmentStatus = async (
    appointmentId: string,
    status: string,
    sessionNotes?: string,
    appointmentData?: Partial<AppointmentWithDetails>
  ) => {
    return updateStatusMutation.mutateAsync({
      appointmentId,
      status,
      sessionNotes,
      appointmentData
    });
  };

  return {
    // Query data
    appointments: appointmentData?.appointments || [],
    todayAppointments: todayAppointmentsData?.appointments || [],
    upcomingAppointments: upcomingAppointmentsData?.appointments || [],
    
    // Loading states
    isLoading: appointmentLoading,
    isTodayLoading: isTodayLoading,
    isUpcomingLoading: isUpcomingLoading,
    
    // Error states
    error: appointmentErrorMessage,
    todayError: todayError,
    upcomingError: upcomingError,
    
    // Mutation functions
    deleteAppointment: deleteMutation.mutateAsync,
    updateAppointmentStatus,
    addAppointment: addAppointmentMutation.mutateAsync,
    
    // Mutation states
    isDeleting: deleteMutation.isPending,
    isUpdatingStatus: updateStatusMutation.isPending,
    isAdding: addAppointmentMutation.isPending,
    
    // Utility functions
    refetchAppointments: async () => {
      await refetch();
    },

    refetchTodayAppointments: async () => {
      await refetchTodayAppointments();
    },

    refetchUpcomingAppointments: async () => {
      await refetchUpcomingAppointments();
    },

    invalidateAppointments: () => {
        queryClient.invalidateQueries({ 
        queryKey: appointmentsKeys.hospital(actualHospitalId) 
        });
    },

  };
}

// Specialized hooks for common use cases

// Hook for doctor's appointments in hospital
export const useDoctorHospitalAppointments = (
  hospitalId: string, 
  doctorId: string, 
  userRole: string = 'doctor'
) => {
  const params = new URLSearchParams();
  params.append('doctorId', doctorId);
  
  return useHospitalAppointments(hospitalId, params, userRole);
};

// Hook for patient's appointments in hospital
export const usePatientHospitalAppointments = (
  hospitalId: string, 
  patientId: string
) => {
  const params = new URLSearchParams();
  params.append('patientId', patientId);
  
  return useHospitalAppointments(hospitalId, params, 'admin');
};

// Hook for appointment statistics
export const useHospitalAppointmentStats = (hospitalId?: string, userRole: string = 'admin') => {
  const { data, isLoading, error } = useHospitalAppointments(hospitalId, undefined, userRole);

  const appointments = data?.appointments ?? [];
  const activeStatuses: string[] = [...ACTIVE_APPOINTMENT_STATUSES, 'scheduled'];
  const stats = {
    total: appointments?.length || 0,
    upcoming: appointments?.filter((a: AppointmentWithDetails) => activeStatuses.includes(a.status)).length || 0,
    completed: appointments?.filter((a: AppointmentWithDetails) => a.status === APPOINTMENT_STATUS.COMPLETED).length || 0,
    cancelled: appointments?.filter((a: AppointmentWithDetails) => a.status === APPOINTMENT_STATUS.CANCELLED).length || 0,
    today: appointments?.filter((a: AppointmentWithDetails) => {
      const appointmentDate = new Date(a.date).toDateString();
      const today = new Date().toDateString();
      return appointmentDate === today;
    }).length || 0,
  };

  return {
    stats,
    isLoading,
    error,
  };
};

// Optimistic updates for better UX
export const useOptimisticHospitalAppointmentMutations = (hospitalId?: string) => {
  const queryClient = useQueryClient();
  const queryParams = useParams();
  const actualHospitalId = hospitalId || (queryParams.id as string);

  const optimisticUpdateAppointment = useMutation({
    mutationFn: ({ appointmentId, updates }: { 
      appointmentId: string; 
      updates: Partial<AppointmentWithDetails> 
    }) => {
      return appointmentsApiFunctions.updateHospitalAppointmentStatus(
        actualHospitalId,
        appointmentId,
        updates.status || '',
        updates.sessionNotes,
        updates
      );
    },
    onMutate: async ({ appointmentId, updates }) => {
      await queryClient.cancelQueries({ 
        queryKey: appointmentsKeys.hospital(actualHospitalId) 
      });

      const previousAppointments = queryClient.getQueryData(
        appointmentsKeys.hospitalList(actualHospitalId)
      );

      // Optimistically update the appointment
      queryClient.setQueryData(
        appointmentsKeys.hospitalList(actualHospitalId),
        (old: AppointmentWithDetails[] | undefined) => {
          if (!old) return old;
          return old.map(appointment =>
            appointment.id === appointmentId ? { ...appointment, ...updates } : appointment
          );
        }
      );

      return { previousAppointments };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousAppointments) {
        queryClient.setQueryData(
          appointmentsKeys.hospitalList(actualHospitalId),
          context.previousAppointments
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ 
        queryKey: appointmentsKeys.hospital(actualHospitalId) 
      });
    },
  });

  const optimisticDeleteAppointment = useMutation({
    mutationFn: (appointmentId: string) => {
      return appointmentsApiFunctions.deleteHospitalAppointment(actualHospitalId, appointmentId, true);
    },
    onMutate: async (appointmentId) => {
      await queryClient.cancelQueries({ 
        queryKey: appointmentsKeys.hospital(actualHospitalId) 
      });

      const previousAppointments = queryClient.getQueryData(
        appointmentsKeys.hospitalList(actualHospitalId)
      );

      // Optimistically remove the appointment
      queryClient.setQueryData(
        appointmentsKeys.hospitalList(actualHospitalId),
        (old: AppointmentWithDetails[] | undefined) => {
          if (!old) return old;
          return old.filter(appointment => appointment.id !== appointmentId);
        }
      );

      return { previousAppointments };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousAppointments) {
        queryClient.setQueryData(
          appointmentsKeys.hospitalList(actualHospitalId),
          context.previousAppointments
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ 
        queryKey: appointmentsKeys.hospital(actualHospitalId) 
      });
    },
  });

  return {
    optimisticUpdateAppointment: optimisticUpdateAppointment.mutateAsync,
    optimisticDeleteAppointment: optimisticDeleteAppointment.mutateAsync,
    isOptimisticUpdating: optimisticUpdateAppointment.isPending,
    isOptimisticDeleting: optimisticDeleteAppointment.isPending,
  };
};
