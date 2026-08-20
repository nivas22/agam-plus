export enum DB_COLLECTIONS {
  USERS = 'users_new',
  DOCTOR_PROFILES = 'doctorProfiles_new_1',
  PATIENTS = 'patients_new_1',
  APPOINTMENTS = 'appointments_new',
  HOSPITALS = 'hospitals_new',
  HOSPITAL_MEMBERS = 'hospitalMembers_new_1',
  REVIEWS = 'reviews',
  DOCTOR_ACTIVIES = 'doctor_activities',
}

export enum ROLE {
  ADMIN = 'admin',
  DOCTOR = 'doctor',
  PATIENT = 'patient',
  STAFF = 'staff',
}

export enum MEMBERSHIP_STATUS {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
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
export function normalizeAppointmentStatus(status: string | undefined | null): APPOINTMENT_STATUS {
  if (status === 'scheduled' || !status) return APPOINTMENT_STATUS.CONFIRMED;
  return status as APPOINTMENT_STATUS;
}

// Allowed next statuses for each current status. Same-status "transitions"
// (e.g. re-saving session notes on a completed appointment) are always
// permitted and validated separately.
export const APPOINTMENT_STATUS_TRANSITIONS: Record<APPOINTMENT_STATUS, APPOINTMENT_STATUS[]> = {
  [APPOINTMENT_STATUS.PENDING]: [APPOINTMENT_STATUS.CONFIRMED, APPOINTMENT_STATUS.CANCELLED],
  [APPOINTMENT_STATUS.CONFIRMED]: [
    APPOINTMENT_STATUS.CHECKED_IN,
    APPOINTMENT_STATUS.IN_CONSULTATION, // doctor-direct fast path when front-desk check-in isn't used
    APPOINTMENT_STATUS.CANCELLED,
    APPOINTMENT_STATUS.NO_SHOW,
    APPOINTMENT_STATUS.RESCHEDULED,
  ],
  [APPOINTMENT_STATUS.CHECKED_IN]: [APPOINTMENT_STATUS.WAITING, APPOINTMENT_STATUS.IN_CONSULTATION, APPOINTMENT_STATUS.CANCELLED],
  [APPOINTMENT_STATUS.WAITING]: [APPOINTMENT_STATUS.IN_CONSULTATION, APPOINTMENT_STATUS.CANCELLED],
  [APPOINTMENT_STATUS.IN_CONSULTATION]: [APPOINTMENT_STATUS.COMPLETED, APPOINTMENT_STATUS.CANCELLED],
  [APPOINTMENT_STATUS.COMPLETED]: [APPOINTMENT_STATUS.CONFIRMED], // reopen
  [APPOINTMENT_STATUS.CANCELLED]: [APPOINTMENT_STATUS.CONFIRMED, APPOINTMENT_STATUS.RESCHEDULED], // reopen / rebook
  [APPOINTMENT_STATUS.NO_SHOW]: [APPOINTMENT_STATUS.CONFIRMED, APPOINTMENT_STATUS.RESCHEDULED], // reopen / rebook
  [APPOINTMENT_STATUS.RESCHEDULED]: [APPOINTMENT_STATUS.CONFIRMED, APPOINTMENT_STATUS.CANCELLED],
};

export function isValidAppointmentTransition(from: string | undefined | null, to: APPOINTMENT_STATUS): boolean {
  const current = normalizeAppointmentStatus(from);
  if (current === to) return true;
  return APPOINTMENT_STATUS_TRANSITIONS[current]?.includes(to) ?? false;
}

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
