export enum DB_COLLECTIONS {
  USERS = "users",
  DOCTOR_PROFILES = "doctorProfiles",
  PATIENTS = "patients",
  APPOINTMENTS = "appointments",
  HOSPITALS = "hospitals",
  HOSPITAL_MEMBERS = "hospitalMembers",
  REVIEWS = "reviews",
  DOCTOR_ACTIVIES = "doctor_activities",
  PAYMENTS = "payments",
  PAYMENT_DAY_CLOSES = "payment_day_closes",
  PACKAGES = "packages",
  TEAM_MEMBER_PROFILES = "team_member_profiles",
  ROLE_PERMISSIONS = "role_permissions",
  AUDIT_LOG = "audit_log",
  APPROVAL_REQUESTS = "approval_requests",
  CHARGE_CATALOG_ITEMS = "charge_catalog_items",
  HOSPITAL_HOLIDAYS = "hospital_holidays",
  MEDICINES = "medicines",
  PRESCRIPTIONS = "prescriptions",
  LEAVE_REQUESTS = "leave_requests",
  COUNTERS = "counters",
  DOCTOR_PRESENCE = "doctor_presence",
  PATIENT_ACCOUNTS = "patient_accounts",
  SESSIONS = "sessions",
}


export enum ROLE {
  ADMIN = "admin",
  DOCTOR = "doctor",
  PATIENT = "patient",
  FRONT_DESK = "front_desk",
  NURSE = "nurse",
  ACCOUNTANT = "accountant",
}

// Roles that share the admin console shell (AdminHospitalLayout) — narrower
// nav/permissions are enforced server-side, not by a separate frontend shell.
export const STAFF_CONSOLE_ROLES: string[] = [ROLE.ADMIN, ROLE.FRONT_DESK, ROLE.NURSE, ROLE.ACCOUNTANT];

export enum MEMBERSHIP_STATUS {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
  SUSPENDED = "suspended",
  DEACTIVATED = "deactivated",
}

export enum GENDER {
  MALE = "Male",
  FEMALE = "Female",
  OTHER = "Other",
}

// Appointment lifecycle. PENDING is reserved for a future patient
// self-booking flow (not reachable today — admin/staff-created
// appointments start at CONFIRMED). This also lays the groundwork for a
// hospital queue: CHECKED_IN -> WAITING -> IN_CONSULTATION.
export enum APPOINTMENT_STATUS {
  PENDING = "pending",
  CONFIRMED = "confirmed",
  CHECKED_IN = "checked-in",
  WAITING = "waiting",
  IN_CONSULTATION = "in-consultation",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
  NO_SHOW = "no-show",
  RESCHEDULED = "rescheduled",
}

export const APPOINTMENT_STATUS_VALUES = Object.values(APPOINTMENT_STATUS);

// Statuses that still hold a claim on the doctor"s schedule for that slot.
export const ACTIVE_APPOINTMENT_STATUSES: APPOINTMENT_STATUS[] = [
  APPOINTMENT_STATUS.PENDING,
  APPOINTMENT_STATUS.CONFIRMED,
  APPOINTMENT_STATUS.CHECKED_IN,
  APPOINTMENT_STATUS.WAITING,
  APPOINTMENT_STATUS.IN_CONSULTATION,
];

// Legacy documents predate this state machine and were all written as
// "scheduled". Normalize them to CONFIRMED for transition checks only —
// the stored value is left untouched until the appointment"s next update.
export function normalizeAppointmentStatus(
  status: string | undefined | null,
): APPOINTMENT_STATUS {
  if (status === "scheduled" || !status) return APPOINTMENT_STATUS.CONFIRMED;
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
    APPOINTMENT_STATUS.IN_CONSULTATION, // doctor-direct fast path when front-desk check-in isn"t used
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

// Marks whether an appointment was booked ad-hoc or drawn from a prepaid
// package. PACKAGE appointments carry packageId/packageVisitNumber.
export enum APPOINTMENT_TYPE {
  REGULAR = "regular",
  PACKAGE = "package",
}

export const APPOINTMENT_TYPE_VALUES = Object.values(APPOINTMENT_TYPE);

export enum PACKAGE_STATUS {
  ACTIVE = "active",
  EXPIRED = "expired",
  CANCELLED = "cancelled",
  REFUNDED = "refunded",
}

export const PACKAGE_STATUS_VALUES = Object.values(PACKAGE_STATUS);

// Derived, display-only classification for a package — never stored. Active
// packages become LAPSING inside the expiry window, USED_UP once every visit
// is consumed, or LAPSED once past validUntil with visits still unused.
export enum PACKAGE_DISPLAY_STATUS {
  ACTIVE = "active",
  LAPSING = "lapsing",
  USED_UP = "used_up",
  LAPSED = "lapsed",
  REFUNDED = "refunded",
  CANCELLED = "cancelled",
}

// A package still holding unused visits gets flagged once it"s this many
// days (or fewer) from validUntil.
export const PACKAGE_LAPSING_WINDOW_DAYS = 30;

export enum PACKAGE_PAYMENT_METHOD {
  CASH = "cash",
  UPI = "upi",
  CARD = "card",
}

export const PACKAGE_PAYMENT_METHOD_VALUES = Object.values(
  PACKAGE_PAYMENT_METHOD,
);

// Fixed bundle sizes offered for a prepaid package.
export const PACKAGE_VISIT_TIERS = [5, 10, 20];

// A package stays redeemable for 6 months from the date it"s sold.
export const PACKAGE_VALIDITY_MONTHS = 6;

// Per-visit price for a prepaid package — roughly 5/6 of the doctor"s normal
// consultation fee, rounded to the nearest ₹5 so bulk pricing reads clean.
export function computePackagePricePerVisit(consultationFee: number): number {
  return Math.round((consultationFee * 0.8333) / 5) * 5;
}

// How a completed visit was settled. SPLIT covers cash+UPI combined; DUE
// records the visit as unpaid rather than blocking completion on collection.
export enum PAYMENT_METHOD {
  CASH = "cash",
  UPI = "upi",
  SPLIT = "split",
  DUE = "due",
}

export const PAYMENT_METHOD_VALUES = Object.values(PAYMENT_METHOD);

export enum PAYMENT_STATUS {
  PAID = "paid",
  DUE = "due",
  REFUNDED = "refunded",
}

export const PAYMENT_STATUS_VALUES = Object.values(PAYMENT_STATUS);

// Offsets for the optional draft follow-up appointment created alongside a
// completed visit. "none" skips it — value keys double as the select"s option value.
export const FOLLOW_UP_OPTIONS = [
  { value: "none", label: "No follow-up needed" },
  { value: "3-days", label: "In 3 days" },
  { value: "1-week", label: "In 1 week" },
  { value: "2-weeks", label: "In 2 weeks" },
  { value: "1-month", label: "In 1 month" },
] as const;

export const FOLLOW_UP_DAY_OFFSETS: Record<string, number> = {
  "3-days": 3,
  "1-week": 7,
  "2-weeks": 14,
  "1-month": 30,
};

export const PAYMENT_DUE_REASONS = [
  "Patient will pay at pharmacy counter",
  "Insurance / TPA claim",
  "Hospital staff — waived",
  "Other",
] as const;

// Groups every billable item that isn"t a doctor"s consultation fee (that
// stays hospital-member-scoped). Drives the Settings > Charge catalog
// sidebar and the bill line-item picker.
export enum CHARGE_CATALOG_CATEGORY {
  PROCEDURES = "procedures",
  INJECTIONS = "injections",
  CONSUMABLES = "consumables",
  LAB_DIAGNOSTICS = "lab_diagnostics",
  OTHER = "other",
}

export const CHARGE_CATALOG_CATEGORY_VALUES = Object.values(
  CHARGE_CATALOG_CATEGORY,
);

export const CHARGE_CATALOG_CATEGORY_LABELS: Record<string, string> = {
  [CHARGE_CATALOG_CATEGORY.PROCEDURES]: "Procedures",
  [CHARGE_CATALOG_CATEGORY.INJECTIONS]: "Injections",
  [CHARGE_CATALOG_CATEGORY.CONSUMABLES]: "Consumables",
  [CHARGE_CATALOG_CATEGORY.LAB_DIAGNOSTICS]: "Lab & diagnostics",
  [CHARGE_CATALOG_CATEGORY.OTHER]: "Other",
};

export const CHARGE_CATALOG_CATEGORY_OPTIONS = Object.values(
  CHARGE_CATALOG_CATEGORY,
).map((value) => ({ value, label: CHARGE_CATALOG_CATEGORY_LABELS[value] }));

export const GST_RATES = [0, 5, 12, 18];

export const MEDICAL_SPECIALIZATIONS = [
  "Cardiology",
  "Dermatology",
  "Endocrinology",
  "Gastroenterology",
  "General Medicine",
  "General Surgery",
  "Gynecology",
  "Neurology",
  "Oncology",
  "Ophthalmology",
  "Orthopedics",
  "Otolaryngology (ENT)",
  "Pediatrics",
  "Psychiatry",
  "Pulmonology",
  "Radiology",
  "Rheumatology",
  "Urology",
  "Anesthesiology",
  "Emergency Medicine",
  "Nephrology",
  "Pathology",
  "Physical Medicine",
  "Plastic Surgery",
  "Dentistry"
] as const;
