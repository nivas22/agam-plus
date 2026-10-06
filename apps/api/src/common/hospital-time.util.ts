import { DateTime } from 'luxon';

// "Today", "now" and "has this slot passed" must be read on the hospital's
// wall clock, not the server's — the API runs on UTC (Vercel), so using
// `new Date()` local getters there puts an IST clinic's day change at 05:30
// and every past-slot check 5.5 h behind. Appointment `date` (YYYY-MM-DD) and
// `time` (HH:mm) are stored as hospital wall-clock values, so everything here
// either reads the clock in the hospital's zone or does pure calendar math.

export const DEFAULT_HOSPITAL_TIMEZONE = 'Asia/Kolkata';

export function isValidTimezone(tz: string): boolean {
  return DateTime.now().setZone(tz).isValid;
}

export function resolveTimezone(tz?: string | null): string {
  return tz && isValidTimezone(tz) ? tz : DEFAULT_HOSPITAL_TIMEZONE;
}

export function hospitalNow(tz: string): DateTime {
  return DateTime.now().setZone(resolveTimezone(tz));
}

// Today's calendar date in the hospital's zone, optionally shifted by whole days.
export function todayIso(tz: string, offsetDays = 0): string {
  return hospitalNow(tz).plus({ days: offsetDays }).toISODate()!;
}

// Minutes since midnight on the hospital's clock right now.
export function nowMinutes(tz: string): number {
  const now = hospitalNow(tz);
  return now.hour * 60 + now.minute;
}

// Current HH:mm on the hospital's clock.
export function nowHHmm(tz: string): string {
  return hospitalNow(tz).toFormat('HH:mm');
}

// The hospital-local calendar date an instant falls on.
export function isoDateInZone(instant: Date | string, tz: string): string {
  const d = typeof instant === 'string' ? new Date(instant) : instant;
  return DateTime.fromJSDate(d).setZone(resolveTimezone(tz)).toISODate()!;
}

// Pure calendar math on YYYY-MM-DD — independent of any timezone.
export function addDaysIso(dateIso: string, n: number): string {
  return DateTime.fromISO(dateIso, { zone: 'utc' }).plus({ days: n }).toISODate()!;
}

export function addMonthsIso(dateIso: string, n: number): string {
  return DateTime.fromISO(dateIso, { zone: 'utc' }).plus({ months: n }).toISODate()!;
}

// 'Monday'…'Sunday' for a calendar date, matching availability[].day.
export function weekdayOf(dateIso: string): string {
  return DateTime.fromISO(dateIso, { zone: 'utc' }).setLocale('en-US').toFormat('cccc');
}
