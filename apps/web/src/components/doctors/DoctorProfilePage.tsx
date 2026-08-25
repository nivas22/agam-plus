// components/doctors/DoctorProfilePage.tsx
"use client";

import { differenceInCalendarDays, format } from "date-fns";
import { ArrowLeft, Package as PackageIcon, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useDoctorPresence } from "@/hooks/useDoctorPresenceApi";
import { useHospitalHolidays } from "@/hooks/useHospitalHolidaysApi";
import { useLeaveRequests } from "@/hooks/useLeaveRequestsApi";
import { useHospitalAppointments } from "@/hooks/useNewAppointmentsApi";
import {
  useHospitalDoctor,
  useUpdateHospitalDoctor,
} from "@/hooks/useNewDoctorApi";
import { usePackagesList } from "@/hooks/useNewPackageApi";
import { useHospitalPayments } from "@/hooks/useNewPaymentApi";
import type { AppointmentWithDetails } from "@/types/appointment";
import type { Payment } from "@/types/payment";
import { APPOINTMENT_STATUS, PACKAGE_DISPLAY_STATUS } from "../../constants";
import {
  buildLanes,
  computePresence,
  DEFAULT_WALKIN_FAIRNESS_MINUTES,
  formatTime12h,
  minutesBetween,
  minutesToTimeStr,
  todaysWindows,
  toISODate,
  type WindowRange,
} from "../queue/queueBoard";
import DoctorAvatar from "./DoctorAvatar";

interface DoctorProfilePageProps {
  hospitalId: string;
  doctorId: string;
}

const DAY_LABELS_SHORT: Record<string, string> = {
  Monday: "Mon",
  Tuesday: "Tue",
  Wednesday: "Wed",
  Thursday: "Thu",
  Friday: "Fri",
  Saturday: "Sat",
  Sunday: "Sun",
};
const WEEK_ORDER = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

function money(v: number): string {
  return `₹${Math.round(v).toLocaleString("en-IN")}`;
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function formatHours(h: number): string {
  return `${Number(h.toFixed(1))}h`;
}

// "9:00" / "13:00" -> "9:00" / "1:00" — matches the doctor's own working-hours
// tag, deliberately without AM/PM since the tag always pairs two ranges
// (morning & evening) where the period is obvious from context.
function formatHourRange(start: string, end: string): string {
  const fmt = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, "0")}`;
  };
  return `${fmt(start)}–${fmt(end)}`;
}

interface TimeSlotLike {
  day: string;
  startTime: string;
  endTime: string;
}

function windowsForWeekday(availability: TimeSlotLike[], weekday: string) {
  return availability.filter((w) => w.day === weekday);
}

function slotsForWindow(
  startTime: string,
  endTime: string,
  duration: number,
): string[] {
  const slots: string[] = [];
  let cur = hhmmToMinutes(startTime);
  const end = hhmmToMinutes(endTime);
  while (cur + duration <= end) {
    slots.push(minutesToTimeStr(cur));
    cur += duration;
  }
  return slots;
}

function slotCountForWeekday(
  availability: TimeSlotLike[],
  weekday: string,
  duration: number,
): number {
  return windowsForWeekday(availability, weekday).reduce(
    (sum, w) => sum + slotsForWindow(w.startTime, w.endTime, duration).length,
    0,
  );
}

function hoursForWeekday(
  availability: TimeSlotLike[],
  weekday: string,
): number {
  return windowsForWeekday(availability, weekday).reduce(
    (sum, w) =>
      sum + (hhmmToMinutes(w.endTime) - hhmmToMinutes(w.startTime)) / 60,
    0,
  );
}

const OVER_CAPACITY_LABELS: Record<string, string> = {
  allow: "Allow overbooking",
  warn: "Warn the desk",
  block: "Block booking",
};

function formatMinutesBefore(mins?: number | null): string | undefined {
  if (!mins) return undefined;
  if (mins % 60 === 0) {
    const h = mins / 60;
    return `${h} hour${h > 1 ? "s" : ""} before`;
  }
  return `${mins} min before`;
}

/* ---------------------------------------------------------------------- */
/*                    today's sessions — per-slot detail                  */
/* ---------------------------------------------------------------------- */

type SlotStatus = "done" | "booked" | "walkin" | "cancelled" | "held" | "free";

interface SessionSlot {
  time: string;
  status: SlotStatus;
  appointment?: AppointmentWithDetails;
}

interface SessionInfo {
  key: string;
  label: string;
  window: WindowRange;
  slots: SessionSlot[];
  totalCapacity: number;
  doneCount: number;
  walkInCount: number;
  bookedCount: number;
  cancelledCount: number;
  heldTotal: number;
  heldUsed: number;
  heldFree: number;
}

function sessionLabelFor(window: WindowRange): string {
  if (window.start < 12 * 60) return "Morning";
  if (window.start < 16 * 60) return "Afternoon";
  return "Evening";
}

// Builds one session's slot-by-slot picture from the doctor's booking-rule
// fields and today's appointments. Held slots aren't tagged in the data —
// the backend just tracks how many are configured per session — so the
// still-free tail of the session (as many as heldFree) is displayed as
// "held for walk-ins", consistent with how heldSlotsPerSession is meant to
// be spent: keep capacity open near the end of the session rather than
// letting online booking fill the whole thing.
function buildSessionInfo(
  window: WindowRange,
  duration: number,
  appointmentsToday: AppointmentWithDetails[],
  heldPerSession: number,
  acceptWalkIns: boolean,
): SessionInfo {
  const times = slotsForWindow(
    minutesToTimeStr(window.start),
    minutesToTimeStr(window.end),
    duration,
  );
  const byTime = new Map<string, AppointmentWithDetails>();
  appointmentsToday.forEach((a) => {
    const mins = hhmmToMinutes(a.time);
    if (mins >= window.start && mins < window.end) byTime.set(a.time, a);
  });

  let doneCount = 0;
  let walkInCount = 0;
  let bookedCount = 0;
  let cancelledCount = 0;
  const slots: SessionSlot[] = times.map((t) => {
    const appt = byTime.get(t);
    if (!appt) return { time: t, status: "free" as const };
    if (
      appt.status === APPOINTMENT_STATUS.CANCELLED ||
      appt.status === APPOINTMENT_STATUS.NO_SHOW
    ) {
      cancelledCount++;
      return { time: t, status: "cancelled" as const, appointment: appt };
    }
    if (appt.bookingSource === "walk-in") {
      walkInCount++;
      return { time: t, status: "walkin" as const, appointment: appt };
    }
    if (appt.status === APPOINTMENT_STATUS.COMPLETED) {
      doneCount++;
      return { time: t, status: "done" as const, appointment: appt };
    }
    bookedCount++;
    return { time: t, status: "booked" as const, appointment: appt };
  });

  const heldTotal = acceptWalkIns ? Math.max(0, heldPerSession) : 0;
  const heldFree = Math.max(0, heldTotal - walkInCount);
  const heldUsed = Math.min(heldTotal, walkInCount);

  if (heldFree > 0) {
    let remaining = heldFree;
    for (let i = slots.length - 1; i >= 0 && remaining > 0; i--) {
      if (slots[i].status === "free") {
        slots[i] = { ...slots[i], status: "held" };
        remaining--;
      }
    }
  }

  return {
    key: `${window.start}-${window.end}`,
    label: sessionLabelFor(window),
    window,
    slots,
    totalCapacity: times.length,
    doneCount,
    walkInCount,
    bookedCount,
    cancelledCount,
    heldTotal,
    heldUsed,
    heldFree,
  };
}

interface SessionMessage {
  tone: "ok" | "done" | "idle";
  text: string;
}

function sessionMessage(
  session: SessionInfo,
  now: Date,
): SessionMessage | null {
  if (session.totalCapacity === 0) return null;
  const nowMins = now.getHours() * 60 + now.getMinutes();
  if (nowMins >= session.window.end) {
    const parts = [`${session.doneCount + session.walkInCount} seen`];
    if (session.cancelledCount > 0)
      parts.push(`${session.cancelledCount} cancelled`);
    return { tone: "done", text: `Session over — ${parts.join(", ")}` };
  }
  if (nowMins < session.window.start) {
    return {
      tone: "idle",
      text: `Starts ${formatTime12h(minutesToTimeStr(session.window.start))}`,
    };
  }
  const freeCount = session.slots.filter(
    (s) => s.status === "free" || s.status === "held",
  ).length;
  if (freeCount === 0) return { tone: "ok", text: "Full for this session" };
  return { tone: "ok", text: "Room to spare — walk-ins welcome" };
}

const MESSAGE_TONE_CLS: Record<SessionMessage["tone"], string> = {
  done: "text-ink-500",
  ok: "text-status-open",
  idle: "text-ink-500",
};

const SLOT_STATUS_CLS: Record<SlotStatus, string> = {
  done: "bg-status-open-soft border-status-open/30 text-status-open",
  booked: "bg-brand-violet-soft border-brand-violet/30 text-brand-violet",
  walkin: "bg-status-warning-soft border-status-warning/30 text-status-warning",
  cancelled: "bg-surface-canvas/60 border-border text-ink-500",
  held: "bg-surface-canvas/40 border-border border-dashed text-ink-500",
  free: "bg-surface-paper border-border text-ink-500",
};

function slotLabel(slot: SessionSlot): string {
  if (slot.status === "free") return "Free";
  if (slot.status === "held") return "Held for walk-ins";
  if (slot.status === "cancelled") {
    return slot.appointment?.status === APPOINTMENT_STATUS.NO_SHOW
      ? "No-show"
      : "Cancelled";
  }
  if (slot.status === "walkin") {
    return slot.appointment?.status === APPOINTMENT_STATUS.COMPLETED
      ? "Walk-in · seen"
      : "Walk-in";
  }
  return slot.appointment?.patientName || "Booked";
}

const PRESENCE_CLS: Record<string, string> = {
  in: "bg-status-open-soft text-status-open",
  expected: "bg-status-warning-soft text-status-warning",
  late: "bg-status-warning-soft text-status-warning",
  notIn: "bg-status-danger-soft text-status-danger",
};

function formatDateRange(start: string, end: string): string {
  const s = new Date(`${start}T00:00:00`);
  if (start === end) return format(s, "d MMM");
  const e = new Date(`${end}T00:00:00`);
  return `${format(s, "d MMM")} – ${format(e, "d MMM")}`;
}

export default function DoctorProfilePage({
  hospitalId,
  doctorId,
}: DoctorProfilePageProps) {
  const router = useRouter();
  const { currentHospital, getCurrentHospitalRole } = useAuth();
  const userRole = getCurrentHospitalRole() || "admin";

  const { data: doctorData, isLoading: doctorLoading } = useHospitalDoctor(
    doctorId,
    hospitalId,
  );
  const doctor = doctorData?.doctor;
  const updateDoctorMutation = useUpdateHospitalDoctor(hospitalId);

  const today = useMemo(() => new Date(), []);
  const todayIso = useMemo(() => toISODate(today), [today]);
  const monthStart = useMemo(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
    [today],
  );
  const monthEnd = useMemo(
    () => new Date(today.getFullYear(), today.getMonth() + 1, 0),
    [today],
  );
  const monthStartIso = useMemo(() => toISODate(monthStart), [monthStart]);
  const monthEndIso = useMemo(() => toISODate(monthEnd), [monthEnd]);
  const weekStart = useMemo(() => {
    const dow = today.getDay();
    const diffToMonday = dow === 0 ? -6 : 1 - dow;
    return addDays(today, diffToMonday);
  }, [today]);

  const rangeStartIso = useMemo(
    () => (weekStart < monthStart ? toISODate(weekStart) : monthStartIso),
    [weekStart, monthStart, monthStartIso],
  );
  const rangeEndIso = useMemo(() => {
    const weekEnd = addDays(weekStart, 6);
    return weekEnd > monthEnd ? toISODate(weekEnd) : monthEndIso;
  }, [weekStart, monthEnd, monthEndIso]);

  const apptParams = useMemo(() => {
    const p = new URLSearchParams();
    p.append("doctorId", doctorId);
    p.append("startDate", rangeStartIso);
    p.append("endDate", rangeEndIso);
    return p;
  }, [doctorId, rangeStartIso, rangeEndIso]);
  const { data: apptData, isLoading: apptLoading } = useHospitalAppointments(
    hospitalId,
    apptParams,
    userRole,
  );
  const rangeAppointments = apptData?.appointments || [];
  const monthAppointments = useMemo(
    () =>
      rangeAppointments.filter(
        (a) => a.date >= monthStartIso && a.date <= monthEndIso,
      ),
    [rangeAppointments, monthStartIso, monthEndIso],
  );
  const appointmentsToday = useMemo(
    () => monthAppointments.filter((a) => a.date === todayIso),
    [monthAppointments, todayIso],
  );

  const paymentParams = useMemo(() => {
    const p = new URLSearchParams();
    p.append("doctorProfileId", doctorId);
    p.append("startDate", `${monthStartIso}T00:00:00.000Z`);
    p.append("endDate", `${monthEndIso}T23:59:59.999Z`);
    return p;
  }, [doctorId, monthStartIso, monthEndIso]);
  const { data: paymentsData } = useHospitalPayments(hospitalId, paymentParams);
  const monthPayments = paymentsData?.payments || [];

  const { data: packagesData } = usePackagesList(
    hospitalId,
    undefined,
    doctorId,
  );
  const doctorPackages = packagesData?.packages || [];

  const { data: presenceOverrides = {} } = useDoctorPresence(
    hospitalId,
    todayIso,
  );

  const { data: holidaysData } = useHospitalHolidays(
    today.getFullYear(),
    hospitalId,
  );
  const { data: approvedLeave } = useLeaveRequests("approved", hospitalId);

  const paymentByAppointmentId = useMemo(() => {
    const map = new Map<string, Payment>();
    monthPayments.forEach((p) => {
      map.set(p.appointmentId, p);
    });
    return map;
  }, [monthPayments]);

  const availability: TimeSlotLike[] = doctor?.availability || [];
  const duration = doctor?.appointmentDuration || 30;

  const lane = useMemo(
    () => (doctor ? buildLanes([doctor], rangeAppointments, today)[0] : null),
    [doctor, rangeAppointments, today],
  );
  const presence = lane
    ? computePresence(lane, presenceOverrides[doctorId], today)
    : null;

  const monthStats = useMemo(() => {
    const completed = monthAppointments.filter(
      (a) => a.status === APPOINTMENT_STATUS.COMPLETED,
    ).length;
    const cancelledCount = monthAppointments.filter(
      (a) => a.status === APPOINTMENT_STATUS.CANCELLED,
    ).length;
    const noShowCount = monthAppointments.filter(
      (a) => a.status === APPOINTMENT_STATUS.NO_SHOW,
    ).length;
    const walkInCount = monthAppointments.filter(
      (a) =>
        a.bookingSource === "walk-in" &&
        a.status !== APPOINTMENT_STATUS.CANCELLED,
    ).length;
    const totalBooked = monthAppointments.length;
    const billed = monthPayments.reduce((sum, p) => sum + p.total, 0);
    const avgBilled = monthPayments.length ? billed / monthPayments.length : 0;

    // "So far" — only days already offered (up to today), not the whole
    // month's theoretical capacity, which would count days not yet worked
    // and inflate the denominator against days that haven't happened.
    let openSlotsSoFar = 0;
    let openSlotsFullMonth = 0;
    const soFarEnd = today < monthEnd ? today : monthEnd;
    const cursor = new Date(monthStart);
    while (cursor <= monthEnd) {
      const weekday = cursor.toLocaleDateString("en-US", { weekday: "long" });
      const count = slotCountForWeekday(availability, weekday, duration);
      openSlotsFullMonth += count;
      if (cursor <= soFarEnd) openSlotsSoFar += count;
      cursor.setDate(cursor.getDate() + 1);
    }
    const diaryFilledPct =
      openSlotsSoFar > 0 ? (totalBooked / openSlotsSoFar) * 100 : 0;

    return {
      completed,
      cancelledCount,
      noShowCount,
      walkInCount,
      totalBooked,
      billed,
      avgBilled,
      openSlotsSoFar,
      openSlotsFullMonth,
      diaryFilledPct,
    };
  }, [
    monthAppointments,
    monthPayments,
    monthStart,
    monthEnd,
    today,
    availability,
    duration,
  ]);

  const leadTimeInsight = useMemo(() => {
    const flagged = monthAppointments.filter(
      (a) =>
        a.status === APPOINTMENT_STATUS.CANCELLED ||
        a.status === APPOINTMENT_STATUS.NO_SHOW,
    );
    if (flagged.length === 0) return null;
    const leadDays = flagged
      .map((a) =>
        differenceInCalendarDays(
          new Date(`${a.date}T00:00:00`),
          new Date(a.createdAt),
        ),
      )
      .filter((n) => Number.isFinite(n));
    if (leadDays.length === 0 || !leadDays.every((d) => d >= 7)) return null;
    return leadDays.length === 1
      ? "Booked more than a week ahead"
      : "All were booked more than a week ahead";
  }, [monthAppointments]);

  const packagesSoldThisMonth = useMemo(
    () =>
      doctorPackages.filter((pkg) => {
        const created = toISODate(new Date(pkg.createdAt));
        return created >= monthStartIso && created <= monthEndIso;
      }),
    [doctorPackages, monthStartIso, monthEndIso],
  );
  const prepaidNotDelivered = packagesSoldThisMonth.reduce(
    (sum, p) => sum + p.valueLeft,
    0,
  );

  const avgConsultMinutes = useMemo(() => {
    const durations = monthAppointments
      .filter(
        (a) =>
          a.status === APPOINTMENT_STATUS.COMPLETED &&
          a.consultationStartedAt &&
          a.completedAt,
      )
      .map((a) =>
        minutesBetween(
          new Date(a.consultationStartedAt as string),
          new Date(a.completedAt as string),
        ),
      )
      .filter((n) => n >= 0);
    if (!durations.length) return null;
    return Math.round(durations.reduce((s, n) => s + n, 0) / durations.length);
  }, [monthAppointments]);

  const packageStats = useMemo(() => {
    const relevant = doctorPackages.filter(
      (pkg) =>
        pkg.displayStatus === PACKAGE_DISPLAY_STATUS.ACTIVE ||
        pkg.displayStatus === PACKAGE_DISPLAY_STATUS.LAPSING,
    );
    const holders = new Set(relevant.map((pkg) => pkg.patientId));
    const visitsOutstanding = relevant.reduce(
      (sum, pkg) => sum + pkg.remainingVisits,
      0,
    );
    const valueOwed = relevant.reduce((sum, pkg) => sum + pkg.valueLeft, 0);
    return { holders: holders.size, visitsOutstanding, valueOwed };
  }, [doctorPackages]);

  const todaySessions = useMemo(() => {
    if (!doctor) return [];
    return todaysWindows(doctor, today).map((w) =>
      buildSessionInfo(
        w,
        duration,
        appointmentsToday,
        doctor.heldSlotsPerSession ?? 0,
        doctor.acceptWalkIns !== false,
      ),
    );
  }, [doctor, today, duration, appointmentsToday]);

  const todayTotals = useMemo(
    () =>
      todaySessions.reduce(
        (acc, s) => ({
          totalSlots: acc.totalSlots + s.totalCapacity,
          held: acc.held + s.heldTotal,
        }),
        { totalSlots: 0, held: 0 },
      ),
    [todaySessions],
  );

  const weekBars = useMemo(
    () =>
      WEEK_ORDER.map((weekday, i) => {
        const dateIso = toISODate(addDays(weekStart, i));
        const totalSlots = slotCountForWeekday(availability, weekday, duration);
        const hours = hoursForWeekday(availability, weekday);
        const bookedCount = rangeAppointments.filter(
          (a) =>
            a.date === dateIso && a.status !== APPOINTMENT_STATUS.CANCELLED,
        ).length;
        return {
          weekday,
          hours,
          pct:
            totalSlots > 0
              ? Math.min(100, (bookedCount / totalSlots) * 100)
              : 0,
          off: totalSlots === 0,
        };
      }),
    [availability, duration, weekStart, rangeAppointments],
  );

  const recentVisits = useMemo(
    () =>
      monthAppointments
        .filter((a) => a.date <= todayIso)
        .filter(
          (a) =>
            a.status === APPOINTMENT_STATUS.COMPLETED ||
            a.status === APPOINTMENT_STATUS.NO_SHOW ||
            a.status === APPOINTMENT_STATUS.CANCELLED,
        )
        .sort((a, b) =>
          `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`),
        )
        .slice(0, 5),
    [monthAppointments, todayIso],
  );

  const timeOffItems = useMemo(() => {
    const holidays = (holidaysData?.holidays || [])
      .filter(
        (h) =>
          h.status === "active" &&
          !h.isPast &&
          !h.exceptionDoctorIds.includes(doctorId),
      )
      .map((h) => ({
        id: `holiday-${h.id}`,
        start: h.startsOn,
        end: h.endsOn,
        label: h.name,
      }));
    const leave = (approvedLeave || [])
      .filter((lr) => lr.doctorProfileId === doctorId && lr.endDate >= todayIso)
      .map((lr) => ({
        id: `leave-${lr.id}`,
        start: lr.startDate,
        end: lr.endDate,
        label: lr.reason || "Personal leave",
      }));
    return [...holidays, ...leave].sort((a, b) =>
      a.start.localeCompare(b.start),
    );
  }, [holidaysData, approvedLeave, doctorId, todayIso]);

  const workingDaySet = useMemo(() => {
    const set = new Set<string>();
    availability.forEach((a) => {
      set.add(a.day);
    });
    return set;
  }, [availability]);

  const scheduleWindowsLabel = useMemo(() => {
    const firstDay = WEEK_ORDER.find((d) => workingDaySet.has(d));
    if (!firstDay) return null;
    const windows = windowsForWeekday(availability, firstDay);
    if (windows.length === 0) return null;
    return windows
      .map((w) => formatHourRange(w.startTime, w.endTime))
      .join(" & ");
  }, [availability, workingDaySet]);

  if (doctorLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-violet" />
      </div>
    );
  }

  if (!doctor) {
    return (
      <div className="py-16 text-center text-sm text-ink-500">
        Doctor not found.
        <button
          type="button"
          onClick={() => router.push(`/hospital/${hospitalId}/doctors`)}
          className="ml-1.5 text-brand-violet hover:underline"
        >
          Back to doctors
        </button>
      </div>
    );
  }

  const isInactive = doctor.status === "inactive";

  const handleToggleActive = () => {
    const message = isInactive
      ? `Reactivate Dr. ${doctor.name}? They'll start accepting bookings again.`
      : `Deactivate Dr. ${doctor.name}? They'll stop accepting new bookings — existing appointments are not affected.`;
    if (!window.confirm(message)) return;
    updateDoctorMutation.mutate({
      doctorId,
      updates: { status: isInactive ? "active" : "inactive" },
    });
  };

  const bookingMode =
    doctor.acceptWalkIns === false
      ? "Walk-ins not accepted"
      : (doctor.heldSlotsPerSession ?? 0) > 0
        ? "Carve-out for walk-ins"
        : "Shared with booked slots";

  return (
    <div className="pb-16">
      <div className="flex items-center gap-3 mb-4">
        <button
          type="button"
          onClick={() => router.push(`/hospital/${hospitalId}/doctors`)}
          className="w-8 h-8 rounded-lg border border-border bg-surface-paper flex items-center justify-center text-ink-700 hover:bg-surface-canvas transition-colors"
          aria-label="Back to doctors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <span className="text-sm text-ink-500">
          Doctors /{" "}
          <b className="text-ink-900 font-semibold">Dr. {doctor.name}</b>
        </span>
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => router.push(`/hospital/${hospitalId}/queue`)}
          className="h-8 px-3 rounded-lg border border-border bg-surface-paper text-xs font-medium text-ink-700 hover:bg-surface-canvas"
        >
          Open in queue
        </button>
        <button
          type="button"
          onClick={handleToggleActive}
          disabled={updateDoctorMutation.isPending}
          className="h-8 px-3 rounded-lg border border-border bg-surface-paper text-xs font-medium text-ink-700 hover:bg-surface-canvas disabled:opacity-50"
        >
          {isInactive ? "Activate" : "Deactivate"}
        </button>
      </div>

      <div className="bg-surface-paper border border-border rounded-2xl shadow-sm p-5 flex flex-wrap items-start gap-4">
        <DoctorAvatar name={doctor.name} size="lg" />
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-ink-900 font-display tracking-tight">
            Dr. {doctor.name}
          </h1>
          <div className="flex items-center gap-2 flex-wrap text-[12.5px] text-ink-500 mt-0.5">
            <span>{doctor.specialization || "General Practitioner"}</span>
            {doctor.experience && (
              <>
                <span className="text-border">·</span>
                <span>{doctor.experience} years</span>
              </>
            )}
            {doctor.consultationFee != null && (
              <>
                <span className="text-border">·</span>
                <span className="font-mono">
                  {money(doctor.consultationFee)}
                </span>{" "}
                per consultation
              </>
            )}
            {currentHospital?.name && (
              <>
                <span className="text-border">·</span>
                <span>{currentHospital.name}</span>
              </>
            )}
          </div>
          <div className="flex gap-1.5 flex-wrap mt-2">
            {doctor.isAcceptingBookings !== false && (
              <span className="rounded-md px-2.5 py-1 text-[11.5px] font-semibold bg-status-open-soft text-status-open">
                ● Accepting bookings
              </span>
            )}
            {WEEK_ORDER.some((d) => workingDaySet.has(d)) && (
              <span className="rounded-md px-2.5 py-1 text-[11.5px] font-semibold bg-surface-canvas text-ink-700">
                {WEEK_ORDER.filter((d) => workingDaySet.has(d))
                  .map((d) => DAY_LABELS_SHORT[d])
                  .join(" · ")}
              </span>
            )}
            {scheduleWindowsLabel && (
              <span className="rounded-md px-2.5 py-1 text-[11.5px] font-semibold bg-surface-canvas text-ink-700 font-mono">
                {scheduleWindowsLabel}
              </span>
            )}
            <span className="rounded-md px-2.5 py-1 text-[11.5px] font-semibold bg-brand-violet-soft text-brand-violet">
              {doctor.acceptWalkIns === false
                ? "Walk-ins off"
                : doctor.heldSlotsPerSession
                  ? `Walk-ins on · ${doctor.heldSlotsPerSession} held per session`
                  : "Walk-ins on"}
            </span>
          </div>
        </div>
        <div className="ml-auto flex flex-col items-end gap-2.5">
          {presence && (
            <span
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11.5px] font-bold ${PRESENCE_CLS[presence.tone]}`}
            >
              {presence.tone === "in"
                ? presence.detail.toUpperCase()
                : presence.label}
            </span>
          )}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button
              type="button"
              onClick={() =>
                router.push(
                  `/hospital/${hospitalId}/appointments/add?doctorId=${doctorId}`,
                )
              }
              className="h-9 px-3.5 rounded-lg bg-brand-violet hover:bg-brand-violet-hover text-white text-sm font-semibold"
            >
              Book appointment
            </button>
            <button
              type="button"
              onClick={() =>
                router.push(`/hospital/${hospitalId}/doctors/${doctorId}/edit`)
              }
              className="h-9 px-3.5 rounded-lg border border-border bg-surface-paper text-sm font-medium text-ink-700 hover:bg-surface-canvas"
            >
              Manage availability
            </button>
            <button
              type="button"
              onClick={() =>
                router.push(`/hospital/${hospitalId}/doctors/${doctorId}/edit`)
              }
              className="h-9 px-3.5 rounded-lg border border-border bg-surface-paper text-sm font-medium text-ink-700 hover:bg-surface-canvas flex items-center gap-1.5"
            >
              <Pencil className="w-3.5 h-3.5" /> Edit profile
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mt-3.5">
        <div className="rounded-xl p-4 bg-surface-paper border border-border shadow-sm">
          <div className="text-[11px] uppercase tracking-wide font-semibold text-ink-500">
            Completed · {format(today, "MMMM")}
          </div>
          <div className="font-mono text-2xl font-bold text-ink-900 mt-1">
            {monthStats.completed}
          </div>
          <div className="text-[11px] text-ink-500 mt-0.5">
            of {monthStats.totalBooked} booked
            {monthStats.walkInCount > 0
              ? ` · ${monthStats.walkInCount} walk-in${monthStats.walkInCount === 1 ? "" : "s"}`
              : ""}
          </div>
          {(monthStats.cancelledCount > 0 || monthStats.noShowCount > 0) && (
            <div className="text-[10.5px] text-ink-500 mt-1.5 pt-1.5 border-t border-lineSoft">
              {[
                monthStats.cancelledCount > 0
                  ? `${monthStats.cancelledCount} cancelled`
                  : null,
                monthStats.noShowCount > 0
                  ? `${monthStats.noShowCount} no-show`
                  : null,
              ]
                .filter(Boolean)
                .join(", ")}
            </div>
          )}
        </div>
        <div className="rounded-xl p-4 bg-surface-paper border border-border shadow-sm">
          <div className="text-[11px] uppercase tracking-wide font-semibold text-ink-500">
            No-shows &amp; cancels
          </div>
          <div
            className={`font-mono text-2xl font-bold mt-1 ${monthStats.cancelledCount + monthStats.noShowCount > 0 ? "text-status-danger" : "text-ink-900"}`}
          >
            {monthStats.totalBooked > 0
              ? `${Math.round(((monthStats.cancelledCount + monthStats.noShowCount) / monthStats.totalBooked) * 100)}%`
              : "—"}
          </div>
          <div className="text-[11px] text-ink-500 mt-0.5">
            {monthStats.noShowCount} no-show, {monthStats.cancelledCount}{" "}
            cancelled
          </div>
          {leadTimeInsight && (
            <div className="text-[10.5px] text-ink-500 mt-1.5 pt-1.5 border-t border-lineSoft">
              {leadTimeInsight}
            </div>
          )}
        </div>
        <div className="rounded-xl p-4 bg-surface-paper border border-border shadow-sm">
          <div className="text-[11px] uppercase tracking-wide font-semibold text-ink-500">
            Billed · {format(today, "MMMM")}
          </div>
          <div className="font-mono text-2xl font-bold text-ink-900 mt-1">
            {money(monthStats.billed)}
          </div>
          <div className="text-[11px] text-ink-500 mt-0.5">
            avg {money(monthStats.avgBilled)} per visit
          </div>
          <div className="text-[10.5px] text-ink-500 mt-1.5 pt-1.5 border-t border-lineSoft">
            {packagesSoldThisMonth.length > 0
              ? `${money(prepaidNotDelivered)} prepaid, not yet delivered`
              : "no prepaid packages sold"}
          </div>
        </div>
        <div className="rounded-xl p-4 bg-surface-paper border border-border shadow-sm">
          <div className="text-[11px] uppercase tracking-wide font-semibold text-ink-500">
            Diary filled
          </div>
          <div className="font-mono text-2xl font-bold text-ink-900 mt-1">
            {Math.round(monthStats.diaryFilledPct)}%
          </div>
          <div className="text-[11px] text-ink-500 mt-0.5">
            {monthStats.totalBooked} booked of {monthStats.openSlotsSoFar}{" "}
            offered so far
          </div>
          {monthStats.openSlotsFullMonth > monthStats.openSlotsSoFar && (
            <div className="text-[10.5px] text-ink-500 mt-1.5 pt-1.5 border-t border-lineSoft">
              Not {monthStats.openSlotsFullMonth} — that counts every slot the
              hours allow, including days not yet worked.
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4 mt-4 items-start">
        <div className="space-y-3.5">
          <div className="bg-surface-paper border border-border rounded-xl shadow-sm overflow-hidden">
            <h2 className="text-sm font-semibold text-ink-900 px-4 py-3 border-b border-border font-display tracking-tight flex items-center gap-2">
              Details <span className="flex-1" />
              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/hospital/${hospitalId}/doctors/${doctorId}/edit`,
                  )
                }
                className="text-xs font-normal text-brand-violet underline"
              >
                Edit
              </button>
            </h2>
            <div className="px-4 py-1">
              <DetailRow label="Email" value={doctor.email} />
              <DetailRow label="Phone" value={doctor.phone} mono />
              <DetailRow
                label="Experience"
                value={
                  doctor.experience ? `${doctor.experience} years` : undefined
                }
              />
              <DetailRow
                label="Consultation"
                value={
                  doctor.consultationFee != null
                    ? `${money(doctor.consultationFee)} · ${duration} min`
                    : undefined
                }
                mono
              />
              <DetailRow
                label="Actually takes"
                value={
                  avgConsultMinutes != null
                    ? `${avgConsultMinutes} min average`
                    : undefined
                }
                mono
              />
            </div>
          </div>

          <div className="bg-surface-paper border border-border rounded-xl shadow-sm overflow-hidden">
            <h2 className="text-sm font-semibold text-ink-900 px-4 py-3 border-b border-border font-display tracking-tight flex items-center gap-2">
              Booking rules <span className="flex-1" />
              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/hospital/${hospitalId}/doctors/${doctorId}/edit`,
                  )
                }
                className="text-xs font-normal text-brand-violet underline"
              >
                Change
              </button>
            </h2>
            <div className="px-4 py-1">
              <DetailRow label="Mode" value={bookingMode} />
              <DetailRow
                label="Patients per slot"
                value={`${doctor.patientsPerSlot ?? 1}`}
              />
              <DetailRow
                label="Walk-ins"
                value={
                  doctor.acceptWalkIns === false ? "Not accepted" : "Accepted"
                }
              />
              {doctor.acceptWalkIns !== false && (
                <DetailRow
                  label="Held per session"
                  value={`${doctor.heldSlotsPerSession ?? 0} slots`}
                />
              )}
              <DetailRow
                label="Released to booking"
                value={
                  formatMinutesBefore(doctor.releaseHeldSlotsBeforeMinutes) ??
                  "Not released automatically"
                }
              />
              <DetailRow
                label="Over capacity"
                value={
                  OVER_CAPACITY_LABELS[doctor.overCapacityPolicy || "warn"]
                }
              />
              <DetailRow
                label="Late grace"
                value={
                  doctor.lateArrivalGraceMinutes != null
                    ? `${doctor.lateArrivalGraceMinutes} min`
                    : undefined
                }
                mono
              />
              <DetailRow
                label="Slot released after"
                value={
                  doctor.noShowReleaseMinutes != null
                    ? `${doctor.noShowReleaseMinutes} min`
                    : undefined
                }
                mono
              />
              <DetailRow
                label="Walk-in fairness"
                value={`${doctor.walkinFairnessMinutes ?? DEFAULT_WALKIN_FAIRNESS_MINUTES} min`}
                mono
              />
            </div>
          </div>

          <div className="bg-surface-paper border border-border rounded-xl shadow-sm overflow-hidden">
            <h2 className="text-sm font-semibold text-ink-900 px-4 py-3 border-b border-border flex items-center gap-2 font-display tracking-tight">
              <PackageIcon className="w-3.5 h-3.5 text-brand-violet" /> Prepaid
              packages
            </h2>
            <div className="px-4 py-1">
              <DetailRow
                label="Active holders"
                value={`${packageStats.holders} patients`}
              />
              <DetailRow
                label="Visits outstanding"
                value={`${packageStats.visitsOutstanding}`}
              />
              <DetailRow
                label="Value owed"
                value={money(packageStats.valueOwed)}
                mono
              />
            </div>
          </div>

          <div className="bg-surface-paper border border-border rounded-xl shadow-sm overflow-hidden">
            <h2 className="text-sm font-semibold text-ink-900 px-4 py-3 border-b border-border font-display tracking-tight flex items-center gap-2">
              Time off <span className="flex-1" />
              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/hospital/${hospitalId}/settings/hospital-holidays`,
                  )
                }
                className="text-xs font-normal text-brand-violet underline"
              >
                Add
              </button>
            </h2>
            <div className="px-4 py-1">
              {timeOffItems.length === 0 ? (
                <div className="py-3 text-[12.5px] text-ink-500">
                  Nothing booked off.
                </div>
              ) : (
                <>
                  {timeOffItems.slice(0, 3).map((t) => (
                    <DetailRow
                      key={t.id}
                      label={formatDateRange(t.start, t.end)}
                      value={t.label}
                    />
                  ))}
                  {timeOffItems.length <= 1 ? (
                    <div className="py-2 text-[12.5px] text-ink-500 border-t border-lineSoft">
                      Nothing else booked off
                    </div>
                  ) : timeOffItems.length > 3 ? (
                    <div className="py-2 text-[12.5px] text-ink-500 border-t border-lineSoft">
                      +{timeOffItems.length - 3} more
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3.5">
          <div className="bg-surface-paper border border-border rounded-xl shadow-sm overflow-hidden">
            <h2 className="text-sm font-semibold text-ink-900 px-4 py-3 border-b border-border font-display tracking-tight flex items-center gap-2">
              Today · {format(today, "EEEE d MMMM")}
              <span className="flex-1" />
              {todaySessions.length > 0 && (
                <span className="text-[11.5px] font-normal text-ink-500">
                  {todayTotals.totalSlots} slots ·{" "}
                  {todayTotals.totalSlots - todayTotals.held} bookable online ·{" "}
                  {todayTotals.held} held for walk-ins
                </span>
              )}
            </h2>
            <div className="p-4">
              {apptLoading ? (
                <div className="text-sm text-ink-500 py-4 text-center">
                  Loading…
                </div>
              ) : todaySessions.length === 0 ? (
                <div className="text-sm text-ink-500 py-4 text-center">
                  Not working today.
                </div>
              ) : (
                <div className="space-y-4">
                  {todaySessions.map((session) => {
                    const msg = sessionMessage(session, today);
                    const usedCount =
                      session.doneCount +
                      session.walkInCount +
                      session.bookedCount;
                    return (
                      <div
                        key={session.key}
                        className="border border-border rounded-xl overflow-hidden"
                      >
                        <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-surface-canvas/40 border-b border-lineSoft">
                          <span className="text-[13px] font-semibold text-ink-900">
                            {session.label} ·{" "}
                            {formatHourRange(
                              minutesToTimeStr(session.window.start),
                              minutesToTimeStr(session.window.end),
                            )}
                          </span>
                          <span className="flex-1" />
                          <span className="font-mono text-xs text-ink-700">
                            {usedCount} of {session.totalCapacity} used
                          </span>
                        </div>
                        {session.totalCapacity > 0 && (
                          <div className="px-3.5 py-2.5 border-b border-lineSoft">
                            <div className="h-[9px] rounded-full bg-surface-canvas overflow-hidden flex">
                              {session.doneCount > 0 && (
                                <div
                                  className="h-full bg-status-open"
                                  style={{
                                    width: `${(session.doneCount / session.totalCapacity) * 100}%`,
                                  }}
                                />
                              )}
                              {session.walkInCount > 0 && (
                                <div
                                  className="h-full bg-status-warning"
                                  style={{
                                    width: `${(session.walkInCount / session.totalCapacity) * 100}%`,
                                  }}
                                />
                              )}
                              {session.bookedCount > 0 && (
                                <div
                                  className="h-full bg-brand-violet"
                                  style={{
                                    width: `${(session.bookedCount / session.totalCapacity) * 100}%`,
                                  }}
                                />
                              )}
                              {session.cancelledCount > 0 && (
                                <div
                                  className="h-full bg-ink-500/25"
                                  style={{
                                    width: `${(session.cancelledCount / session.totalCapacity) * 100}%`,
                                  }}
                                />
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              {msg && (
                                <span
                                  className={`text-[11.5px] ${MESSAGE_TONE_CLS[msg.tone]}`}
                                >
                                  {msg.text}
                                </span>
                              )}
                              {session.heldTotal > 0 && (
                                <span className="font-mono text-[10px] text-ink-500 border border-dashed border-border rounded px-1.5 py-0.5">
                                  {session.heldUsed > 0
                                    ? `${session.heldUsed} of ${session.heldTotal} held slot${session.heldTotal === 1 ? "" : "s"} used`
                                    : `${session.heldFree} held slot${session.heldFree === 1 ? "" : "s"} free`}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                        <div className="flex flex-wrap gap-1.5 p-3.5">
                          {session.slots.map((s) => (
                            <div
                              key={s.time}
                              className={`rounded-lg px-2.5 py-1.5 border text-[12px] min-w-[92px] ${SLOT_STATUS_CLS[s.status]}`}
                            >
                              <div className="font-mono text-[11.5px]">
                                {formatTime12h(s.time)}
                              </div>
                              <div
                                className={`font-medium mt-0.5 ${s.status === "cancelled" ? "line-through" : ""}`}
                              >
                                {slotLabel(s)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex gap-4 flex-wrap text-[11px] text-ink-500 pt-1">
                    <LegendItem cls="bg-status-open" label="Seen" />
                    <LegendItem cls="bg-brand-violet" label="Booked" />
                    <LegendItem cls="bg-status-warning" label="Walk-in" />
                    <LegendItem
                      cls="bg-surface-paper border border-border"
                      label="Free"
                    />
                    <LegendItem
                      cls="bg-surface-canvas border border-dashed border-border"
                      label="Held for walk-ins"
                    />
                    <LegendItem
                      cls="bg-surface-canvas border border-border"
                      label="Cancelled"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-surface-paper border border-border rounded-xl shadow-sm overflow-hidden">
            <h2 className="text-sm font-semibold text-ink-900 px-4 py-3 border-b border-border font-display tracking-tight">
              This week
            </h2>
            <div className="p-4">
              <div className="grid grid-cols-7 gap-1.5">
                {weekBars.map((w) => (
                  <div
                    key={w.weekday}
                    className={`text-center border rounded-lg py-2 px-1 ${w.off ? "bg-surface-canvas/40 border-border" : "border-border"}`}
                  >
                    <div className="text-[10px] uppercase tracking-wide text-ink-500">
                      {DAY_LABELS_SHORT[w.weekday]}
                    </div>
                    <div className="font-mono text-[11px] text-ink-700 mt-0.5">
                      {w.off ? "—" : formatHours(w.hours)}
                    </div>
                    <div className="h-1 rounded-full bg-surface-canvas mt-1.5 overflow-hidden">
                      {!w.off && (
                        <div
                          className="h-full bg-status-open"
                          style={{ width: `${w.pct}%` }}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[11.5px] text-ink-500 mt-2.5">
                Bars show appointments booked against slots offered that day.
              </p>
            </div>
          </div>

          <div className="bg-surface-paper border border-border rounded-xl shadow-sm overflow-hidden">
            <h2 className="text-sm font-semibold text-ink-900 px-4 py-3 border-b border-border font-display tracking-tight">
              Recent visits
            </h2>
            {recentVisits.length === 0 ? (
              <div className="py-10 text-center text-sm text-ink-500">
                No visits recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-ink-500 bg-surface-canvas/40">
                      <th className="px-4 py-2 font-semibold">Date</th>
                      <th className="px-3 py-2 font-semibold">Patient</th>
                      <th className="px-3 py-2 font-semibold">Source</th>
                      <th className="px-3 py-2 font-semibold">Outcome</th>
                      <th className="px-3 py-2 font-semibold text-right">
                        Billed
                      </th>
                      <th className="px-3 py-2 font-semibold">Payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentVisits.map((a) => {
                      const payment = paymentByAppointmentId.get(a.id);
                      return (
                        <tr key={a.id} className="border-t border-border">
                          <td className="px-4 py-2 font-mono whitespace-nowrap">
                            {format(new Date(`${a.date}T00:00:00`), "d MMM")}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {a.patientName}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <span
                              className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                                a.bookingSource === "walk-in"
                                  ? "bg-status-warning-soft text-status-warning"
                                  : "bg-surface-canvas text-ink-700"
                              }`}
                            >
                              {a.bookingSource === "walk-in"
                                ? "Walk-in"
                                : "Booked"}
                            </span>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap capitalize">
                            {a.status === APPOINTMENT_STATUS.NO_SHOW
                              ? "No-show"
                              : a.status}
                          </td>
                          <td className="px-3 py-2 text-right font-mono whitespace-nowrap">
                            {payment ? money(payment.total) : "—"}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {payment ? (
                              <span
                                className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                                  payment.status === "due"
                                    ? "bg-status-danger-soft text-status-danger"
                                    : payment.packageId
                                      ? "bg-brand-violet-soft text-brand-violet"
                                      : "bg-status-open-soft text-status-open"
                                }`}
                              >
                                {payment.status === "due"
                                  ? "Unpaid"
                                  : payment.packageId
                                    ? "Package"
                                    : payment.method === "upi"
                                      ? "UPI"
                                      : payment.method === "cash"
                                        ? "Cash"
                                        : "Paid"}
                              </span>
                            ) : (
                              <span className="rounded-md px-2 py-0.5 text-[11px] font-semibold bg-surface-canvas text-ink-500">
                                —
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-3 py-2 border-t border-border first:border-t-0 text-[12.5px]">
      <span className="text-ink-500 shrink-0">{label}</span>
      <span className={`text-right text-ink-900 ${mono ? "font-mono" : ""}`}>
        {value}
      </span>
    </div>
  );
}

function LegendItem({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-2.5 h-2.5 rounded-sm ${cls}`} />
      {label}
    </span>
  );
}
