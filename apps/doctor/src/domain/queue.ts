import { Appointment, OrderedEntry } from '../types';

const MINUTE = 60_000;
export const DEFAULT_FAIRNESS_MINUTES = 45;

const minutesElapsed = (from: number, to: number) => Math.floor((to - from) / MINUTE);

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

/**
 * Effective ready time — the single sort key for the queue.
 *
 *   readyAt = max(checkedInAt, scheduledStart)
 *
 * A booked patient isn't "ready" before their slot, so arriving early gains nothing.
 * A walk-in is ready the moment they check in. A booked patient who arrives late is
 * ready at arrival, so they lose their place automatically — no separate grace rule.
 */
export function readyAt(a: Appointment): number {
  const checkedIn = a.checkedInAt ? Date.parse(a.checkedInAt) : Number.POSITIVE_INFINITY;
  const scheduled = a.scheduledStart ? Date.parse(a.scheduledStart) : checkedIn;
  return Math.max(checkedIn, scheduled);
}

function describe(a: Appointment, now: number): string {
  if (a.source === 'walk_in') {
    const waited = a.checkedInAt ? minutesElapsed(Date.parse(a.checkedInAt), now) : 0;
    return `Walked in · waited ${waited} min`;
  }
  if (!a.scheduledStart) return 'Booked';
  const ready = readyAt(a);
  if (ready > now) {
    const early = Math.floor((ready - now) / MINUTE);
    return `Booked ${fmtTime(a.scheduledStart)} — ${early} min early`;
  }
  return `Booked ${fmtTime(a.scheduledStart)}`;
}

/**
 * Pure ordering. No dates created inside — `now` is always passed in, so the
 * function is deterministic and testable.
 *
 * Precondition: every candidate is already checked in.
 * Precedence: fairness-promoted walk-ins → everyone else by readyAt.
 */
export function orderQueue(
  candidates: Appointment[],
  now: number,
  fairnessMinutes: number = DEFAULT_FAIRNESS_MINUTES,
): OrderedEntry[] {
  const promoted: Appointment[] = [];
  const base: Appointment[] = [];

  for (const a of candidates) {
    const waited = a.checkedInAt ? minutesElapsed(Date.parse(a.checkedInAt), now) : 0;
    if (a.source === 'walk_in' && waited >= fairnessMinutes) promoted.push(a);
    else base.push(a);
  }

  const byCheckIn = (x: Appointment, y: Appointment) =>
    (x.checkedInAt ? Date.parse(x.checkedInAt) : 0) - (y.checkedInAt ? Date.parse(y.checkedInAt) : 0) ||
    x.id.localeCompare(y.id);

  promoted.sort(byCheckIn);
  base.sort((x, y) => readyAt(x) - readyAt(y) || byCheckIn(x, y));

  return [...promoted, ...base].map((a) => {
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
