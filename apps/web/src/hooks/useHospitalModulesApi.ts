// hooks/useHospitalModulesApi.ts
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useCallback } from "react";
import { ApiRequestError, apiUrl, fetchWithAuth } from "@/lib/api";
import type {
  HospitalModuleKey,
  ResolvedHospitalModule,
} from "@/lib/hospitalModules";

async function parseJsonOrThrow(response: Response) {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiRequestError(
      errorData.error ||
        errorData.message ||
        `HTTP error! status: ${response.status}`,
      errorData.details,
    );
  }
  return response.json();
}

type ModulesResponse = { modules: ResolvedHospitalModule[] };

const hospitalModulesApiFunctions = {
  fetchModules: async (hospitalId: string): Promise<ModulesResponse> => {
    const response = await fetchWithAuth(
      apiUrl(`/hospitals/${hospitalId}/modules`),
    );
    return parseJsonOrThrow(response);
  },

  updateModules: async (
    hospitalId: string,
    modules: Partial<Record<HospitalModuleKey, boolean>>,
  ): Promise<ModulesResponse> => {
    const response = await fetchWithAuth(
      apiUrl(`/hospitals/${hospitalId}/modules`),
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modules }),
      },
    );
    return parseJsonOrThrow(response);
  },
};

export const hospitalModulesKeys = {
  all: ["hospital-modules"] as const,
  hospital: (hospitalId: string) =>
    [...hospitalModulesKeys.all, hospitalId] as const,
};

export const useHospitalModules = (hospitalId?: string) => {
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useQuery({
    queryKey: hospitalModulesKeys.hospital(actualHospitalId),
    queryFn: () => hospitalModulesApiFunctions.fetchModules(actualHospitalId),
    enabled: !!actualHospitalId,
    staleTime: 5 * 60 * 1000,
  });
};

export const useUpdateHospitalModules = (hospitalId?: string) => {
  const queryClient = useQueryClient();
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useMutation({
    mutationFn: (modules: Partial<Record<HospitalModuleKey, boolean>>) =>
      hospitalModulesApiFunctions.updateModules(actualHospitalId, modules),
    onSuccess: (data) => {
      queryClient.setQueryData(
        hospitalModulesKeys.hospital(actualHospitalId),
        data,
      );
    },
  });
};

// For hiding UI. Optimistic: anything counts as on until the list has
// loaded (or if it failed to load) — the API enforces the real state, and
// nearly every hospital has nearly everything on, so this avoids menus and
// buttons popping in on every page load.
export const useModuleEnabled = (hospitalId?: string) => {
  const { data, isLoading } = useHospitalModules(hospitalId);

  const isEnabled = useCallback(
    (key: HospitalModuleKey) =>
      data?.modules.find((m) => m.key === key)?.enabled ?? true,
    [data],
  );

  return { isEnabled, modules: data?.modules, isLoading };
};
