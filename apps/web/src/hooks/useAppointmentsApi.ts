// Simplified hooks only - no context provider needed
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppointmentResponse, AppointmentWithDetails } from '@/types/appointment';
import { apiUrl, fetchWithAuth } from '@/lib/api';

// Base API functions
const appointmentsApiFunctions = {
  fetchAppointments: async (params: URLSearchParams, userRole: string): Promise<AppointmentWithDetails[]> => {
    const endpoint = userRole === 'admin' ? apiUrl('/appointments') : apiUrl('/doctor/appointments');
    const response = await fetchWithAuth(`${endpoint}?${params.toString()}`);
    
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const result = await response.json() as AppointmentResponse;
    return result.appointments || [];
  },

  deleteAppointment: async (id: string, canEdit: boolean): Promise<void> => {
    if (!canEdit) throw new Error("Unauthorized: User does not have edit permissions");
    
    const response = await fetchWithAuth(apiUrl(`/appointment/${id}`), { method: 'DELETE' });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  },

  updateAppointmentStatus: async (
    appointmentId: string,
    status: string,
    sessionNotes?: string,
    appointmentData?: Partial<AppointmentWithDetails>
  ): Promise<void> => {
    const response = await fetchWithAuth(apiUrl('/appointments'), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appointmentId, status, sessionNotes, appointmentData }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update appointment');
    }
  },

  addAppointment: async (appointmentData: Partial<AppointmentWithDetails>): Promise<AppointmentWithDetails> => {
    const response = await fetchWithAuth(apiUrl('/appointments'), {
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
};

// TanStack Query keys
export const appointmentsKeys = {
  all: ['appointments'] as const,
  lists: () => [...appointmentsKeys.all, 'list'] as const,
  list: (filters: any) => [...appointmentsKeys.lists(), { filters }] as const,
  upcoming: () => [...appointmentsKeys.all, 'upcoming'] as const,
  today: () => [...appointmentsKeys.all, 'today'] as const,
};

// Individual query hooks
export const useAppointments = (userRole: string, params?: URLSearchParams) => {
  const queryParams = params ? Object.fromEntries(params.entries()) : {};
  
  return useQuery({
    queryKey: appointmentsKeys.list({ userRole, ...queryParams }),
    queryFn: () => appointmentsApiFunctions.fetchAppointments(params || new URLSearchParams(), userRole),
    staleTime: 2 * 60 * 1000,
    enabled: !!userRole,
  });
};

export const useTodayAppointments = (userRole: string) => {
  const today = new Date().toISOString().split("T")[0]; // e.g. "2025-09-29"

  const params = new URLSearchParams();
  params.append("startDate", today);
  params.append("endDate", today);

  return useQuery({
    queryKey: appointmentsKeys.today(),
    queryFn: () => appointmentsApiFunctions.fetchAppointments(params, userRole),
    staleTime: 30 * 1000,  // 30 seconds
    refetchInterval: 60 * 1000,  // 1 minute
  });
};

export const useUpcomingAppointments = (userRole: string, limit?: number) => {
  const params = new URLSearchParams();
  params.append('status', 'upcoming');
  if (limit) params.append('limit', limit.toString());
  
  return useQuery({
    queryKey: appointmentsKeys.upcoming(),
    queryFn: () => appointmentsApiFunctions.fetchAppointments(params, userRole),
    staleTime: 1 * 60 * 1000,
  });
};

// Mutation hooks
export const useDeleteAppointment = (canEdit: boolean) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => appointmentsApiFunctions.deleteAppointment(id, canEdit),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: appointmentsKeys.all });
    },
  });
};

// CORRECTED: Mutation function accepts a single object parameter
export const useUpdateAppointmentStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: {
      appointmentId: string;
      status: string;
      sessionNotes?: string;
      appointmentData?: Partial<AppointmentWithDetails>;
    }) => appointmentsApiFunctions.updateAppointmentStatus(
      variables.appointmentId, 
      variables.status, 
      variables.sessionNotes, 
      variables.appointmentData
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: appointmentsKeys.all });
    },
  });
};

export const useAddAppointment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (appointmentData: Partial<AppointmentWithDetails>) => 
      appointmentsApiFunctions.addAppointment(appointmentData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: appointmentsKeys.all });
    },
  });
};

// Main convenience hook (optional) - CORRECTED VERSION
export const useAppointmentsApi = (userRole: string, canEdit: boolean) => {
  const appointments = useAppointments(userRole);
  const todayAppointments = useTodayAppointments(userRole);
  const upcomingAppointments = useUpcomingAppointments(userRole, 10);
  const deleteMutation = useDeleteAppointment(canEdit);
  const updateStatusMutation = useUpdateAppointmentStatus();
  const addAppointmentMutation = useAddAppointment();

  // Create wrapper function that accepts individual parameters
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
    // Queries
    appointments: appointments.data || [],
    todayAppointments: todayAppointments.data || [],
    upcomingAppointments: upcomingAppointments.data || [],
    
    // Loading states
    isLoading: appointments.isLoading,
    isTodayLoading: todayAppointments.isLoading,
    isUpcomingLoading: upcomingAppointments.isLoading,
    
    // Error states
    error: appointments.error,
    todayError: todayAppointments.error,
    upcomingError: upcomingAppointments.error,
    
    // Mutations
    deleteAppointment: deleteMutation.mutateAsync,
    updateAppointmentStatus, // Use the wrapper function
    addAppointment: addAppointmentMutation.mutateAsync,
    
    // Direct mutation functions (for object-style usage)
    _updateAppointmentStatusMutation: updateStatusMutation.mutateAsync,
    
    // Mutation states
    isDeleting: deleteMutation.isPending,
    isUpdatingStatus: updateStatusMutation.isPending,
    isAdding: addAppointmentMutation.isPending,
    
    // Refetch functions
    refetchAppointments: appointments.refetch,
    refetchTodayAppointments: todayAppointments.refetch,
    refetchUpcomingAppointments: upcomingAppointments.refetch,
  };
};

// Alternative: Enhanced hook with both calling patterns
export const useEnhancedAppointmentsApi = (userRole: string, canEdit: boolean) => {
  const appointments = useAppointments(userRole);
  const todayAppointments = useTodayAppointments(userRole);
  const upcomingAppointments = useUpcomingAppointments(userRole, 10);
  const deleteMutation = useDeleteAppointment(canEdit);
  const updateStatusMutation = useUpdateAppointmentStatus();
  const addAppointmentMutation = useAddAppointment();

  // Individual parameters wrapper
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
    // Queries
    appointments: appointments.data || [],
    todayAppointments: todayAppointments.data || [],
    upcomingAppointments: upcomingAppointments.data || [],
    
    // Loading states
    isLoading: appointments.isLoading,
    isTodayLoading: todayAppointments.isLoading,
    isUpcomingLoading: upcomingAppointments.isLoading,
    
    // Error states
    error: appointments.error,
    todayError: todayAppointments.error,
    upcomingError: upcomingAppointments.error,
    
    // Mutation functions
    deleteAppointment: deleteMutation.mutateAsync,
    
    // Individual parameters (your preferred style)
    updateAppointmentStatus,
    
    // Object parameter style
    updateAppointmentStatusWithObject: updateStatusMutation.mutateAsync,
    
    addAppointment: addAppointmentMutation.mutateAsync,
    
    // Mutation states
    isDeleting: deleteMutation.isPending,
    isUpdatingStatus: updateStatusMutation.isPending,
    isAdding: addAppointmentMutation.isPending,
    
    // Refetch functions
    refetchAppointments: appointments.refetch,
    refetchTodayAppointments: todayAppointments.refetch,
    refetchUpcomingAppointments: upcomingAppointments.refetch,
  };
};



// Option 1: Use the convenience hook (recommended)
// typescript
// // In your component
// const { updateAppointmentStatus } = useAppointmentsApi(userRole, canEdit);

// // Now you can call it exactly as you wanted:
// await updateAppointmentStatus(
//   selectedApp.id, 
//   selectedApp.status, 
//   "", 
//   {
//     ...selectedApp,
//     doctorId: selectedDoctorForAppointments.id,
//     doctorName: selectedDoctorForAppointments.name,
//   }
// );
// Option 2: Use the enhanced hook
// typescript
// // In your component
// const { updateAppointmentStatus, updateAppointmentStatusWithObject } = useEnhancedAppointmentsApi(userRole, canEdit);

// // Individual parameters (your current usage)
// await updateAppointmentStatus(
//   selectedApp.id, 
//   selectedApp.status, 
//   "", 
//   {
//     ...selectedApp,
//     doctorId: selectedDoctorForAppointments.id,
//     doctorName: selectedDoctorForAppointments.name,
//   }
// );

// // Or object style
// await updateAppointmentStatusWithObject({
//   appointmentId: selectedApp.id,
//   status: selectedApp.status,
//   sessionNotes: "",
//   appointmentData: {
//     ...selectedApp,
//     doctorId: selectedDoctorForAppointments.id,
//     doctorName: selectedDoctorForAppointments.name,
//   }
// });
// Option 3: Use the individual hook directly
// typescript
// // In your component
// import { useUpdateAppointmentStatus } from '@/hooks/useAppointmentsApi';

// const updateStatusMutation = useUpdateAppointmentStatus();

// // Call it with object parameter
// await updateStatusMutation.mutateAsync({
//   appointmentId: selectedApp.id,
//   status: selectedApp.status,
//   sessionNotes: "",
//   appointmentData: {
//     ...selectedApp,
//     doctorId: selectedDoctorForAppointments.id,
//     doctorName: selectedDoctorForAppointments.name,
//   }
// });