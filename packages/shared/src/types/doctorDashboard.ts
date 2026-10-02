// types/doctorDashboard.ts — response shapes for
// GET /hospitals/:id/doctor-dashboard/*
import type { LeaveRequest } from "./leaveRequest";

export interface DashboardUnwrittenNote {
  appointmentId: string;
  patientName?: string;
  completedAt?: string;
}

export interface DashboardUnsignedPrescription {
  appointmentId: string;
  patientId: string;
  patientName?: string;
  medicineCount: number;
  updatedAt?: string;
}

export interface DashboardMissedFollowUp {
  appointmentId: string;
  patientName?: string;
  dueDate: string;
  daysOverdue: number;
}

export interface DoctorDashboardPending {
  unwrittenNotes: DashboardUnwrittenNote[];
  unsignedPrescriptions: DashboardUnsignedPrescription[];
  missedFollowUps: DashboardMissedFollowUp[];
  pendingLeaveRequest: LeaveRequest | null;
}

export interface DoctorDashboardFollowUp {
  appointmentId: string;
  patientName?: string;
  dueDate: string;
  state: "late" | "dueIn" | "booked";
  dayDelta?: number;
  bookedDate?: string;
  bookedTime?: string;
}

export interface WeekOverviewWindow {
  startTime: string;
  endTime: string;
}

export interface WeekOverviewDay {
  date: string;
  dayName: string;
  windows: WeekOverviewWindow[];
  isWorkingDay: boolean;
  totalSlots: number;
  bookedCount: number;
  holiday: { name: string; closureType: string } | null;
  leave: { status: string; startDate: string; endDate: string } | null;
}

export interface DoctorDashboardWeekOverview {
  days: WeekOverviewDay[];
}

export interface DoctorDashboardPracticeStats {
  range: { startDate: string; endDate: string };
  patientsSeen: {
    value: number;
    delta: number | null;
    clinicDaysCount: number;
  };
  avgConsultationMinutes: number | null;
  diaryFilledPct: { value: number | null; delta: number | null };
  billed: { value: number; delta: number | null; avgPerVisit: number };
  noShowPct: { value: number | null; delta: number | null };
  notesSameDayPct: number | null;
  insight: string | null;
}

export interface DoctorDashboardYesterdaySummary {
  date: string;
  patientsSeenCount: number;
  consultationMinutes: number;
  prescriptionsSignedCount: number;
  notesUnwrittenCount: number;
  noShows: { count: number; times: string[] };
}
