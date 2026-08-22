// hooks/useAuditApi.ts
"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { apiUrl, fetchWithAuth } from "@/lib/api";
import type { AuditLogEntry } from "@/types/audit";

export interface AuditFilters {
  actor?: string;
  area?: string;
  moneyOnly?: boolean;
  search?: string;
  startDate?: string;
  endDate?: string;
}

async function parseJsonOrThrow(response: Response) {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }
  return response.json();
}

function buildParams(filters?: AuditFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters?.actor) params.append("actor", filters.actor);
  if (filters?.area) params.append("area", filters.area);
  if (filters?.moneyOnly) params.append("moneyOnly", "true");
  if (filters?.search) params.append("search", filters.search);
  if (filters?.startDate) params.append("startDate", filters.startDate);
  if (filters?.endDate) params.append("endDate", filters.endDate);
  return params;
}

export const auditKeys = {
  all: ["audit"] as const,
  hospital: (hospitalId: string, filters?: AuditFilters) =>
    [...auditKeys.all, hospitalId, { filters }] as const,
};

export const useAuditLog = (hospitalId?: string, filters?: AuditFilters) => {
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useQuery({
    queryKey: auditKeys.hospital(actualHospitalId, filters),
    queryFn: async (): Promise<{ entries: AuditLogEntry[]; total: number }> => {
      const response = await fetchWithAuth(
        `${apiUrl(`/hospitals/${actualHospitalId}/audit`)}?${buildParams(filters).toString()}`,
      );
      return parseJsonOrThrow(response);
    },
    enabled: !!actualHospitalId,
    staleTime: 30 * 1000,
    select: (data) => ({ ...data, entries: data.entries || [] }),
  });
};

export function auditExportUrl(hospitalId: string, filters?: AuditFilters): string {
  return `${apiUrl(`/hospitals/${hospitalId}/audit/export.csv`)}?${buildParams(filters).toString()}`;
}
