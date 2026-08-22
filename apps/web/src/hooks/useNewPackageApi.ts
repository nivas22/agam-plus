// hooks/useNewPackageApi.ts
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiUrl, fetchWithAuth } from "@/lib/api";
import type {
  ExtendPackagePayload,
  ExtendPackageResponse,
  PackageLedgerResponse,
  PackageStats,
  PackagesListResponse,
  PreviewSchedulePayload,
  PreviewScheduleResponse,
  RefundPackageResponse,
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

  getPackages: async (
    hospitalId: string,
    patientId?: string,
  ): Promise<PackagesListResponse> => {
    const params = new URLSearchParams();
    if (patientId) params.append("patientId", patientId);
    const qs = params.toString();
    const response = await fetchWithAuth(
      apiUrl(`/hospitals/${hospitalId}/packages${qs ? `?${qs}` : ""}`),
    );
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to load packages");
    }
    return response.json();
  },

  getPackageStats: async (hospitalId: string): Promise<PackageStats> => {
    const response = await fetchWithAuth(
      apiUrl(`/hospitals/${hospitalId}/packages/stats`),
    );
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to load package stats");
    }
    return response.json();
  },

  getPackageLedger: async (
    hospitalId: string,
    packageId: string,
  ): Promise<PackageLedgerResponse> => {
    const response = await fetchWithAuth(
      apiUrl(`/hospitals/${hospitalId}/packages/${packageId}`),
    );
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to load the package ledger");
    }
    return response.json();
  },

  extendPackage: async (
    hospitalId: string,
    packageId: string,
    payload: ExtendPackagePayload,
  ): Promise<ExtendPackageResponse> => {
    const response = await fetchWithAuth(
      apiUrl(`/hospitals/${hospitalId}/packages/${packageId}/extend`),
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to extend the package");
    }
    return response.json();
  },

  refundPackage: async (
    hospitalId: string,
    packageId: string,
  ): Promise<RefundPackageResponse> => {
    const response = await fetchWithAuth(
      apiUrl(`/hospitals/${hospitalId}/packages/${packageId}/refund`),
      { method: "PATCH" },
    );
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to refund the package");
    }
    return response.json();
  },
};

export const packagesKeys = {
  all: ["packages"] as const,
  hospital: (hospitalId: string) =>
    [...packagesKeys.all, "hospital", hospitalId] as const,
  list: (hospitalId: string, patientId?: string) =>
    [...packagesKeys.hospital(hospitalId), "list", { patientId }] as const,
  stats: (hospitalId: string) =>
    [...packagesKeys.hospital(hospitalId), "stats"] as const,
  ledger: (hospitalId: string, packageId: string) =>
    [...packagesKeys.hospital(hospitalId), "ledger", packageId] as const,
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
        queryClient.invalidateQueries({
          queryKey: packagesKeys.hospital(hospitalId),
        });
      }
    },
  });
};

export const usePackagesList = (hospitalId?: string, patientId?: string) => {
  return useQuery({
    queryKey: packagesKeys.list(hospitalId as string, patientId),
    queryFn: () =>
      packagesApiFunctions.getPackages(hospitalId as string, patientId),
    enabled: !!hospitalId,
    staleTime: 30 * 1000,
  });
};

export const usePackageStats = (hospitalId?: string) => {
  return useQuery({
    queryKey: packagesKeys.stats(hospitalId as string),
    queryFn: () => packagesApiFunctions.getPackageStats(hospitalId as string),
    enabled: !!hospitalId,
    staleTime: 30 * 1000,
  });
};

export const usePackageLedger = (hospitalId?: string, packageId?: string) => {
  return useQuery({
    queryKey: packagesKeys.ledger(hospitalId as string, packageId as string),
    queryFn: () =>
      packagesApiFunctions.getPackageLedger(
        hospitalId as string,
        packageId as string,
      ),
    enabled: !!hospitalId && !!packageId,
  });
};

export const useExtendPackage = (hospitalId?: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      packageId,
      months,
    }: {
      packageId: string;
      months: number;
    }) =>
      packagesApiFunctions.extendPackage(hospitalId as string, packageId, {
        months,
      }),
    onSuccess: () => {
      if (hospitalId) {
        queryClient.invalidateQueries({
          queryKey: packagesKeys.hospital(hospitalId),
        });
      }
    },
  });
};

export const useRefundPackage = (hospitalId?: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (packageId: string) =>
      packagesApiFunctions.refundPackage(hospitalId as string, packageId),
    onSuccess: () => {
      if (hospitalId) {
        queryClient.invalidateQueries({
          queryKey: packagesKeys.hospital(hospitalId),
        });
      }
    },
  });
};
