// hooks/useHospitalHolidaysApi.ts
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { ApiRequestError, apiUrl, fetchWithAuth } from "@/lib/api";
import type {
  CreateHospitalHolidayData,
  HolidayDraft,
  HolidayImpactPreview,
  HolidayResolution,
  HospitalHoliday,
  HospitalHolidayListResponse,
  UpdateHospitalHolidayData,
} from "@/types/hospitalHoliday";

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

const hospitalHolidaysApiFunctions = {
  fetchHolidays: async (
    hospitalId: string,
    year: number,
  ): Promise<HospitalHolidayListResponse> => {
    const response = await fetchWithAuth(
      apiUrl(`/hospitals/${hospitalId}/hospital-holidays?year=${year}`),
    );
    return parseJsonOrThrow(response);
  },

  previewImpact: async (
    hospitalId: string,
    draft: HolidayDraft,
  ): Promise<HolidayImpactPreview> => {
    const response = await fetchWithAuth(
      apiUrl(`/hospitals/${hospitalId}/hospital-holidays/preview-impact`),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      },
    );
    return parseJsonOrThrow(response);
  },

  createHoliday: async (
    hospitalId: string,
    data: CreateHospitalHolidayData,
  ) => {
    const response = await fetchWithAuth(
      apiUrl(`/hospitals/${hospitalId}/hospital-holidays`),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
    );
    return parseJsonOrThrow(response);
  },

  applyResolutions: async (
    hospitalId: string,
    holidayId: string,
    resolutions: HolidayResolution[],
  ) => {
    const response = await fetchWithAuth(
      apiUrl(
        `/hospitals/${hospitalId}/hospital-holidays/${holidayId}/apply-resolutions`,
      ),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolutions }),
      },
    );
    return parseJsonOrThrow(response);
  },

  updateHoliday: async (
    hospitalId: string,
    holidayId: string,
    updates: UpdateHospitalHolidayData,
  ): Promise<HospitalHoliday> => {
    const response = await fetchWithAuth(
      apiUrl(`/hospitals/${hospitalId}/hospital-holidays/${holidayId}`),
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      },
    );
    return parseJsonOrThrow(response);
  },

  setStatus: async (
    hospitalId: string,
    holidayId: string,
    status: "active" | "removed",
  ) => {
    const response = await fetchWithAuth(
      apiUrl(`/hospitals/${hospitalId}/hospital-holidays/${holidayId}/status`),
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      },
    );
    return parseJsonOrThrow(response);
  },

  generateRepeats: async (hospitalId: string, year: number) => {
    const response = await fetchWithAuth(
      apiUrl(`/hospitals/${hospitalId}/hospital-holidays/generate-repeats`),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year }),
      },
    );
    return parseJsonOrThrow(response);
  },

  importTnList: async (hospitalId: string, year: number) => {
    const response = await fetchWithAuth(
      apiUrl(`/hospitals/${hospitalId}/hospital-holidays/import-tn-list`),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year }),
      },
    );
    return parseJsonOrThrow(response);
  },
};

export const hospitalHolidaysKeys = {
  all: ["hospital-holidays"] as const,
  hospital: (hospitalId: string) =>
    [...hospitalHolidaysKeys.all, "hospital", hospitalId] as const,
  year: (hospitalId: string, year: number) =>
    [...hospitalHolidaysKeys.hospital(hospitalId), "year", year] as const,
};

export const useHospitalHolidays = (year: number, hospitalId?: string) => {
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useQuery({
    queryKey: hospitalHolidaysKeys.year(actualHospitalId, year),
    queryFn: () =>
      hospitalHolidaysApiFunctions.fetchHolidays(actualHospitalId, year),
    enabled: !!actualHospitalId,
    staleTime: 60 * 1000,
  });
};

export const usePreviewHolidayImpact = (hospitalId?: string) => {
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useMutation({
    mutationFn: (draft: HolidayDraft) =>
      hospitalHolidaysApiFunctions.previewImpact(actualHospitalId, draft),
  });
};

export const useCreateHospitalHoliday = (hospitalId?: string) => {
  const queryClient = useQueryClient();
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useMutation({
    mutationFn: (data: CreateHospitalHolidayData) =>
      hospitalHolidaysApiFunctions.createHoliday(actualHospitalId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: hospitalHolidaysKeys.hospital(actualHospitalId),
      });
    },
  });
};

export const useApplyHolidayResolutions = (hospitalId?: string) => {
  const queryClient = useQueryClient();
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useMutation({
    mutationFn: ({
      holidayId,
      resolutions,
    }: {
      holidayId: string;
      resolutions: HolidayResolution[];
    }) =>
      hospitalHolidaysApiFunctions.applyResolutions(
        actualHospitalId,
        holidayId,
        resolutions,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: hospitalHolidaysKeys.hospital(actualHospitalId),
      });
    },
  });
};

export const useUpdateHospitalHoliday = (hospitalId?: string) => {
  const queryClient = useQueryClient();
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useMutation({
    mutationFn: ({
      holidayId,
      updates,
    }: {
      holidayId: string;
      updates: UpdateHospitalHolidayData;
    }) =>
      hospitalHolidaysApiFunctions.updateHoliday(
        actualHospitalId,
        holidayId,
        updates,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: hospitalHolidaysKeys.hospital(actualHospitalId),
      });
    },
  });
};

export const useSetHolidayStatus = (hospitalId?: string) => {
  const queryClient = useQueryClient();
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useMutation({
    mutationFn: ({
      holidayId,
      status,
    }: {
      holidayId: string;
      status: "active" | "removed";
    }) =>
      hospitalHolidaysApiFunctions.setStatus(
        actualHospitalId,
        holidayId,
        status,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: hospitalHolidaysKeys.hospital(actualHospitalId),
      });
    },
  });
};

export const useGenerateHolidayRepeats = (hospitalId?: string) => {
  const queryClient = useQueryClient();
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useMutation({
    mutationFn: (year: number) =>
      hospitalHolidaysApiFunctions.generateRepeats(actualHospitalId, year),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: hospitalHolidaysKeys.hospital(actualHospitalId),
      });
    },
  });
};

export const useImportTnHolidayList = (hospitalId?: string) => {
  const queryClient = useQueryClient();
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useMutation({
    mutationFn: (year: number) =>
      hospitalHolidaysApiFunctions.importTnList(actualHospitalId, year),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: hospitalHolidaysKeys.hospital(actualHospitalId),
      });
    },
  });
};
