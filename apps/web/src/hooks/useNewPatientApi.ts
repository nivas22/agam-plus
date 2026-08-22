// hooks/useNewPatientApi.ts
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { ApiRequestError, apiUrl, fetchWithAuth } from "@/lib/api";
import type {
  CreatePatientData,
  Patient,
  PatientsResponse,
  UpdatePatientData,
} from "@/types/patientNew";
import { GENDER } from "../constants";

// Base API functions with hospital context
const patientApiFunctions = {
  // Fetch patients for a specific hospital
  fetchHospitalPatients: async (
    hospitalId: string,
    filters?: {
      status?: string;
      gender?: string;
      page?: number;
      limit?: number;
    },
  ): Promise<PatientsResponse & { pagination?: any }> => {
    const params = new URLSearchParams();
    if (filters?.status) params.append("status", filters.status);
    if (filters?.gender) params.append("gender", filters.gender);
    if (filters?.page) params.append("page", filters.page.toString());
    if (filters?.limit) params.append("limit", filters.limit.toString());

    const url = `${apiUrl(`/hospitals/${hospitalId}/patients`)}${params.toString() ? `?${params.toString()}` : ""}`;

    const response = await fetchWithAuth(url, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.error || `HTTP error! status: ${response.status}`,
      );
    }

    return response.json();
  },

  // Fetch single patient
  fetchPatient: async (
    hospitalId: string,
    patientId: string,
  ): Promise<{ patient: Patient }> => {
    const response = await fetchWithAuth(
      apiUrl(`/hospitals/${hospitalId}/patients/${patientId}`),
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.error || `HTTP error! status: ${response.status}`,
      );
    }

    return response.json();
  },

  // Create patient in hospital
  createPatient: async (
    hospitalId: string,
    patientData: CreatePatientData,
  ): Promise<{ success: boolean; patient: Patient }> => {
    const response = await fetchWithAuth(
      apiUrl(`/hospitals/${hospitalId}/patients`),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(patientData),
      },
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new ApiRequestError(
        errorData.error || `HTTP error! status: ${response.status}`,
        errorData.details,
      );
    }

    return response.json();
  },

  // Update patient
  updatePatient: async (
    hospitalId: string,
    patientId: string,
    updates: UpdatePatientData,
  ): Promise<{ success: boolean }> => {
    const response = await fetchWithAuth(
      apiUrl(`/hospitals/${hospitalId}/patients/${patientId}`),
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      },
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.error || `HTTP error! status: ${response.status}`,
      );
    }

    return response.json();
  },

  // Delete patient (soft delete)
  deletePatient: async (
    hospitalId: string,
    patientId: string,
  ): Promise<{ success: boolean }> => {
    const response = await fetchWithAuth(
      apiUrl(`/hospitals/${hospitalId}/patients/${patientId}`),
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.error || `HTTP error! status: ${response.status}`,
      );
    }

    return response.json();
  },

  // Update patient's assigned doctor
  updatePatientDoctor: async (
    hospitalId: string,
    patientId: string,
    doctorId: string,
  ): Promise<{ success: boolean }> => {
    const response = await fetchWithAuth(
      apiUrl(`/hospitals/${hospitalId}/patients/${patientId}/doctor`),
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ assignedDoctorId: doctorId }),
      },
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.error || `HTTP error! status: ${response.status}`,
      );
    }

    return response.json();
  },

  // Search patients
  searchPatients: async (
    hospitalId: string,
    searchTerm: string,
  ): Promise<{ patients: Patient[]; total: number }> => {
    const response = await fetchWithAuth(
      `${apiUrl(`/hospitals/${hospitalId}/patients/search`)}?q=${encodeURIComponent(searchTerm)}`,
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.error || `HTTP error! status: ${response.status}`,
      );
    }

    return response.json();
  },
};

// TanStack Query keys with hospital context
export const patientKeys = {
  all: ["patients"] as const,
  hospital: (hospitalId: string) =>
    [...patientKeys.all, "hospital", hospitalId] as const,
  hospitalList: (hospitalId: string, filters?: any) =>
    [...patientKeys.hospital(hospitalId), "list", { filters }] as const,
  hospitalDetail: (hospitalId: string, patientId: string) =>
    [...patientKeys.hospital(hospitalId), "detail", patientId] as const,
  hospitalSearch: (hospitalId: string, searchTerm: string) =>
    [...patientKeys.hospital(hospitalId), "search", searchTerm] as const,
  filters: (hospitalId: string) =>
    [...patientKeys.hospital(hospitalId), "filters"] as const,
};

// React Query hooks

// Hook for hospital patients list
export const useHospitalPatients = (
  hospitalId?: string,
  filters?: {
    status?: string;
    gender?: string;
    assignedDoctorId?: string;
    page?: number;
    limit?: number;
  },
  enabled: boolean = true,
) => {
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useQuery({
    queryKey: patientKeys.hospitalList(actualHospitalId, filters),
    queryFn: () =>
      patientApiFunctions.fetchHospitalPatients(actualHospitalId, filters),
    enabled: !!actualHospitalId && enabled,
    staleTime: 2 * 60 * 1000, // 2 minutes
    select: (data) => ({
      ...data,
      patients: data.patients || [],
    }),
  });
};

// Hook for single patient
export const useHospitalPatient = (patientId: string, hospitalId?: string) => {
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useQuery({
    queryKey: patientKeys.hospitalDetail(actualHospitalId, patientId),
    queryFn: () =>
      patientApiFunctions.fetchPatient(actualHospitalId, patientId),
    enabled: !!actualHospitalId && !!patientId,
    staleTime: 2 * 60 * 1000,
  });
};

// Hook for creating patient
export const useCreateHospitalPatient = (hospitalId?: string) => {
  const queryClient = useQueryClient();
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useMutation({
    mutationFn: (patientData: CreatePatientData) =>
      patientApiFunctions.createPatient(actualHospitalId, patientData),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: patientKeys.hospital(actualHospitalId),
      });
    },
  });
};

// Hook for updating patient
export const useUpdateHospitalPatient = (hospitalId?: string) => {
  const queryClient = useQueryClient();
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useMutation({
    mutationFn: ({
      patientId,
      updates,
    }: {
      patientId: string;
      updates: UpdatePatientData;
    }) =>
      patientApiFunctions.updatePatient(actualHospitalId, patientId, updates),
    onSuccess: (_, variables) => {
      // Update specific patient cache
      queryClient.invalidateQueries({
        queryKey: patientKeys.hospitalDetail(
          actualHospitalId,
          variables.patientId,
        ),
      });
      // Invalidate list
      queryClient.invalidateQueries({
        queryKey: patientKeys.hospital(actualHospitalId),
      });
    },
  });
};

// Hook for deleting patient
export const useDeleteHospitalPatient = (hospitalId?: string) => {
  const queryClient = useQueryClient();
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useMutation({
    mutationFn: (patientId: string) =>
      patientApiFunctions.deletePatient(actualHospitalId, patientId),
    onSuccess: (_, patientId) => {
      // Remove from cache
      queryClient.removeQueries({
        queryKey: patientKeys.hospitalDetail(actualHospitalId, patientId),
      });
      // Invalidate list
      queryClient.invalidateQueries({
        queryKey: patientKeys.hospital(actualHospitalId),
      });
    },
  });
};

// Hook for updating patient's assigned doctor
export const useUpdatePatientDoctor = (hospitalId?: string) => {
  const queryClient = useQueryClient();
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useMutation({
    mutationFn: ({
      patientId,
      doctorId,
    }: {
      patientId: string;
      doctorId: string;
    }) =>
      patientApiFunctions.updatePatientDoctor(
        actualHospitalId,
        patientId,
        doctorId,
      ),
    onSuccess: (_, variables) => {
      // Update patient cache
      queryClient.invalidateQueries({
        queryKey: patientKeys.hospitalDetail(
          actualHospitalId,
          variables.patientId,
        ),
      });
      // Invalidate list
      queryClient.invalidateQueries({
        queryKey: patientKeys.hospital(actualHospitalId),
      });
    },
  });
};

// Hook for searching patients
export const useSearchHospitalPatients = (
  hospitalId?: string,
  searchTerm?: string,
) => {
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useQuery({
    queryKey: patientKeys.hospitalSearch(actualHospitalId, searchTerm || ""),
    queryFn: () =>
      patientApiFunctions.searchPatients(actualHospitalId, searchTerm || ""),
    enabled: !!actualHospitalId && !!searchTerm && searchTerm.length >= 2,
    staleTime: 1 * 60 * 1000, // 1 minute for search results
  });
};

// Main hook that combines everything
export interface UsePatientApiReturn {
  // Query states
  patients: Patient[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  filters?: {
    statuses: string[];
    genders: string[];
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
  deletePatient: (patientId: string) => Promise<void>;
  updatePatient: (
    patientId: string,
    updates: UpdatePatientData,
  ) => Promise<void>;
  createPatient: (
    patientData: CreatePatientData,
  ) => Promise<{ success: boolean; patient: Patient }>;
  updatePatientDoctor: (patientId: string, doctorId: string) => Promise<void>;

  // Mutation states
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  isUpdatingDoctor: boolean;

  // Utility functions
  refetchPatients: () => Promise<void>;
  invalidatePatients: () => void;
}

export function usePatientApi(
  hospitalId?: string,
  filters?: { status?: string; gender?: string; page?: number; limit?: number },
  enabled: boolean = true,
): UsePatientApiReturn {
  const queryClient = useQueryClient();
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  // Query for patients list
  const {
    data: patientsData,
    isLoading,
    isError,
    error,
    refetch,
  } = useHospitalPatients(actualHospitalId, filters, enabled);

  // Mutations
  const createMutation = useCreateHospitalPatient(actualHospitalId);
  const updateMutation = useUpdateHospitalPatient(actualHospitalId);
  const deleteMutation = useDeleteHospitalPatient(actualHospitalId);
  const updateDoctorMutation = useUpdatePatientDoctor(actualHospitalId);

  return {
    // Query data
    patients: patientsData?.patients || [],
    filters: patientsData?.filters,
    total: patientsData?.total || 0,
    pagination: patientsData?.pagination,
    isLoading,
    isError,
    error,

    // Mutation functions
    deletePatient: async (patientId: string) => {
      await deleteMutation.mutateAsync(patientId);
    },
    updatePatient: async (patientId: string, updates: UpdatePatientData) => {
      await updateMutation.mutateAsync({ patientId, updates });
    },
    createPatient: async (patientData: CreatePatientData) => {
      return await createMutation.mutateAsync(patientData);
    },
    updatePatientDoctor: async (patientId: string, doctorId: string) => {
      await updateDoctorMutation.mutateAsync({ patientId, doctorId });
    },

    // Mutation states
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isUpdatingDoctor: updateDoctorMutation.isPending,

    // Utility functions
    refetchPatients: async () => {
      await refetch();
    },
    invalidatePatients: () => {
      queryClient.invalidateQueries({
        queryKey: patientKeys.hospital(actualHospitalId),
      });
    },
  };
}

// Specialized hooks for common use cases

// Hook for active patients
export const useActivePatients = (hospitalId?: string) => {
  return useHospitalPatients(hospitalId, { status: "active" });
};

// Hook for patients by gender
export const usePatientsByGender = (hospitalId: string, gender: string) => {
  return useHospitalPatients(hospitalId, { gender });
};

// Hook for patient filters
export const usePatientFilters = (hospitalId?: string) => {
  const { data } = useHospitalPatients(hospitalId, {}, false);

  return {
    statuses: data?.filters?.statuses || ["active", "inactive", "archived"],
    genders: data?.filters?.genders || [
      GENDER.MALE,
      GENDER.FEMALE,
      GENDER.OTHER,
    ],
  };
};

// Hook for doctor's patients (for doctor role)
export const useDoctorPatients = (hospitalId: string, doctorId: string) => {
  return useHospitalPatients(hospitalId, { assignedDoctorId: doctorId });
};

// Optimistic updates for better UX
export const useOptimisticPatientMutations = (hospitalId?: string) => {
  const queryClient = useQueryClient();
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  const optimisticUpdatePatient = useMutation({
    mutationFn: ({
      patientId,
      updates,
    }: {
      patientId: string;
      updates: UpdatePatientData;
    }) => {
      return patientApiFunctions.updatePatient(
        actualHospitalId,
        patientId,
        updates,
      );
    },
    onMutate: async ({ patientId, updates }) => {
      await queryClient.cancelQueries({
        queryKey: patientKeys.hospital(actualHospitalId),
      });

      const previousPatients = queryClient.getQueryData(
        patientKeys.hospitalList(actualHospitalId),
      );

      // Optimistically update the patient
      queryClient.setQueryData(
        patientKeys.hospitalList(actualHospitalId),
        (old: PatientsResponse | undefined) => {
          if (!old) return old;
          return {
            ...old,
            patients: old.patients.map((patient) =>
              patient.id === patientId ? { ...patient, ...updates } : patient,
            ),
          };
        },
      );

      return { previousPatients };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousPatients) {
        queryClient.setQueryData(
          patientKeys.hospitalList(actualHospitalId),
          context.previousPatients,
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: patientKeys.hospital(actualHospitalId),
      });
    },
  });

  const optimisticDeletePatient = useMutation({
    mutationFn: (patientId: string) => {
      return patientApiFunctions.deletePatient(actualHospitalId, patientId);
    },
    onMutate: async (patientId) => {
      await queryClient.cancelQueries({
        queryKey: patientKeys.hospital(actualHospitalId),
      });

      const previousPatients = queryClient.getQueryData(
        patientKeys.hospitalList(actualHospitalId),
      );

      // Optimistically remove the patient
      queryClient.setQueryData(
        patientKeys.hospitalList(actualHospitalId),
        (old: PatientsResponse | undefined) => {
          if (!old) return old;
          return {
            ...old,
            patients: old.patients.filter(
              (patient) => patient.id !== patientId,
            ),
            total: old.total - 1,
          };
        },
      );

      return { previousPatients };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousPatients) {
        queryClient.setQueryData(
          patientKeys.hospitalList(actualHospitalId),
          context.previousPatients,
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: patientKeys.hospital(actualHospitalId),
      });
    },
  });

  return {
    optimisticUpdatePatient: optimisticUpdatePatient.mutateAsync,
    optimisticDeletePatient: optimisticDeletePatient.mutateAsync,
    isOptimisticUpdating: optimisticUpdatePatient.isPending,
    isOptimisticDeleting: optimisticDeletePatient.isPending,
  };
};

// Hook for patient statistics
export const usePatientStats = (hospitalId?: string) => {
  const { data, isLoading, error } = useHospitalPatients(hospitalId);

  const patients = data?.patients || [];
  const stats = {
    total: patients?.length || 0,
    active: patients?.filter((p: Patient) => p.status === "active").length || 0,
    inactive:
      patients?.filter((p: Patient) => p.status === "inactive").length || 0,
    archived:
      patients?.filter((p: Patient) => p.status === "archived").length || 0,
    male:
      patients?.filter((p: Patient) => p.gender === GENDER.MALE).length || 0,
    female:
      patients?.filter((p: Patient) => p.gender === GENDER.FEMALE).length || 0,
    other:
      patients?.filter((p: Patient) => p.gender === GENDER.OTHER).length || 0,
  };

  return {
    stats,
    isLoading,
    error,
  };
};
