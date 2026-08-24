// hooks/useReportsApi.ts
"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { apiUrl, fetchWithAuth } from "@/lib/api";

export interface DateRangeFilter {
  startDate?: string;
  endDate?: string;
}

export interface DailyCollectionReport {
  range: { startDate: string; endDate: string };
  tiles: {
    collected: { amount: number; activeDays: number };
    earned: { amount: number };
    raisedButUnpaid: {
      amount: number;
      billCount: number;
      patientCount: number;
    };
    refunded: { amount: number; count: number };
  };
  chart: {
    days: {
      date: string;
      cash: number;
      upi: number;
      packageSales: number;
      closed: boolean;
    }[];
  };
  byUser: {
    userId: string;
    name: string;
    cash: number;
    upi: number;
    total: number;
    paymentCount: number;
    drawerVariance: number;
    activeDays: number;
    closedDays: number;
  }[];
  totals: {
    cash: number;
    upi: number;
    packageSales: number;
    drawerVariance: number;
  };
  unclosedDates: string[];
  insight: string;
}

export interface DoctorRevenueReport {
  range: { startDate: string; endDate: string };
  chart: { doctors: { name: string; billed: number }[] };
  table: {
    doctorProfileId: string;
    name: string;
    specialization: string | null;
    consultationFee: number | null;
    visits: number;
    billed: number;
    collected: number;
    outstanding: number;
    fromPackages: number;
    avgPerVisit: number;
    diaryFullPct: number | null;
    noShowPct: number | null;
  }[];
  totals: {
    visits: number;
    billed: number;
    collected: number;
    outstanding: number;
    fromPackages: number;
  };
  insight: string;
}

export interface DuesAgingReport {
  asOf: string;
  tiles: {
    totalOutstanding: {
      amount: number;
      billCount: number;
      patientCount: number;
    };
    under15: { amount: number };
    over30: { amount: number; billCount: number };
    recovered: { amount: number; count: number; month: string };
  };
  buckets: { label: string; amount: number; count: number }[];
  table: {
    paymentId: string;
    patientId: string;
    patientName: string;
    patientPhone: string;
    doctorName: string;
    invoiceNumber: string;
    amount: number;
    ageDays: number;
    bucket: string;
    createdAt: string;
  }[];
  insight: string;
}

export interface NoShowsReport {
  range: { startDate: string; endDate: string };
  tiles: {
    noShowRate: { rate: number; noShowCount: number; totalCount: number };
    trend: { deltaPoints: number; previousRate: number };
    slotsLost: { hours: number; valueEstimate: number };
    repeatOffenders: { count: number };
  };
  byDoctor: {
    doctorProfileId: string;
    name: string;
    totalCount: number;
    noShowCount: number;
    rate: number;
  }[];
  byLeadTime: {
    bucket: string;
    totalCount: number;
    noShowCount: number;
    rate: number;
  }[];
  heatmap: {
    days: string[];
    slots: string[];
    cells: { total: number; noShows: number; rate: number }[][];
  };
  insight: string;
}

async function parseJsonOrThrow(response: Response) {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error || `HTTP error! status: ${response.status}`,
    );
  }
  return response.json();
}

function buildParams(filters?: DateRangeFilter): URLSearchParams {
  const params = new URLSearchParams();
  if (filters?.startDate) params.append("startDate", filters.startDate);
  if (filters?.endDate) params.append("endDate", filters.endDate);
  return params;
}

export const reportKeys = {
  all: ["reports"] as const,
  dailyCollection: (hospitalId: string, filters?: DateRangeFilter) =>
    [...reportKeys.all, "daily-collection", hospitalId, filters] as const,
  doctorRevenue: (hospitalId: string, filters?: DateRangeFilter) =>
    [...reportKeys.all, "doctor-revenue", hospitalId, filters] as const,
  duesAging: (hospitalId: string) =>
    [...reportKeys.all, "dues-aging", hospitalId] as const,
  noShows: (hospitalId: string, filters?: DateRangeFilter) =>
    [...reportKeys.all, "no-shows", hospitalId, filters] as const,
};

function useActualHospitalId(hospitalId?: string): string {
  const params = useParams();
  return hospitalId || (params.id as string);
}

export function useDailyCollectionReport(
  hospitalId?: string,
  filters?: DateRangeFilter,
) {
  const actualHospitalId = useActualHospitalId(hospitalId);
  return useQuery({
    queryKey: reportKeys.dailyCollection(actualHospitalId, filters),
    queryFn: async (): Promise<DailyCollectionReport> => {
      const response = await fetchWithAuth(
        `${apiUrl(`/hospitals/${actualHospitalId}/reports/daily-collection`)}?${buildParams(filters).toString()}`,
      );
      return parseJsonOrThrow(response);
    },
    enabled: !!actualHospitalId,
    staleTime: 30 * 1000,
  });
}

export function useDoctorRevenueReport(
  hospitalId?: string,
  filters?: DateRangeFilter,
) {
  const actualHospitalId = useActualHospitalId(hospitalId);
  return useQuery({
    queryKey: reportKeys.doctorRevenue(actualHospitalId, filters),
    queryFn: async (): Promise<DoctorRevenueReport> => {
      const response = await fetchWithAuth(
        `${apiUrl(`/hospitals/${actualHospitalId}/reports/doctor-revenue`)}?${buildParams(filters).toString()}`,
      );
      return parseJsonOrThrow(response);
    },
    enabled: !!actualHospitalId,
    staleTime: 30 * 1000,
  });
}

export function useDuesAgingReport(hospitalId?: string) {
  const actualHospitalId = useActualHospitalId(hospitalId);
  return useQuery({
    queryKey: reportKeys.duesAging(actualHospitalId),
    queryFn: async (): Promise<DuesAgingReport> => {
      const response = await fetchWithAuth(
        apiUrl(`/hospitals/${actualHospitalId}/reports/dues-aging`),
      );
      return parseJsonOrThrow(response);
    },
    enabled: !!actualHospitalId,
    staleTime: 30 * 1000,
  });
}

export function useNoShowsReport(
  hospitalId?: string,
  filters?: DateRangeFilter,
) {
  const actualHospitalId = useActualHospitalId(hospitalId);
  return useQuery({
    queryKey: reportKeys.noShows(actualHospitalId, filters),
    queryFn: async (): Promise<NoShowsReport> => {
      const response = await fetchWithAuth(
        `${apiUrl(`/hospitals/${actualHospitalId}/reports/no-shows`)}?${buildParams(filters).toString()}`,
      );
      return parseJsonOrThrow(response);
    },
    enabled: !!actualHospitalId,
    staleTime: 30 * 1000,
  });
}

export function reportExportUrl(
  report: "daily-collection" | "doctor-revenue" | "dues-aging" | "no-shows",
  hospitalId: string,
  filters?: DateRangeFilter,
): string {
  const query = buildParams(filters).toString();
  const base = apiUrl(`/hospitals/${hospitalId}/reports/${report}/export.csv`);
  return query ? `${base}?${query}` : base;
}
