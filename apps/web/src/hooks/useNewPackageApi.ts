// hooks/useNewPackageApi.ts
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiUrl, fetchWithAuth } from "@/lib/api";
import type {
  PreviewSchedulePayload,
  PreviewScheduleResponse,
  SellPackagePayload,
  SellPackageResponse,
} from "@/types/package";
import { appointmentsKeys } from "./useNewAppointmentsApi";

const packagesApiFunctions = {
  previewSchedule: async (
    hospitalId: string,
    payload: PreviewSchedulePayload,
  ): Promise<PreviewScheduleResponse> => {
    const response = await fetchWithAuth(
      apiUrl(`/hospitals/${hospitalId}/packages/preview-schedule`),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to preview the schedule");
    }
    return response.json();
  },

  sellPackage: async (
    hospitalId: string,
    payload: SellPackagePayload,
  ): Promise<SellPackageResponse> => {
    const response = await fetchWithAuth(
      apiUrl(`/hospitals/${hospitalId}/packages`),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to sell the package");
    }
    return response.json();
  },
};

// Modeled as a mutation rather than a query — the dialog fires it explicitly
// whenever an input that affects scheduling changes (or "Re-run" is clicked),
// which fits an imperative "go compute this" call better than a cached read.
export const usePreviewPackageSchedule = (hospitalId?: string) => {
  return useMutation({
    mutationFn: (payload: PreviewSchedulePayload) =>
      packagesApiFunctions.previewSchedule(hospitalId as string, payload),
  });
};

export const useSellPackage = (hospitalId?: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: SellPackagePayload) =>
      packagesApiFunctions.sellPackage(hospitalId as string, payload),
    onSuccess: () => {
      if (hospitalId) {
        queryClient.invalidateQueries({
          queryKey: appointmentsKeys.hospital(hospitalId),
        });
      }
    },
  });
};
