// components/dashboard/DoctorDashboardPage.tsx
"use client";

import { format } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildLanes,
  computePresence,
  formatTime12h,
  minutesToTimeStr,
  type QueueLane,
  toISODate,
} from "@/components/queue/queueBoard";
import { useAuth } from "@/hooks/useAuth";
import { useDoctorPresence } from "@/hooks/useDoctorPresenceApi";
import {
  useDoctorDashboardFollowUps,
  useDoctorDashboardPending,
  useDoctorDashboardPracticeStats,
  useDoctorDashboardWeekOverview,
  useDoctorDashboardYesterdaySummary,
} from "@/hooks/useDoctorDashboardApi";
import { useHospitalHolidays } from "@/hooks/useHospitalHolidaysApi";
import {
  useApplyForLeave,
  useNudgeLeaveRequest,
  usePreviewLeaveImpact,
} from "@/hooks/useLeaveRequestsApi";
import { useHospitalAppointmentsApi } from "@/hooks/useNewAppointmentsApi";
import { useHospitalDoctors } from "@/hooks/useNewDoctorApi";
import { usePackagesList } from "@/hooks/useNewPackageApi";
import type {
  DoctorDashboardFollowUp,
  DoctorDashboardPending,
  WeekOverviewDay,
} from "@/types/doctorDashboard";
import type { Doctor } from "@/types/doctorNew";
import type { HospitalHoliday } from "@/types/hospitalHoliday";
import type { PackageRecord } from "@/types/package";

interface DoctorDashboardPageProps {
  hospitalId: string;
  doctorId: string;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function mondayOf(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dow = d.getDay(); // 0=Sun..6=Sat
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return d;
}

// Local calendar date, not `.toISOString()` (queueBoard's toISODate) — that
// converts to UTC first, which shifts a locally-midnight Date back a day in
// any timezone ahead of UTC (e.g. IST), understating "this week" by one day.
function toLocalISODate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

function windowsLabel(
  windows: { startTime: string; endTime: string }[],
): string {
  if (windows.length === 0) return "—";
  return windows
    .map((w) => `${formatTime12h(w.startTime)}–${formatTime12h(w.endTime)}`)
    .join(", ");
}

function windowsForDayName(
  doctor: Doctor,
  dayName: string,
): { startTime: string; endTime: string }[] {
  return (doctor.availability || [])
    .filter((w) => w.day === dayName)
    .slice()
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

// A holiday active on `dateIso` and not excepted for this doctor closes OPD
// entirely (full/opd_closed) or truncates the day's windows to before its
// cutoff (half_day) — mirrors doctor-dashboard.service.ts's getWeekOverview
// so "next session" never lands on a day the clinic is actually closed.
function effectiveWindowsForDate(
  doctor: Doctor,
  dateIso: string,
  holidays: HospitalHoliday[],
): { start: number; end: number }[] {
  const dayName = format(new Date(`${dateIso}T00:00:00`), "EEEE");
  const raw = windowsForDayName(doctor, dayName);
  if (raw.length === 0) return [];

  const holiday = holidays.find(
    (h) =>
      h.status === "active" &&
      h.startsOn <= dateIso &&
      h.endsOn >= dateIso &&
      !h.exceptionDoctorIds?.includes(doctor.id),
  );
  const toRange = (w: { startTime: string; endTime: string }) => ({
    start: toMinutes(w.startTime),
    end: toMinutes(w.endTime),
  });
  if (!holiday) return raw.map(toRange);
  if (holiday.closureType === "full" || holiday.closureType === "opd_closed") {
    return [];
  }
  if (holiday.closureType === "half_day" && holiday.halfDayUntil) {
    const cutoff = toMinutes(holiday.halfDayUntil);
    return raw
      .map(toRange)
      .map((w) => ({ start: w.start, end: Math.min(w.end, cutoff) }))
      .filter((w) => w.start < w.end);
  }
  return raw.map(toRange);
}

export default function DoctorDashboardPage({
  hospitalId,
  doctorId,
}: DoctorDashboardPageProps) {
  const { navigateToHospitalRoute } = useAuth();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  const today = toISODate(now);
  const weekStartDate = toLocalISODate(mondayOf(now));
  const currentMonth = monthKey(now);

  const { data: doctorsData = { doctors: [] } } =
    useHospitalDoctors(hospitalId);
  const doctor = doctorsData.doctors.find((d: Doctor) => d.id === doctorId);
  const { data: presenceOverrides = {} } = useDoctorPresence(
    hospitalId,
    today,
  );

  const todayParams = useMemo(() => {
    const p = new URLSearchParams();
    p.append("startDate", today);
    p.append("endDate", today);
    p.append("userRole", "doctor");
    p.append("doctorId", doctorId);
    return p;
  }, [today, doctorId]);
  const { appointments, isLoading: appointmentsLoading } =
    useHospitalAppointmentsApi(hospitalId, "doctor", true, todayParams);

  const { data: pending, isLoading: pendingLoading } =
    useDoctorDashboardPending(hospitalId, doctorId);
  const { data: followUps = [] } = useDoctorDashboardFollowUps(
    7,
    hospitalId,
    doctorId,
  );
  const { data: weekOverview } = useDoctorDashboardWeekOverview(
    weekStartDate,
    hospitalId,
    doctorId,
  );
  const { data: practiceStats } = useDoctorDashboardPracticeStats(
    currentMonth,
    hospitalId,
    doctorId,
  );
  const { data: yesterday } = useDoctorDashboardYesterdaySummary(
    hospitalId,
    doctorId,
  );
  const { data: packagesData } = usePackagesList(
    hospitalId,
    undefined,
    doctorId,
  );

  // Both years so a 30-day "next session" search never falls off the edge
  // of the fetched calendar when today is late in the year.
  const currentYear = now.getFullYear();
  const { data: holidaysThisYear } = useHospitalHolidays(
    currentYear,
    hospitalId,
  );
  const { data: holidaysNextYear } = useHospitalHolidays(
    currentYear + 1,
    hospitalId,
  );
  const holidays: HospitalHoliday[] = [
    ...(holidaysThisYear?.holidays || []),
    ...(holidaysNextYear?.holidays || []),
  ];

  const [showLeaveDialog, setShowLeaveDialog] = useState(false);

  const isLoading = !doctor || appointmentsLoading || pendingLoading;
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-violet" />
      </div>
    );
  }

  const lane: QueueLane = buildLanes([doctor], appointments, now)[0];
  const windows = effectiveWindowsForDate(doctor, today, holidays);
  const presence = computePresence(lane, presenceOverrides[doctorId], now);

  const nowMins = now.getHours() * 60 + now.getMinutes();
  const nextWindow = windows.find((w) => nowMins < w.start);
  const currentWindow = windows.find(
    (w) => nowMins >= w.start && nowMins < w.end,
  );
  const insideWindow = !!currentWindow;
  const liveBanner = nextWindow
    ? {
        title: `Clinic starts in ${nextWindow.start - nowMins} minute${nextWindow.start - nowMins === 1 ? "" : "s"}`,
        sub: `${lane.all.length} patient${lane.all.length === 1 ? "" : "s"} booked · ${lane.waiting.length + lane.inConsultation.length} already checked in and waiting`,
      }
    : insideWindow
      ? {
          title: "Clinic is open",
          sub: `${lane.waiting.length} waiting · ${lane.inConsultation.length} with you now`,
        }
      : {
          title: windows.length
            ? "Clinic hours are over for today"
            : "Not consulting today",
          sub: `${lane.done.length} seen · ${lane.all.length} booked in total`,
        };

  const newPatientAppts = lane.all.filter((a) => {
    return a.createdAt && toISODate(new Date(a.createdAt)) === today;
  });

  const sessionEnd = windows.length ? windows[windows.length - 1].end : null;

  // "Next session" must roll forward once today has nothing genuinely ahead
  // of us — either every window today has already passed, or we're sitting
  // inside the last one right now. currentWindow is deliberately excluded:
  // a session already in progress isn't "next", it's the one the live
  // banner above is already describing.
  const nextSession = (() => {
    const upcomingWindow = nextWindow;
    if (upcomingWindow) {
      return {
        dateLabel: "Today",
        startLabel: formatTime12h(minutesToTimeStr(upcomingWindow.start)),
        endLabel:
          sessionEnd != null
            ? formatTime12h(minutesToTimeStr(sessionEnd))
            : null,
        patients: lane.all.length,
        firstVisits: newPatientAppts.length,
      };
    }
    // Walk forward day by day (skipping full/opd_closed holidays, and
    // truncating half-days) rather than only checking weekly availability —
    // otherwise a holiday tomorrow gets shown as tomorrow's session.
    const cursor = new Date(now);
    cursor.setDate(cursor.getDate() + 1);
    for (let i = 0; i < 30; i++) {
      const dateIso = toLocalISODate(cursor);
      const dayWindows = effectiveWindowsForDate(doctor, dateIso, holidays);
      if (dayWindows.length > 0) {
        const nextDate = new Date(`${dateIso}T00:00:00`);
        return {
          dateLabel: format(nextDate, "EEE, d MMM"),
          startLabel: formatTime12h(minutesToTimeStr(dayWindows[0].start)),
          endLabel: formatTime12h(
            minutesToTimeStr(dayWindows[dayWindows.length - 1].end),
          ),
          patients: null as number | null,
          firstVisits: null as number | null,
        };
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return null;
  })();

  return (
    <div className="pb-16">
      {/* header */}
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <h1 className="font-display tracking-tight text-2xl font-bold text-ink-900">
            Good{" "}
            {nowMins < 12 * 60
              ? "morning"
              : nowMins < 17 * 60
                ? "afternoon"
                : "evening"}
            , Dr. {doctor.name.split(" ")[0]}
          </h1>
          <p className="text-xs text-ink-500 mt-0.5">
            {format(now, "EEEE, d MMMM")} ·{" "}
            {windows.length
              ? windowsLabel(
                  windows.map((w) => ({
                    startTime: minutesToTimeStr(w.start),
                    endTime: minutesToTimeStr(w.end),
                  })),
                )
              : "not working today"}
          </p>
        </div>
        <span className="ml-auto flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold ${
              presence.tone === "in"
                ? "border-status-open/30 bg-status-open-soft text-status-open"
                : presence.tone === "late"
                  ? "border-status-warning/30 bg-status-warning-soft text-status-warning"
                  : presence.tone === "notIn"
                    ? "border-status-danger/30 bg-status-danger-soft text-status-danger"
                    : "border-border bg-surface-canvas text-ink-700"
            }`}
          >
            {presence.label}
          </span>
          <button
            type="button"
            onClick={() => setShowLeaveDialog(true)}
            className="h-9 px-4 rounded-lg border border-border text-sm font-medium text-ink-700 hover:bg-surface-canvas"
          >
            Apply for leave
          </button>
        </span>
      </div>

      {/* live banner */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl bg-gradient-to-r from-brand-violet to-brand-violet-hover text-white px-5 py-4 mb-4">
        <div>
          <div className="text-lg font-bold">{liveBanner.title}</div>
          <div className="text-sm opacity-90 mt-0.5">{liveBanner.sub}</div>
        </div>
        <div className="ml-auto flex items-center gap-6">
          <div className="flex gap-5">
            <StatMini value={lane.all.length} label="Booked" />
            <StatMini
              value={lane.waiting.length + lane.inConsultation.length}
              label="Here"
            />
            <StatMini value={newPatientAppts.length} label="New" />
          </div>
          <button
            type="button"
            onClick={() => navigateToHospitalRoute("/today")}
            className="h-10 px-5 rounded-lg bg-white text-brand-violet text-sm font-bold hover:bg-white/90"
          >
            Open Today →
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_372px] gap-4 items-start">
        <div className="space-y-4">
          {/* waiting on you */}
          <WaitingOnYouCard
            pending={pending || null}
            hospitalId={hospitalId}
            onGoToday={() => navigateToHospitalRoute("/today")}
            onOpenPrescription={(appointmentId) =>
              navigateToHospitalRoute(
                `/appointments/${appointmentId}/prescription`,
              )
            }
          />

          {/* your week */}
          <WeekCard
            days={weekOverview?.days || []}
            onChangeHours={() => navigateToHospitalRoute("/settings")}
          />

          {/* your practice */}
          <PracticeStatsCard
            stats={practiceStats || null}
            month={currentMonth}
          />
        </div>

        <div className="space-y-4">
          {/* next session */}
          <div className="rounded-xl bg-gradient-to-br from-status-open to-status-open-hover text-white px-4 py-4">
            <div className="text-[10.5px] uppercase tracking-wide opacity-80 font-bold">
              Next session
            </div>
            <div className="font-mono tabular text-xl font-bold mt-1">
              {nextSession
                ? `${nextSession.dateLabel} · ${nextSession.startLabel}`
                : "No upcoming session scheduled"}
            </div>
            <div className="text-xs opacity-90 mt-1">
              {nextSession?.patients != null
                ? `${nextSession.patients} patients · ${nextSession.firstVisits} first visit${nextSession.firstVisits === 1 ? "" : "s"}`
                : ""}
              {nextSession?.endLabel
                ? `${nextSession.patients != null ? " · " : ""}ends ${nextSession.endLabel}`
                : ""}
            </div>
          </div>

          {/* follow-ups due */}
          <FollowUpsDueCard followUps={followUps} />

          {/* patients on packages */}
          <PackagesCard packages={packagesData?.packages || []} />

          {/* yesterday */}
          <YesterdayCard summary={yesterday || null} />
        </div>
      </div>

      {showLeaveDialog && (
        <ApplyForLeaveDialog
          hospitalId={hospitalId}
          onClose={() => setShowLeaveDialog(false)}
        />
      )}
    </div>
  );
}

function StatMini({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <div className="font-mono text-2xl font-bold leading-tight">{value}</div>
      <div className="text-[10px] uppercase tracking-wide opacity-80 font-semibold">
        {label}
      </div>
    </div>
  );
}

function Card({
  title,
  sub,
  children,
  action,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-surface-paper border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <h2 className="font-display tracking-tight text-sm font-bold text-ink-900">{title}</h2>
        <span className="flex-1" />
        {sub && <span className="text-xs text-ink-500">{sub}</span>}
        {action}
      </div>
      {children}
    </div>
  );
}

function WaitingOnYouCard({
  pending,
  onGoToday,
  onOpenPrescription,
}: {
  pending: DoctorDashboardPending | null;
  hospitalId: string;
  onGoToday: () => void;
  onOpenPrescription: (appointmentId: string) => void;
}) {
  const nudgeMutation = useNudgeLeaveRequest();
  const nudge = useCallback(
    (leaveRequestId: string) => nudgeMutation.mutate(leaveRequestId),
    [nudgeMutation],
  );
  if (!pending) return null;

  const leaveRequest = pending.pendingLeaveRequest;
  const count =
    pending.unwrittenNotes.length +
    pending.unsignedPrescriptions.length +
    (pending.missedFollowUps.length > 0 ? 1 : 0) +
    (leaveRequest ? 1 : 0);

  if (count === 0) {
    return (
      <Card title="Waiting on you">
        <div className="px-4 py-6 text-sm text-ink-500">
          Nothing needs your attention right now.
        </div>
      </Card>
    );
  }

  return (
    <Card
      title="Waiting on you"
      sub="Things only you can finish"
      action={
        <span className="bg-status-warning text-white rounded-full text-[10.5px] px-2 py-0.5 font-bold">
          {count}
        </span>
      }
    >
      {pending.unwrittenNotes.length > 0 && (
        <Row
          icon="✎"
          iconTone="warning"
          title={`${pending.unwrittenNotes.length} visit${pending.unwrittenNotes.length === 1 ? "" : "s"} completed without notes`}
          sub={pending.unwrittenNotes
            .map((n) => n.patientName)
            .filter(Boolean)
            .join(", ")}
          actionLabel="Write now"
          onAction={onGoToday}
        />
      )}
      {pending.unsignedPrescriptions.map((p) => (
        <Row
          key={p.appointmentId}
          icon="Rx"
          iconTone="brand"
          title="A prescription is drafted but not signed"
          sub={`${p.patientName || "Patient"} · ${p.medicineCount} medicine${p.medicineCount === 1 ? "" : "s"}`}
          actionLabel="Review & sign"
          onAction={() => onOpenPrescription(p.appointmentId)}
        />
      ))}
      {pending.missedFollowUps.length > 0 && (
        <Row
          icon="↺"
          iconTone="danger"
          title={`${pending.missedFollowUps.length} patient${pending.missedFollowUps.length === 1 ? "" : "s"} missed the follow-up you asked for`}
          sub={pending.missedFollowUps
            .map((f) => `${f.patientName} — ${f.daysOverdue}d overdue`)
            .join(" · ")}
          actionLabel="See them"
          onAction={onGoToday}
        />
      )}
      {leaveRequest && (
        <Row
          icon="⏷"
          iconTone="neutral"
          title={`Your leave request for ${leaveRequest.startDate} is still pending`}
          sub={`${leaveRequest.affectedAppointmentCount} appointment(s) would need moving`}
          actionLabel="Nudge"
          onAction={() => nudge(leaveRequest.id)}
        />
      )}
    </Card>
  );
}

function Row({
  icon,
  iconTone,
  title,
  sub,
  actionLabel,
  onAction,
}: {
  icon: string;
  iconTone: "warning" | "brand" | "danger" | "neutral";
  title: string;
  sub: string;
  actionLabel: string;
  onAction: () => void;
}) {
  const iconCls = {
    warning: "bg-status-warning-soft text-status-warning",
    brand: "bg-brand-violet-soft text-brand-violet",
    danger: "bg-status-danger-soft text-status-danger",
    neutral: "bg-surface-canvas text-ink-700",
  }[iconTone];
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-t border-border first:border-t-0">
      <span
        className={`w-8 h-8 rounded-lg grid place-items-center text-sm font-bold shrink-0 ${iconCls}`}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[13.5px] font-semibold text-ink-900">
          {title}
        </span>
        <span className="block text-[11.5px] text-ink-500 truncate">{sub}</span>
      </span>
      <button
        type="button"
        onClick={onAction}
        className="ml-auto shrink-0 h-8 px-3 rounded-lg border border-border text-xs font-semibold text-ink-700 hover:bg-surface-canvas"
      >
        {actionLabel}
      </button>
    </div>
  );
}

function WeekCard({
  days,
  onChangeHours,
}: {
  days: WeekOverviewDay[];
  onChangeHours: () => void;
}) {
  const holidayBanners = days
    .filter(
      (
        d,
      ): d is WeekOverviewDay & {
        holiday: NonNullable<WeekOverviewDay["holiday"]>;
      } => !!d.holiday,
    )
    .map((d) => `${d.date} · ${d.holiday.name}`);
  const leaves = days
    .filter(
      (
        d,
      ): d is WeekOverviewDay & {
        leave: NonNullable<WeekOverviewDay["leave"]>;
      } => !!d.leave,
    )
    .map((d) => d.leave);
  const leaveBanners = Array.from(
    new Map(leaves.map((l) => [`${l.startDate}-${l.endDate}`, l])).values(),
  );

  return (
    <Card
      title="Your week"
      action={
        <button
          type="button"
          onClick={onChangeHours}
          className="h-8 px-3 rounded-lg border border-border text-xs font-semibold text-ink-700 hover:bg-surface-canvas"
        >
          Change hours
        </button>
      }
    >
      <div className="p-4">
        <div className="grid grid-cols-7 gap-2">
          {days.map((d) => {
            const dayDate = new Date(`${d.date}T00:00:00`);
            const pct =
              d.totalSlots > 0
                ? Math.min(
                    100,
                    Math.round((d.bookedCount / d.totalSlots) * 100),
                  )
                : 0;
            const isToday = toISODate(new Date()) === d.date;
            return (
              <div
                key={d.date}
                className={`border rounded-lg p-2 text-center ${isToday ? "border-brand-violet bg-brand-violet-soft" : "border-border"}`}
              >
                <div
                  className={`font-mono tabular text-[10px] uppercase font-bold ${isToday ? "text-brand-violet" : "text-ink-500"}`}
                >
                  {format(dayDate, "EEE")}
                </div>
                <div
                  className={`font-mono tabular text-lg font-bold ${isToday ? "text-brand-violet" : "text-ink-900"}`}
                >
                  {format(dayDate, "d")}
                </div>
                <div
                  className="text-[10px] text-ink-500 mt-0.5 truncate"
                  title={windowsLabel(d.windows)}
                >
                  {d.isWorkingDay
                    ? windowsLabel(d.windows)
                    : d.holiday
                      ? d.holiday.name
                      : "off"}
                </div>
                <div className="h-1 rounded-full bg-surface-canvas mt-1.5 overflow-hidden">
                  <div
                    className={`h-full ${isToday ? "bg-brand-violet" : "bg-status-open"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="text-[10px] text-ink-500 mt-1">
                  {d.isWorkingDay ? `${d.bookedCount} of ${d.totalSlots}` : "—"}
                </div>
              </div>
            );
          })}
        </div>
        {(holidayBanners.length > 0 || leaveBanners.length > 0) && (
          <div className="flex flex-wrap gap-2 mt-3">
            {leaveBanners.map((l) => (
              <span
                key={`${l.startDate}-${l.endDate}`}
                className="rounded-lg border border-status-warning/30 bg-status-warning-soft text-status-warning text-xs font-semibold px-3 py-1.5"
              >
                {l.startDate}–{l.endDate} · your leave ({l.status})
              </span>
            ))}
            {holidayBanners.map((h) => (
              <span
                key={h}
                className="rounded-lg border border-status-danger/30 bg-status-danger-soft text-status-danger text-xs font-semibold px-3 py-1.5"
              >
                {h}
              </span>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

function PracticeStatsCard({
  stats,
  month,
}: {
  stats: import("@/types/doctorDashboard").DoctorDashboardPracticeStats | null;
  month: string;
}) {
  if (!stats) return null;

  const tiles = [
    {
      label: "Patients seen",
      value: `${stats.patientsSeen.value}`,
      delta: stats.patientsSeen.delta,
      sub: `across ${stats.patientsSeen.clinicDaysCount} clinic days`,
    },
    {
      label: "Average consultation",
      value:
        stats.avgConsultationMinutes != null
          ? `${stats.avgConsultationMinutes} min`
          : "—",
      delta: null,
      sub: "",
    },
    {
      label: "Diary filled",
      value:
        stats.diaryFilledPct.value != null
          ? `${stats.diaryFilledPct.value}%`
          : "—",
      delta: stats.diaryFilledPct.delta,
      sub: "",
    },
    {
      label: "Billed through you",
      value: `₹${stats.billed.value.toLocaleString()}`,
      delta: stats.billed.delta,
      sub: `avg ₹${stats.billed.avgPerVisit} per visit`,
    },
    {
      label: "No-shows",
      value: stats.noShowPct.value != null ? `${stats.noShowPct.value}%` : "—",
      delta: stats.noShowPct.delta,
      sub: "",
      invertDelta: true,
    },
    {
      label: "Notes written same day",
      value: stats.notesSameDayPct != null ? `${stats.notesSameDayPct}%` : "—",
      delta: null,
      sub: "",
    },
  ];

  return (
    <Card title="Your practice" sub={`${month} · compared with last month`}>
      <div className="grid grid-cols-2 sm:grid-cols-3 divide-x divide-y divide-border">
        {tiles.map((t) => (
          <div key={t.label} className="px-4 py-3">
            <div className="text-[10.5px] uppercase tracking-wide text-ink-500 font-bold">
              {t.label}
            </div>
            <div className="text-xl font-bold text-ink-900 mt-0.5 font-mono">
              {t.value}
              {t.delta != null && t.delta !== 0 && (
                <span
                  className={`ml-1.5 text-[11px] font-bold rounded px-1.5 py-0.5 align-middle ${
                    (t.invertDelta ? t.delta < 0 : t.delta > 0)
                      ? "bg-status-open-soft text-status-open"
                      : "bg-status-danger-soft text-status-danger"
                  }`}
                >
                  {t.delta > 0 ? "+" : ""}
                  {t.delta}
                </span>
              )}
            </div>
            {t.sub && (
              <div className="text-[11px] text-ink-500 mt-0.5">{t.sub}</div>
            )}
          </div>
        ))}
      </div>
      {stats.insight && (
        <div className="px-4 py-3 border-t border-border bg-surface-canvas/40 text-[11.5px] text-ink-500">
          {stats.insight}
        </div>
      )}
    </Card>
  );
}

function FollowUpsDueCard({
  followUps,
}: {
  followUps: DoctorDashboardFollowUp[];
}) {
  return (
    <Card title="Follow-ups due" sub="Next 7 days">
      {followUps.length === 0 ? (
        <div className="px-4 py-4 text-sm text-ink-500">Nothing due soon.</div>
      ) : (
        followUps.map((f) => (
          <div
            key={f.appointmentId}
            className="flex items-center gap-3 px-4 py-3 border-t border-border first:border-t-0"
          >
            <span className="min-w-0">
              <span className="block text-[13.5px] font-semibold text-ink-900">
                {f.patientName}
              </span>
              <span className="block text-[11.5px] text-ink-500">
                {f.state === "booked"
                  ? `Due ${f.dueDate} · booked ${f.bookedDate} ${f.bookedTime ? formatTime12h(f.bookedTime) : ""}`
                  : `Asked to return by ${f.dueDate} · not booked`}
              </span>
            </span>
            <span className="ml-auto shrink-0">
              <span
                className={`rounded px-2 py-1 text-[10px] font-bold ${
                  f.state === "late"
                    ? "bg-status-danger-soft text-status-danger"
                    : f.state === "booked"
                      ? "bg-status-open-soft text-status-open"
                      : "bg-status-warning-soft text-status-warning"
                }`}
              >
                {f.state === "late"
                  ? `${f.dayDelta}d late`
                  : f.state === "booked"
                    ? "Booked"
                    : `In ${f.dayDelta}d`}
              </span>
            </span>
          </div>
        ))
      )}
    </Card>
  );
}

function PackagesCard({ packages }: { packages: PackageRecord[] }) {
  const owed = packages.filter(
    (p) => p.status === "active" && p.remainingVisits > 0,
  );
  const totalVisitsOwed = owed.reduce((s, p) => s + p.remainingVisits, 0);
  const shown = owed.slice(0, 2);
  const more = owed.length - shown.length;

  return (
    <Card title="Patients on packages" sub="Visits you owe">
      {owed.length === 0 ? (
        <div className="px-4 py-4 text-sm text-ink-500">
          No active packages.
        </div>
      ) : (
        <>
          {shown.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-3 px-4 py-3 border-t border-border first:border-t-0"
            >
              <span className="min-w-0">
                <span className="block text-[13.5px] font-semibold text-ink-900">
                  {p.patientName}
                </span>
                <span className="block text-[11.5px] text-ink-500">
                  {p.remainingVisits} of {p.totalVisits} left · expires{" "}
                  {p.validUntil}
                </span>
              </span>
              <span className="ml-auto shrink-0 rounded bg-brand-violet-soft text-brand-violet text-[10px] font-bold px-2 py-1">
                {p.remainingVisits} left
              </span>
            </div>
          ))}
          {more > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 border-t border-border text-sm">
              <span className="text-ink-700">
                {more} more patient{more === 1 ? "" : "s"}
              </span>
              <span className="text-ink-500 text-xs">
                {totalVisitsOwed} visits outstanding in total
              </span>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function YesterdayCard({
  summary,
}: {
  summary:
    | import("@/types/doctorDashboard").DoctorDashboardYesterdaySummary
    | null;
}) {
  if (!summary) return null;
  const hours = Math.floor(summary.consultationMinutes / 60);
  const mins = summary.consultationMinutes % 60;

  return (
    <Card title="What you did yesterday">
      <div className="px-4 py-3 border-t-0 text-[13px] text-ink-700 space-y-2">
        <div>
          <b className="text-ink-900">{summary.patientsSeenCount} patients</b>{" "}
          seen
          {summary.consultationMinutes > 0
            ? ` · ${hours > 0 ? `${hours}h ` : ""}${mins}m in consultation`
            : ""}
        </div>
        <div>
          <b className="text-ink-900">
            {summary.prescriptionsSignedCount} prescriptions
          </b>{" "}
          signed and sent
        </div>
        {summary.notesUnwrittenCount > 0 && (
          <div className="text-status-warning">
            <b>{summary.notesUnwrittenCount} notes</b> still unwritten from the
            evening
          </div>
        )}
        {summary.noShows.count > 0 && (
          <div className="text-status-danger">
            <b>{summary.noShows.count} no-shows</b>
            {summary.noShows.times.length > 0
              ? ` · ${summary.noShows.times.map(formatTime12h).join(" and ")}`
              : ""}
          </div>
        )}
      </div>
    </Card>
  );
}

function ApplyForLeaveDialog({
  hospitalId,
  onClose,
}: {
  hospitalId: string;
  onClose: () => void;
}) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const previewImpact = usePreviewLeaveImpact(hospitalId);
  const applyForLeave = useApplyForLeave(hospitalId);

  const canPreview = !!startDate && !!endDate && endDate >= startDate;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-surface-paper rounded-xl border border-border w-full max-w-md">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-display tracking-tight text-base font-bold text-ink-900">Apply for leave</h3>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-semibold text-ink-500">
              From
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  previewImpact.reset();
                }}
                className="mt-1 w-full px-3 py-2 border border-border rounded-lg text-sm"
              />
            </label>
            <label className="text-xs font-semibold text-ink-500">
              To
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  previewImpact.reset();
                }}
                className="mt-1 w-full px-3 py-2 border border-border rounded-lg text-sm"
              />
            </label>
          </div>
          <label className="block text-xs font-semibold text-ink-500">
            Reason (optional)
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              className="mt-1 w-full px-3 py-2 border border-border rounded-lg text-sm"
            />
          </label>

          {previewImpact.data && (
            <div className="rounded-lg bg-status-warning-soft border border-status-warning/30 text-status-warning text-sm px-3 py-2">
              {previewImpact.data.affectedAppointmentCount} appointment(s) would
              need moving.
            </div>
          )}
          {applyForLeave.isSuccess && (
            <div className="rounded-lg bg-status-open-soft border border-status-open/30 text-status-open text-sm px-3 py-2">
              Leave request sent for approval.
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 px-5 py-4 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-lg border border-border text-sm font-medium text-ink-700 hover:bg-surface-canvas"
          >
            Close
          </button>
          <span className="flex-1" />
          <button
            type="button"
            disabled={!canPreview || previewImpact.isPending}
            onClick={() => previewImpact.mutate({ startDate, endDate })}
            className="h-9 px-4 rounded-lg border border-border text-sm font-medium text-ink-700 hover:bg-surface-canvas disabled:opacity-50"
          >
            Check impact
          </button>
          <button
            type="button"
            disabled={
              !canPreview || applyForLeave.isPending || applyForLeave.isSuccess
            }
            onClick={() =>
              applyForLeave.mutate({
                startDate,
                endDate,
                reason: reason || undefined,
              })
            }
            className="h-9 px-4 rounded-lg bg-brand-violet hover:bg-brand-violet-hover text-white text-sm font-semibold disabled:opacity-50"
          >
            Submit request
          </button>
        </div>
      </div>
    </div>
  );
}
