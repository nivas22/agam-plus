// hooks/usePrescriptionApi.ts
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { ApiRequestError, apiUrl, fetchWithAuth } from "@/lib/api";
import type {
  FollowUpOption,
  Prescription,
  PrescriptionStatus,
  SavePrescriptionData,
} from "@/types/prescription";

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

interface SetStatusBody {
  status: PrescriptionStatus;
  followUpOption?: FollowUpOption;
}

const prescriptionApiFunctions = {
  fetchPrescription: async (
    hospitalId: string,
    appointmentId: string,
  ): Promise<{ prescription: Prescription | null }> => {
    const response = await fetchWithAuth(
      apiUrl(
        `/hospitals/${hospitalId}/appointments/${appointmentId}/prescription`,
      ),
    );
    return parseJsonOrThrow(response);
  },

  fetchLastSigned: async (
    hospitalId: string,
    appointmentId: string,
  ): Promise<{ prescription: Prescription | null }> => {
    const response = await fetchWithAuth(
      apiUrl(
        `/hospitals/${hospitalId}/appointments/${appointmentId}/prescription/repeat-last`,
      ),
    );
    return parseJsonOrThrow(response);
  },

  save: async (
    hospitalId: string,
    appointmentId: string,
    data: SavePrescriptionData,
  ): Promise<Prescription> => {
    const response = await fetchWithAuth(
      apiUrl(
        `/hospitals/${hospitalId}/appointments/${appointmentId}/prescription`,
      ),
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
    );
    return parseJsonOrThrow(response);
  },

  setStatus: async (
    hospitalId: string,
    appointmentId: string,
    body: SetStatusBody,
  ): Promise<Prescription> => {
    const response = await fetchWithAuth(
      apiUrl(
        `/hospitals/${hospitalId}/appointments/${appointmentId}/prescription/status`,
      ),
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    return parseJsonOrThrow(response);
  },
};

export const prescriptionKeys = {
  all: ["prescriptions"] as const,
  hospital: (hospitalId: string) =>
    [...prescriptionKeys.all, "hospital", hospitalId] as const,
  detail: (hospitalId: string, appointmentId: string) =>
    [
      ...prescriptionKeys.hospital(hospitalId),
      "appointment",
      appointmentId,
    ] as const,
  lastSigned: (hospitalId: string, appointmentId: string) =>
    [...prescriptionKeys.detail(hospitalId, appointmentId), "repeat-last"] as const,
};

export const usePrescription = (appointmentId: string, hospitalId?: string) => {
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useQuery({
    queryKey: prescriptionKeys.detail(actualHospitalId, appointmentId),
    queryFn: () =>
      prescriptionApiFunctions.fetchPrescription(
        actualHospitalId,
        appointmentId,
      ),
    enabled: !!actualHospitalId && !!appointmentId,
  });
};

// Backs "Repeat last" in the prescription writer's quick-start row — the
// same doctor's most recent signed prescription for this patient, if any.
export const useLastSignedPrescription = (
  appointmentId: string,
  hospitalId?: string,
) => {
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useQuery({
    queryKey: prescriptionKeys.lastSigned(actualHospitalId, appointmentId),
    queryFn: () =>
      prescriptionApiFunctions.fetchLastSigned(actualHospitalId, appointmentId),
    enabled: !!actualHospitalId && !!appointmentId,
  });
};

export const useSavePrescription = (
  appointmentId: string,
  hospitalId?: string,
) => {
  const queryClient = useQueryClient();
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useMutation({
    mutationFn: (data: SavePrescriptionData) =>
      prescriptionApiFunctions.save(actualHospitalId, appointmentId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: prescriptionKeys.detail(actualHospitalId, appointmentId),
      });
    },
  });
};

export const useSetPrescriptionStatus = (
  appointmentId: string,
  hospitalId?: string,
) => {
  const queryClient = useQueryClient();
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useMutation({
    mutationFn: (body: SetStatusBody) =>
      prescriptionApiFunctions.setStatus(
        actualHospitalId,
        appointmentId,
        body,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: prescriptionKeys.detail(actualHospitalId, appointmentId),
      });
    },
  });
};
