// hooks/useLeaveRequestsApi.ts
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { ApiRequestError, apiUrl, fetchWithAuth } from "@/lib/api";
import type {
  CreateLeaveRequestData,
  LeaveRequest,
  LeaveRequestImpactPreview,
} from "@/types/leaveRequest";

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

const leaveRequestsApiFunctions = {
  fetchList: async (
    hospitalId: string,
    status?: string,
  ): Promise<LeaveRequest[]> => {
    const search = status ? `?status=${status}` : "";
    const response = await fetchWithAuth(
      apiUrl(`/hospitals/${hospitalId}/leave-requests${search}`),
    );
    return parseJsonOrThrow(response);
  },

  previewImpact: async (
    hospitalId: string,
    draft: { startDate: string; endDate: string },
  ): Promise<LeaveRequestImpactPreview> => {
    const response = await fetchWithAuth(
      apiUrl(`/hospitals/${hospitalId}/leave-requests/preview-impact`),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      },
    );
    return parseJsonOrThrow(response);
  },

  create: async (
    hospitalId: string,
    data: CreateLeaveRequestData,
  ): Promise<LeaveRequest> => {
    const response = await fetchWithAuth(
      apiUrl(`/hospitals/${hospitalId}/leave-requests`),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
    );
    return parseJsonOrThrow(response);
  },

  nudge: async (
    hospitalId: string,
    leaveRequestId: string,
  ): Promise<LeaveRequest> => {
    const response = await fetchWithAuth(
      apiUrl(`/hospitals/${hospitalId}/leave-requests/${leaveRequestId}/nudge`),
      { method: "POST" },
    );
    return parseJsonOrThrow(response);
  },

  approve: async (
    hospitalId: string,
    leaveRequestId: string,
    note?: string,
  ): Promise<LeaveRequest> => {
    const response = await fetchWithAuth(
      apiUrl(
        `/hospitals/${hospitalId}/leave-requests/${leaveRequestId}/approve`,
      ),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      },
    );
    return parseJsonOrThrow(response);
  },

  decline: async (
    hospitalId: string,
    leaveRequestId: string,
    note?: string,
  ): Promise<LeaveRequest> => {
    const response = await fetchWithAuth(
      apiUrl(
        `/hospitals/${hospitalId}/leave-requests/${leaveRequestId}/decline`,
      ),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      },
    );
    return parseJsonOrThrow(response);
  },
};

export const leaveRequestsKeys = {
  all: ["leave-requests"] as const,
  hospital: (hospitalId: string) =>
    [...leaveRequestsKeys.all, "hospital", hospitalId] as const,
  list: (hospitalId: string, status?: string) =>
    [...leaveRequestsKeys.hospital(hospitalId), "list", status] as const,
};

export const useLeaveRequests = (status?: string, hospitalId?: string) => {
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useQuery({
    queryKey: leaveRequestsKeys.list(actualHospitalId, status),
    queryFn: () =>
      leaveRequestsApiFunctions.fetchList(actualHospitalId, status),
    enabled: !!actualHospitalId,
    staleTime: 30 * 1000,
  });
};

export const usePreviewLeaveImpact = (hospitalId?: string) => {
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useMutation({
    mutationFn: (draft: { startDate: string; endDate: string }) =>
      leaveRequestsApiFunctions.previewImpact(actualHospitalId, draft),
  });
};

export const useApplyForLeave = (hospitalId?: string) => {
  const queryClient = useQueryClient();
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useMutation({
    mutationFn: (data: CreateLeaveRequestData) =>
      leaveRequestsApiFunctions.create(actualHospitalId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: leaveRequestsKeys.hospital(actualHospitalId),
      });
    },
  });
};

export const useNudgeLeaveRequest = (hospitalId?: string) => {
  const queryClient = useQueryClient();
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useMutation({
    mutationFn: (leaveRequestId: string) =>
      leaveRequestsApiFunctions.nudge(actualHospitalId, leaveRequestId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: leaveRequestsKeys.hospital(actualHospitalId),
      });
    },
  });
};

export const useResolveLeaveRequest = (hospitalId?: string) => {
  const queryClient = useQueryClient();
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useMutation({
    mutationFn: ({
      leaveRequestId,
      action,
      note,
    }: {
      leaveRequestId: string;
      action: "approve" | "decline";
      note?: string;
    }) =>
      action === "approve"
        ? leaveRequestsApiFunctions.approve(
            actualHospitalId,
            leaveRequestId,
            note,
          )
        : leaveRequestsApiFunctions.decline(
            actualHospitalId,
            leaveRequestId,
            note,
          ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: leaveRequestsKeys.hospital(actualHospitalId),
      });
    },
  });
};
