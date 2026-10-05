export enum DB_COLLECTIONS {
  USERS = "users",
  DOCTOR_PROFILES = "doctor_profiles",
  PATIENTS = "patients",
  APPOINTMENTS = "appointments",
  HOSPITALS = "hospitals",
  HOSPITAL_MEMBERS = "hospital_members",
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
  MEDICINE_PACKS = "medicine_packs",
  NOTES_TEMPLATES = "notes_templates",
  PRESCRIPTIONS = "prescriptions",
  LEAVE_REQUESTS = "leave_requests",
  COUNTERS = "counters",
  DOCTOR_PRESENCE = "doctor_presence",
  PATIENT_ACCOUNTS = "patient_accounts",
  SESSIONS = "sessions",
  WHATSAPP_CONFIGS = "whatsapp_configs",
  WHATSAPP_SESSIONS = "whatsapp_sessions",
  WHATSAPP_ENQUIRIES = "whatsapp_enquiries",
  WHATSAPP_PROCESSED_MESSAGES = "whatsapp_processed_messages",
  SUBSCRIPTIONS = "subscriptions",
  SUBSCRIPTION_INVOICES = "subscription_invoices",
  SUBSCRIPTION_PLAN_CONFIG = "subscription_plan_config",
  PLATFORM_FEATURE_CATALOG = "platform_feature_catalog",
  DEMO_REQUESTS = "demo_requests",
  INVENTORY_ITEMS = "inventory_items",
  INVENTORY_BATCHES = "inventory_batches",
  INVENTORY_MOVEMENTS = "inventory_movements",
}

// FRONT_DESK/NURSE/ACCOUNTANT replace the old unused STAFF value — nothing
// ever created a "staff" membership, these are the first real non-admin,
// non-clinical roles in the system (see the Team/Roles & permissions feature).
export enum ROLE {
  ADMIN = "admin",
  DOCTOR = "doctor",
  PATIENT = "patient",
  FRONT_DESK = "front_desk",
  NURSE = "nurse",
  ACCOUNTANT = "accountant",
}

export const STAFF_ROLES = [ROLE.FRONT_DESK, ROLE.NURSE, ROLE.ACCOUNTANT];

export enum MEMBERSHIP_STATUS {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
  SUSPENDED = "suspended",
  DEACTIVATED = "deactivated",
}

// The three states a permission action can be in for a given role — see
// permissions/permission-catalog.ts for the full action catalog.
export enum PERMISSION_STATE {
  ALLOWED = "allowed",
  NEEDS_APPROVAL = "needs_approval",
  BLOCKED = "blocked",
}

export enum GENDER {
  MALE = "Male",
  FEMALE = "Female",
  OTHER = "Other",
}

// Appointment lifecycle. PENDING means a patient self-booked (today: via
// WhatsApp) and staff have not confirmed yet — admin/staff-created
// appointments still start at CONFIRMED. This also lays the groundwork for a
// hospital queue: CHECKED_IN -> WAITING -> IN_CONSULTATION.
export enum APPOINTMENT_STATUS {
  PENDING = "pending",
  CONFIRMED = "confirmed",
  CHECKED_IN = "checked-in",
  WAITING = "waiting",
  IN_CONSULTATION = "in-consultation",
  AWAITING_PAYMENT = "awaiting-payment",
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

// Statuses meaning "this patient was actually seen today" — the clinical
// session happened, whether or not payment has been collected yet. Use this
// (not a strict === COMPLETED check) for visit history/counts/durations;
// keep strict COMPLETED only where "fully billed and closed" is the intent
// (e.g. package-visit redemption).
export const VISIT_FINISHED_STATUSES: APPOINTMENT_STATUS[] = [
  APPOINTMENT_STATUS.AWAITING_PAYMENT,
  APPOINTMENT_STATUS.COMPLETED,
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
    APPOINTMENT_STATUS.AWAITING_PAYMENT,
    APPOINTMENT_STATUS.CANCELLED,
  ],
  [APPOINTMENT_STATUS.AWAITING_PAYMENT]: [
    APPOINTMENT_STATUS.COMPLETED,
    APPOINTMENT_STATUS.CANCELLED,
    APPOINTMENT_STATUS.CONFIRMED, // reopen
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
  REGULAR = "regular",
  PACKAGE = "package",
  FOLLOW_UP = "follow-up",
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

// Default bundle sizes offered for a prepaid package.
export const PACKAGE_VISIT_TIERS = [5, 10, 20];

// By default a package stays redeemable for 6 months from the date it"s sold.
export const PACKAGE_VALIDITY_MONTHS = 6;

// Hospital-admin-configurable package pricing/terms (Settings > Packages).
// A hospital that never saved these gets DEFAULT_PACKAGE_SETTINGS — the
// original ~1/6 discount, 5/10/20 tiers and 6-month validity. Keep in sync
// with apps/web/src/constants.ts.
export interface PackageSettings {
  discountEnabled: boolean;
  discountPercent: number;
  visitTiers: number[];
  validityMonths: number;
}

export const DEFAULT_PACKAGE_SETTINGS: PackageSettings = {
  discountEnabled: true,
  discountPercent: 16.67,
  visitTiers: PACKAGE_VISIT_TIERS,
  validityMonths: PACKAGE_VALIDITY_MONTHS,
};

// Per-visit price for a prepaid package — the doctor"s consultation fee less
// the hospital's package discount, rounded to the nearest ₹5 so bulk pricing
// reads clean. With the discount off, it's the plain consultation fee.
export function computePackagePricePerVisit(
  consultationFee: number,
  settings: Pick<PackageSettings, "discountEnabled" | "discountPercent"> = DEFAULT_PACKAGE_SETTINGS,
): number {
  const percent = settings.discountEnabled ? settings.discountPercent : 0;
  return Math.round((consultationFee * (1 - percent / 100)) / 5) * 5;
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
// stays hospital-member-scoped — see doctors.service.ts). Drives the
// Settings > Charge catalog sidebar and the bill line-item picker.
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

// Two-digit prefix used to build a catalog item"s auto code, e.g. CH-1001.
// Purely cosmetic grouping — not enforced as a real numbering authority.
export const CHARGE_CATALOG_CODE_PREFIX: Record<string, string> = {
  [CHARGE_CATALOG_CATEGORY.PROCEDURES]: "10",
  [CHARGE_CATALOG_CATEGORY.INJECTIONS]: "20",
  [CHARGE_CATALOG_CATEGORY.LAB_DIAGNOSTICS]: "30",
  [CHARGE_CATALOG_CATEGORY.CONSUMABLES]: "40",
  [CHARGE_CATALOG_CATEGORY.OTHER]: "50",
};

export const GST_RATES = [0, 5, 12, 18];

// Seeded once per hospital the first time its charge catalog is read empty
// (see ChargeCatalogService) — a reasonable starting point so the bill
// line-item picker isn"t blank on day one. Purely a starting point: every
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
  { name: "Dressing", category: CHARGE_CATALOG_CATEGORY.PROCEDURES, price: 150, gstPercent: 0 },
  { name: "Injection — Tetanus toxoid", category: CHARGE_CATALOG_CATEGORY.INJECTIONS, price: 250, gstPercent: 0 },
  { name: "Injection — Vitamin B12", category: CHARGE_CATALOG_CATEGORY.INJECTIONS, price: 180, gstPercent: 0 },
  { name: "Nebulisation", category: CHARGE_CATALOG_CATEGORY.PROCEDURES, price: 200, gstPercent: 0 },
  { name: "Suture removal", category: CHARGE_CATALOG_CATEGORY.PROCEDURES, price: 120, gstPercent: 0 },
  { name: "ECG", category: CHARGE_CATALOG_CATEGORY.LAB_DIAGNOSTICS, price: 300, gstPercent: 0 },
  { name: "Blood sugar — random", category: CHARGE_CATALOG_CATEGORY.LAB_DIAGNOSTICS, price: 80, gstPercent: 0 },
  { name: "Paracetamol 650 — strip of 10", category: CHARGE_CATALOG_CATEGORY.CONSUMABLES, price: 40, gstPercent: 12 },
];

// How a Hospital Holiday closes the day. `full`/`opd_closed` both block every
// booking for the day (the difference is informational — whether the hospital
// stays staffed for emergencies) — `half_day` only truncates the window.
export enum HOLIDAY_CLOSURE_TYPE {
  FULL = "full",
  OPD_CLOSED = "opd_closed",
  HALF_DAY = "half_day",
}

export const HOLIDAY_CLOSURE_TYPE_VALUES = Object.values(HOLIDAY_CLOSURE_TYPE);

// Seed data for the Settings > Hospital holidays "Import Tamil Nadu list"
// button — fixed-date holidays only. Deepavali/Ramzan follow lunar calendars
// and can"t be safely hardcoded, so hospitals still add those by hand.
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
    name: "Pongal",
    startMonth: 1,
    startDay: 14,
    endMonth: 1,
    endDay: 16,
    closureType: HOLIDAY_CLOSURE_TYPE.FULL,
    repeatsAnnually: false,
  },
  {
    name: "Republic Day",
    startMonth: 1,
    startDay: 26,
    endMonth: 1,
    endDay: 26,
    closureType: HOLIDAY_CLOSURE_TYPE.FULL,
    repeatsAnnually: true,
  },
  {
    name: "Independence Day",
    startMonth: 8,
    startDay: 15,
    endMonth: 8,
    endDay: 15,
    closureType: HOLIDAY_CLOSURE_TYPE.FULL,
    repeatsAnnually: true,
  },
  {
    name: "Gandhi Jayanti",
    startMonth: 10,
    startDay: 2,
    endMonth: 10,
    endDay: 2,
    closureType: HOLIDAY_CLOSURE_TYPE.FULL,
    repeatsAnnually: true,
  },
  {
    name: "Christmas",
    startMonth: 12,
    startDay: 25,
    endMonth: 12,
    endDay: 25,
    closureType: HOLIDAY_CLOSURE_TYPE.FULL,
    repeatsAnnually: true,
  },
];

// A hospital"s own free-text medicine catalog — not a fixed drug database.
// `classes` on a Medicine (e.g. "penicillin", "nsaid") are hospital-curated
// tags matched against a patient"s `allergies` strings for the prescription
// writer"s allergy warning — see PrescriptionsService.
export enum MEDICINE_FORM {
  TABLET = "tablet",
  CAPSULE = "capsule",
  SYRUP = "syrup",
  INJECTION = "injection",
  DROPS = "drops",
  OINTMENT = "ointment",
  INHALER = "inhaler",
  OTHER = "other",
}

export const MEDICINE_FORM_VALUES = Object.values(MEDICINE_FORM);

export const FOOD_TIMING_OPTIONS = [
  "before_food",
  "after_food",
  "with_food",
  "anytime",
] as const;

export const HOW_OFTEN_VALUES = ["1-0-0", "0-0-1", "1-0-1", "1-1-1", "SOS"] as const;

export const FOLLOW_UP_REVIEW_VALUES = ["none", "1-week", "2-weeks", "1-month"] as const;

// A prescription is a draft until the doctor signs it — signing just stamps
// issuedAt; it can still be resaved afterwards (no immutability lock in v1).
export enum PRESCRIPTION_STATUS {
  DRAFT = "draft",
  SIGNED = "signed",
}

export const PRESCRIPTION_STATUS_VALUES = Object.values(PRESCRIPTION_STATUS);

// A doctor"s leave request needs admin sign-off before it"s treated as
// blocking their schedule — mirrors ApprovalRequest"s status wording.
export enum LEAVE_REQUEST_STATUS {
  PENDING = "pending",
  APPROVED = "approved",
  DECLINED = "declined",
}

export const LEAVE_REQUEST_STATUS_VALUES = Object.values(LEAVE_REQUEST_STATUS);

// Seeded once per hospital the first time its medicine catalog is read empty
// (see MedicinesService) — same one-time-seed idea as
// DEFAULT_CHARGE_CATALOG_ITEMS, so a fresh hospital isn"t blank on day one.
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
    name: "Amoxicillin",
    genericName: "Amoxicillin",
    classes: ["penicillin"],
    form: MEDICINE_FORM.CAPSULE,
    strength: "500mg",
    defaultDose: "1-0-1",
    defaultFrequency: "Twice daily",
    defaultFoodTiming: "after_food",
  },
  {
    name: "Augmentin",
    genericName: "Amoxicillin + Clavulanic acid",
    classes: ["penicillin"],
    form: MEDICINE_FORM.TABLET,
    strength: "625mg",
    defaultDose: "1-0-1",
    defaultFrequency: "Twice daily",
    defaultFoodTiming: "after_food",
  },
  {
    name: "Azithromycin",
    genericName: "Azithromycin",
    classes: ["macrolide"],
    form: MEDICINE_FORM.TABLET,
    strength: "500mg",
    defaultDose: "1-0-0",
    defaultFrequency: "Once daily",
    defaultFoodTiming: "before_food",
  },
  {
    name: "Doxycycline",
    genericName: "Doxycycline",
    classes: ["tetracycline"],
    form: MEDICINE_FORM.CAPSULE,
    strength: "100mg",
    defaultDose: "1-0-1",
    defaultFrequency: "Twice daily",
    defaultFoodTiming: "after_food",
  },
  {
    name: "Cefuroxime",
    genericName: "Cefuroxime axetil",
    classes: ["cephalosporin"],
    form: MEDICINE_FORM.TABLET,
    strength: "500mg",
    defaultDose: "1-0-1",
    defaultFrequency: "Twice daily",
    defaultFoodTiming: "after_food",
  },
  {
    name: "Etoricoxib",
    genericName: "Etoricoxib",
    classes: ["nsaid"],
    form: MEDICINE_FORM.TABLET,
    strength: "60mg",
    defaultDose: "1-0-0",
    defaultFrequency: "Once daily",
    defaultFoodTiming: "after_food",
  },
  {
    name: "Ibuprofen",
    genericName: "Ibuprofen",
    classes: ["nsaid"],
    form: MEDICINE_FORM.TABLET,
    strength: "400mg",
    defaultDose: "1-1-1",
    defaultFrequency: "Thrice daily",
    defaultFoodTiming: "after_food",
  },
  {
    name: "Paracetamol",
    genericName: "Paracetamol",
    classes: [],
    form: MEDICINE_FORM.TABLET,
    strength: "650mg",
    defaultDose: "1-1-1",
    defaultFrequency: "Thrice daily",
    defaultFoodTiming: "after_food",
  },
  {
    name: "Pantoprazole",
    genericName: "Pantoprazole",
    classes: [],
    form: MEDICINE_FORM.TABLET,
    strength: "40mg",
    defaultDose: "1-0-0",
    defaultFrequency: "Once daily",
    defaultFoodTiming: "before_food",
  },
  {
    name: "Cetirizine",
    genericName: "Cetirizine",
    classes: [],
    form: MEDICINE_FORM.TABLET,
    strength: "10mg",
    defaultDose: "0-0-1",
    defaultFrequency: "Once daily, at night",
    defaultFoodTiming: "anytime",
  },
];

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
  "Dentistry",
] as const;

// Steps in the WhatsApp booking/enquiry conversation. The bot always replies
// with interactive buttons or lists, so the reply we get back is an option id
// for the current step rather than free text (the enquiry body is the one
// exception).
export enum WHATSAPP_STEP {
  MAIN_MENU = "main_menu",
  CHOOSE_DOCTOR = "choose_doctor",
  CHOOSE_DATE = "choose_date",
  CHOOSE_TIME = "choose_time",
  CONFIRM = "confirm",
  ENQUIRY_CAPTURE = "enquiry_capture",
  MY_APPOINTMENTS = "my_appointments",
  APPOINTMENT_ACTION = "appointment_action",
  CANCEL_CONFIRM = "cancel_confirm",
}

export enum WHATSAPP_ENQUIRY_STATUS {
  NEW = "new",
  RESOLVED = "resolved",
}

// Abandoned conversations expire rather than trapping a patient mid-flow.
export const WHATSAPP_SESSION_TTL_MINUTES = 30;

export enum SUBSCRIPTION_BILLING_CYCLE {
  MONTHLY = "monthly",
  ANNUAL = "annual",
}

export const SUBSCRIPTION_BILLING_CYCLE_VALUES = Object.values(SUBSCRIPTION_BILLING_CYCLE);

// `exempt` is a platform-admin-only override (pilot/demo hospitals) that
// always passes the HospitalContextGuard billing check, regardless of dates.
export enum SUBSCRIPTION_STATUS {
  TRIALING = "trialing",
  ACTIVE = "active",
  PAST_DUE = "past_due",
  SUSPENDED = "suspended",
  EXEMPT = "exempt",
  CANCELLED = "cancelled",
}

export const SUBSCRIPTION_STATUS_VALUES = Object.values(SUBSCRIPTION_STATUS);

export enum SUBSCRIPTION_INVOICE_STATUS {
  DUE = "due",
  PAYMENT_SUBMITTED = "payment_submitted",
  PAID = "paid",
  FAILED = "failed",
}

export const SUBSCRIPTION_INVOICE_STATUS_VALUES = Object.values(SUBSCRIPTION_INVOICE_STATUS);

// New hospitals get this many days to start using the product before the
// first invoice is due — see SubscriptionsService.provisionForNewHospital.
export const SUBSCRIPTION_TRIAL_DAYS = 14;

// Days a past_due subscription keeps working before the renewal sweep
// suspends it (see SubscriptionsService.runRenewalSweep).
export const SUBSCRIPTION_GRACE_DAYS = 7;

// How far ahead of trialEndsAt the renewal sweep sends the one-time
// trial-ending-soon email.
export const SUBSCRIPTION_TRIAL_REMINDER_DAYS_BEFORE = 3;

// The base bundle covers one hospital with up to this many doctor/staff
// seats; STAFF_ROLES (front_desk/nurse/accountant) share the one staff
// allowance rather than each getting their own. Admins are never billed.
export const SUBSCRIPTION_INCLUDED_DOCTORS = 5;
export const SUBSCRIPTION_INCLUDED_STAFF = 1;

export const SUBSCRIPTION_BASE_PRICE: Record<SUBSCRIPTION_BILLING_CYCLE, number> = {
  [SUBSCRIPTION_BILLING_CYCLE.MONTHLY]: 799,
  [SUBSCRIPTION_BILLING_CYCLE.ANNUAL]: 7990,
};

export const SUBSCRIPTION_DOCTOR_ADDON_PRICE: Record<SUBSCRIPTION_BILLING_CYCLE, number> = {
  [SUBSCRIPTION_BILLING_CYCLE.MONTHLY]: 299,
  [SUBSCRIPTION_BILLING_CYCLE.ANNUAL]: 2990,
};

export const SUBSCRIPTION_STAFF_ADDON_PRICE: Record<SUBSCRIPTION_BILLING_CYCLE, number> = {
  [SUBSCRIPTION_BILLING_CYCLE.MONTHLY]: 149,
  [SUBSCRIPTION_BILLING_CYCLE.ANNUAL]: 1490,
};

// Modules a platform admin can individually turn off for a hospital,
// independent of billing status — see Subscription.features and
// RequiresFeature(). All default to enabled (SubscriptionsService
// provisioning) so no existing hospital loses access until explicitly toggled.
export enum SUBSCRIPTION_FEATURE {
  WHATSAPP = "whatsapp",
  REPORTS = "reports",
  PACKAGES = "packages",
  MEDICINE_PACKS = "medicinePacks",
}

export const SUBSCRIPTION_FEATURE_VALUES = Object.values(SUBSCRIPTION_FEATURE);

// Modules a hospital admin can switch on/off for their own hospital under
// Settings > Features — see Hospital.modules, RequiresModule() and
// resolveHospitalModules(). Missing keys mean enabled, so no existing
// hospital loses anything until an admin turns it off. Keep in sync with
// apps/web/src/lib/hospitalModules.ts.
export enum HOSPITAL_MODULE {
  APPOINTMENTS = "appointments",
  QUEUE = "queue",
  PACKAGES = "packages",
  PRESCRIPTIONS = "prescriptions",
  PAYMENTS = "payments",
  SMS = "sms",
  WHATSAPP_NOTIFY = "whatsappNotify",
  WHATSAPP = "whatsapp",
  REPORTS = "reports",
  AUDIT = "audit",
  LEAVE_REQUESTS = "leaveRequests",
  HOSPITAL_HOLIDAYS = "hospitalHolidays",
  CHARGE_CATALOG = "chargeCatalog",
  MEDICINES = "medicines",
  MEDICINE_PACKS = "medicinePacks",
  PATIENT_FIELDS = "patientFields",
  AI_NOTES = "aiNotes",
  INVENTORY = "inventory",
}

export const HOSPITAL_MODULE_VALUES = Object.values(HOSPITAL_MODULE);

// Used in audit-log summaries; the web app has its own copy with descriptions.
export const HOSPITAL_MODULE_LABELS: Record<HOSPITAL_MODULE, string> = {
  [HOSPITAL_MODULE.APPOINTMENTS]: "Appointments",
  [HOSPITAL_MODULE.QUEUE]: "Today's queue",
  [HOSPITAL_MODULE.PACKAGES]: "Package appointments",
  [HOSPITAL_MODULE.PRESCRIPTIONS]: "Prescriptions",
  [HOSPITAL_MODULE.PAYMENTS]: "Payments",
  [HOSPITAL_MODULE.SMS]: "SMS to patients",
  [HOSPITAL_MODULE.WHATSAPP_NOTIFY]: "WhatsApp to patients",
  [HOSPITAL_MODULE.WHATSAPP]: "WhatsApp",
  [HOSPITAL_MODULE.REPORTS]: "Reports",
  [HOSPITAL_MODULE.AUDIT]: "Audit trail",
  [HOSPITAL_MODULE.LEAVE_REQUESTS]: "Leave requests",
  [HOSPITAL_MODULE.HOSPITAL_HOLIDAYS]: "Hospital holidays",
  [HOSPITAL_MODULE.CHARGE_CATALOG]: "Charge catalog",
  [HOSPITAL_MODULE.MEDICINES]: "Medicines",
  [HOSPITAL_MODULE.MEDICINE_PACKS]: "Medicine packs",
  [HOSPITAL_MODULE.PATIENT_FIELDS]: "Custom patient fields",
  [HOSPITAL_MODULE.AI_NOTES]: "AI session notes",
  [HOSPITAL_MODULE.INVENTORY]: "Inventory",
};

// A module is only usable while every module it builds on is too — e.g. the
// queue is a view over appointments, and the prescription writer can only
// add medicines from the hospital's catalog.
export const HOSPITAL_MODULE_DEPENDENCIES: Partial<Record<HOSPITAL_MODULE, HOSPITAL_MODULE[]>> = {
  [HOSPITAL_MODULE.QUEUE]: [HOSPITAL_MODULE.APPOINTMENTS],
  [HOSPITAL_MODULE.PACKAGES]: [HOSPITAL_MODULE.APPOINTMENTS],
  [HOSPITAL_MODULE.PRESCRIPTIONS]: [HOSPITAL_MODULE.APPOINTMENTS, HOSPITAL_MODULE.MEDICINES],
  [HOSPITAL_MODULE.WHATSAPP]: [HOSPITAL_MODULE.APPOINTMENTS],
  [HOSPITAL_MODULE.MEDICINE_PACKS]: [HOSPITAL_MODULE.MEDICINES],
  [HOSPITAL_MODULE.CHARGE_CATALOG]: [HOSPITAL_MODULE.PAYMENTS],
  [HOSPITAL_MODULE.AI_NOTES]: [HOSPITAL_MODULE.APPOINTMENTS],
};

// Everything the hospital stocks, sold to patients or not — medicines,
// consumables, equipment, stationery. Deliberately not linked to the
// Medicine or Charge catalogs in v1: stock goes out by hand (Issue / Write
// off), never as a side effect of a prescription or a bill.
export enum INVENTORY_CATEGORY {
  MEDICINES = "medicines",
  CONSUMABLES = "consumables",
  SURGICAL = "surgical",
  LAB = "lab",
  EQUIPMENT = "equipment",
  HOUSEKEEPING = "housekeeping",
  STATIONERY = "stationery",
  OTHER = "other",
}

export const INVENTORY_CATEGORY_VALUES = Object.values(INVENTORY_CATEGORY);

// Every change to a batch's quantity is one movement. RECEIVED and positive
// ADJUSTED rows add stock; everything else removes it. `quantity` on the
// movement is signed accordingly, so summing an item's movements gives its
// stock on hand.
export enum INVENTORY_MOVEMENT_TYPE {
  RECEIVED = "received",
  ISSUED = "issued",
  ADJUSTED = "adjusted",
  EXPIRED = "expired",
  DAMAGED = "damaged",
  RETURNED = "returned",
}

export const INVENTORY_MOVEMENT_TYPE_VALUES = Object.values(INVENTORY_MOVEMENT_TYPE);

// The write-off flavours of a batch adjustment — each removes a counted
// quantity, unlike ADJUSTED which sets the batch to a physical count.
export const INVENTORY_WRITE_OFF_TYPES = [
  INVENTORY_MOVEMENT_TYPE.EXPIRED,
  INVENTORY_MOVEMENT_TYPE.DAMAGED,
  INVENTORY_MOVEMENT_TYPE.RETURNED,
] as const;

// A batch with stock left is flagged as expiring this many days (or fewer)
// before its expiry date.
export const INVENTORY_EXPIRY_WARNING_DAYS = 30;

// Whether a module ships at all, set platform-wide by a platform admin under
// Platform Admin > Feature catalog (PlatformFeatureCatalog.moduleStatus). It
// sits above both the per-hospital plan grant (Subscription.features — every
// HOSPITAL_MODULE key, missing means granted) and the hospital admin's own
// switch. A missing status means AVAILABLE.
//   COMING_SOON — listed on Settings > Features with a badge, can't be used.
//   HIDDEN      — not listed anywhere, can't be used (still being built).
export enum FEATURE_RELEASE_STATUS {
  AVAILABLE = "available",
  COMING_SOON = "coming_soon",
  HIDDEN = "hidden",
}

export const FEATURE_RELEASE_STATUS_VALUES = Object.values(FEATURE_RELEASE_STATUS);

// Section a teaser ("upcoming") feature is listed under on Settings >
// Features — mirrors HospitalModuleGroup in apps/web/src/lib/hospitalModules.ts.
export const HOSPITAL_MODULE_GROUP_VALUES = ["care", "frontDesk", "admin", "setup"] as const;

// A "Book a demo" submission from the marketing site (apps/www). NEW until a
// platform admin has reached out, then CONTACTED — mirrors the
// WHATSAPP_ENQUIRY_STATUS new/resolved shape.
export enum DEMO_REQUEST_STATUS {
  NEW = "new",
  CONTACTED = "contacted",
}

export const DEMO_REQUEST_STATUS_VALUES = Object.values(DEMO_REQUEST_STATUS);

// Fields shown in the Notes section of the patient Add/Edit form. Each
// hospital can switch these on/off, relabel them and add its own custom
// fields (see HospitalsService.getPatientNoteFields). Built-in keys map to
// top-level Patient properties consumed elsewhere (allergies → prescription
// allergy check, conditions/flags → prescription writer badges); custom
// fields live under Patient.customFields[key]. Keep in sync with
// apps/web/src/lib/patientNoteFields.ts.
export type PatientNoteFieldType = "tags" | "text";

export interface PatientNoteField {
  key: string;
  label: string;
  type: PatientNoteFieldType;
  enabled: boolean;
  hint?: string;
  placeholder?: string;
  builtIn?: boolean;
}

export const BUILT_IN_PATIENT_NOTE_FIELDS: PatientNoteField[] = [
  {
    key: "allergies",
    label: "Allergies",
    type: "tags",
    enabled: true,
    builtIn: true,
    hint: "Checked against a medicine's allergy class tags when a doctor writes a prescription.",
    placeholder: "Type an allergy and press Enter (e.g. Penicillin)",
  },
  {
    key: "conditions",
    label: "Conditions",
    type: "tags",
    enabled: true,
    builtIn: true,
    hint: "Shown as badges on the prescription writer, e.g. diabetic, hypertensive.",
    placeholder: "Type a condition and press Enter (e.g. Diabetic)",
  },
  {
    key: "flags",
    label: "Flags",
    type: "tags",
    enabled: true,
    builtIn: true,
    hint: "Any other context worth surfacing on the prescription writer, e.g. eGFR normal.",
    placeholder: "Type a flag and press Enter (e.g. eGFR normal)",
  },
  {
    key: "notes",
    label: "Additional notes",
    type: "text",
    enabled: true,
    builtIn: true,
    placeholder: "Any additional information about the patient...",
  },
];

export const BUILT_IN_PATIENT_NOTE_FIELD_KEYS = BUILT_IN_PATIENT_NOTE_FIELDS.map((f) => f.key);
