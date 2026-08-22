// hooks/useNewPaymentApi.ts
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { apiUrl, fetchWithAuth } from "@/lib/api";
import type {
  CloseDayPayload,
  CompleteVisitPayload,
  CompleteVisitResponse,
  DayClose,
  PaymentListResponse,
} from "@/types/payment";
import { appointmentsKeys } from "./useNewAppointmentsApi";
import { packagesKeys } from "./useNewPackageApi";

// Base API functions with hospital context
const paymentsApiFunctions = {
  fetchHospitalPayments: async (
    hospitalId: string,
    params: URLSearchParams,
  ): Promise<PaymentListResponse> => {
    const response = await fetchWithAuth(
      `${apiUrl(`/hospitals/${hospitalId}/payments`)}?${params.toString()}`,
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.error || `HTTP error! status: ${response.status}`,
      );
    }

    return response.json();
  },

  completeVisit: async (
    hospitalId: string,
    payload: CompleteVisitPayload,
  ): Promise<CompleteVisitResponse> => {
    const response = await fetchWithAuth(
      apiUrl(`/hospitals/${hospitalId}/payments`),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to complete visit");
    }

    return response.json();
  },

  updatePayment: async (
    hospitalId: string,
    paymentId: string,
    updates: Record<string, unknown>,
  ): Promise<void> => {
    const response = await fetchWithAuth(
      apiUrl(`/hospitals/${hospitalId}/payments/${paymentId}`),
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      },
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to update payment");
    }
  },

  fetchDayClose: async (
    hospitalId: string,
    date: string,
  ): Promise<DayClose> => {
    const response = await fetchWithAuth(
      `${apiUrl(`/hospitals/${hospitalId}/payments/day-close`)}?date=${date}`,
    );
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to load the day's totals");
    }
    return response.json();
  },

  closeDay: async (
    hospitalId: string,
    payload: CloseDayPayload,
  ): Promise<void> => {
    const response = await fetchWithAuth(
      apiUrl(`/hospitals/${hospitalId}/payments/day-close`),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to close the day");
    }
  },
};

// TanStack Query keys with hospital context
export const paymentsKeys = {
  all: ["payments"] as const,
  hospital: (hospitalId: string) =>
    [...paymentsKeys.all, "hospital", hospitalId] as const,
  hospitalList: (hospitalId: string, filters?: any) =>
    [...paymentsKeys.hospital(hospitalId), "list", { filters }] as const,
  byAppointment: (hospitalId: string, appointmentId: string) =>
    [
      ...paymentsKeys.hospital(hospitalId),
      "appointment",
      appointmentId,
    ] as const,
  dayClose: (hospitalId: string, date: string) =>
    [...paymentsKeys.hospital(hospitalId), "day-close", date] as const,
};

export const useHospitalPayments = (
  hospitalId?: string,
  params?: URLSearchParams,
) => {
  const queryParams = useParams();
  const actualHospitalId = hospitalId || (queryParams.id as string);
  const queryParamsObj = params ? Object.fromEntries(params.entries()) : {};

  return useQuery({
    queryKey: paymentsKeys.hospitalList(actualHospitalId, queryParamsObj),
    queryFn: () =>
      paymentsApiFunctions.fetchHospitalPayments(
        actualHospitalId,
        params || new URLSearchParams(),
      ),
    enabled: !!actualHospitalId,
    staleTime: 30 * 1000,
    select: (data) => ({ ...data, payments: data.payments || [] }),
  });
};

// Looks up the bill already recorded for an appointment, if any — lets the
// UI tell a completed-but-unbilled visit apart from one that's already settled.
export const usePaymentForAppointment = (
  hospitalId: string | undefined,
  appointmentId: string | undefined,
) => {
  const params = new URLSearchParams();
  if (appointmentId) params.append("appointmentId", appointmentId);

  return useQuery({
    queryKey: paymentsKeys.byAppointment(hospitalId || "", appointmentId || ""),
    queryFn: () =>
      paymentsApiFunctions.fetchHospitalPayments(hospitalId as string, params),
    enabled: !!hospitalId && !!appointmentId,
    select: (data) => data.payments[0] || null,
  });
};

export const useCompleteVisit = (hospitalId?: string) => {
  const queryClient = useQueryClient();
  const queryParams = useParams();
  const actualHospitalId = hospitalId || (queryParams.id as string);

  return useMutation({
    mutationFn: (payload: CompleteVisitPayload) =>
      paymentsApiFunctions.completeVisit(actualHospitalId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: paymentsKeys.hospital(actualHospitalId),
      });
      queryClient.invalidateQueries({
        queryKey: appointmentsKeys.hospital(actualHospitalId),
      });
      // A completed visit may be a package redemption, which moves that
      // package's usedVisits — refresh the Packages tab's data too.
      queryClient.invalidateQueries({
        queryKey: packagesKeys.hospital(actualHospitalId),
      });
    },
  });
};

export const useUpdatePayment = (hospitalId?: string) => {
  const queryClient = useQueryClient();
  const queryParams = useParams();
  const actualHospitalId = hospitalId || (queryParams.id as string);

  return useMutation({
    mutationFn: ({
      paymentId,
      updates,
    }: {
      paymentId: string;
      updates: Record<string, unknown>;
    }) =>
      paymentsApiFunctions.updatePayment(actualHospitalId, paymentId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: paymentsKeys.hospital(actualHospitalId),
      });
    },
  });
};

// "Close the day" always concerns a single calendar date, independent of
// whatever date-range the transactions table is currently filtered to.
export const useDayClose = (hospitalId: string | undefined, date: string) => {
  return useQuery({
    queryKey: paymentsKeys.dayClose(hospitalId || "", date),
    queryFn: () =>
      paymentsApiFunctions.fetchDayClose(hospitalId as string, date),
    enabled: !!hospitalId && !!date,
    staleTime: 30 * 1000,
  });
};

export const useCloseDay = (hospitalId?: string) => {
  const queryClient = useQueryClient();
  const queryParams = useParams();
  const actualHospitalId = hospitalId || (queryParams.id as string);

  return useMutation({
    mutationFn: (payload: CloseDayPayload) =>
      paymentsApiFunctions.closeDay(actualHospitalId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: paymentsKeys.dayClose(actualHospitalId, variables.date),
      });
      queryClient.invalidateQueries({
        queryKey: paymentsKeys.hospital(actualHospitalId),
      });
    },
  });
};
