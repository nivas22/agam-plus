// Local date/slot-math helpers for the Reports module. Deliberately not
// hoisted into apps/api/src/common — appointments.service.ts/packages.service.ts/
// doctors.service.ts each already carry their own near-identical copies, and
// refactoring those is out of scope for this feature.

// Local calendar date (not `.toISOString()`, which shifts a day back in any
// timezone ahead of UTC).
export function toISODateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Half-open [start, end) UTC range spanning every calendar day from
// startDate through endDate inclusive — matches how the rest of the app
// anchors "YYYY-MM-DD" day boundaries to UTC midnight (see
// PaymentsService.dateRangeForDay).
export function dayBoundsUTC(startDate: string, endDate: string): { start: Date; end: Date } {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

// Every calendar day string from startDate through endDate, inclusive.
export function eachDateIso(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00.000Z`);
  const last = new Date(`${endDate}T00:00:00.000Z`);
  while (cursor.getTime() <= last.getTime()) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export function weekdayName(dateIso: string): string {
  return new Date(`${dateIso}T00:00:00.000Z`).toLocaleDateString('en-US', {
    weekday: 'long',
    timeZone: 'UTC',
  });
}

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

// Number of bookable slots a single availability window/day produces, same
// stepping logic as DoctorsService.getAvailableSlots (duration + buffer per step).
export function slotsPerDay(
  windows: { day: string; startTime: string; endTime: string }[],
  dayName: string,
  durationMin: number,
  bufferMin: number,
): number {
  const step = durationMin + Math.max(0, bufferMin);
  let count = 0;
  for (const w of windows.filter((win) => win.day === dayName)) {
    let cur = toMinutes(w.startTime);
    const end = toMinutes(w.endTime);
    while (cur + durationMin <= end) {
      count++;
      cur += step;
    }
  }
  return count;
}

export interface DoctorScheduleConfig {
  availability?: { day: string; startTime: string; endTime: string }[];
  appointmentDuration?: number;
  bufferMinutes?: number;
  patientsPerSlot?: number;
}

// Theoretical total appointment capacity for a doctor across every day in
// [startDate, endDate] — the denominator for "diary full %".
export function capacityForRange(config: DoctorScheduleConfig, startDate: string, endDate: string): number {
  const windows = config.availability || [];
  const duration = config.appointmentDuration || 30;
  const buffer = config.bufferMinutes || 0;
  const perSlot = Math.max(1, config.patientsPerSlot || 1);

  let totalSlots = 0;
  for (const dateIso of eachDateIso(startDate, endDate)) {
    totalSlots += slotsPerDay(windows, weekdayName(dateIso), duration, buffer);
  }
  return totalSlots * perSlot;
}

export function ageDaysBetween(earlier: Date, asOf: Date): number {
  return Math.floor((asOf.getTime() - earlier.getTime()) / 86_400_000);
}

export const AGE_BUCKETS = ['0-7 days', '8-15 days', '16-30 days', '31-60 days', 'Over 60 days'] as const;

export function bucketForAge(ageDays: number): (typeof AGE_BUCKETS)[number] {
  if (ageDays <= 7) return AGE_BUCKETS[0];
  if (ageDays <= 15) return AGE_BUCKETS[1];
  if (ageDays <= 30) return AGE_BUCKETS[2];
  if (ageDays <= 60) return AGE_BUCKETS[3];
  return AGE_BUCKETS[4];
}

export const LEAD_TIME_BUCKETS = ['Same day', 'Within a week', '1 - 3 weeks', 'Over 3 weeks'] as const;

export function bucketForLeadDays(leadDays: number): (typeof LEAD_TIME_BUCKETS)[number] {
  if (leadDays <= 0) return LEAD_TIME_BUCKETS[0];
  if (leadDays <= 7) return LEAD_TIME_BUCKETS[1];
  if (leadDays <= 21) return LEAD_TIME_BUCKETS[2];
  return LEAD_TIME_BUCKETS[3];
}

export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

// 2-hour clinic slots, matching how front-desk shifts are usually described.
export const TIME_SLOTS = [
  { label: '8 - 10 am', startMin: 8 * 60, endMin: 10 * 60 },
  { label: '10 - 12', startMin: 10 * 60, endMin: 12 * 60 },
  { label: '12 - 2 pm', startMin: 12 * 60, endMin: 14 * 60 },
  { label: '2 - 4 pm', startMin: 14 * 60, endMin: 16 * 60 },
  { label: '4 - 6 pm', startMin: 16 * 60, endMin: 18 * 60 },
  { label: '6 - 8 pm', startMin: 18 * 60, endMin: 20 * 60 },
] as const;

export function timeSlotIndexFor(hhmm: string | undefined): number {
  if (!hhmm) return -1;
  const mins = toMinutes(hhmm);
  const idx = TIME_SLOTS.findIndex((s) => mins >= s.startMin && mins < s.endMin);
  return idx;
}
