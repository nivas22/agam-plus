export enum DB_COLLECTIONS {
  USERS = 'users_new',
  DOCTOR_PROFILES = 'doctorProfiles_new_1',
  PATIENTS = 'patients_new_1',
  APPOINTMENTS = 'appointments_new',
  HOSPITALS = 'hospitals_new',
  HOSPITAL_MEMBERS = 'hospitalMembers_new_1',
  REVIEWS = 'reviews',
  DOCTOR_ACTIVIES = 'doctor_activities',
  PAYMENTS = 'payments',
  PAYMENT_DAY_CLOSES = 'payment_day_closes',
  PACKAGES = 'packages',
  TEAM_MEMBER_PROFILES = 'team_member_profiles',
  ROLE_PERMISSIONS = 'role_permissions',
  AUDIT_LOG = 'audit_log',
  APPROVAL_REQUESTS = 'approval_requests',
  CHARGE_CATALOG_ITEMS = 'charge_catalog_items',
  HOSPITAL_HOLIDAYS = 'hospital_holidays',
  MEDICINES = 'medicines',
  PRESCRIPTIONS = 'prescriptions',
  LEAVE_REQUESTS = 'leave_requests',
}

// FRONT_DESK/NURSE/ACCOUNTANT replace the old unused STAFF value — nothing
// ever created a 'staff' membership, these are the first real non-admin,
// non-clinical roles in the system (see the Team/Roles & permissions feature).
export enum ROLE {
  ADMIN = 'admin',
  DOCTOR = 'doctor',
  PATIENT = 'patient',
  FRONT_DESK = 'front_desk',
  NURSE = 'nurse',
  ACCOUNTANT = 'accountant',
}

export const STAFF_ROLES = [ROLE.FRONT_DESK, ROLE.NURSE, ROLE.ACCOUNTANT];

export enum MEMBERSHIP_STATUS {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  SUSPENDED = 'suspended',
  DEACTIVATED = 'deactivated',
}

// The three states a permission action can be in for a given role — see
// permissions/permission-catalog.ts for the full action catalog.
export enum PERMISSION_STATE {
  ALLOWED = 'allowed',
  NEEDS_APPROVAL = 'needs_approval',
  BLOCKED = 'blocked',
}

export enum GENDER {
  MALE = 'Male',
  FEMALE = 'Female',
  OTHER = 'Other',
}

// Appointment lifecycle. PENDING is reserved for a future patient
// self-booking flow (not reachable today — admin/staff-created
// appointments start at CONFIRMED). This also lays the groundwork for a
// hospital queue: CHECKED_IN -> WAITING -> IN_CONSULTATION.
export enum APPOINTMENT_STATUS {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CHECKED_IN = 'checked-in',
  WAITING = 'waiting',
  IN_CONSULTATION = 'in-consultation',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no-show',
  RESCHEDULED = 'rescheduled',
}

export const APPOINTMENT_STATUS_VALUES = Object.values(APPOINTMENT_STATUS);

// Statuses that still hold a claim on the doctor's schedule for that slot.
export const ACTIVE_APPOINTMENT_STATUSES: APPOINTMENT_STATUS[] = [
  APPOINTMENT_STATUS.PENDING,
  APPOINTMENT_STATUS.CONFIRMED,
  APPOINTMENT_STATUS.CHECKED_IN,
  APPOINTMENT_STATUS.WAITING,
  APPOINTMENT_STATUS.IN_CONSULTATION,
];

// Legacy documents predate this state machine and were all written as
// 'scheduled'. Normalize them to CONFIRMED for transition checks only —
// the stored value is left untouched until the appointment's next update.
export function normalizeAppointmentStatus(
  status: string | undefined | null,
): APPOINTMENT_STATUS {
  if (status === 'scheduled' || !status) return APPOINTMENT_STATUS.CONFIRMED;
  return status as APPOINTMENT_STATUS;
}

// Allowed next statuses for each current status. Same-status "transitions"
// (e.g. re-saving session notes on a completed appointment) are always
// permitted and validated separately.
export const APPOINTMENT_STATUS_TRANSITIONS: Record<
  APPOINTMENT_STATUS,
  APPOINTMENT_STATUS[]
> = {
  [APPOINTMENT_STATUS.PENDING]: [
    APPOINTMENT_STATUS.CONFIRMED,
    APPOINTMENT_STATUS.CANCELLED,
  ],
  [APPOINTMENT_STATUS.CONFIRMED]: [
    APPOINTMENT_STATUS.CHECKED_IN,
    APPOINTMENT_STATUS.IN_CONSULTATION, // doctor-direct fast path when front-desk check-in isn't used
    APPOINTMENT_STATUS.CANCELLED,
    APPOINTMENT_STATUS.NO_SHOW,
    APPOINTMENT_STATUS.RESCHEDULED,
  ],
  [APPOINTMENT_STATUS.CHECKED_IN]: [
    APPOINTMENT_STATUS.WAITING,
    APPOINTMENT_STATUS.IN_CONSULTATION,
    APPOINTMENT_STATUS.CANCELLED,
  ],
  [APPOINTMENT_STATUS.WAITING]: [
    APPOINTMENT_STATUS.IN_CONSULTATION,
    APPOINTMENT_STATUS.CANCELLED,
  ],
  [APPOINTMENT_STATUS.IN_CONSULTATION]: [
    APPOINTMENT_STATUS.COMPLETED,
    APPOINTMENT_STATUS.CANCELLED,
  ],
  [APPOINTMENT_STATUS.COMPLETED]: [APPOINTMENT_STATUS.CONFIRMED], // reopen
  [APPOINTMENT_STATUS.CANCELLED]: [
    APPOINTMENT_STATUS.CONFIRMED,
    APPOINTMENT_STATUS.RESCHEDULED,
  ], // reopen / rebook
  [APPOINTMENT_STATUS.NO_SHOW]: [
    APPOINTMENT_STATUS.CONFIRMED,
    APPOINTMENT_STATUS.RESCHEDULED,
  ], // reopen / rebook
  [APPOINTMENT_STATUS.RESCHEDULED]: [
    APPOINTMENT_STATUS.CONFIRMED,
    APPOINTMENT_STATUS.CANCELLED,
  ],
};

export function isValidAppointmentTransition(
  from: string | undefined | null,
  to: APPOINTMENT_STATUS,
): boolean {
  const current = normalizeAppointmentStatus(from);
  if (current === to) return true;
  return APPOINTMENT_STATUS_TRANSITIONS[current]?.includes(to) ?? false;
}

// Marks whether an appointment was booked ad-hoc, drawn from a prepaid
// package, or auto-created as a doctor-requested follow-up at visit
// completion (see FOLLOW_UP_DAY_OFFSETS / PaymentsService.completeVisit).
// PACKAGE appointments carry packageId/packageVisitNumber.
export enum APPOINTMENT_TYPE {
  REGULAR = 'regular',
  PACKAGE = 'package',
  FOLLOW_UP = 'follow-up',
}

export const APPOINTMENT_TYPE_VALUES = Object.values(APPOINTMENT_TYPE);

export enum PACKAGE_STATUS {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

export const PACKAGE_STATUS_VALUES = Object.values(PACKAGE_STATUS);

// Derived, display-only classification for a package — never stored. Active
// packages become LAPSING inside the expiry window, USED_UP once every visit
// is consumed, or LAPSED once past validUntil with visits still unused.
export enum PACKAGE_DISPLAY_STATUS {
  ACTIVE = 'active',
  LAPSING = 'lapsing',
  USED_UP = 'used_up',
  LAPSED = 'lapsed',
  REFUNDED = 'refunded',
  CANCELLED = 'cancelled',
}

// A package still holding unused visits gets flagged once it's this many
// days (or fewer) from validUntil.
export const PACKAGE_LAPSING_WINDOW_DAYS = 30;

export enum PACKAGE_PAYMENT_METHOD {
  CASH = 'cash',
  UPI = 'upi',
  CARD = 'card',
}

export const PACKAGE_PAYMENT_METHOD_VALUES = Object.values(
  PACKAGE_PAYMENT_METHOD,
);

// Fixed bundle sizes offered for a prepaid package.
export const PACKAGE_VISIT_TIERS = [5, 10, 20];

// A package stays redeemable for 6 months from the date it's sold.
export const PACKAGE_VALIDITY_MONTHS = 6;

// Per-visit price for a prepaid package — roughly 5/6 of the doctor's normal
// consultation fee, rounded to the nearest ₹5 so bulk pricing reads clean.
export function computePackagePricePerVisit(consultationFee: number): number {
  return Math.round((consultationFee * 0.8333) / 5) * 5;
}

// How a completed visit was settled. SPLIT covers cash+UPI combined; DUE
// records the visit as unpaid rather than blocking completion on collection.
export enum PAYMENT_METHOD {
  CASH = 'cash',
  UPI = 'upi',
  SPLIT = 'split',
  DUE = 'due',
}

export const PAYMENT_METHOD_VALUES = Object.values(PAYMENT_METHOD);

export enum PAYMENT_STATUS {
  PAID = 'paid',
  DUE = 'due',
  REFUNDED = 'refunded',
}

export const PAYMENT_STATUS_VALUES = Object.values(PAYMENT_STATUS);

// Offsets for the optional draft follow-up appointment created alongside a
// completed visit. 'none' skips it — value keys double as the select's option value.
export const FOLLOW_UP_OPTIONS = [
  { value: 'none', label: 'No follow-up needed' },
  { value: '3-days', label: 'In 3 days' },
  { value: '1-week', label: 'In 1 week' },
  { value: '2-weeks', label: 'In 2 weeks' },
  { value: '1-month', label: 'In 1 month' },
] as const;

export const FOLLOW_UP_DAY_OFFSETS: Record<string, number> = {
  '3-days': 3,
  '1-week': 7,
  '2-weeks': 14,
  '1-month': 30,
};

export const PAYMENT_DUE_REASONS = [
  'Patient will pay at pharmacy counter',
  'Insurance / TPA claim',
  'Hospital staff — waived',
  'Other',
] as const;

// Groups every billable item that isn't a doctor's consultation fee (that
// stays hospital-member-scoped — see doctors.service.ts). Drives the
// Settings > Charge catalog sidebar and the bill line-item picker.
export enum CHARGE_CATALOG_CATEGORY {
  PROCEDURES = 'procedures',
  INJECTIONS = 'injections',
  CONSUMABLES = 'consumables',
  LAB_DIAGNOSTICS = 'lab_diagnostics',
  OTHER = 'other',
}

export const CHARGE_CATALOG_CATEGORY_VALUES = Object.values(
  CHARGE_CATALOG_CATEGORY,
);

export const CHARGE_CATALOG_CATEGORY_LABELS: Record<string, string> = {
  [CHARGE_CATALOG_CATEGORY.PROCEDURES]: 'Procedures',
  [CHARGE_CATALOG_CATEGORY.INJECTIONS]: 'Injections',
  [CHARGE_CATALOG_CATEGORY.CONSUMABLES]: 'Consumables',
  [CHARGE_CATALOG_CATEGORY.LAB_DIAGNOSTICS]: 'Lab & diagnostics',
  [CHARGE_CATALOG_CATEGORY.OTHER]: 'Other',
};

// Two-digit prefix used to build a catalog item's auto code, e.g. CH-1001.
// Purely cosmetic grouping — not enforced as a real numbering authority.
export const CHARGE_CATALOG_CODE_PREFIX: Record<string, string> = {
  [CHARGE_CATALOG_CATEGORY.PROCEDURES]: '10',
  [CHARGE_CATALOG_CATEGORY.INJECTIONS]: '20',
  [CHARGE_CATALOG_CATEGORY.LAB_DIAGNOSTICS]: '30',
  [CHARGE_CATALOG_CATEGORY.CONSUMABLES]: '40',
  [CHARGE_CATALOG_CATEGORY.OTHER]: '50',
};

export const GST_RATES = [0, 5, 12, 18];

// Seeded once per hospital the first time its charge catalog is read empty
// (see ChargeCatalogService) — a reasonable starting point so the bill
// line-item picker isn't blank on day one. Purely a starting point: every
// field is editable/archivable afterwards like any other catalog item.
// Dressing/Injection — Tetanus toxoid/ECG carry over the exact prices the
// old hardcoded COMMON_BILL_ITEMS shortlist used, so existing hospitals see
// no change to those three quick-add prices.
export const DEFAULT_CHARGE_CATALOG_ITEMS: {
  name: string;
  category: CHARGE_CATALOG_CATEGORY;
  price: number;
  gstPercent: number;
}[] = [
  { name: 'Dressing', category: CHARGE_CATALOG_CATEGORY.PROCEDURES, price: 150, gstPercent: 0 },
  { name: 'Injection — Tetanus toxoid', category: CHARGE_CATALOG_CATEGORY.INJECTIONS, price: 250, gstPercent: 0 },
  { name: 'Injection — Vitamin B12', category: CHARGE_CATALOG_CATEGORY.INJECTIONS, price: 180, gstPercent: 0 },
  { name: 'Nebulisation', category: CHARGE_CATALOG_CATEGORY.PROCEDURES, price: 200, gstPercent: 0 },
  { name: 'Suture removal', category: CHARGE_CATALOG_CATEGORY.PROCEDURES, price: 120, gstPercent: 0 },
  { name: 'ECG', category: CHARGE_CATALOG_CATEGORY.LAB_DIAGNOSTICS, price: 300, gstPercent: 0 },
  { name: 'Blood sugar — random', category: CHARGE_CATALOG_CATEGORY.LAB_DIAGNOSTICS, price: 80, gstPercent: 0 },
  { name: 'Paracetamol 650 — strip of 10', category: CHARGE_CATALOG_CATEGORY.CONSUMABLES, price: 40, gstPercent: 12 },
];

// How a Hospital Holiday closes the day. `full`/`opd_closed` both block every
// booking for the day (the difference is informational — whether the hospital
// stays staffed for emergencies) — `half_day` only truncates the window.
export enum HOLIDAY_CLOSURE_TYPE {
  FULL = 'full',
  OPD_CLOSED = 'opd_closed',
  HALF_DAY = 'half_day',
}

export const HOLIDAY_CLOSURE_TYPE_VALUES = Object.values(HOLIDAY_CLOSURE_TYPE);

// Seed data for the Settings > Hospital holidays "Import Tamil Nadu list"
// button — fixed-date holidays only. Deepavali/Ramzan follow lunar calendars
// and can't be safely hardcoded, so hospitals still add those by hand.
// `month`/`day` are shifted onto the target year at import/generate time.
export const TN_HOLIDAY_SEED_LIST: {
  name: string;
  startMonth: number;
  startDay: number;
  endMonth: number;
  endDay: number;
  closureType: HOLIDAY_CLOSURE_TYPE;
  repeatsAnnually: boolean;
}[] = [
  {
    name: 'Pongal',
    startMonth: 1,
    startDay: 14,
    endMonth: 1,
    endDay: 16,
    closureType: HOLIDAY_CLOSURE_TYPE.FULL,
    repeatsAnnually: false,
  },
  {
    name: 'Republic Day',
    startMonth: 1,
    startDay: 26,
    endMonth: 1,
    endDay: 26,
    closureType: HOLIDAY_CLOSURE_TYPE.FULL,
    repeatsAnnually: true,
  },
  {
    name: 'Independence Day',
    startMonth: 8,
    startDay: 15,
    endMonth: 8,
    endDay: 15,
    closureType: HOLIDAY_CLOSURE_TYPE.FULL,
    repeatsAnnually: true,
  },
  {
    name: 'Gandhi Jayanti',
    startMonth: 10,
    startDay: 2,
    endMonth: 10,
    endDay: 2,
    closureType: HOLIDAY_CLOSURE_TYPE.FULL,
    repeatsAnnually: true,
  },
  {
    name: 'Christmas',
    startMonth: 12,
    startDay: 25,
    endMonth: 12,
    endDay: 25,
    closureType: HOLIDAY_CLOSURE_TYPE.FULL,
    repeatsAnnually: true,
  },
];

// A hospital's own free-text medicine catalog — not a fixed drug database.
// `classes` on a Medicine (e.g. "penicillin", "nsaid") are hospital-curated
// tags matched against a patient's `allergies` strings for the prescription
// writer's allergy warning — see PrescriptionsService.
export enum MEDICINE_FORM {
  TABLET = 'tablet',
  CAPSULE = 'capsule',
  SYRUP = 'syrup',
  INJECTION = 'injection',
  DROPS = 'drops',
  OINTMENT = 'ointment',
  INHALER = 'inhaler',
  OTHER = 'other',
}

export const MEDICINE_FORM_VALUES = Object.values(MEDICINE_FORM);

export const FOOD_TIMING_OPTIONS = [
  'before_food',
  'after_food',
  'with_food',
  'anytime',
] as const;

// A prescription is a draft until the doctor signs it — signing just stamps
// issuedAt; it can still be resaved afterwards (no immutability lock in v1).
export enum PRESCRIPTION_STATUS {
  DRAFT = 'draft',
  SIGNED = 'signed',
}

export const PRESCRIPTION_STATUS_VALUES = Object.values(PRESCRIPTION_STATUS);

// A doctor's leave request needs admin sign-off before it's treated as
// blocking their schedule — mirrors ApprovalRequest's status wording.
export enum LEAVE_REQUEST_STATUS {
  PENDING = 'pending',
  APPROVED = 'approved',
  DECLINED = 'declined',
}

export const LEAVE_REQUEST_STATUS_VALUES = Object.values(LEAVE_REQUEST_STATUS);

// Seeded once per hospital the first time its medicine catalog is read empty
// (see MedicinesService) — same one-time-seed idea as
// DEFAULT_CHARGE_CATALOG_ITEMS, so a fresh hospital isn't blank on day one.
// A spread of classes (penicillin/nsaid/cephalosporin/macrolide/tetracycline)
// is included on purpose so the allergy-warning flow has something to catch
// in testing without any manual catalog setup.
export const DEFAULT_MEDICINES: {
  name: string;
  genericName?: string;
  classes: string[];
  form: MEDICINE_FORM;
  strength?: string;
  defaultDose?: string;
  defaultFrequency?: string;
  defaultFoodTiming?: (typeof FOOD_TIMING_OPTIONS)[number];
}[] = [
  {
    name: 'Amoxicillin',
    genericName: 'Amoxicillin',
    classes: ['penicillin'],
    form: MEDICINE_FORM.CAPSULE,
    strength: '500mg',
    defaultDose: '1-0-1',
    defaultFrequency: 'Twice daily',
    defaultFoodTiming: 'after_food',
  },
  {
    name: 'Augmentin',
    genericName: 'Amoxicillin + Clavulanic acid',
    classes: ['penicillin'],
    form: MEDICINE_FORM.TABLET,
    strength: '625mg',
    defaultDose: '1-0-1',
    defaultFrequency: 'Twice daily',
    defaultFoodTiming: 'after_food',
  },
  {
    name: 'Azithromycin',
    genericName: 'Azithromycin',
    classes: ['macrolide'],
    form: MEDICINE_FORM.TABLET,
    strength: '500mg',
    defaultDose: '1-0-0',
    defaultFrequency: 'Once daily',
    defaultFoodTiming: 'before_food',
  },
  {
    name: 'Doxycycline',
    genericName: 'Doxycycline',
    classes: ['tetracycline'],
    form: MEDICINE_FORM.CAPSULE,
    strength: '100mg',
    defaultDose: '1-0-1',
    defaultFrequency: 'Twice daily',
    defaultFoodTiming: 'after_food',
  },
  {
    name: 'Cefuroxime',
    genericName: 'Cefuroxime axetil',
    classes: ['cephalosporin'],
    form: MEDICINE_FORM.TABLET,
    strength: '500mg',
    defaultDose: '1-0-1',
    defaultFrequency: 'Twice daily',
    defaultFoodTiming: 'after_food',
  },
  {
    name: 'Etoricoxib',
    genericName: 'Etoricoxib',
    classes: ['nsaid'],
    form: MEDICINE_FORM.TABLET,
    strength: '60mg',
    defaultDose: '1-0-0',
    defaultFrequency: 'Once daily',
    defaultFoodTiming: 'after_food',
  },
  {
    name: 'Ibuprofen',
    genericName: 'Ibuprofen',
    classes: ['nsaid'],
    form: MEDICINE_FORM.TABLET,
    strength: '400mg',
    defaultDose: '1-1-1',
    defaultFrequency: 'Thrice daily',
    defaultFoodTiming: 'after_food',
  },
  {
    name: 'Paracetamol',
    genericName: 'Paracetamol',
    classes: [],
    form: MEDICINE_FORM.TABLET,
    strength: '650mg',
    defaultDose: '1-1-1',
    defaultFrequency: 'Thrice daily',
    defaultFoodTiming: 'after_food',
  },
  {
    name: 'Pantoprazole',
    genericName: 'Pantoprazole',
    classes: [],
    form: MEDICINE_FORM.TABLET,
    strength: '40mg',
    defaultDose: '1-0-0',
    defaultFrequency: 'Once daily',
    defaultFoodTiming: 'before_food',
  },
  {
    name: 'Cetirizine',
    genericName: 'Cetirizine',
    classes: [],
    form: MEDICINE_FORM.TABLET,
    strength: '10mg',
    defaultDose: '0-0-1',
    defaultFrequency: 'Once daily, at night',
    defaultFoodTiming: 'anytime',
  },
];

export const MEDICAL_SPECIALIZATIONS = [
  'Cardiology',
  'Dermatology',
  'Endocrinology',
  'Gastroenterology',
  'General Medicine',
  'General Surgery',
  'Gynecology',
  'Neurology',
  'Oncology',
  'Ophthalmology',
  'Orthopedics',
  'Otolaryngology (ENT)',
  'Pediatrics',
  'Psychiatry',
  'Pulmonology',
  'Radiology',
  'Rheumatology',
  'Urology',
  'Anesthesiology',
  'Emergency Medicine',
  'Nephrology',
  'Pathology',
  'Physical Medicine',
  'Plastic Surgery',
] as const;
