// hooks/useDoctorPresenceApi.ts
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { apiUrl, fetchWithAuth } from "@/lib/api";
import type { PresenceOverride } from "@/components/queue/queueBoard";

async function parseJsonOrThrow(response: Response) {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error || `HTTP error! status: ${response.status}`,
    );
  }
  return response.json();
}

export const doctorPresenceKeys = {
  all: ["doctor-presence"] as const,
  hospital: (hospitalId: string, date: string) =>
    [...doctorPresenceKeys.all, hospitalId, date] as const,
};

// Replaces the old localStorage-based presence: the single source of truth
// for "who's marked in/late/on break/left for the day today" now lives in
// the DB, shared across every front-desk terminal and the doctor's own
// device, with a full audit trail of who set what (see DoctorPresenceMenu's
// callers and AuditTrailPage's "Doctors" area).
export function useDoctorPresence(
  hospitalId: string | undefined,
  date: string,
) {
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useQuery({
    queryKey: doctorPresenceKeys.hospital(actualHospitalId, date),
    queryFn: async (): Promise<Record<string, PresenceOverride>> => {
      const response = await fetchWithAuth(
        `${apiUrl(`/hospitals/${actualHospitalId}/doctor-presence`)}?date=${date}`,
      );
      const data = await parseJsonOrThrow(response);
      return data.overrides || {};
    },
    enabled: !!actualHospitalId && !!date,
    staleTime: 15 * 1000,
  });
}

export interface SetDoctorPresenceInput {
  doctorId: string;
  date: string;
  kind: "here" | "runningLate" | "onBreak" | "notIn" | "leftForDay";
  expectedTime?: string;
  returnTime?: string;
  reason?: string;
  toldBy?: string;
  note?: string;
}

export function useSetDoctorPresence(hospitalId: string | undefined) {
  const queryClient = useQueryClient();
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useMutation({
    mutationFn: async (
      input: SetDoctorPresenceInput,
    ): Promise<PresenceOverride> => {
      const { doctorId, ...body } = input;
      const response = await fetchWithAuth(
        apiUrl(`/hospitals/${actualHospitalId}/doctor-presence/${doctorId}`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const data = await parseJsonOrThrow(response);
      return data.override;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: doctorPresenceKeys.hospital(
          actualHospitalId,
          variables.date,
        ),
      });
    },
  });
}
