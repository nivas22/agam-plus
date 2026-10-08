import { Appointment, OrderedEntry } from '../types';

const MINUTE = 60_000;
export const DEFAULT_FAIRNESS_MINUTES = 45;

const minutesElapsed = (from: number, to: number) => Math.floor((to - from) / MINUTE);

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

/**
 * A booked patient who has checked in by their slot time goes ahead of ordinary
 * walk-ins from this many minutes before the slot. Must match
 * BOOKED_PRIORITY_WINDOW_MINUTES in the web app's queueBoard.ts.
 */
export const BOOKED_PRIORITY_WINDOW_MINUTES = 10;

/** Checked in after their slot — a late booked patient keeps no priority. */
function isLate(a: Appointment): boolean {
  return !!a.scheduledStart && !!a.checkedInAt && Date.parse(a.checkedInAt) > Date.parse(a.scheduledStart);
}

/** When an on-time booked patient's priority starts (slot − window); null for walk-ins and late arrivals. */
function priorityFrom(a: Appointment): number | null {
  if (a.source === 'walk_in' || !a.scheduledStart || isLate(a)) return null;
  return Date.parse(a.scheduledStart) - BOOKED_PRIORITY_WINDOW_MINUTES * MINUTE;
}

/**
 * Effective ready time — when a patient may first be called.
 *
 * A walk-in, or a booked patient who arrived late, is ready at check-in. An
 * on-time booked patient is ready from 10 min before their slot (or from
 * check-in, if they arrived inside that window).
 */
export function readyAt(a: Appointment): number {
  const checkedIn = a.checkedInAt ? Date.parse(a.checkedInAt) : Number.POSITIVE_INFINITY;
  const from = priorityFrom(a);
  return from === null ? checkedIn : Math.max(checkedIn, from);
}

function hasBookedPriority(a: Appointment, now: number): boolean {
  const from = priorityFrom(a);
  return from !== null && from <= now;
}

function describe(a: Appointment, now: number): string {
  if (a.source === 'walk_in') {
    const waited = a.checkedInAt ? minutesElapsed(Date.parse(a.checkedInAt), now) : 0;
    return `Walked in · waited ${waited} min`;
  }
  if (!a.scheduledStart) return 'Booked';
  if (isLate(a)) {
    const late = minutesElapsed(Date.parse(a.scheduledStart), Date.parse(a.checkedInAt!));
    return `Booked ${fmtTime(a.scheduledStart)} — ${late} min late`;
  }
  const from = priorityFrom(a);
  if (from !== null && from > now) {
    return `Booked ${fmtTime(a.scheduledStart)} — priority from ${fmtTime(new Date(from).toISOString())}`;
  }
  return `Booked ${fmtTime(a.scheduledStart)}`;
}

/**
 * Pure ordering. No dates created inside — `now` is always passed in, so the
 * function is deterministic and testable.
 *
 * Precondition: every candidate is already checked in.
 * Precedence: fairness-promoted walk-ins → booked patients inside their
 * priority window (by slot time) → everyone else by readyAt.
 */
export function orderQueue(
  candidates: Appointment[],
  now: number,
  fairnessMinutes: number = DEFAULT_FAIRNESS_MINUTES,
): OrderedEntry[] {
  const promoted: Appointment[] = [];
  const booked: Appointment[] = [];
  const base: Appointment[] = [];

  for (const a of candidates) {
    const waited = a.checkedInAt ? minutesElapsed(Date.parse(a.checkedInAt), now) : 0;
    if (a.source === 'walk_in' && waited >= fairnessMinutes) promoted.push(a);
    else if (hasBookedPriority(a, now)) booked.push(a);
    else base.push(a);
  }

  const byCheckIn = (x: Appointment, y: Appointment) =>
    (x.checkedInAt ? Date.parse(x.checkedInAt) : 0) - (y.checkedInAt ? Date.parse(y.checkedInAt) : 0) ||
    x.id.localeCompare(y.id);

  promoted.sort(byCheckIn);
  booked.sort((x, y) => Date.parse(x.scheduledStart!) - Date.parse(y.scheduledStart!) || byCheckIn(x, y));
  base.sort((x, y) => readyAt(x) - readyAt(y) || byCheckIn(x, y));

  return [...promoted, ...booked, ...base].map((a) => {
    const waited = a.checkedInAt ? minutesElapsed(Date.parse(a.checkedInAt), now) : 0;
    const wasPromoted = promoted.includes(a);
    return {
      appointment: a,
      readyAt: readyAt(a),
      reason: wasPromoted ? `Waited ${waited} min — next regardless` : describe(a, now),
    };
  });
}

export function waitedMinutes(a: Appointment, now: number): number {
  return a.checkedInAt ? minutesElapsed(Date.parse(a.checkedInAt), now) : 0;
}
