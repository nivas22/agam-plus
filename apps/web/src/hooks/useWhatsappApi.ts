// hooks/useWhatsappApi.ts
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { ApiRequestError, apiUrl, fetchWithAuth } from "@/lib/api";
import type {
  ConnectWhatsappData,
  WhatsappEnquiry,
  WhatsappStatus,
} from "@/types/whatsapp";

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

const whatsappApiFunctions = {
  fetchStatus: async (hospitalId: string): Promise<WhatsappStatus> => {
    const response = await fetchWithAuth(
      apiUrl(`/hospitals/${hospitalId}/whatsapp`),
    );
    return parseJsonOrThrow(response);
  },

  connect: async (
    hospitalId: string,
    data: ConnectWhatsappData,
  ): Promise<WhatsappStatus> => {
    const response = await fetchWithAuth(
      apiUrl(`/hospitals/${hospitalId}/whatsapp/connect`),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
    );
    return parseJsonOrThrow(response);
  },

  disconnect: async (hospitalId: string): Promise<WhatsappStatus> => {
    const response = await fetchWithAuth(
      apiUrl(`/hospitals/${hospitalId}/whatsapp/disconnect`),
      { method: "POST" },
    );
    return parseJsonOrThrow(response);
  },

  setEnabled: async (
    hospitalId: string,
    enabled: boolean,
  ): Promise<WhatsappStatus> => {
    const response = await fetchWithAuth(
      apiUrl(`/hospitals/${hospitalId}/whatsapp/enabled`),
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      },
    );
    return parseJsonOrThrow(response);
  },

  fetchEnquiries: async (
    hospitalId: string,
    status?: string,
  ): Promise<WhatsappEnquiry[]> => {
    const query = status ? `?status=${status}` : "";
    const response = await fetchWithAuth(
      apiUrl(`/hospitals/${hospitalId}/whatsapp/enquiries${query}`),
    );
    return parseJsonOrThrow(response);
  },

  resolveEnquiry: async (hospitalId: string, enquiryId: string) => {
    const response = await fetchWithAuth(
      apiUrl(`/hospitals/${hospitalId}/whatsapp/enquiries/${enquiryId}/resolve`),
      { method: "PATCH" },
    );
    return parseJsonOrThrow(response);
  },
};

export const whatsappKeys = {
  all: ["whatsapp"] as const,
  hospital: (hospitalId: string) =>
    [...whatsappKeys.all, "hospital", hospitalId] as const,
  status: (hospitalId: string) =>
    [...whatsappKeys.hospital(hospitalId), "status"] as const,
  enquiries: (hospitalId: string, status?: string) =>
    [...whatsappKeys.hospital(hospitalId), "enquiries", status ?? "all"] as const,
};

export const useWhatsappStatus = (hospitalId?: string) => {
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useQuery({
    queryKey: whatsappKeys.status(actualHospitalId),
    queryFn: () => whatsappApiFunctions.fetchStatus(actualHospitalId),
    enabled: !!actualHospitalId,
    staleTime: 60 * 1000,
  });
};

export const useConnectWhatsapp = (hospitalId?: string) => {
  const queryClient = useQueryClient();
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useMutation({
    mutationFn: (data: ConnectWhatsappData) =>
      whatsappApiFunctions.connect(actualHospitalId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: whatsappKeys.all });
    },
  });
};

export const useDisconnectWhatsapp = (hospitalId?: string) => {
  const queryClient = useQueryClient();
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useMutation({
    mutationFn: () => whatsappApiFunctions.disconnect(actualHospitalId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: whatsappKeys.all });
    },
  });
};

export const useSetWhatsappEnabled = (hospitalId?: string) => {
  const queryClient = useQueryClient();
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useMutation({
    mutationFn: (enabled: boolean) =>
      whatsappApiFunctions.setEnabled(actualHospitalId, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: whatsappKeys.hospital(actualHospitalId),
      });
    },
  });
};

export const useWhatsappEnquiries = (status?: string, hospitalId?: string) => {
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useQuery({
    queryKey: whatsappKeys.enquiries(actualHospitalId, status),
    queryFn: () =>
      whatsappApiFunctions.fetchEnquiries(actualHospitalId, status),
    enabled: !!actualHospitalId,
    staleTime: 30 * 1000,
  });
};

export const useResolveWhatsappEnquiry = (hospitalId?: string) => {
  const queryClient = useQueryClient();
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useMutation({
    mutationFn: (enquiryId: string) =>
      whatsappApiFunctions.resolveEnquiry(actualHospitalId, enquiryId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: whatsappKeys.hospital(actualHospitalId),
      });
    },
  });
};
