// components/queue/queueBoard.ts
import { format } from "date-fns";
import type { AppointmentWithDetails } from "@/types/appointment";
import type { Doctor } from "@/types/doctorNew";
import { APPOINTMENT_STATUS } from "../../constants";

export function normalizeStatus(status: string): string {
  return status === "scheduled" ? APPOINTMENT_STATUS.CONFIRMED : status;
}

// Local calendar date, not UTC — `.toISOString().split("T")[0]` returns the
// previous day for any local time before the UTC offset (e.g. 3:30am IST).
export function toISODate(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

export function apptDateTime(appt: AppointmentWithDetails): Date {
  return new Date(`${appt.date}T${appt.time}:00`);
}

export function minutesBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 60000);
}

// Floor, not round — for threshold checks (fairness promotion, overdue),
// rounding would fire ~30s early (44m31s rounds up to 45).
export function minutesElapsed(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 60000);
}

// The backend stamps a dedicated timestamp the moment an appointment enters
// each lifecycle stage (see STATUS_TIMESTAMP_FIELD in appointments.service.ts),
// untouched by later same-status saves (e.g. a notes edit) — so these are the
// right anchor for queue ordering and elapsed-time display, unlike
// `updatedAt` which bumps on every save and would reshuffle the queue.
export function stageStart(appt: AppointmentWithDetails, iso?: string): Date {
  return new Date(iso || appt.updatedAt);
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
  // 1:1 with `waiting`, same order — carries the reason orderQueue assigned
  // each entry (e.g. "booked 10:45", "waited 47 min — next regardless") for
  // the queue card to display.
  waitingOrder: OrderedQueueEntry[];
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
  // `appointments` is fed straight from a page that queries date ranges, not
  // strictly "today" — without this filter a stale multi-day record (a
  // `waiting` patient nobody cleared yesterday, a walk-in booked on a
  // different date) leaks into today's counts and, worse, ranks in today's
  // queue with a readyAt far in the past.
  const today = toISODate(now);
  return doctors.map((doctor) => {
    const all = appointments.filter(
      (a) => a.doctorProfileId === doctor.id && a.date === today,
    );
    const inConsultation = all.filter(
      (a) => normalizeStatus(a.status) === APPOINTMENT_STATUS.IN_CONSULTATION,
    );
    const waitingAppts = all.filter((a) =>
      [APPOINTMENT_STATUS.CHECKED_IN, APPOINTMENT_STATUS.WAITING].includes(
        normalizeStatus(a.status) as APPOINTMENT_STATUS,
      ),
    );
    const orderingRules: QueueOrderingRules = {
      walkinFairnessMinutes:
        doctor.walkinFairnessMinutes ?? DEFAULT_WALKIN_FAIRNESS_MINUTES,
    };
    const { appts: waiting, entries: waitingOrder } = orderWaitingAppointments(
      waitingAppts,
      orderingRules,
      now,
    );
    const yetToArrive = all
      .filter((a) =>
        [APPOINTMENT_STATUS.CONFIRMED, APPOINTMENT_STATUS.PENDING].includes(
          normalizeStatus(a.status) as APPOINTMENT_STATUS,
        ),
      )
      .sort((a, b) => a.time.localeCompare(b.time));
    const overdue = yetToArrive.filter(
      (a) => minutesElapsed(apptDateTime(a), now) >= OVERDUE_GRACE_MINUTES,
    );
    const done = all.filter(
      (a) => normalizeStatus(a.status) === APPOINTMENT_STATUS.COMPLETED,
    );
    return {
      doctor,
      inConsultation,
      waiting,
      waitingOrder,
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

/* ---------------------------------------------------------------------- */
/*                          session capacity                              */
/* ---------------------------------------------------------------------- */

export interface WindowRange {
  start: number;
  end: number;
}

// Which of today's windows the capacity strip should describe: the one in
// progress right now, else the next one still to come, else (every window
// already over) the last one — so a lane never shows a blank strip.
export function primaryWindowToday(
  doctor: Doctor,
  now: Date,
): WindowRange | null {
  const windows = todaysWindows(doctor, now);
  if (windows.length === 0) return null;
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const current = windows.find((w) => nowMins >= w.start && nowMins < w.end);
  if (current) return current;
  const upcoming = windows.find((w) => w.start > nowMins);
  if (upcoming) return upcoming;
  return windows[windows.length - 1];
}

function slotsInWindow(w: WindowRange, duration: number, gap: number): number {
  if (duration <= 0) return 0;
  const span = w.end - w.start;
  const step = duration + gap;
  if (span < duration) return 0;
  return Math.floor((span - duration) / step) + 1;
}

// Counts toward a doctor's daily capacity from the moment they're on the
// books until the visit is done — cancelled and no-show free the slot back
// up, so those are deliberately excluded.
const COUNTS_TOWARD_CAPACITY = new Set<string>([
  APPOINTMENT_STATUS.CONFIRMED,
  APPOINTMENT_STATUS.PENDING,
  APPOINTMENT_STATUS.CHECKED_IN,
  APPOINTMENT_STATUS.WAITING,
  APPOINTMENT_STATUS.IN_CONSULTATION,
  APPOINTMENT_STATUS.COMPLETED,
]);

export interface SessionCapacity {
  window: WindowRange | null;
  totalCapacity: number;
  bookedCount: number;
  scheduledCount: number;
  walkInCount: number;
  freeCount: number;
  heldTotal: number;
  heldUsed: number;
  heldFree: number;
}

// This session's capacity picture for one doctor (the window primaryWindowToday
// picks — in progress, else next, else the last one over), built entirely
// from data already on hand — no extra network round-trip, so it's cheap to
// recompute on every 30s board refresh. Scoped to a single session, not the
// whole day: a doctor with a 9–1 and a 5–8 window has separate held-slot
// budgets per session (that's what `heldSlotsPerSession` promises), so
// mixing both sessions' bookings into one total would charge an evening
// walk-in against the morning's held slots and misreport "full" once the
// other session fills. "Held" is a soft, informational budget for the front
// desk (see doctor settings) — this doesn't gate anything by itself,
// `assertWalkInCapacityAllowed` on the backend is what actually enforces the
// 'block' policy.
export function sessionCapacity(lane: QueueLane, now: Date): SessionCapacity {
  const doctor = lane.doctor;
  const window = primaryWindowToday(doctor, now);
  const duration = doctor.appointmentDuration || 30;
  const gap = Math.max(0, doctor.bufferMinutes || 0);
  const perSlot = Math.max(1, doctor.patientsPerSlot || 1);
  const totalCapacity = window ? slotsInWindow(window, duration, gap) * perSlot : 0;

  const inSession = (a: AppointmentWithDetails) =>
    window !== null &&
    minutesSinceMidnight(a.time) >= window.start &&
    minutesSinceMidnight(a.time) < window.end;

  const countedThisSession = lane.all.filter(
    (a) => COUNTS_TOWARD_CAPACITY.has(normalizeStatus(a.status)) && inSession(a),
  );
  const walkInCount = countedThisSession.filter(
    (a) => a.bookingSource === "walk-in",
  ).length;
  const bookedCount = countedThisSession.length;

  const heldTotal =
    doctor.acceptWalkIns !== false
      ? Math.max(0, doctor.heldSlotsPerSession ?? 0)
      : 0;

  return {
    window,
    totalCapacity,
    bookedCount,
    scheduledCount: bookedCount - walkInCount,
    walkInCount,
    freeCount: Math.max(0, totalCapacity - bookedCount),
    heldTotal,
    heldUsed: Math.min(heldTotal, walkInCount),
    heldFree: Math.max(0, heldTotal - walkInCount),
  };
}

export interface FinishProjection {
  window: WindowRange;
  finishMinutes: number;
  overMinutes: number;
  pace: number;
  // People still to be seen that count toward *this* window — a lane with a
  // morning and an evening session shouldn't have its morning overrun
  // inflated by patients booked for the evening.
  remainingInWindow: number;
}

// Rough finish-time estimate — "now, plus however many appointment-lengths
// are left to see" — using the doctor's configured appointment length + gap
// as the per-patient pace. Deliberately not the measured average from
// practice-stats: that would mean one extra API call per lane on every 30s
// refresh, for a number that's an estimate either way.
export function projectFinish(
  lane: QueueLane,
  now: Date,
  extraPatients = 0,
): FinishProjection | null {
  const doctor = lane.doctor;
  const window = primaryWindowToday(doctor, now);
  if (!window) return null;
  const duration = doctor.appointmentDuration || 30;
  const gap = Math.max(0, doctor.bufferMinutes || 0);
  const perSlot = Math.max(1, doctor.patientsPerSlot || 1);
  const pace = duration + gap;

  // Same window test for all three groups — sessionCapacity scopes its
  // counts to this window the same way, and a leftover from the other
  // session (e.g. a morning patient nobody cleared before the evening
  // session started) must not inflate this session's overrun. A walk-in's
  // `.time` is the slot they were actually placed in (see sessionCapacity),
  // so it's a meaningful window membership test for them too.
  const inWindow = (a: AppointmentWithDetails) => {
    const mins = minutesSinceMidnight(a.time);
    return mins >= window.start && mins < window.end;
  };
  const windowInConsultation = lane.inConsultation.filter(inWindow).length;
  const windowWaiting = lane.waiting.filter(inWindow).length;
  const windowYetToArrive = lane.yetToArrive.filter(inWindow).length;
  const remainingInWindow =
    windowInConsultation + windowWaiting + windowYetToArrive;
  const remainingSlots = Math.ceil(
    (remainingInWindow + extraPatients) / perSlot,
  );
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const finishMinutes = nowMins + remainingSlots * pace;

  return {
    window,
    finishMinutes,
    overMinutes: finishMinutes - window.end,
    pace,
    remainingInWindow,
  };
}

export interface CapacityMessage {
  tone: "ok" | "warn" | "danger";
  text: string;
}

// The single line under the capacity bar — priority order: actively running
// over > actively tight > fully booked (but the day's not derailed) > room
// to spare. Mirrors the three cases in the v2 queue mockup.
export function capacityMessage(
  cap: SessionCapacity,
  proj: FinishProjection | null,
  windows: WindowRange[],
): CapacityMessage | null {
  if (!cap.window || cap.totalCapacity === 0) return null;

  if (proj && proj.remainingInWindow > 0) {
    if (proj.overMinutes > 20) {
      return {
        tone: "danger",
        text: `Likely to finish ${formatTime12h(minutesToTimeStr(proj.finishMinutes))} — ${proj.overMinutes} min over`,
      };
    }
    if (proj.overMinutes > 0) {
      return {
        tone: "warn",
        text: `Likely to finish ${formatTime12h(minutesToTimeStr(proj.finishMinutes))} — ${proj.overMinutes} min over`,
      };
    }
    if (proj.overMinutes > -15) {
      return {
        tone: "warn",
        text: `Likely to finish ${formatTime12h(minutesToTimeStr(proj.finishMinutes))} — ${-proj.overMinutes} minutes to spare`,
      };
    }
  }

  if (cap.freeCount === 0) {
    const next = windows.find((w) => w.start > cap.window!.end);
    return {
      tone: "ok",
      text: next
        ? `Full for this session — next session ${formatTime12h(minutesToTimeStr(next.start))}`
        : "Full for this session",
    };
  }

  return { tone: "ok", text: "Room to spare — walk-ins welcome" };
}

export function laneStatus(lane: QueueLane, now: Date): LaneStatus {
  // Someone's already checked in or being seen — the doctor is clearly
  // working, regardless of what their nominal availability window says.
  if (lane.inConsultation.length > 0 || lane.waiting.length > 0) {
    // A walk-in's `time` is just when they were slotted in, not a
    // commitment they could be late against — only scheduled bookings can
    // make the doctor look behind.
    const lateness = lane.waiting
      .filter((a) => a.bookingSource !== "walk-in")
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
  // Appointments with no consultationStartedAt are skipped outright rather
  // than passed through stageStart, which would default to `updatedAt` and
  // report the doctor's last unrelated save as their arrival time.
  const candidates = [...lane.inConsultation, ...lane.done]
    .filter((a) => !!a.consultationStartedAt)
    .map((a) => new Date(a.consultationStartedAt as string))
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

// Manually-set presence, entered by the front desk (or the doctor
// themself) for whatever the day's data can't prove on its own — a doctor
// who hasn't started a consultation yet could be five minutes away or a
// no-show, and only a human knows which. Persisted server-side per
// hospital+doctor+day (see useDoctorPresenceApi), shared across every
// front-desk terminal and the doctor's own device, with every change
// recorded in the audit trail.
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

// How long past a doctor's shift start we wait, with no consultation started
// and no manual "here" from the front desk, before flagging them as running
// late on our own — nobody has to notice and set it by hand.
export const AUTO_LATE_GRACE_MINUTES = 15;

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

  if (availability.available) {
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const currentWindow = todaysWindows(lane.doctor, now).find(
      (w) => nowMins >= w.start && nowMins < w.end,
    );
    const minsPastStart = currentWindow ? nowMins - currentWindow.start : 0;
    if (minsPastStart >= AUTO_LATE_GRACE_MINUTES) {
      return {
        tone: "late",
        label: "RUNNING LATE",
        detail: `${minsPastStart} min past start · not marked in`,
      };
    }
    return {
      tone: "expected",
      label: "EXPECTED",
      detail: "Due now · not arrived",
    };
  }

  // Every window for today has come and gone and the doctor was never seen —
  // flag it, but only as a display label. Whether to actually reassign or
  // cancel their remaining bookings stays a front-desk call via "Not coming
  // today"; we don't take that action on their behalf.
  if (availability.label === "Session over") {
    return {
      tone: "notIn",
      label: "NOT COMING TODAY",
      detail: "Did not check in during scheduled hours today",
    };
  }

  return {
    tone: "expected",
    label: "EXPECTED",
    detail: availability.label,
  };
}

/* ---------------------------------------------------------------------- */
/*                turn order — effective ready time                       */
/* ---------------------------------------------------------------------- */

export type BookingSource = "scheduled" | "walk-in";

// One waiting patient as seen by the ordering function. Deliberately
// decoupled from AppointmentWithDetails: dates are already resolved to Date
// objects here, so this function stays pure over its inputs rather than
// over date/time-string parsing rules that belong to the wiring layer.
export interface QueueCandidate {
  id: string;
  bookingSource: BookingSource;
  checkedInAt: Date;
  // The appointment's booked date+time. Null for walk-ins — they have no
  // slot to be early or late for.
  scheduledStart: Date | null;
  // Desk-triggered only; null unless a front-desk user explicitly set it.
  urgentOverrideAt: Date | null;
  urgentOverrideReason?: string;
}

export interface QueueOrderingRules {
  // A walk-in waiting longer than this jumps ahead of the base order,
  // longest-waiting first, so they can't be leapfrogged indefinitely by
  // booked patients arriving on time. Per-doctor; falls back to
  // DEFAULT_WALKIN_FAIRNESS_MINUTES when the doctor hasn't set one.
  walkinFairnessMinutes?: number;
}

export const DEFAULT_WALKIN_FAIRNESS_MINUTES = 45;

export interface OrderedQueueEntry {
  id: string;
  readyAt: Date;
  reason: string;
}

// A booked patient isn't "ready" before their slot — arriving early gains
// them nothing. A walk-in is ready the moment they check in. A booked
// patient who arrives after their slot is simply ready at arrival, which
// automatically costs them their place; no separate grace-period rule
// is needed on top of this.
function readyAt(candidate: QueueCandidate): Date {
  if (!candidate.scheduledStart) return candidate.checkedInAt;
  return candidate.checkedInAt.getTime() > candidate.scheduledStart.getTime()
    ? candidate.checkedInAt
    : candidate.scheduledStart;
}

function clockTime(d: Date): string {
  return formatTime12h(format(d, "HH:mm"));
}

// An online booking has two distinct times worth showing side by side — the
// slot they booked and when they actually checked in — since readyAt only
// ever surfaces whichever of the two was later. A walk-in has no "booked
// time" at all, so it only ever shows when they checked in.
//
// For a booked patient whose slot hasn't arrived yet, also name the
// earliness — otherwise the desk has no way to tell "ranked last because
// ready in 54 min" from "ranked last for no visible reason". Walk-ins are
// always ready at checkedInAt, so this branch never applies to them.
function baseReason(candidate: QueueCandidate, now: Date): string {
  if (candidate.bookingSource === "walk-in") {
    return `walked in ${clockTime(candidate.checkedInAt)}`;
  }
  const bookedTime = clockTime(candidate.scheduledStart ?? candidate.checkedInAt);
  const checkedInTime = clockTime(candidate.checkedInAt);
  const label = `booked ${bookedTime} · checked in ${checkedInTime}`;
  const ready = readyAt(candidate);
  if (ready.getTime() > now.getTime()) {
    return `${label} — ${minutesElapsed(now, ready)} min early`;
  }
  return label;
}

// Ascending by `primary`, then checkedInAt, then id — keeps the order
// deterministic (and equal-key input order irrelevant) when two candidates
// tie on the main sort key.
function compareStable(
  a: QueueCandidate,
  b: QueueCandidate,
  primary: (c: QueueCandidate) => number,
): number {
  return (
    primary(a) - primary(b) ||
    a.checkedInAt.getTime() - b.checkedInAt.getTime() ||
    a.id.localeCompare(b.id)
  );
}

// The single source of truth for queue turn order. Backs the queue board
// display, the "call next" action, and the patient wait estimate, so all
// three always agree — none of them may compute their own ordering.
//
// Precondition: every candidate must already be checked in — `checkedInAt`
// is a real, already-happened timestamp. This is an ordering among people
// physically waiting, not a schedule of who's expected; callers must filter
// out yet-to-arrive appointments before mapping them to QueueCandidate.
//
// Precedence: urgent override -> fairness-promoted walk-ins -> everyone
// else by readyAt. heldSlotsPerSession/acceptWalkIns and bookingSource
// deliberately play no role here — capacity and turn order are separate
// concerns (see sessionCapacity above).
// A candidate whose readyAt is this far behind `now` almost certainly isn't
// today's patient — it's a stale record that slipped past the caller's date
// filter (see buildLanes). Purely a dev-time signal; orderQueue still ranks
// it rather than guessing what the caller intended.
const STALE_CANDIDATE_HOURS = 12;

export function orderQueue(
  candidates: QueueCandidate[],
  rules: QueueOrderingRules,
  now: Date,
): OrderedQueueEntry[] {
  if (process.env.NODE_ENV !== "production") {
    for (const c of candidates) {
      if (c.checkedInAt.getTime() > now.getTime()) {
        console.warn(
          `orderQueue: candidate ${c.id} has a checkedInAt in the future — only already-checked-in patients may be passed in`,
        );
      }
      const staleMs = now.getTime() - readyAt(c).getTime();
      if (staleMs > STALE_CANDIDATE_HOURS * 60 * 60 * 1000) {
        const hoursAgo = Math.floor(staleMs / (60 * 60 * 1000));
        console.warn(
          `orderQueue: candidate ${c.id} is ready ${hoursAgo}h ago — stale appointment reaching the queue, check the caller's date filter`,
        );
      }
    }
  }

  const urgent = candidates.filter((c) => c.urgentOverrideAt);
  const rest = candidates.filter((c) => !c.urgentOverrideAt);

  const fairnessMinutes =
    rules.walkinFairnessMinutes ?? DEFAULT_WALKIN_FAIRNESS_MINUTES;
  const promoted = rest.filter(
    (c) =>
      c.bookingSource === "walk-in" &&
      minutesElapsed(c.checkedInAt, now) >= fairnessMinutes,
  );
  const promotedIds = new Set(promoted.map((c) => c.id));
  const remaining = rest.filter((c) => !promotedIds.has(c.id));

  urgent.sort((a, b) =>
    compareStable(a, b, (c) => c.urgentOverrideAt!.getTime()),
  );
  // Longest-waiting first among promoted walk-ins.
  promoted.sort((a, b) => compareStable(a, b, (c) => c.checkedInAt.getTime()));
  remaining.sort((a, b) => compareStable(a, b, (c) => readyAt(c).getTime()));

  return [...urgent, ...promoted, ...remaining].map((c) => {
    if (c.urgentOverrideAt) {
      return {
        id: c.id,
        readyAt: readyAt(c),
        reason: `urgent — ${c.urgentOverrideReason ?? "no reason given"}`,
      };
    }
    if (promotedIds.has(c.id)) {
      return {
        id: c.id,
        readyAt: readyAt(c),
        reason: `waited ${minutesElapsed(c.checkedInAt, now)} min — next regardless`,
      };
    }
    return { id: c.id, readyAt: readyAt(c), reason: baseReason(c, now) };
  });
}

// Who the desk should call next, or null if nobody's waiting. The caller is
// responsible for wrapping the transaction that records `calledAt` in a
// per-doctor lock and recomputing this inside it — two desks may hit "next"
// at the same moment.
export function nextInQueue(
  candidates: QueueCandidate[],
  rules: QueueOrderingRules,
  now: Date,
): OrderedQueueEntry | null {
  return orderQueue(candidates, rules, now)[0] ?? null;
}

// Bridges an appointment to what orderQueue needs. Returns null when the
// appointment has neither `waitingAt` nor `checkedInAt` — that shouldn't
// happen once status reaches checked-in/waiting, but if it does, ordering
// must not silently anchor to `updatedAt` (see stageStart's comment above),
// since that would reshuffle the queue on an unrelated edit.
export function appointmentToQueueCandidate(
  appt: AppointmentWithDetails,
): QueueCandidate | null {
  const checkedInIso = appt.waitingAt || appt.checkedInAt;
  if (!checkedInIso) return null;
  const bookingSource: BookingSource =
    appt.bookingSource === "walk-in" ? "walk-in" : "scheduled";
  return {
    id: appt.id,
    bookingSource,
    checkedInAt: new Date(checkedInIso),
    scheduledStart: bookingSource === "walk-in" ? null : apptDateTime(appt),
    urgentOverrideAt: appt.urgentOverrideAt
      ? new Date(appt.urgentOverrideAt)
      : null,
    urgentOverrideReason: appt.urgentOverrideReason,
  };
}

export interface WaitingOrder {
  appts: AppointmentWithDetails[];
  entries: OrderedQueueEntry[];
}

// The one place `waiting` gets its order — buildLanes, the queue card's
// displayed reason, and its position number all read this same result, so
// none of them can disagree with the others. An appointment missing both
// check-in timestamps is excluded from ranking rather than defaulting into
// it via `updatedAt`, and appended after the ranked list instead of being
// dropped — the front desk still needs to see everyone who's waiting.
export function orderWaitingAppointments(
  waitingAppts: AppointmentWithDetails[],
  rules: QueueOrderingRules,
  now: Date,
): WaitingOrder {
  const candidates: QueueCandidate[] = [];
  const orphans: AppointmentWithDetails[] = [];
  for (const appt of waitingAppts) {
    const candidate = appointmentToQueueCandidate(appt);
    if (candidate) {
      candidates.push(candidate);
    } else {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          `queueBoard: appointment ${appt.id} is waiting with no checkedInAt/waitingAt — excluded from turn-order ranking`,
        );
      }
      orphans.push(appt);
    }
  }

  const apptsById = new Map(waitingAppts.map((a) => [a.id, a]));
  const ranked = orderQueue(candidates, rules, now);
  const rankedAppts = ranked
    .map((entry) => apptsById.get(entry.id))
    .filter((a): a is AppointmentWithDetails => a !== undefined);
  const orphanEntries: OrderedQueueEntry[] = orphans.map((appt) => ({
    id: appt.id,
    readyAt: now,
    reason: "missing check-in time",
  }));

  return {
    appts: [...rankedAppts, ...orphans],
    entries: [...ranked, ...orphanEntries],
  };
}
