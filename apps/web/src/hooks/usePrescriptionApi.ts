// hooks/usePrescriptionApi.ts
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { ApiRequestError, apiUrl, fetchWithAuth } from "@/lib/api";
import type {
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
    status: PrescriptionStatus,
  ): Promise<Prescription> => {
    const response = await fetchWithAuth(
      apiUrl(
        `/hospitals/${hospitalId}/appointments/${appointmentId}/prescription/status`,
      ),
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
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
    mutationFn: (status: PrescriptionStatus) =>
      prescriptionApiFunctions.setStatus(
        actualHospitalId,
        appointmentId,
        status,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: prescriptionKeys.detail(actualHospitalId, appointmentId),
      });
    },
  });
};
