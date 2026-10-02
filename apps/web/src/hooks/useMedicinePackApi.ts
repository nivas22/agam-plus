// hooks/useMedicinePackApi.ts
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { ApiRequestError, apiUrl, fetchWithAuth } from "@/lib/api";
import type {
  CreateMedicinePackData,
  MedicinePack,
  MedicinePackListResponse,
  UpdateMedicinePackData,
} from "@/types/medicinePack";

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

const medicinePackApiFunctions = {
  fetchItems: async (
    hospitalId: string,
    filters?: ListFilters,
  ): Promise<MedicinePackListResponse> => {
    const response = await fetchWithAuth(
      apiUrl(`/hospitals/${hospitalId}/medicine-packs${buildQuery(filters)}`),
    );
    return parseJsonOrThrow(response);
  },

  fetchItem: async (
    hospitalId: string,
    packId: string,
  ): Promise<MedicinePack> => {
    const response = await fetchWithAuth(
      apiUrl(`/hospitals/${hospitalId}/medicine-packs/${packId}`),
    );
    return parseJsonOrThrow(response);
  },

  createItem: async (hospitalId: string, data: CreateMedicinePackData) => {
    const response = await fetchWithAuth(
      apiUrl(`/hospitals/${hospitalId}/medicine-packs`),
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
    packId: string,
    updates: UpdateMedicinePackData,
  ) => {
    const response = await fetchWithAuth(
      apiUrl(`/hospitals/${hospitalId}/medicine-packs/${packId}`),
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
    packId: string,
    status: "active" | "archived",
  ) => {
    const response = await fetchWithAuth(
      apiUrl(`/hospitals/${hospitalId}/medicine-packs/${packId}/status`),
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      },
    );
    return parseJsonOrThrow(response);
  },
};

export const medicinePackKeys = {
  all: ["medicinePacks"] as const,
  hospital: (hospitalId: string) =>
    [...medicinePackKeys.all, "hospital", hospitalId] as const,
  list: (hospitalId: string, filters?: ListFilters) =>
    [...medicinePackKeys.hospital(hospitalId), "list", filters || {}] as const,
  detail: (hospitalId: string, packId: string) =>
    [...medicinePackKeys.hospital(hospitalId), "detail", packId] as const,
};

export const useMedicinePacks = (hospitalId?: string, filters?: ListFilters) => {
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useQuery({
    queryKey: medicinePackKeys.list(actualHospitalId, filters),
    queryFn: () => medicinePackApiFunctions.fetchItems(actualHospitalId, filters),
    enabled: !!actualHospitalId,
    staleTime: 60 * 1000,
  });
};

export const useMedicinePack = (packId: string, hospitalId?: string) => {
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useQuery({
    queryKey: medicinePackKeys.detail(actualHospitalId, packId),
    queryFn: () => medicinePackApiFunctions.fetchItem(actualHospitalId, packId),
    enabled: !!actualHospitalId && !!packId,
  });
};

export const useCreateMedicinePack = (hospitalId?: string) => {
  const queryClient = useQueryClient();
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useMutation({
    mutationFn: (data: CreateMedicinePackData) =>
      medicinePackApiFunctions.createItem(actualHospitalId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: medicinePackKeys.hospital(actualHospitalId),
      });
    },
  });
};

export const useUpdateMedicinePack = (hospitalId?: string) => {
  const queryClient = useQueryClient();
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useMutation({
    mutationFn: ({
      packId,
      updates,
    }: {
      packId: string;
      updates: UpdateMedicinePackData;
    }) => medicinePackApiFunctions.updateItem(actualHospitalId, packId, updates),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: medicinePackKeys.hospital(actualHospitalId),
      });
      queryClient.invalidateQueries({
        queryKey: medicinePackKeys.detail(actualHospitalId, variables.packId),
      });
    },
  });
};

export const useSetMedicinePackStatus = (hospitalId?: string) => {
  const queryClient = useQueryClient();
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useMutation({
    mutationFn: ({
      packId,
      status,
    }: {
      packId: string;
      status: "active" | "archived";
    }) => medicinePackApiFunctions.setStatus(actualHospitalId, packId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: medicinePackKeys.hospital(actualHospitalId),
      });
    },
  });
};
