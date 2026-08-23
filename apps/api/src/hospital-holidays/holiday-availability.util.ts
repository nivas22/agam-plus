import { HOLIDAY_CLOSURE_TYPE } from '../constants';

export interface HolidayLike {
  startsOn: string;
  endsOn: string;
  closureType: string;
  halfDayUntil?: string;
  exceptionDoctorIds?: string[];
}

// The one active holiday covering a given YYYY-MM-DD, if any. Holiday date
// ranges never overlap in practice, so the first match is enough.
export function findHolidayForDate<T extends HolidayLike>(
  holidays: T[],
  dateIso: string,
): T | null {
  return holidays.find((h) => h.startsOn <= dateIso && dateIso <= h.endsOn) ?? null;
}

export function isDoctorExempt(holiday: HolidayLike, doctorProfileId: string): boolean {
  return (holiday.exceptionDoctorIds || []).includes(doctorProfileId);
}

// Applies a holiday's closure rule to a list of candidate slots for one
// doctor on one date. `full`/`opd_closed` block the whole day; `half_day`
// truncates to slots starting before the cutoff. An exempt doctor (or no
// holiday at all) passes the slots through untouched.
export function filterSlotsForHoliday<T extends { time: string }>(
  slots: T[],
  holiday: HolidayLike | null,
  doctorProfileId: string,
): T[] {
  if (!holiday) return slots;
  if (isDoctorExempt(holiday, doctorProfileId)) return slots;

  if (holiday.closureType === HOLIDAY_CLOSURE_TYPE.HALF_DAY) {
    if (!holiday.halfDayUntil) return slots;
    return slots.filter((s) => s.time < holiday.halfDayUntil!);
  }

  // FULL or OPD_CLOSED
  return [];
}
