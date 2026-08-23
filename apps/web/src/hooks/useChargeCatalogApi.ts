// hooks/useChargeCatalogApi.ts
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { ApiRequestError, apiUrl, fetchWithAuth } from "@/lib/api";
import type {
  BulkReviseChargeCatalogData,
  BulkReviseChargeCatalogResult,
  ChargeCatalogItem,
  ChargeCatalogListResponse,
  CreateChargeCatalogItemData,
  UpdateChargeCatalogItemData,
} from "@/types/chargeCatalog";

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
  category?: string;
  status?: string;
  search?: string;
}

function buildQuery(filters?: ListFilters) {
  if (!filters) return "";
  const params = new URLSearchParams();
  if (filters.category) params.set("category", filters.category);
  if (filters.status) params.set("status", filters.status);
  if (filters.search) params.set("search", filters.search);
  const query = params.toString();
  return query ? `?${query}` : "";
}

const chargeCatalogApiFunctions = {
  fetchItems: async (
    hospitalId: string,
    filters?: ListFilters,
  ): Promise<ChargeCatalogListResponse> => {
    const response = await fetchWithAuth(
      apiUrl(`/hospitals/${hospitalId}/charge-catalog${buildQuery(filters)}`),
    );
    return parseJsonOrThrow(response);
  },

  fetchItem: async (hospitalId: string, itemId: string): Promise<ChargeCatalogItem> => {
    const response = await fetchWithAuth(
      apiUrl(`/hospitals/${hospitalId}/charge-catalog/${itemId}`),
    );
    return parseJsonOrThrow(response);
  },

  createItem: async (hospitalId: string, data: CreateChargeCatalogItemData) => {
    const response = await fetchWithAuth(apiUrl(`/hospitals/${hospitalId}/charge-catalog`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return parseJsonOrThrow(response);
  },

  updateItem: async (
    hospitalId: string,
    itemId: string,
    updates: UpdateChargeCatalogItemData,
  ) => {
    const response = await fetchWithAuth(
      apiUrl(`/hospitals/${hospitalId}/charge-catalog/${itemId}`),
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      },
    );
    return parseJsonOrThrow(response);
  },

  setStatus: async (hospitalId: string, itemId: string, status: "active" | "archived") => {
    const response = await fetchWithAuth(
      apiUrl(`/hospitals/${hospitalId}/charge-catalog/${itemId}/status`),
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      },
    );
    return parseJsonOrThrow(response);
  },

  bulkRevise: async (
    hospitalId: string,
    data: BulkReviseChargeCatalogData,
  ): Promise<BulkReviseChargeCatalogResult> => {
    const response = await fetchWithAuth(
      apiUrl(`/hospitals/${hospitalId}/charge-catalog/bulk-revise`),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
    );
    return parseJsonOrThrow(response);
  },
};

export const chargeCatalogKeys = {
  all: ["charge-catalog"] as const,
  hospital: (hospitalId: string) => [...chargeCatalogKeys.all, "hospital", hospitalId] as const,
  list: (hospitalId: string, filters?: ListFilters) =>
    [...chargeCatalogKeys.hospital(hospitalId), "list", filters || {}] as const,
  detail: (hospitalId: string, itemId: string) =>
    [...chargeCatalogKeys.hospital(hospitalId), "detail", itemId] as const,
};

export const useChargeCatalogItems = (hospitalId?: string, filters?: ListFilters) => {
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useQuery({
    queryKey: chargeCatalogKeys.list(actualHospitalId, filters),
    queryFn: () => chargeCatalogApiFunctions.fetchItems(actualHospitalId, filters),
    enabled: !!actualHospitalId,
    staleTime: 60 * 1000,
  });
};

export const useChargeCatalogItem = (itemId: string, hospitalId?: string) => {
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useQuery({
    queryKey: chargeCatalogKeys.detail(actualHospitalId, itemId),
    queryFn: () => chargeCatalogApiFunctions.fetchItem(actualHospitalId, itemId),
    enabled: !!actualHospitalId && !!itemId,
  });
};

export const useCreateChargeCatalogItem = (hospitalId?: string) => {
  const queryClient = useQueryClient();
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useMutation({
    mutationFn: (data: CreateChargeCatalogItemData) =>
      chargeCatalogApiFunctions.createItem(actualHospitalId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chargeCatalogKeys.hospital(actualHospitalId) });
    },
  });
};

export const useUpdateChargeCatalogItem = (hospitalId?: string) => {
  const queryClient = useQueryClient();
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useMutation({
    mutationFn: ({ itemId, updates }: { itemId: string; updates: UpdateChargeCatalogItemData }) =>
      chargeCatalogApiFunctions.updateItem(actualHospitalId, itemId, updates),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: chargeCatalogKeys.hospital(actualHospitalId) });
      queryClient.invalidateQueries({
        queryKey: chargeCatalogKeys.detail(actualHospitalId, variables.itemId),
      });
    },
  });
};

export const useSetChargeCatalogItemStatus = (hospitalId?: string) => {
  const queryClient = useQueryClient();
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useMutation({
    mutationFn: ({ itemId, status }: { itemId: string; status: "active" | "archived" }) =>
      chargeCatalogApiFunctions.setStatus(actualHospitalId, itemId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chargeCatalogKeys.hospital(actualHospitalId) });
    },
  });
};

export const useBulkReviseChargeCatalog = (hospitalId?: string) => {
  const queryClient = useQueryClient();
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useMutation({
    mutationFn: (data: BulkReviseChargeCatalogData) =>
      chargeCatalogApiFunctions.bulkRevise(actualHospitalId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chargeCatalogKeys.hospital(actualHospitalId) });
    },
  });
};
