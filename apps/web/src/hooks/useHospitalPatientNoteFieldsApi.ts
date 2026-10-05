// hooks/useHospitalPatientNoteFieldsApi.ts
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { ApiRequestError, apiUrl, fetchWithAuth } from "@/lib/api";
import type { PatientNoteField } from "@/lib/patientNoteFields";

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

const patientNoteFieldsApiFunctions = {
  fetchFields: async (
    hospitalId: string,
  ): Promise<{ fields: PatientNoteField[] }> => {
    const response = await fetchWithAuth(
      apiUrl(`/hospitals/${hospitalId}/patient-note-fields`),
    );
    return parseJsonOrThrow(response);
  },

  updateFields: async (
    hospitalId: string,
    fields: PatientNoteField[],
  ): Promise<{ fields: PatientNoteField[] }> => {
    const response = await fetchWithAuth(
      apiUrl(`/hospitals/${hospitalId}/patient-note-fields`),
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // builtIn is server-derived; the PUT schema doesn't accept it.
          fields: fields.map(({ builtIn: _builtIn, ...rest }) => rest),
        }),
      },
    );
    return parseJsonOrThrow(response);
  },
};

export const hospitalPatientNoteFieldsKeys = {
  all: ["hospital-patient-note-fields"] as const,
  hospital: (hospitalId: string) =>
    [...hospitalPatientNoteFieldsKeys.all, hospitalId] as const,
};

export const useHospitalPatientNoteFields = (hospitalId?: string) => {
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useQuery({
    queryKey: hospitalPatientNoteFieldsKeys.hospital(actualHospitalId),
    queryFn: () => patientNoteFieldsApiFunctions.fetchFields(actualHospitalId),
    enabled: !!actualHospitalId,
    staleTime: 60 * 1000,
  });
};

export const useUpdateHospitalPatientNoteFields = (hospitalId?: string) => {
  const queryClient = useQueryClient();
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useMutation({
    mutationFn: (fields: PatientNoteField[]) =>
      patientNoteFieldsApiFunctions.updateFields(actualHospitalId, fields),
    onSuccess: (data) => {
      queryClient.setQueryData(
        hospitalPatientNoteFieldsKeys.hospital(actualHospitalId),
        data,
      );
    },
  });
};
