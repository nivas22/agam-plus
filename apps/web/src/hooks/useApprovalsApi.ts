// hooks/useApprovalsApi.ts
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { apiUrl, fetchWithAuth } from "@/lib/api";
import type { ApprovalRequest } from "@/types/audit";

async function parseJsonOrThrow(response: Response) {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }
  return response.json();
}

const approvalsApiFunctions = {
  list: async (hospitalId: string, status?: string): Promise<ApprovalRequest[]> => {
    const qs = status ? `?status=${status}` : "";
    const response = await fetchWithAuth(apiUrl(`/hospitals/${hospitalId}/approvals${qs}`));
    return parseJsonOrThrow(response);
  },

  approve: async (hospitalId: string, approvalId: string, body: { pin?: string; note?: string }) => {
    const response = await fetchWithAuth(apiUrl(`/hospitals/${hospitalId}/approvals/${approvalId}/approve`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return parseJsonOrThrow(response);
  },

  decline: async (hospitalId: string, approvalId: string, body: { note?: string }) => {
    const response = await fetchWithAuth(apiUrl(`/hospitals/${hospitalId}/approvals/${approvalId}/decline`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return parseJsonOrThrow(response);
  },
};

export const approvalsKeys = {
  all: ["approvals"] as const,
  hospital: (hospitalId: string, status?: string) => [...approvalsKeys.all, hospitalId, status ?? "all"] as const,
};

export const usePendingApprovals = (hospitalId?: string) => {
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useQuery({
    queryKey: approvalsKeys.hospital(actualHospitalId, "pending"),
    queryFn: () => approvalsApiFunctions.list(actualHospitalId, "pending"),
    enabled: !!actualHospitalId,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
};

export const useApproveRequest = (hospitalId?: string) => {
  const queryClient = useQueryClient();
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useMutation({
    mutationFn: ({ approvalId, pin, note }: { approvalId: string; pin?: string; note?: string }) =>
      approvalsApiFunctions.approve(actualHospitalId, approvalId, { pin, note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: approvalsKeys.all });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["packages"] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
  });
};

export const useDeclineRequest = (hospitalId?: string) => {
  const queryClient = useQueryClient();
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useMutation({
    mutationFn: ({ approvalId, note }: { approvalId: string; note?: string }) =>
      approvalsApiFunctions.decline(actualHospitalId, approvalId, { note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: approvalsKeys.all });
    },
  });
};
