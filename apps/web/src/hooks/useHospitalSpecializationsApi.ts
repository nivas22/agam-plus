// hooks/useHospitalSpecializationsApi.ts
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
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

const specializationsApiFunctions = {
  fetchSpecializations: async (
    hospitalId: string,
  ): Promise<{ specializations: string[] }> => {
    const response = await fetchWithAuth(
      apiUrl(`/hospitals/${hospitalId}/specializations`),
    );
    return parseJsonOrThrow(response);
  },

  updateSpecializations: async (
    hospitalId: string,
    specializations: string[],
  ): Promise<{ specializations: string[] }> => {
    const response = await fetchWithAuth(
      apiUrl(`/hospitals/${hospitalId}/specializations`),
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ specializations }),
      },
    );
    return parseJsonOrThrow(response);
  },
};

export const hospitalSpecializationsKeys = {
  all: ["hospital-specializations"] as const,
  hospital: (hospitalId: string) =>
    [...hospitalSpecializationsKeys.all, hospitalId] as const,
};

export const useHospitalSpecializations = (hospitalId?: string) => {
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useQuery({
    queryKey: hospitalSpecializationsKeys.hospital(actualHospitalId),
    queryFn: () =>
      specializationsApiFunctions.fetchSpecializations(actualHospitalId),
    enabled: !!actualHospitalId,
    staleTime: 60 * 1000,
  });
};

export const useUpdateHospitalSpecializations = (hospitalId?: string) => {
  const queryClient = useQueryClient();
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useMutation({
    mutationFn: (specializations: string[]) =>
      specializationsApiFunctions.updateSpecializations(
        actualHospitalId,
        specializations,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: hospitalSpecializationsKeys.hospital(actualHospitalId),
      });
    },
  });
};
