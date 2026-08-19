// hooks/useNewDoctorApi.ts
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import {
  Doctor,
  DoctorsResponse,
  CreateDoctorData,
  UpdateDoctorData,
  UpdateDoctorStatus,
  DoctorListFilters
} from '@/types/doctorNew';
import { useMemo } from 'react';
import { NextAvailableSlotResponse, SlotsResponse } from '@/types/appointment';
import { apiUrl, fetchWithAuth } from '@/lib/api';

// Base API functions with hospital context
const doctorApiFunctions = {
  // Fetch doctors for a specific hospital
  fetchHospitalDoctors: async (
    hospitalId: string,
    filters?: DoctorListFilters
  ): Promise<DoctorsResponse & { pagination?: any }> => {
    const params = new URLSearchParams();
    if (filters?.search) params.append('search', filters.search);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.specialization) params.append('specialization', filters.specialization);
    if (filters?.joinedFrom) params.append('joinedFrom', filters.joinedFrom);
    if (filters?.joinedTo) params.append('joinedTo', filters.joinedTo);
    if (filters?.sortBy) params.append('sortBy', filters.sortBy);
    if (filters?.sortOrder) params.append('sortOrder', filters.sortOrder);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const url = `${apiUrl(`/hospitals/${hospitalId}/doctors`)}${params.toString() ? `?${params.toString()}` : ''}`;

    const response = await fetchWithAuth(url, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    // Transform the API response to match our Doctor type
    return {
      doctors: data.doctors || [],
      filters: data.filters || { specializations: [], statuses: [] },
      total: data.total || 0,
      hospitalId: data.hospitalId,
      pagination: data.pagination
    };
  },

  // Fetch single doctor profile
  fetchDoctor: async (hospitalId: string, doctorId: string): Promise<{ doctor: Doctor }> => {
    const response = await fetchWithAuth(apiUrl(`/hospitals/${hospitalId}/doctors/${doctorId}`), {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    data.hospitalId = hospitalId;
    return {
      doctor: data as Doctor,
    };
  },

  // Create doctor in hospital
  createDoctor: async (hospitalId: string, doctorData: CreateDoctorData): Promise<{ success: boolean; doctor: Doctor }> => {
    const response = await fetchWithAuth(apiUrl(`/hospitals/${hospitalId}/doctors`), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(doctorData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  },

  // Update doctor profile
  updateDoctor: async (hospitalId: string, doctorId: string, updates: UpdateDoctorData): Promise<{ success: boolean }> => {
    const response = await fetchWithAuth(apiUrl(`/hospitals/${hospitalId}/doctors/${doctorId}`), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  },

  // Delete doctor (soft delete)
  deleteDoctor: async (hospitalId: string, doctorId: string): Promise<{ success: boolean }> => {
    const response = await fetchWithAuth(apiUrl(`/hospitals/${hospitalId}/doctors/${doctorId}`), {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  },

  // Update doctor status (approve/reject membership)
  updateDoctorMembership: async (hospitalId: string, doctorId: string, doctorStatus: UpdateDoctorStatus): Promise<{ success: boolean }> => {
    const response = await fetchWithAuth(apiUrl(`/hospitals/${hospitalId}/doctors/${doctorId}/status`), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: doctorStatus.status }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  },

  // Fetch current doctor profile by userId
  fetchCurrentDoctorProfile: async (hospitalId: string, userId: string): Promise<{ doctor: Doctor | null }> => {
    const response = await fetchWithAuth(apiUrl(`/hospitals/${hospitalId}/doctors/profile/${userId}`), {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return { doctor: null };
      }
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    // API returns the doctor profile directly, not wrapped in a doctor property
    return {
      doctor: data as Doctor,
    };
  },
};

// TanStack Query keys with hospital context
export const doctorKeys = {
  all: ['doctors'] as const,
  hospital: (hospitalId: string) => [...doctorKeys.all, 'hospital', hospitalId] as const,
  hospitalList: (hospitalId: string, filters?: any) => [...doctorKeys.hospital(hospitalId), 'list', { filters }] as const,
  hospitalDetail: (hospitalId: string, doctorId: string) => [...doctorKeys.hospital(hospitalId), 'detail', doctorId] as const,
  currentProfile: (hospitalId: string, userId: string) => [...doctorKeys.hospital(hospitalId), 'current-profile', userId] as const,
  filters: (hospitalId: string) => [...doctorKeys.hospital(hospitalId), 'filters'] as const,
};

// React Query hooks

// Hook for hospital doctors list
export const useHospitalDoctors = (
  hospitalId?: string,
  filters?: DoctorListFilters,
  enabled: boolean = true
) => {
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useQuery({
    queryKey: doctorKeys.hospitalList(actualHospitalId, filters),
    queryFn: () => doctorApiFunctions.fetchHospitalDoctors(actualHospitalId, filters),
    enabled: !!actualHospitalId && enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    select: (data) => ({
      ...data,
      doctors: data.doctors || [],
    }),
  });
};

export const getDoctorById = async (hospitalId: string, doctorId: string): Promise<Doctor> => {
  const { doctor } = await doctorApiFunctions.fetchDoctor(hospitalId, doctorId);
  return doctor;
};

// Hook for single doctor
export const useHospitalDoctor = (doctorId: string, hospitalId?: string) => {
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useQuery({
    queryKey: doctorKeys.hospitalDetail(actualHospitalId, doctorId),
    queryFn: () => doctorApiFunctions.fetchDoctor(actualHospitalId, doctorId),
    enabled: !!actualHospitalId && !!doctorId,
    staleTime: 5 * 60 * 1000,
  });
};

// Hook for creating doctor
export const useUpdateDoctorMembership = (hospitalId?: string) => {
  const queryClient = useQueryClient();
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);
  
  return useMutation({
    mutationFn: ({doctorId, updates}: {doctorId: string; updates: UpdateDoctorStatus}) => 
      doctorApiFunctions.updateDoctorMembership(actualHospitalId, doctorId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: doctorKeys.hospital(actualHospitalId) 
      });
    },
  });
};

export const useCreateHospitalDoctor = (hospitalId?: string) => {
  const queryClient = useQueryClient();
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useMutation({
    mutationFn: (doctorData: CreateDoctorData) => 
      doctorApiFunctions.createDoctor(actualHospitalId, doctorData),
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: doctorKeys.hospital(actualHospitalId) 
      });
    },
  });
};

// Hook for updating doctor
export const useUpdateHospitalDoctor = (hospitalId?: string) => {
  const queryClient = useQueryClient();
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useMutation({
    mutationFn: ({ doctorId, updates }: { doctorId: string; updates: UpdateDoctorData }) =>
      doctorApiFunctions.updateDoctor(actualHospitalId, doctorId, updates),
    onSuccess: (_, variables) => {
      // Update specific doctor cache
      queryClient.invalidateQueries({ 
        queryKey: doctorKeys.hospitalDetail(actualHospitalId, variables.doctorId) 
      });
      // Invalidate list
      queryClient.invalidateQueries({ 
        queryKey: doctorKeys.hospital(actualHospitalId) 
      });
    },
  });
};

// Hook for deleting doctor
export const useDeleteHospitalDoctor = (hospitalId?: string) => {
  const queryClient = useQueryClient();
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useMutation({
    mutationFn: (doctorId: string) =>
      doctorApiFunctions.deleteDoctor(actualHospitalId, doctorId),
    onSuccess: (_, doctorId) => {
      // Remove from cache
      queryClient.removeQueries({ 
        queryKey: doctorKeys.hospitalDetail(actualHospitalId, doctorId) 
      });
      // Invalidate list
      queryClient.invalidateQueries({ 
        queryKey: doctorKeys.hospital(actualHospitalId) 
      });
    },
  });
};

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

  fetchNextAvailableSlots: async (hospitalId: string, doctorId: string, date: string, preferredTime?: string): Promise<NextAvailableSlotResponse> => {
    const params = new URLSearchParams({ date });
    if (preferredTime) params.append('preferredTime', preferredTime);

    const response = await fetchWithAuth(
      `${apiUrl(`/hospitals/${hospitalId}/doctors/${doctorId}/next-availability`)}?${params}`
    );
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch available slots');
    }

    return response.json();
  },
};

export const doctorSlotsKeys = {
  all: ['doctor-slots'] as const,
  hospital: (hospitalId: string) => [...doctorSlotsKeys.all, 'hospital', hospitalId] as const,
  doctor: (hospitalId: string, doctorId: string) => 
    [...doctorSlotsKeys.hospital(hospitalId), 'doctor', doctorId] as const,
  date: (hospitalId: string, doctorId: string, date: string) => 
    [...doctorSlotsKeys.doctor(hospitalId, doctorId), 'date', date] as const,
  workingHours: (hospitalId: string, doctorId: string) => 
    [...doctorSlotsKeys.doctor(hospitalId, doctorId), 'working-hours'] as const,
};


// Hook for fetch doctor slots
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

// Main hook that combines everything
export interface UseDoctorApiReturn {
  // Query states
  doctors: Doctor[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  filters?: {
    specializations: string[];
    statuses: string[];
  };
  total: number;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  
  // Mutation functions
  deleteDoctor: (doctorId: string) => Promise<void>;
  updateDoctor: (doctorId: string, updates: UpdateDoctorData) => Promise<void>;
  createDoctor: (doctorData: CreateDoctorData) => Promise<{ success: boolean; doctor: Doctor }>;
  updateDoctorMembership: (doctorId: string, status: UpdateDoctorStatus) => Promise<void>;
  
  // Mutation states
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  isUpdatingMembership: boolean;
  
  // Utility functions
  refetchDoctors: () => Promise<void>;
  invalidateDoctors: () => void;
}

export function useNewDoctorApi(
  hospitalId?: string,
  filters?: DoctorListFilters,
  enabled: boolean = true
): UseDoctorApiReturn {
  const queryClient = useQueryClient();
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  // Query for doctors list
  const {
    data: doctorsData,
    isLoading,
    isError,
    error,
    refetch,
  } = useHospitalDoctors(actualHospitalId, filters, enabled);

  // Mutations
  const createMutation = useCreateHospitalDoctor(actualHospitalId);
  const updateMutation = useUpdateHospitalDoctor(actualHospitalId);
  const deleteMutation = useDeleteHospitalDoctor(actualHospitalId);
  const updateMembershipMutation = useUpdateDoctorMembership(actualHospitalId);

  return {
    // Query data
    doctors: doctorsData?.doctors || [],
    filters: doctorsData?.filters,
    total: doctorsData?.total || 0,
    pagination: doctorsData?.pagination,
    isLoading,
    isError,
    error,
    
    // Mutation functions
    deleteDoctor: async (doctorId: string) => {
      await deleteMutation.mutateAsync(doctorId);
    },
    updateDoctor: async (doctorId: string, updates: UpdateDoctorData) => {
      await updateMutation.mutateAsync({ doctorId, updates });
    },
    createDoctor: async (doctorData: CreateDoctorData) => {
      return await createMutation.mutateAsync(doctorData);
    },
    updateDoctorMembership: async (doctorId: string, updates: UpdateDoctorStatus) => {
      await updateMembershipMutation.mutateAsync({ doctorId, updates });
    },
    
    // Mutation states
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isUpdatingMembership: updateMembershipMutation.isPending,
    
    // Utility functions
    refetchDoctors: async () => {
      await refetch();
    },
    invalidateDoctors: () => {
      queryClient.invalidateQueries({ 
        queryKey: doctorKeys.hospital(actualHospitalId) 
      });
    },
  };
}

// Specialized hooks for common use cases

// Hook for pending doctors (for admin approval)
export const usePendingDoctors = (hospitalId?: string) => {
  return useHospitalDoctors(hospitalId, { status: 'pending' });
};

// Hook for active doctors
export const useActiveDoctors = (hospitalId?: string) => {
  return useHospitalDoctors(hospitalId, { status: 'active' });
};

// Hook for doctor by specialization
export const useDoctorsBySpecialization = (hospitalId: string, specialization: string) => {
  return useHospitalDoctors(hospitalId, { specialization });
};

// Hook for doctor filters
export const useDoctorFilters = (hospitalId?: string) => {
  const { data } = useHospitalDoctors(hospitalId, {}, false);
  
  return {
    specializations: data?.filters?.specializations || [],
    statuses: data?.filters?.statuses || [],
  };
};

// Optimistic updates for better UX
export const useOptimisticDoctorMutations = (hospitalId?: string) => {
  const queryClient = useQueryClient();
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  const optimisticUpdateStatus = useMutation({
    mutationFn: ({ doctorId, status }: { doctorId: string; status: Doctor['status'] }) => {
      return doctorApiFunctions.updateDoctor(actualHospitalId, doctorId, { status });
    },
    onMutate: async ({ doctorId, status }) => {
      await queryClient.cancelQueries({ 
        queryKey: doctorKeys.hospital(actualHospitalId) 
      });

      const previousDoctors = queryClient.getQueryData(
        doctorKeys.hospitalList(actualHospitalId)
      );

      // Optimistically update the doctor status
      queryClient.setQueryData(
        doctorKeys.hospitalList(actualHospitalId),
        (old: DoctorsResponse | undefined) => {
          if (!old) return old;
          return {
            ...old,
            doctors: old.doctors.map(doctor =>
              doctor.id === doctorId ? { ...doctor, status } : doctor
            ),
          };
        }
      );

      return { previousDoctors };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousDoctors) {
        queryClient.setQueryData(
          doctorKeys.hospitalList(actualHospitalId),
          context.previousDoctors
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ 
        queryKey: doctorKeys.hospital(actualHospitalId) 
      });
    },
  });

  return {
    optimisticUpdateStatus: optimisticUpdateStatus.mutateAsync,
    isOptimisticUpdating: optimisticUpdateStatus.isPending,
  };
};

// Hook for current doctor profile
export const useCurrentDoctorProfile = (userId?: string, hospitalId?: string) => {
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useQuery({
    queryKey: doctorKeys.currentProfile(actualHospitalId, userId || ''),
    queryFn: () => doctorApiFunctions.fetchCurrentDoctorProfile(actualHospitalId, userId || ''),
    enabled: !!actualHospitalId && !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    select: (data) => data.doctor,
  });
};

// Hook for doctor search
export const useDoctorSearch = (
  hospitalId: string, 
  searchTerm: string,
  filters?: { status?: string; specialization?: string }
) => {
  const { data, isLoading, error } = useHospitalDoctors(hospitalId, filters);

  // Memoize the search results for better performance
  const filteredDoctors = useMemo(() => {
    if (!data?.doctors) return [];

    if (!searchTerm.trim()) {
      return data.doctors;
    }

    const lowerSearchTerm = searchTerm.toLowerCase();
    
    return data.doctors.filter((doctor: Doctor) =>
      doctor.name.toLowerCase().includes(lowerSearchTerm) ||
      doctor.specialization.toLowerCase().includes(lowerSearchTerm) ||
      doctor.email.toLowerCase().includes(lowerSearchTerm) ||
      doctor.qualification?.toLowerCase().includes(lowerSearchTerm) ||
      doctor.bio?.toLowerCase().includes(lowerSearchTerm)
    );
  }, [data?.doctors, searchTerm]);

  // Calculate search statistics
  const searchStats = useMemo(() => {
    const totalDoctors = data?.doctors?.length || 0;
    const filteredCount = filteredDoctors.length;
    
    return {
      totalDoctors,
      filteredCount,
      hasResults: filteredCount > 0,
      hasSearchTerm: searchTerm.trim().length > 0,
      isFiltered: filteredCount !== totalDoctors,
    };
  }, [data?.doctors?.length, filteredDoctors.length, searchTerm]);

  return {
    doctors: filteredDoctors,
    isLoading,
    error,
    total: filteredDoctors.length,
    searchStats,
    allDoctors: data?.doctors || [],
  };
};