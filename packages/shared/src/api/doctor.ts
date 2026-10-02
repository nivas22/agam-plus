// Typed wrappers over the doctor-facing routes:
//   apps/api/src/doctor-dashboard/doctor-dashboard.controller.ts
//   apps/api/src/doctor-presence/doctor-presence.controller.ts
import type { ApiClient } from "./client";
import type {
  DoctorDashboardFollowUp,
  DoctorDashboardPending,
  DoctorDashboardPracticeStats,
  DoctorDashboardWeekOverview,
  DoctorDashboardYesterdaySummary,
} from "../types/doctorDashboard";

/**
 * A doctor caller is always scoped to their own data by HospitalContextGuard,
 * so `doctorId` is only needed when an admin is viewing a specific doctor.
 */
export interface DoctorScope {
  hospitalId: string;
  doctorId?: string;
}

export interface DoctorPresenceEntry {
  doctorId: string;
  status: string;
  updatedAt?: string;
  note?: string;
}

export function createDoctorApi(client: ApiClient) {
  const dashboard = (hospitalId: string) =>
    `/hospitals/${hospitalId}/doctor-dashboard`;
  const presence = (hospitalId: string) =>
    `/hospitals/${hospitalId}/doctor-presence`;

  return {
    getPending: ({ hospitalId, doctorId }: DoctorScope) =>
      client.get<DoctorDashboardPending>(`${dashboard(hospitalId)}/pending`, {
        query: { doctorId },
      }),

    getFollowUps: ({ hospitalId, doctorId }: DoctorScope, days = 7) =>
      client.get<DoctorDashboardFollowUp[]>(
        `${dashboard(hospitalId)}/follow-ups`,
        { query: { doctorId, days } },
      ),

    /** `startDate` is an ISO date (YYYY-MM-DD) for the Monday of the week. */
    getWeekOverview: ({ hospitalId, doctorId }: DoctorScope, startDate: string) =>
      client.get<DoctorDashboardWeekOverview>(
        `${dashboard(hospitalId)}/week-overview`,
        { query: { doctorId, startDate } },
      ),

    /** `month` is YYYY-MM. */
    getPracticeStats: ({ hospitalId, doctorId }: DoctorScope, month: string) =>
      client.get<DoctorDashboardPracticeStats>(
        `${dashboard(hospitalId)}/practice-stats`,
        { query: { doctorId, month } },
      ),

    getYesterdaySummary: ({ hospitalId, doctorId }: DoctorScope) =>
      client.get<DoctorDashboardYesterdaySummary>(
        `${dashboard(hospitalId)}/yesterday-summary`,
        { query: { doctorId } },
      ),

    /** `date` is an ISO date (YYYY-MM-DD). */
    getPresence: (hospitalId: string, date: string) =>
      client.get<DoctorPresenceEntry[]>(presence(hospitalId), {
        query: { date },
      }),

    setPresence: (
      hospitalId: string,
      doctorId: string,
      body: { date: string; status: string; note?: string },
    ) => client.post<DoctorPresenceEntry>(`${presence(hospitalId)}/${doctorId}`, body),
  };
}
