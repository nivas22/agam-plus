import type { Appointment } from '../types';

/**
 * The data behind the four reference screens.
 *
 * These fields don't all exist on the API yet — `token`, `room`, the desk's
 * "why he's here" note and the unpaid balance have no endpoint today (see the
 * TODO block at the bottom). Keeping them in one typed fixture means the
 * screens are built against the real shape now and swap to live data by
 * replacing this module, not by editing every screen.
 */

/** Anchored so the fixture always renders the same relative wait times. */
export const DEMO_NOW = Date.parse('2025-08-21T11:20:00+05:30');

const iso = (hhmm: string) => `2025-08-21T${hhmm}:00+05:30`;

export const withYouNow = {
  name: 'Fathima Abdul',
  ageSex: '34 F',
  bookedAt: '10:30',
  room: 'room 2',
  elapsedSeconds: 504, // 8:24
  slotMinutes: 30,
};

export const todayAppointments: Appointment[] = [
  {
    id: 'a-12',
    token: 12,
    name: 'Anand Venkat',
    ageSex: '51 M',
    reason: 'knee review',
    source: 'booked',
    scheduledStart: iso('10:45'),
    checkedInAt: iso('10:52'),
    allergy: 'Penicillin',
    unpaidAmount: 1100,
    weightKg: 78,
  },
  {
    id: 'a-13',
    token: 13,
    name: 'Priya Selvam',
    ageSex: '29 F',
    reason: 'fever, 3 days',
    source: 'walk_in',
    checkedInAt: iso('11:05'),
  },
  {
    id: 'a-14',
    token: 14,
    name: 'Meena Raghavan',
    ageSex: '41 F',
    reason: 'follow-up',
    source: 'booked',
    scheduledStart: iso('11:30'),
  },
  {
    id: 'a-15',
    token: 15,
    name: 'Suresh Kumar',
    ageSex: '63 M',
    reason: 'physio review',
    source: 'booked',
    scheduledStart: iso('12:00'),
    packageProgress: 'Package 5/10',
  },
];

export const patientDetail = {
  id: 'a-12',
  toldToTheDesk:
    'Knee pain review — a month after starting etoricoxib. Better on stairs but still stiff in the mornings.',
  lastVisit: {
    date: '14 July',
    author: 'Dr. Ramesh',
    note: 'Right knee pain on stairs for 3 weeks. No swelling, full range of movement. Started etoricoxib 60 mg for 5 days.',
  },
  background: [
    { label: 'Conditions', value: 'Hypertension' },
    { label: 'On regular meds', value: 'Telmisartan 40' },
    { label: 'Last BP', value: '138/86 · 14 July' },
  ],
};

export const finishVisit = {
  notes:
    'Knee pain much improved since July. Climbing stairs without discomfort. No swelling today. Continue exercises, stop the tablet.',
  quickInserts: ['Copy last visit', 'Continue meds', 'Advised rest'],
  given: [{ label: 'Dressing', amount: 150 }],
};

export const schedule = {
  doctor: 'Dr. Arun Prakash',
  week: [
    { day: 'Monday', hours: '9–1,  5–8' },
    { day: 'Wednesday', hours: '9–1,  5–8' },
    { day: 'Friday', hours: '9–1' },
    { day: 'Saturday', hours: '9–12:30' },
  ],
  timeOff: [
    { dates: '24–25 Aug', reason: 'Family function' },
    { dates: '31 Aug', reason: 'Hospital holiday' },
  ],
};

/*
 * TODO(api): fields these screens need that apps/api does not expose yet.
 *
 *   token            queue token number shown to the patient at the desk
 *   room             which room the doctor is sitting in
 *   toldToTheDesk    the desk's free-text reason for the visit
 *   unpaidAmount     outstanding balance, read-only on the phone
 *   packageProgress  sessions used out of a purchased package
 *
 * `scheduledStart` and `checkedInAt` here are full ISO timestamps, whereas
 * Appointment in @agam/shared carries `date` + `time` as separate strings and
 * a `waitingAt`/`checkedInAt` pair. Whatever maps this fixture to the API must
 * combine them the way apptDateTime does in the web queue board, and prefer
 * `waitingAt` over `checkedInAt` as that module does.
 */
