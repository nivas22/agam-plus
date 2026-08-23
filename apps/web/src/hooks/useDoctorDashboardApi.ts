// hooks/useDoctorDashboardApi.ts
"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { ApiRequestError, apiUrl, fetchWithAuth } from "@/lib/api";
import type {
  DoctorDashboardFollowUp,
  DoctorDashboardPending,
  DoctorDashboardPracticeStats,
  DoctorDashboardWeekOverview,
  DoctorDashboardYesterdaySummary,
} from "@/types/doctorDashboard";

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

const doctorDashboardApiFunctions = {
  fetchPending: async (
    hospitalId: string,
    doctorId?: string,
  ): Promise<DoctorDashboardPending> => {
    const params = doctorId ? `?doctorId=${doctorId}` : "";
    const response = await fetchWithAuth(
      apiUrl(`/hospitals/${hospitalId}/doctor-dashboard/pending${params}`),
    );
    return parseJsonOrThrow(response);
  },

  fetchFollowUpsDue: async (
    hospitalId: string,
    days: number,
    doctorId?: string,
  ): Promise<DoctorDashboardFollowUp[]> => {
    const search = new URLSearchParams({ days: String(days) });
    if (doctorId) search.set("doctorId", doctorId);
    const response = await fetchWithAuth(
      apiUrl(
        `/hospitals/${hospitalId}/doctor-dashboard/follow-ups?${search.toString()}`,
      ),
    );
    return parseJsonOrThrow(response);
  },

  fetchWeekOverview: async (
    hospitalId: string,
    startDate: string,
    doctorId?: string,
  ): Promise<DoctorDashboardWeekOverview> => {
    const search = new URLSearchParams({ startDate });
    if (doctorId) search.set("doctorId", doctorId);
    const response = await fetchWithAuth(
      apiUrl(
        `/hospitals/${hospitalId}/doctor-dashboard/week-overview?${search.toString()}`,
      ),
    );
    return parseJsonOrThrow(response);
  },

  fetchPracticeStats: async (
    hospitalId: string,
    month: string,
    doctorId?: string,
  ): Promise<DoctorDashboardPracticeStats> => {
    const search = new URLSearchParams({ month });
    if (doctorId) search.set("doctorId", doctorId);
    const response = await fetchWithAuth(
      apiUrl(
        `/hospitals/${hospitalId}/doctor-dashboard/practice-stats?${search.toString()}`,
      ),
    );
    return parseJsonOrThrow(response);
  },

  fetchYesterdaySummary: async (
    hospitalId: string,
    doctorId?: string,
  ): Promise<DoctorDashboardYesterdaySummary> => {
    const params = doctorId ? `?doctorId=${doctorId}` : "";
    const response = await fetchWithAuth(
      apiUrl(
        `/hospitals/${hospitalId}/doctor-dashboard/yesterday-summary${params}`,
      ),
    );
    return parseJsonOrThrow(response);
  },
};

export const doctorDashboardKeys = {
  all: ["doctor-dashboard"] as const,
  hospital: (hospitalId: string) =>
    [...doctorDashboardKeys.all, "hospital", hospitalId] as const,
  pending: (hospitalId: string, doctorId?: string) =>
    [...doctorDashboardKeys.hospital(hospitalId), "pending", doctorId] as const,
  followUps: (hospitalId: string, days: number, doctorId?: string) =>
    [
      ...doctorDashboardKeys.hospital(hospitalId),
      "follow-ups",
      days,
      doctorId,
    ] as const,
  weekOverview: (hospitalId: string, startDate: string, doctorId?: string) =>
    [
      ...doctorDashboardKeys.hospital(hospitalId),
      "week-overview",
      startDate,
      doctorId,
    ] as const,
  practiceStats: (hospitalId: string, month: string, doctorId?: string) =>
    [
      ...doctorDashboardKeys.hospital(hospitalId),
      "practice-stats",
      month,
      doctorId,
    ] as const,
  yesterdaySummary: (hospitalId: string, doctorId?: string) =>
    [
      ...doctorDashboardKeys.hospital(hospitalId),
      "yesterday-summary",
      doctorId,
    ] as const,
};

export const useDoctorDashboardPending = (
  hospitalId?: string,
  doctorId?: string,
) => {
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useQuery({
    queryKey: doctorDashboardKeys.pending(actualHospitalId, doctorId),
    queryFn: () =>
      doctorDashboardApiFunctions.fetchPending(actualHospitalId, doctorId),
    enabled: !!actualHospitalId,
    staleTime: 60 * 1000,
  });
};

export const useDoctorDashboardFollowUps = (
  days: number = 7,
  hospitalId?: string,
  doctorId?: string,
) => {
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useQuery({
    queryKey: doctorDashboardKeys.followUps(actualHospitalId, days, doctorId),
    queryFn: () =>
      doctorDashboardApiFunctions.fetchFollowUpsDue(
        actualHospitalId,
        days,
        doctorId,
      ),
    enabled: !!actualHospitalId,
    staleTime: 60 * 1000,
  });
};

export const useDoctorDashboardWeekOverview = (
  startDate: string,
  hospitalId?: string,
  doctorId?: string,
) => {
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useQuery({
    queryKey: doctorDashboardKeys.weekOverview(
      actualHospitalId,
      startDate,
      doctorId,
    ),
    queryFn: () =>
      doctorDashboardApiFunctions.fetchWeekOverview(
        actualHospitalId,
        startDate,
        doctorId,
      ),
    enabled: !!actualHospitalId && !!startDate,
    staleTime: 60 * 1000,
  });
};

export const useDoctorDashboardPracticeStats = (
  month: string,
  hospitalId?: string,
  doctorId?: string,
) => {
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useQuery({
    queryKey: doctorDashboardKeys.practiceStats(
      actualHospitalId,
      month,
      doctorId,
    ),
    queryFn: () =>
      doctorDashboardApiFunctions.fetchPracticeStats(
        actualHospitalId,
        month,
        doctorId,
      ),
    enabled: !!actualHospitalId && !!month,
    staleTime: 5 * 60 * 1000,
  });
};

export const useDoctorDashboardYesterdaySummary = (
  hospitalId?: string,
  doctorId?: string,
) => {
  const params = useParams();
  const actualHospitalId = hospitalId || (params.id as string);

  return useQuery({
    queryKey: doctorDashboardKeys.yesterdaySummary(actualHospitalId, doctorId),
    queryFn: () =>
      doctorDashboardApiFunctions.fetchYesterdaySummary(
        actualHospitalId,
        doctorId,
      ),
    enabled: !!actualHospitalId,
    staleTime: 5 * 60 * 1000,
  });
};
