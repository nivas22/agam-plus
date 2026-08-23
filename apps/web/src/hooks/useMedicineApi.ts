// hooks/useMedicineApi.ts
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { ApiRequestError, apiUrl, fetchWithAuth } from "@/lib/api";
import type {
  CreateMedicineData,
  Medicine,
  MedicineListResponse,
  UpdateMedicineData,
} from "@/types/medicine";

async function parseJsonOrThrow(response: Response) {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiRequestError(
      errorData.error || `HTTP error! status: ${response.status}`,
      errorData.details,
    );
  }
  return response.json();
}

interface ListFilters {
  status?: string;
  search?: string;
}

function buildQuery(filters?: ListFilters) {
  if (!filters) return "";
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.search) params.set("search", filters.search);
  const query = params.toString();
  return query ? `?${query}` : "";
}

const medicineApiFunctions = {
  fetchItems: async (
    hospitalId: string,
    filters?: ListFilters,
  ): Promise<MedicineListResponse> => {
    const response = await fetchWithAuth(
      apiUrl(`/hospitals/${hospitalId}/medicines${buildQuery(filters)}`),
    );
    return parseJsonOrThrow(response);
  },

  fetchItem: async (
    hospitalId: string,
    medicineId: string,
  ): Promise<Medicine> => {
    const response = await fetchWithAuth(
      apiUrl(`/hospitals/${hospitalId}/medicines/${medicineId}`),
    );
    return parseJsonOrThrow(response);
  },

  createItem: async (hospitalId: string, data: CreateMedicineData) => {
    const response = await fetchWithAuth(
      apiUrl(`/hospitals/${hospitalId}/medicines`),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
    );
    return parseJsonOrThrow(response);
  },

  updateItem: async (
    hospitalId: string,
    medicineId: string,
    updates: UpdateMedicineData,
  ) => {
    const response = await fetchWithAuth(
      apiUrl(`/hospitals/${hospitalId}/medicines/${medicineId}`),
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      },
    );
    return parseJsonOrThrow(response);
  },

  setStatus: async (
    hospitalId: string,
    medicineId: string,
    status: "active" | "archived",
  ) => {
    const response = await fetchWithAuth(
      apiUrl(`/hospitals/${hospitalId}/medicines/${medicineId}/status`),
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      },
    );
    return parseJsonOrThrow(response);
  },
};

export const medicineKeys = {
  all: ["medicines"] as const,
  hospital: (hospitalId: string) =>
    [...medicineKeys.all, "hospital", hospitalId] as const,
  list: (hospitalId: string, filters?: ListFilters) =>
    [...medicineKeys.hospital(hospitalId), "list", filters || {}] as const,
  detail: (hospitalId: string, medicineId: string) =>
    [...medicineKeys.hospital(hospitalId), "detail", medicineId] as const,
};

export const useMedicines = (hospitalId?: string, filters?: ListFilters) => {
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useQuery({
    queryKey: medicineKeys.list(actualHospitalId, filters),
    queryFn: () => medicineApiFunctions.fetchItems(actualHospitalId, filters),
    enabled: !!actualHospitalId,
    staleTime: 60 * 1000,
  });
};

export const useMedicine = (medicineId: string, hospitalId?: string) => {
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useQuery({
    queryKey: medicineKeys.detail(actualHospitalId, medicineId),
    queryFn: () => medicineApiFunctions.fetchItem(actualHospitalId, medicineId),
    enabled: !!actualHospitalId && !!medicineId,
  });
};

export const useCreateMedicine = (hospitalId?: string) => {
  const queryClient = useQueryClient();
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useMutation({
    mutationFn: (data: CreateMedicineData) =>
      medicineApiFunctions.createItem(actualHospitalId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: medicineKeys.hospital(actualHospitalId),
      });
    },
  });
};

export const useUpdateMedicine = (hospitalId?: string) => {
  const queryClient = useQueryClient();
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useMutation({
    mutationFn: ({
      medicineId,
      updates,
    }: {
      medicineId: string;
      updates: UpdateMedicineData;
    }) =>
      medicineApiFunctions.updateItem(actualHospitalId, medicineId, updates),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: medicineKeys.hospital(actualHospitalId),
      });
      queryClient.invalidateQueries({
        queryKey: medicineKeys.detail(actualHospitalId, variables.medicineId),
      });
    },
  });
};

export const useSetMedicineStatus = (hospitalId?: string) => {
  const queryClient = useQueryClient();
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useMutation({
    mutationFn: ({
      medicineId,
      status,
    }: {
      medicineId: string;
      status: "active" | "archived";
    }) => medicineApiFunctions.setStatus(actualHospitalId, medicineId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: medicineKeys.hospital(actualHospitalId),
      });
    },
  });
};
