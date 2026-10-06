import {
  addDaysIso,
  addMonthsIso,
  isoDateInZone,
  nowMinutes,
  resolveTimezone,
  todayIso,
  weekdayOf,
} from './hospital-time.util';

describe('hospital-time.util', () => {
  afterEach(() => jest.useRealTimers());

  it('reads "today" on the hospital clock, not UTC', () => {
    // 20:00 UTC on 5 Oct is already 01:30 on 6 Oct in IST.
    jest.useFakeTimers().setSystemTime(new Date('2026-10-05T20:00:00Z'));
    expect(todayIso('Asia/Kolkata')).toBe('2026-10-06');
    expect(todayIso('Asia/Kolkata', -1)).toBe('2026-10-05');
    expect(todayIso('UTC')).toBe('2026-10-05');
  });

  it('reads the current minute on the hospital clock', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-05T04:00:00Z'));
    expect(nowMinutes('Asia/Kolkata')).toBe(9 * 60 + 30);
  });

  it('maps an instant to its hospital-local date', () => {
    expect(isoDateInZone('2026-10-05T19:00:00Z', 'Asia/Kolkata')).toBe('2026-10-06');
    expect(isoDateInZone('2026-10-05T17:00:00Z', 'Asia/Kolkata')).toBe('2026-10-05');
  });

  it('falls back to the default zone for missing or bogus values', () => {
    expect(resolveTimezone(undefined)).toBe('Asia/Kolkata');
    expect(resolveTimezone('Not/AZone')).toBe('Asia/Kolkata');
    expect(resolveTimezone('Asia/Dubai')).toBe('Asia/Dubai');
  });

  it('does pure calendar math', () => {
    expect(weekdayOf('2026-10-05')).toBe('Monday');
    expect(addDaysIso('2026-12-31', 1)).toBe('2027-01-01');
    expect(addMonthsIso('2026-01-31', 1)).toBe('2026-02-28');
  });
});
