// hooks/useLeaveRequestsApi.ts
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { ApiRequestError, apiUrl, fetchWithAuth } from "@/lib/api";
import { appointmentsKeys } from "@/hooks/useNewAppointmentsApi";
import type {
  CreateLeaveRequestData,
  LeaveAffectedAppointments,
  LeaveAppointmentResolution,
  LeaveRequest,
  LeaveRequestImpactPreview,
  OnLeaveEntry,
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

  fetchOnLeave: async (
    hospitalId: string,
    startDate: string,
    endDate: string,
  ): Promise<OnLeaveEntry[]> => {
    const response = await fetchWithAuth(
      apiUrl(
        `/hospitals/${hospitalId}/leave-requests/on-leave?startDate=${startDate}&endDate=${endDate}`,
      ),
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

  fetchAffectedAppointments: async (
    hospitalId: string,
    leaveRequestId: string,
  ): Promise<LeaveAffectedAppointments> => {
    const response = await fetchWithAuth(
      apiUrl(
        `/hospitals/${hospitalId}/leave-requests/${leaveRequestId}/affected-appointments`,
      ),
    );
    return parseJsonOrThrow(response);
  },

  approve: async (
    hospitalId: string,
    leaveRequestId: string,
    note?: string,
    resolutions?: LeaveAppointmentResolution[],
  ): Promise<LeaveRequest> => {
    const response = await fetchWithAuth(
      apiUrl(
        `/hospitals/${hospitalId}/leave-requests/${leaveRequestId}/approve`,
      ),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note, resolutions }),
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
  onLeave: (hospitalId: string, startDate: string, endDate: string) =>
    [...leaveRequestsKeys.hospital(hospitalId), "on-leave", startDate, endDate] as const,
  affected: (hospitalId: string, leaveRequestId: string) =>
    [...leaveRequestsKeys.hospital(hospitalId), "affected", leaveRequestId] as const,
};

// Always refetched on open — the list feeds a must-resolve-everything gate,
// so a stale copy would just bounce off the API's own check.
export const useLeaveAffectedAppointments = (
  leaveRequestId: string | undefined,
  hospitalId?: string,
) => {
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useQuery({
    queryKey: leaveRequestsKeys.affected(actualHospitalId, leaveRequestId || ""),
    queryFn: () =>
      leaveRequestsApiFunctions.fetchAffectedAppointments(
        actualHospitalId,
        leaveRequestId!,
      ),
    enabled: !!actualHospitalId && !!leaveRequestId,
    staleTime: 0,
  });
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

// Approved absences overlapping a date range, for "on leave" markers. Pass
// `enabled: false` while the Leave requests module is switched off — the API
// rejects the call then.
export const useOnLeave = (
  startDate: string,
  endDate: string,
  hospitalId?: string,
  enabled = true,
) => {
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useQuery({
    queryKey: leaveRequestsKeys.onLeave(actualHospitalId, startDate, endDate),
    queryFn: () =>
      leaveRequestsApiFunctions.fetchOnLeave(actualHospitalId, startDate, endDate),
    enabled: enabled && !!actualHospitalId && !!startDate && !!endDate,
    staleTime: 60 * 1000,
  });
};

// The approved leave covering `date` for one person, if any.
export function findLeaveOn(
  entries: OnLeaveEntry[] | undefined,
  userId: string | undefined,
  date: string,
): OnLeaveEntry | undefined {
  if (!entries || !userId) return undefined;
  return entries.find(
    (e) => e.userId === userId && e.startDate <= date && e.endDate >= date,
  );
}

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
      resolutions,
    }: {
      leaveRequestId: string;
      action: "approve" | "decline";
      note?: string;
      resolutions?: LeaveAppointmentResolution[];
    }) =>
      action === "approve"
        ? leaveRequestsApiFunctions.approve(
            actualHospitalId,
            leaveRequestId,
            note,
            resolutions,
          )
        : leaveRequestsApiFunctions.decline(
            actualHospitalId,
            leaveRequestId,
            note,
          ),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: leaveRequestsKeys.hospital(actualHospitalId),
      });
      if (variables.resolutions?.length) {
        queryClient.invalidateQueries({ queryKey: appointmentsKeys.all });
      }
    },
  });
};
