// hooks/useHospitalPackageSettingsApi.ts
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import type { PackageSettings } from "@/constants";
import { ApiRequestError, apiUrl, fetchWithAuth } from "@/lib/api";

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

const packageSettingsApiFunctions = {
  fetchSettings: async (
    hospitalId: string,
  ): Promise<{ settings: PackageSettings }> => {
    const response = await fetchWithAuth(
      apiUrl(`/hospitals/${hospitalId}/package-settings`),
    );
    return parseJsonOrThrow(response);
  },

  updateSettings: async (
    hospitalId: string,
    settings: PackageSettings,
  ): Promise<{ settings: PackageSettings }> => {
    const response = await fetchWithAuth(
      apiUrl(`/hospitals/${hospitalId}/package-settings`),
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      },
    );
    return parseJsonOrThrow(response);
  },
};

export const hospitalPackageSettingsKeys = {
  all: ["hospital-package-settings"] as const,
  hospital: (hospitalId: string) =>
    [...hospitalPackageSettingsKeys.all, hospitalId] as const,
};

export const useHospitalPackageSettings = (hospitalId?: string) => {
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useQuery({
    queryKey: hospitalPackageSettingsKeys.hospital(actualHospitalId),
    queryFn: () => packageSettingsApiFunctions.fetchSettings(actualHospitalId),
    enabled: !!actualHospitalId,
    staleTime: 60 * 1000,
  });
};

export const useUpdateHospitalPackageSettings = (hospitalId?: string) => {
  const queryClient = useQueryClient();
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useMutation({
    mutationFn: (settings: PackageSettings) =>
      packageSettingsApiFunctions.updateSettings(actualHospitalId, settings),
    onSuccess: (data) => {
      queryClient.setQueryData(
        hospitalPackageSettingsKeys.hospital(actualHospitalId),
        data,
      );
    },
  });
};
