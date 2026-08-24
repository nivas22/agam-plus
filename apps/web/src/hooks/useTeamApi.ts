// hooks/useTeamApi.ts
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { ApiRequestError, apiUrl, fetchWithAuth } from "@/lib/api";
import type {
  CreateTeamMemberData,
  TeamMember,
  TeamMemberProfileResponse,
  UpdateTeamMemberData,
} from "@/types/team";

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

const teamApiFunctions = {
  fetchTeam: async (hospitalId: string): Promise<{ members: TeamMember[]; total: number }> => {
    const response = await fetchWithAuth(apiUrl(`/hospitals/${hospitalId}/team`));
    return parseJsonOrThrow(response);
  },

  fetchMember: async (hospitalId: string, memberId: string): Promise<TeamMemberProfileResponse> => {
    const response = await fetchWithAuth(apiUrl(`/hospitals/${hospitalId}/team/${memberId}`));
    return parseJsonOrThrow(response);
  },

  createMember: async (hospitalId: string, data: CreateTeamMemberData) => {
    const response = await fetchWithAuth(apiUrl(`/hospitals/${hospitalId}/team`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return parseJsonOrThrow(response);
  },

  updateMember: async (hospitalId: string, memberId: string, updates: UpdateTeamMemberData) => {
    const response = await fetchWithAuth(apiUrl(`/hospitals/${hospitalId}/team/${memberId}`), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    return parseJsonOrThrow(response);
  },

  updateStatus: async (
    hospitalId: string,
    memberId: string,
    status: "active" | "suspended" | "deactivated",
  ) => {
    const response = await fetchWithAuth(apiUrl(`/hospitals/${hospitalId}/team/${memberId}/status`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    return parseJsonOrThrow(response);
  },

  resetPin: async (hospitalId: string, memberId: string) => {
    const response = await fetchWithAuth(apiUrl(`/hospitals/${hospitalId}/team/${memberId}/pin/reset`), {
      method: "POST",
    });
    return parseJsonOrThrow(response);
  },
};

export const teamKeys = {
  all: ["team"] as const,
  hospital: (hospitalId: string) => [...teamKeys.all, "hospital", hospitalId] as const,
  list: (hospitalId: string) => [...teamKeys.hospital(hospitalId), "list"] as const,
  detail: (hospitalId: string, memberId: string) => [...teamKeys.hospital(hospitalId), "detail", memberId] as const,
};

export const useTeamMembers = (hospitalId?: string) => {
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useQuery({
    queryKey: teamKeys.list(actualHospitalId),
    queryFn: () => teamApiFunctions.fetchTeam(actualHospitalId),
    enabled: !!actualHospitalId,
    staleTime: 60 * 1000,
    select: (data) => ({ ...data, members: data.members || [] }),
  });
};

export const useTeamMember = (memberId: string, hospitalId?: string) => {
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useQuery({
    queryKey: teamKeys.detail(actualHospitalId, memberId),
    queryFn: () => teamApiFunctions.fetchMember(actualHospitalId, memberId),
    enabled: !!actualHospitalId && !!memberId,
  });
};

export const useCreateTeamMember = (hospitalId?: string) => {
  const queryClient = useQueryClient();
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useMutation({
    mutationFn: (data: CreateTeamMemberData) => teamApiFunctions.createMember(actualHospitalId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamKeys.hospital(actualHospitalId) });
    },
  });
};

export const useUpdateTeamMember = (hospitalId?: string) => {
  const queryClient = useQueryClient();
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useMutation({
    mutationFn: ({ memberId, updates }: { memberId: string; updates: UpdateTeamMemberData }) =>
      teamApiFunctions.updateMember(actualHospitalId, memberId, updates),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: teamKeys.hospital(actualHospitalId) });
      queryClient.invalidateQueries({ queryKey: teamKeys.detail(actualHospitalId, variables.memberId) });
    },
  });
};

export const useUpdateTeamMemberStatus = (hospitalId?: string) => {
  const queryClient = useQueryClient();
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useMutation({
    mutationFn: ({ memberId, status }: { memberId: string; status: "active" | "suspended" | "deactivated" }) =>
      teamApiFunctions.updateStatus(actualHospitalId, memberId, status),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: teamKeys.hospital(actualHospitalId) });
      queryClient.invalidateQueries({ queryKey: teamKeys.detail(actualHospitalId, variables.memberId) });
    },
  });
};

export const useResetTeamMemberPin = (hospitalId?: string) => {
  const queryClient = useQueryClient();
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useMutation({
    mutationFn: (memberId: string) => teamApiFunctions.resetPin(actualHospitalId, memberId),
    onSuccess: (_data, memberId) => {
      queryClient.invalidateQueries({ queryKey: teamKeys.detail(actualHospitalId, memberId) });
    },
  });
};
