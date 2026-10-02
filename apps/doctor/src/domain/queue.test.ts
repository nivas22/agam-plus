import { describe, expect, it } from 'vitest';
import { DEFAULT_FAIRNESS_MINUTES, orderQueue, readyAt, waitedMinutes } from './queue';
import type { Appointment } from '../types';

const NOW = Date.parse('2025-08-21T11:20:00+05:30');
const at = (hhmm: string) => `2025-08-21T${hhmm}:00+05:30`;

const appt = (over: Partial<Appointment> & Pick<Appointment, 'id' | 'source'>): Appointment => ({
  token: 1,
  name: 'Test Patient',
  ageSex: '40 M',
  reason: 'review',
  ...over,
});

const ids = (entries: ReturnType<typeof orderQueue>) => entries.map((e) => e.appointment.id);

describe('readyAt', () => {
  it('holds a booked patient to their slot when they arrive early', () => {
    const early = appt({ id: 'a', source: 'booked', scheduledStart: at('11:00'), checkedInAt: at('10:30') });
    expect(readyAt(early)).toBe(Date.parse(at('11:00')));
  });

  it('makes a walk-in ready at check-in', () => {
    const walkIn = appt({ id: 'a', source: 'walk_in', checkedInAt: at('10:30') });
    expect(readyAt(walkIn)).toBe(Date.parse(at('10:30')));
  });

  it('makes a late booked patient ready at arrival, not at their slot', () => {
    const late = appt({ id: 'a', source: 'booked', scheduledStart: at('10:00'), checkedInAt: at('11:00') });
    expect(readyAt(late)).toBe(Date.parse(at('11:00')));
  });
});

describe('orderQueue', () => {
  it('orders by readyAt, so arriving early gains a booked patient nothing', () => {
    const early = appt({ id: 'early', source: 'booked', scheduledStart: at('11:15'), checkedInAt: at('09:00') });
    const onTime = appt({ id: 'ontime', source: 'booked', scheduledStart: at('10:45'), checkedInAt: at('10:44') });

    expect(ids(orderQueue([early, onTime], NOW))).toEqual(['ontime', 'early']);
  });

  it('promotes a walk-in that has waited past the fairness threshold', () => {
    const waitedLong = appt({ id: 'walkin', source: 'walk_in', checkedInAt: at('10:30') }); // 50 min
    const booked = appt({ id: 'booked', source: 'booked', scheduledStart: at('11:00'), checkedInAt: at('10:55') });

    const entries = orderQueue([booked, waitedLong], NOW);
    expect(ids(entries)).toEqual(['walkin', 'booked']);
    expect(entries[0].reason).toBe('Waited 50 min — next regardless');
  });

  it('leaves a walk-in below the threshold in readyAt order', () => {
    const recent = appt({ id: 'walkin', source: 'walk_in', checkedInAt: at('11:05') }); // 15 min
    const booked = appt({ id: 'booked', source: 'booked', scheduledStart: at('10:45'), checkedInAt: at('10:52') });

    expect(ids(orderQueue([booked, recent], NOW))).toEqual(['booked', 'walkin']);
  });

  it('treats the fairness threshold as inclusive', () => {
    const exactly = appt({
      id: 'walkin',
      source: 'walk_in',
      checkedInAt: new Date(NOW - DEFAULT_FAIRNESS_MINUTES * 60_000).toISOString(),
    });
    const booked = appt({ id: 'booked', source: 'booked', scheduledStart: at('11:00'), checkedInAt: at('10:59') });

    expect(ids(orderQueue([booked, exactly], NOW))).toEqual(['walkin', 'booked']);
  });

  it('honours a custom fairness window', () => {
    const walkIn = appt({ id: 'walkin', source: 'walk_in', checkedInAt: at('11:00') }); // 20 min
    const booked = appt({ id: 'booked', source: 'booked', scheduledStart: at('10:50'), checkedInAt: at('10:50') });

    expect(ids(orderQueue([booked, walkIn], NOW, 15))).toEqual(['walkin', 'booked']);
    expect(ids(orderQueue([booked, walkIn], NOW))).toEqual(['booked', 'walkin']);
  });

  it('orders promoted walk-ins longest-waiting first', () => {
    const older = appt({ id: 'older', source: 'walk_in', checkedInAt: at('10:00') });
    const newer = appt({ id: 'newer', source: 'walk_in', checkedInAt: at('10:20') });

    expect(ids(orderQueue([newer, older], NOW))).toEqual(['older', 'newer']);
  });

  it('breaks readyAt ties by id so the order never flickers between renders', () => {
    const b = appt({ id: 'b', source: 'booked', scheduledStart: at('11:00'), checkedInAt: at('11:00') });
    const a = appt({ id: 'a', source: 'booked', scheduledStart: at('11:00'), checkedInAt: at('11:00') });

    expect(ids(orderQueue([b, a], NOW))).toEqual(['a', 'b']);
    expect(ids(orderQueue([a, b], NOW))).toEqual(['a', 'b']);
  });

  it('is a pure function of the `now` it is given', () => {
    const list = [
      appt({ id: 'walkin', source: 'walk_in', checkedInAt: at('10:30') }),
      appt({ id: 'booked', source: 'booked', scheduledStart: at('11:00'), checkedInAt: at('10:55') }),
    ];

    // 10 min after the walk-in checked in, it has not yet earned promotion.
    expect(ids(orderQueue(list, Date.parse(at('10:40'))))).toEqual(['walkin', 'booked']);
    // Same input, later clock — now promoted ahead of the booked slot.
    expect(ids(orderQueue(list, NOW))).toEqual(['walkin', 'booked']);
  });

  it('explains each position to the doctor', () => {
    const entries = orderQueue(
      [
        appt({ id: 'walkin', source: 'walk_in', checkedInAt: at('11:05') }),
        appt({ id: 'booked', source: 'booked', scheduledStart: at('10:45'), checkedInAt: at('10:52') }),
      ],
      NOW,
    );

    expect(entries.map((e) => e.reason)).toEqual([
      expect.stringContaining('Booked'),
      'Walked in · waited 15 min',
    ]);
  });
});

describe('waitedMinutes', () => {
  it('floors rather than rounds, so a threshold never fires early', () => {
    const a = appt({ id: 'a', source: 'walk_in', checkedInAt: new Date(NOW - 44 * 60_000 - 31_000).toISOString() });
    expect(waitedMinutes(a, NOW)).toBe(44);
  });

  it('reports zero for a patient who has not checked in', () => {
    expect(waitedMinutes(appt({ id: 'a', source: 'booked' }), NOW)).toBe(0);
  });
});
