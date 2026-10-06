// hooks/useInventoryApi.ts
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { ApiRequestError, apiUrl, fetchWithAuth } from "@/lib/api";
import { useModuleFetchAllowed } from "@/hooks/useHospitalModulesApi";
import type {
  AdjustBatchData,
  ExpiringBatch,
  InventoryItemData,
  InventoryItemDetail,
  InventoryListResponse,
  InventoryMovement,
  InventoryMutationResult,
  InventorySummary,
  IssueStockData,
  ReceiveStockData,
} from "@/types/inventory";

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

// Any inventory change may be queued for approval instead of applied (202).
async function parseMutation(
  response: Response,
): Promise<InventoryMutationResult> {
  if (response.status === 202) return { requiresApproval: true };
  await parseJsonOrThrow(response);
  return { requiresApproval: false };
}

export interface InventoryListFilters {
  category?: string;
  status?: string;
  search?: string;
  stock?: "low" | "out" | "expiring";
}

export interface InventoryMovementFilters {
  itemId?: string;
  type?: string;
  from?: string;
  to?: string;
}

function toQuery(filters?: object) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters || {})) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

function postJson(url: string, body: unknown, method = "POST") {
  return fetchWithAuth(apiUrl(url), {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const inventoryApiFunctions = {
  fetchSummary: async (hospitalId: string): Promise<InventorySummary> =>
    parseJsonOrThrow(
      await fetchWithAuth(apiUrl(`/hospitals/${hospitalId}/inventory/summary`)),
    ),

  fetchItems: async (
    hospitalId: string,
    filters?: InventoryListFilters,
  ): Promise<InventoryListResponse> =>
    parseJsonOrThrow(
      await fetchWithAuth(
        apiUrl(`/hospitals/${hospitalId}/inventory/items${toQuery(filters)}`),
      ),
    ),

  fetchItem: async (
    hospitalId: string,
    itemId: string,
  ): Promise<InventoryItemDetail> =>
    parseJsonOrThrow(
      await fetchWithAuth(
        apiUrl(`/hospitals/${hospitalId}/inventory/items/${itemId}`),
      ),
    ),

  fetchExpiring: async (
    hospitalId: string,
    withinDays?: number,
  ): Promise<{ batches: ExpiringBatch[]; withinDays: number }> =>
    parseJsonOrThrow(
      await fetchWithAuth(
        apiUrl(
          `/hospitals/${hospitalId}/inventory/batches/expiring${toQuery({ withinDays })}`,
        ),
      ),
    ),

  fetchMovements: async (
    hospitalId: string,
    filters?: InventoryMovementFilters,
  ): Promise<InventoryMovement[]> =>
    parseJsonOrThrow(
      await fetchWithAuth(
        apiUrl(
          `/hospitals/${hospitalId}/inventory/movements${toQuery(filters)}`,
        ),
      ),
    ),

  createItem: async (hospitalId: string, data: InventoryItemData) =>
    parseMutation(
      await postJson(`/hospitals/${hospitalId}/inventory/items`, data),
    ),

  updateItem: async (
    hospitalId: string,
    itemId: string,
    data: Partial<InventoryItemData>,
  ) =>
    parseMutation(
      await postJson(
        `/hospitals/${hospitalId}/inventory/items/${itemId}`,
        data,
        "PUT",
      ),
    ),

  setStatus: async (
    hospitalId: string,
    itemId: string,
    status: "active" | "archived",
  ) =>
    parseMutation(
      await postJson(
        `/hospitals/${hospitalId}/inventory/items/${itemId}/status`,
        { status },
        "PATCH",
      ),
    ),

  receive: async (hospitalId: string, itemId: string, data: ReceiveStockData) =>
    parseMutation(
      await postJson(
        `/hospitals/${hospitalId}/inventory/items/${itemId}/receive`,
        data,
      ),
    ),

  issue: async (hospitalId: string, itemId: string, data: IssueStockData) =>
    parseMutation(
      await postJson(
        `/hospitals/${hospitalId}/inventory/items/${itemId}/issue`,
        data,
      ),
    ),

  adjust: async (
    hospitalId: string,
    itemId: string,
    batchId: string,
    data: AdjustBatchData,
  ) =>
    parseMutation(
      await postJson(
        `/hospitals/${hospitalId}/inventory/items/${itemId}/batches/${batchId}/adjust`,
        data,
      ),
    ),
};

export const inventoryKeys = {
  all: ["inventory"] as const,
  hospital: (hospitalId: string) => [...inventoryKeys.all, hospitalId] as const,
  summary: (hospitalId: string) =>
    [...inventoryKeys.hospital(hospitalId), "summary"] as const,
  list: (hospitalId: string, filters?: InventoryListFilters) =>
    [...inventoryKeys.hospital(hospitalId), "list", filters || {}] as const,
  detail: (hospitalId: string, itemId: string) =>
    [...inventoryKeys.hospital(hospitalId), "detail", itemId] as const,
  expiring: (hospitalId: string, withinDays?: number) =>
    [
      ...inventoryKeys.hospital(hospitalId),
      "expiring",
      withinDays ?? null,
    ] as const,
  movements: (hospitalId: string, filters?: InventoryMovementFilters) =>
    [
      ...inventoryKeys.hospital(hospitalId),
      "movements",
      filters || {},
    ] as const,
};

function useHospitalId(hospitalId?: string) {
  const params = useParams();
  return hospitalId || (params.id as string);
}

// Not fetched while the inventory module is off (Settings > Features).
export const useInventorySummary = (hospitalId?: string) => {
  const id = useHospitalId(hospitalId);
  const moduleOn = useModuleFetchAllowed("inventory", id);
  return useQuery({
    queryKey: inventoryKeys.summary(id),
    queryFn: () => inventoryApiFunctions.fetchSummary(id),
    enabled: !!id && moduleOn,
    staleTime: 30 * 1000,
  });
};

export const useInventoryItems = (
  hospitalId?: string,
  filters?: InventoryListFilters,
) => {
  const id = useHospitalId(hospitalId);
  const moduleOn = useModuleFetchAllowed("inventory", id);
  return useQuery({
    queryKey: inventoryKeys.list(id, filters),
    queryFn: () => inventoryApiFunctions.fetchItems(id, filters),
    enabled: !!id && moduleOn,
    staleTime: 30 * 1000,
  });
};

export const useInventoryItem = (itemId: string, hospitalId?: string) => {
  const id = useHospitalId(hospitalId);
  const moduleOn = useModuleFetchAllowed("inventory", id);
  return useQuery({
    queryKey: inventoryKeys.detail(id, itemId),
    queryFn: () => inventoryApiFunctions.fetchItem(id, itemId),
    enabled: !!id && !!itemId && moduleOn,
  });
};

export const useExpiringBatches = (
  hospitalId?: string,
  withinDays?: number,
) => {
  const id = useHospitalId(hospitalId);
  const moduleOn = useModuleFetchAllowed("inventory", id);
  return useQuery({
    queryKey: inventoryKeys.expiring(id, withinDays),
    queryFn: () => inventoryApiFunctions.fetchExpiring(id, withinDays),
    enabled: !!id && moduleOn,
    staleTime: 30 * 1000,
  });
};

export const useInventoryMovements = (
  hospitalId?: string,
  filters?: InventoryMovementFilters,
) => {
  const id = useHospitalId(hospitalId);
  const moduleOn = useModuleFetchAllowed("inventory", id);
  return useQuery({
    queryKey: inventoryKeys.movements(id, filters),
    queryFn: () => inventoryApiFunctions.fetchMovements(id, filters),
    enabled: !!id && moduleOn,
  });
};

// Every change can move totals, alerts and the ledger at once, so each
// mutation just invalidates the whole hospital's inventory cache.
function useInventoryMutation<TVars>(
  hospitalId: string | undefined,
  fn: (id: string, vars: TVars) => Promise<InventoryMutationResult>,
) {
  const queryClient = useQueryClient();
  const id = useHospitalId(hospitalId);
  return useMutation({
    mutationFn: (vars: TVars) => fn(id, vars),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.hospital(id) });
    },
  });
}

export const useCreateInventoryItem = (hospitalId?: string) =>
  useInventoryMutation(hospitalId, (id, data: InventoryItemData) =>
    inventoryApiFunctions.createItem(id, data),
  );

export const useUpdateInventoryItem = (hospitalId?: string) =>
  useInventoryMutation(
    hospitalId,
    (id, vars: { itemId: string; data: Partial<InventoryItemData> }) =>
      inventoryApiFunctions.updateItem(id, vars.itemId, vars.data),
  );

export const useSetInventoryItemStatus = (hospitalId?: string) =>
  useInventoryMutation(
    hospitalId,
    (id, vars: { itemId: string; status: "active" | "archived" }) =>
      inventoryApiFunctions.setStatus(id, vars.itemId, vars.status),
  );

export const useReceiveStock = (hospitalId?: string) =>
  useInventoryMutation(
    hospitalId,
    (id, vars: { itemId: string; data: ReceiveStockData }) =>
      inventoryApiFunctions.receive(id, vars.itemId, vars.data),
  );

export const useIssueStock = (hospitalId?: string) =>
  useInventoryMutation(
    hospitalId,
    (id, vars: { itemId: string; data: IssueStockData }) =>
      inventoryApiFunctions.issue(id, vars.itemId, vars.data),
  );

export const useAdjustBatch = (hospitalId?: string) =>
  useInventoryMutation(
    hospitalId,
    (id, vars: { itemId: string; batchId: string; data: AdjustBatchData }) =>
      inventoryApiFunctions.adjust(id, vars.itemId, vars.batchId, vars.data),
  );
