// hooks/usePermissionsApi.ts
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { apiUrl, fetchWithAuth } from "@/lib/api";
import type { RolePermissionSummary } from "@/types/permissions";

async function parseJsonOrThrow(response: Response) {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }
  return response.json();
}

const permissionsApiFunctions = {
  fetchRoles: async (hospitalId: string): Promise<{ roles: RolePermissionSummary[] }> => {
    const response = await fetchWithAuth(apiUrl(`/hospitals/${hospitalId}/roles`));
    return parseJsonOrThrow(response);
  },

  updateRolePermissions: async (
    hospitalId: string,
    role: string,
    updates: { overrides: Record<string, string>; discountCapAmount?: number },
  ): Promise<RolePermissionSummary> => {
    const response = await fetchWithAuth(apiUrl(`/hospitals/${hospitalId}/roles/${role}/permissions`), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    return parseJsonOrThrow(response);
  },
};

export const permissionsKeys = {
  all: ["roles"] as const,
  hospital: (hospitalId: string) => [...permissionsKeys.all, hospitalId] as const,
};

export const useRolePermissions = (hospitalId?: string) => {
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useQuery({
    queryKey: permissionsKeys.hospital(actualHospitalId),
    queryFn: () => permissionsApiFunctions.fetchRoles(actualHospitalId),
    enabled: !!actualHospitalId,
    staleTime: 60 * 1000,
    select: (data) => data.roles || [],
  });
};

export const useUpdateRolePermissions = (hospitalId?: string) => {
  const queryClient = useQueryClient();
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useMutation({
    mutationFn: ({
      role,
      overrides,
      discountCapAmount,
    }: {
      role: string;
      overrides: Record<string, string>;
      discountCapAmount?: number;
    }) => permissionsApiFunctions.updateRolePermissions(actualHospitalId, role, { overrides, discountCapAmount }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: permissionsKeys.hospital(actualHospitalId) });
    },
  });
};
