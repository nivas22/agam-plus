// components/queue/queueBoard.ts
import { format } from "date-fns";
import type { AppointmentWithDetails } from "@/types/appointment";
import type { Doctor } from "@/types/doctorNew";
import { APPOINTMENT_STATUS } from "../../constants";

export function normalizeStatus(status: string): string {
  return status === "scheduled" ? APPOINTMENT_STATUS.CONFIRMED : status;
}

export function toISODate(d: Date): string {
  return d.toISOString().split("T")[0];
}

export function apptDateTime(appt: AppointmentWithDetails): Date {
  return new Date(`${appt.date}T${appt.time}:00`);
}

export function minutesBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 60000);
}

export function formatTime12h(time: string): string {
  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours, 10);
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${period}`;
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// A patient is "overdue" once this many minutes pass their booked time with
// no check-in. Nothing is released automatically — it just flags the card
// for the front desk to call or mark a no-show.
export const OVERDUE_GRACE_MINUTES = 20;

export interface QueueLane {
  doctor: Doctor;
  inConsultation: AppointmentWithDetails[];
  waiting: AppointmentWithDetails[];
  yetToArrive: AppointmentWithDetails[];
  overdue: AppointmentWithDetails[];
  done: AppointmentWithDetails[];
  all: AppointmentWithDetails[];
}

// Patients still needing the doctor's attention today — excludes completed,
// cancelled, and no-show appointments.
export function activePatientCount(lane: QueueLane): number {
  return (
    lane.inConsultation.length + lane.waiting.length + lane.yetToArrive.length
  );
}

export function buildLanes(
  doctors: Doctor[],
  appointments: AppointmentWithDetails[],
  now: Date,
): QueueLane[] {
  return doctors.map((doctor) => {
    const all = appointments.filter((a) => a.doctorProfileId === doctor.id);
    const inConsultation = all.filter(
      (a) => normalizeStatus(a.status) === APPOINTMENT_STATUS.IN_CONSULTATION,
    );
    const waiting = all
      .filter((a) =>
        [APPOINTMENT_STATUS.CHECKED_IN, APPOINTMENT_STATUS.WAITING].includes(
          normalizeStatus(a.status) as APPOINTMENT_STATUS,
        ),
      )
      .sort((a, b) => (a.updatedAt || "").localeCompare(b.updatedAt || ""));
    const yetToArrive = all
      .filter((a) =>
        [APPOINTMENT_STATUS.CONFIRMED, APPOINTMENT_STATUS.PENDING].includes(
          normalizeStatus(a.status) as APPOINTMENT_STATUS,
        ),
      )
      .sort((a, b) => a.time.localeCompare(b.time));
    const overdue = yetToArrive.filter(
      (a) => minutesBetween(apptDateTime(a), now) > OVERDUE_GRACE_MINUTES,
    );
    const done = all.filter(
      (a) => normalizeStatus(a.status) === APPOINTMENT_STATUS.COMPLETED,
    );
    return {
      doctor,
      inConsultation,
      waiting,
      yetToArrive,
      overdue,
      done,
      all,
    };
  });
}

export interface LaneStatus {
  label: string;
  tone: "idle" | "ok" | "late" | "off";
}

function minutesSinceMidnight(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTimeStr(mins: number): string {
  const wrapped = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Today's working windows for a doctor, sorted by start time. Empty when the
// doctor doesn't consult on this day at all.
export function todaysWindows(
  doctor: Doctor,
  now: Date,
): { start: number; end: number }[] {
  const dayName = format(now, "EEEE");
  return (doctor.availability || [])
    .filter((w) => w.day === dayName)
    .map((w) => ({
      start: minutesSinceMidnight(w.startTime),
      end: minutesSinceMidnight(w.endTime),
    }))
    .sort((a, b) => a.start - b.start);
}

export interface AvailabilityNow {
  available: boolean;
  label: string;
}

// Whether a doctor is inside one of today's working windows right now — the
// same rule the backend's slot generator uses, so this doubles as a
// front-end guard before a walk-in booking is attempted and rejected.
export function doctorAvailabilityNow(
  doctor: Doctor,
  now: Date,
): AvailabilityNow {
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const windows = todaysWindows(doctor, now);

  if (windows.length === 0) {
    return { available: false, label: "Not consulting today" };
  }
  if (windows.some((w) => nowMins >= w.start && nowMins < w.end)) {
    return { available: true, label: "Free now" };
  }
  const next = windows.find((w) => w.start > nowMins);
  if (next) {
    return {
      available: false,
      label: `Starts at ${formatTime12h(minutesToTimeStr(next.start))}`,
    };
  }
  return { available: false, label: "Session over" };
}

export function laneStatus(lane: QueueLane, now: Date): LaneStatus {
  // Someone's already checked in or being seen — the doctor is clearly
  // working, regardless of what their nominal availability window says.
  if (lane.inConsultation.length > 0 || lane.waiting.length > 0) {
    const lateness = lane.waiting
      .map((a) => minutesBetween(apptDateTime(a), now))
      .filter((m) => m > 0);
    const behindMins = lateness.length ? Math.max(...lateness) : 0;
    if (behindMins > 10)
      return { label: `${behindMins} min behind`, tone: "late" };
    return { label: "On time", tone: "ok" };
  }

  const availability = doctorAvailabilityNow(lane.doctor, now);
  return {
    label: availability.label,
    tone: availability.available ? "idle" : "off",
  };
}

/* ---------------------------------------------------------------------- */
/*                            doctor presence                             */
/* ---------------------------------------------------------------------- */

// The doctor can only be marked "in" for real once a consultation has
// actually started — that's the one signal that proves they're physically
// here. Earliest such timestamp today, or null if nobody's been seen yet.
export function earliestConsultationStart(lane: QueueLane): Date | null {
  const candidates = [...lane.inConsultation, ...lane.done]
    .map((a) => new Date(a.updatedAt))
    .filter((d) => !Number.isNaN(d.getTime()));
  if (!candidates.length) return null;
  return new Date(Math.min(...candidates.map((d) => d.getTime())));
}

// First future date (starting tomorrow) whose weekday matches one of the
// doctor's working days, or null if they have no availability configured.
export function nextWorkingDate(
  doctor: Doctor,
  from: Date,
  maxDays = 14,
): string | null {
  const workingDays = new Set((doctor.availability || []).map((w) => w.day));
  if (workingDays.size === 0) return null;
  const cursor = new Date(from);
  cursor.setDate(cursor.getDate() + 1);
  for (let i = 0; i < maxDays; i++) {
    if (workingDays.has(format(cursor, "EEEE"))) return toISODate(cursor);
    cursor.setDate(cursor.getDate() + 1);
  }
  return null;
}

// Manually-set presence, entered by the front desk for whatever the day's
// data can't prove on its own (a doctor who hasn't started a consultation
// yet could be five minutes away or a no-show — only a human knows which).
// Session-local only: there's no backend field for "today's presence" yet,
// so this resets on reload. The *consequences* of "not coming" (reassigning
// or cancelling appointments) are real, persisted appointment updates —
// only the presence label itself is ephemeral.
export type PresenceOverride =
  | { kind: "here"; setAt: string }
  | { kind: "runningLate"; expectedTime: string; setBy: string; setAt: string }
  | { kind: "onBreak"; returnTime: string; setBy: string; setAt: string }
  | {
      kind: "notIn";
      reason: string;
      toldBy: string;
      note?: string;
      setBy: string;
      setAt: string;
    }
  | { kind: "leftForDay"; setBy: string; setAt: string };

export interface DoctorPresence {
  tone: "in" | "expected" | "late" | "notIn";
  label: string;
  detail: string;
}

export function presenceStorageKey(
  hospitalId: string,
  dateISO: string,
): string {
  return `queue-presence:${hospitalId}:${dateISO}`;
}

// Reads today's manual presence overrides for a hospital. Safe to call from
// any page that wants a read-only view of presence (e.g. the dashboard) —
// only the queue page itself writes to this key.
export function readPresenceOverrides(
  hospitalId: string,
  dateISO: string,
): Record<string, PresenceOverride> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(
      presenceStorageKey(hospitalId, dateISO),
    );
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function computePresence(
  lane: QueueLane,
  override: PresenceOverride | undefined,
  now: Date,
): DoctorPresence {
  // Actively seeing a patient right now overrides any stale manual flag —
  // they clearly can't be "not coming today" while mid-consultation.
  if (lane.inConsultation.length > 0) {
    const since = earliestConsultationStart(lane) ?? now;
    return {
      tone: "in",
      label: "IN",
      detail: `In since ${format(since, "h:mm a")}`,
    };
  }

  if (override?.kind === "leftForDay") {
    return {
      tone: "notIn",
      label: "LEFT FOR DAY",
      detail: `Marked by ${override.setBy} at ${format(new Date(override.setAt), "h:mm a")}`,
    };
  }
  if (override?.kind === "notIn") {
    return {
      tone: "notIn",
      label: "NOT IN",
      detail: `${override.reason} · marked by ${override.setBy} at ${format(new Date(override.setAt), "h:mm a")}`,
    };
  }
  if (override?.kind === "runningLate") {
    return {
      tone: "late",
      label: "RUNNING LATE",
      detail: `Expected around ${formatTime12h(override.expectedTime)}`,
    };
  }
  // A doctor who finished their morning session and will resume later today —
  // distinct from "left for the day" (gone for good) since their remaining
  // bookings (typically evening ones) stay untouched, nothing to reassign.
  // Superseded automatically the moment a new consultation starts (the
  // in-consultation check above runs first).
  if (override?.kind === "onBreak") {
    return {
      tone: "expected",
      label: "ON BREAK",
      detail: `Back around ${formatTime12h(override.returnTime)}`,
    };
  }

  const doneStarted = earliestConsultationStart(lane);
  const manualHere =
    override?.kind === "here" ? new Date(override.setAt) : null;
  const inSince =
    doneStarted && manualHere
      ? new Date(Math.min(doneStarted.getTime(), manualHere.getTime()))
      : doneStarted || manualHere;
  if (inSince) {
    return {
      tone: "in",
      label: "IN",
      detail: `In since ${format(inSince, "h:mm a")}`,
    };
  }

  const availability = doctorAvailabilityNow(lane.doctor, now);
  return {
    tone: "expected",
    label: "EXPECTED",
    detail: availability.available
      ? "Due now · not arrived"
      : availability.label,
  };
}
