import { z } from 'zod';
import {
  GENDER,
  APPOINTMENT_STATUS_VALUES,
  PAYMENT_METHOD_VALUES,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  PACKAGE_PAYMENT_METHOD_VALUES,
  CHARGE_CATALOG_CATEGORY_VALUES,
  HOLIDAY_CLOSURE_TYPE_VALUES,
  MEDICINE_FORM_VALUES,
  FOOD_TIMING_OPTIONS,
  PRESCRIPTION_STATUS_VALUES,
} from '../../constants';

/* -------------------------------------------------------------------------- */
/*                              AUTH SCHEMAS                                  */
/* -------------------------------------------------------------------------- */

export const loginSchema = z.object({
  idToken: z.string().min(1, 'ID token is required'),
});

export const switchHospitalSchema = z.object({
  hospitalId: z.string().min(1, 'Hospital ID is required'),
});

/* -------------------------------------------------------------------------- */
/*                           APPOINTMENT SCHEMAS                              */
/* -------------------------------------------------------------------------- */

// Front-desk-recorded vitals, taken at walk-in time — every field optional
// since not every desk has every instrument to hand.
export const vitalsSchema = z.object({
  bpSystolic: z.number().positive().optional(),
  bpDiastolic: z.number().positive().optional(),
  spo2: z.number().min(0).max(100).optional(),
  pulse: z.number().positive().optional(),
  weight: z.number().positive().optional(),
  temperature: z.number().positive().optional(),
  height: z.number().positive().optional(),
});

// NOTE: Status is NOT included in creation schema - all appointments are created as 'confirmed'
// (admin/staff booking). The update endpoint moves status through the queue lifecycle from there.
export const createAppointmentSchema = z.object({
  doctorProfileId: z.string().min(1, 'Doctor profile ID is required'),
  patientId: z.string().min(1, 'Patient ID is required'),
  startDate: z.string().min(1, 'Start date is required'),
  preferredTime: z.string().min(1, 'Preferred time is required'),
  frequency: z.enum(['once', 'weekly', 'monthly']),
  numberOfOccurrences: z.number().int().positive().default(1),
  selectedDays: z.array(z.string()).default([]),
  notes: z.string().default(''),
  // Set by the walk-in flow so capacity/held-slot accounting can tell a
  // front-desk walk-in apart from a normally scheduled booking.
  bookingSource: z.enum(['scheduled', 'walk-in']).optional(),
  // Front-desk override: skip the normal slot-capacity search and book
  // exactly `preferredTime` even if it's outside generated slots or the
  // session is already at capacity. Only honored for frequency 'once', and
  // still blocked server-side if the doctor's overCapacityPolicy is 'block'.
  forceSlot: z.boolean().optional().default(false),
  vitals: vitalsSchema.optional(),
});

export const updateAppointmentSchema = z.object({
  appointmentId: z.string().min(1, 'Appointment ID is required'),
  status: z.enum(APPOINTMENT_STATUS_VALUES as [string, ...string[]], {
    message: `Status must be one of: ${APPOINTMENT_STATUS_VALUES.join(', ')}`,
  }),
  sessionNotes: z.string().optional(),
  appointmentData: z
    .object({
      doctorProfileId: z.string().optional(),
      doctorName: z.string().optional(),
      rescheduleDate: z.string().optional(),
      rescheduleTime: z.string().optional(),
      cancelReason: z.string().optional(),
      noShowReason: z.string().optional(),
      notes: z.string().optional(),
    })
    .optional(),
});

/* -------------------------------------------------------------------------- */
/*                             PAYMENT SCHEMAS                                 */
/* -------------------------------------------------------------------------- */

export const paymentItemSchema = z.object({
  name: z.string().min(1, 'Item name is required'),
  quantity: z.number().int().positive().default(1),
  unitPrice: z.number().min(0, 'Price cannot be negative'),
  chargeCatalogItemId: z.string().optional(),
  isAuto: z.boolean().optional(),
  isPackageCovered: z.boolean().optional(),
});

export const completeVisitSchema = z.object({
  appointmentId: z.string().min(1, 'Appointment ID is required'),
  sessionNotes: z.string().optional(),
  followUp: z
    .enum(['none', '3-days', '1-week', '2-weeks', '1-month'])
    .default('none'),
  items: z
    .array(paymentItemSchema)
    .min(1, 'At least one billable item is required'),
  discount: z.number().min(0).default(0),
  method: z.enum(PAYMENT_METHOD_VALUES as [string, ...string[]], {
    message: `Method must be one of: ${PAYMENT_METHOD_VALUES.join(', ')}`,
  }),
  // cash
  amountTendered: z.number().min(0).optional(),
  collectedBy: z.string().optional(),
  // upi
  upiReference: z.string().optional(),
  // split
  splitCashAmount: z.number().min(0).optional(),
  splitUpiAmount: z.number().min(0).optional(),
  // due
  dueReason: z.string().optional(),
  sendReceiptWhatsApp: z.boolean().default(true),
  // Whether to draw this visit's consultation from a linked package's unused
  // credits. Only meaningful when the appointment is a package visit — the
  // server independently checks the package actually has capacity before
  // honoring this either way, so a client can't force coverage it shouldn't get.
  usePackageVisit: z.boolean().default(true),
});

export const updatePaymentSchema = z.object({
  upiReference: z.string().optional(),
  status: z.enum([PAYMENT_STATUS.PAID]).optional(),
  // Settling a due payment (status: PAID moving off an existing DUE record)
  method: z.enum([PAYMENT_METHOD.CASH, PAYMENT_METHOD.UPI]).optional(),
  amountTendered: z.number().min(0).optional(),
  collectedBy: z.string().optional(),
});

export const refundPaymentSchema = z.object({
  refundReason: z.string().optional(),
});

export const closeDaySchema = z.object({
  date: z.string().min(1, 'Date is required'),
  openingFloat: z.number().min(0).default(0),
  countedAmount: z.number().min(0, 'Counted amount is required'),
  note: z.string().optional(),
});

/* -------------------------------------------------------------------------- */
/*                             PACKAGE SCHEMAS                                 */
/* -------------------------------------------------------------------------- */

export const previewPackageScheduleSchema = z.object({
  doctorProfileId: z.string().min(1, 'Doctor is required'),
  startDate: z.string().min(1, 'Start date is required'),
  preferredTime: z.string().min(1, 'Preferred time is required'),
  frequency: z.enum(['weekly', 'every-3-days']),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).default([]),
  count: z.number().int().positive().max(60),
});

export const sellPackageVisitSchema = z.object({
  date: z.string().min(1, 'Visit date is required'),
  time: z.string().min(1, 'Visit time is required'),
});

export const sellPackageSchema = z.object({
  patientId: z.string().min(1, 'Patient is required'),
  doctorProfileId: z.string().min(1, 'Doctor is required'),
  totalVisits: z.number().int().positive(),
  pricePerVisit: z.number().min(0),
  paymentMethod: z.enum(
    PACKAGE_PAYMENT_METHOD_VALUES as [string, ...string[]],
    {
      message: `Payment method must be one of: ${PACKAGE_PAYMENT_METHOD_VALUES.join(', ')}`,
    },
  ),
  visits: z.array(sellPackageVisitSchema).default([]),
});

export const extendPackageSchema = z.object({
  months: z.number().int().positive().max(24),
});

/* -------------------------------------------------------------------------- */
/*                          AVAILABILITY SCHEMAS                              */
/* -------------------------------------------------------------------------- */

export const availabilitySlotSchema = z.object({
  day: z.enum([
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ]),
  startTime: z
    .string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
  endTime: z
    .string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
});

export const doctorAvailabilitySchema = z.object({
  availability: z
    .array(availabilitySlotSchema)
    .min(1, 'At least one availability slot is required'),
  appointmentDuration: z.number().int().positive().default(30),
  bufferMinutes: z.number().int().min(0).default(0),
  patientsPerSlot: z.number().int().positive().default(1),
});

/* -------------------------------------------------------------------------- */
/*                             DOCTOR SCHEMAS                                 */
/* -------------------------------------------------------------------------- */

export const createDoctorSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email format'),
  phone: z.string().min(1, 'Phone is required'),
  specialization: z.string().optional(),
  qualification: z.string().optional(),
  experience: z.string().optional(),
  bio: z.string().optional(),
  consultationFee: z.number().optional(),
  gender: z.string().optional(),
  maritalStatus: z.string().optional(),
  address: z.string().optional(),
  status: z.enum(['active', 'inactive', 'pending']).optional(),
  // Hospital-scoped scheduling fields — persisted on HospitalMember, not DoctorProfile.
  availability: z.array(availabilitySlotSchema).optional(),
  appointmentDuration: z.number().int().positive().optional(),
  bufferMinutes: z.number().int().min(0).optional(),
  patientsPerSlot: z.number().int().positive().optional(),
  // Walk-in carve-out settings — also hospital-scoped, on HospitalMember.
  acceptWalkIns: z.boolean().optional(),
  heldSlotsPerSession: z.number().int().min(0).optional(),
  releaseHeldSlotsBeforeMinutes: z.number().int().min(0).nullable().optional(),
  overCapacityPolicy: z.enum(['allow', 'warn', 'block']).optional(),
  lateArrivalGraceMinutes: z.number().int().min(0).optional(),
  noShowReleaseMinutes: z.number().int().min(0).optional(),
  // Set once staff have seen the phone-duplicate warning and chosen to create anyway.
  confirmDuplicate: z.boolean().optional().default(false),
});

export const updateDoctorAvailabilitySchema = z.object({
  availability: z.array(
    z.object({
      day: z.string().min(1, 'Day is required'),
      startTime: z.string().min(1, 'Start time is required'),
      endTime: z.string().min(1, 'End time is required'),
    }),
  ),
  appointmentDuration: z.number().int().positive().optional(),
  bufferMinutes: z.number().int().min(0).optional(),
  patientsPerSlot: z.number().int().positive().optional(),
});

/* -------------------------------------------------------------------------- */
/*                             PATIENT SCHEMAS                                */
/* -------------------------------------------------------------------------- */

export const createPatientSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  age: z.number().int().positive('Age must be a positive number'),
  gender: z.enum([GENDER.MALE, GENDER.FEMALE, GENDER.OTHER]),
  phone: z.string().min(1, 'Phone is required'),
  email: z.string().email('Invalid email format').optional(),
  address: z.string().optional(),
  medicalHistory: z.string().optional(),
  allergies: z.array(z.string()).optional(),
});

export const updatePatientSchema = createPatientSchema.partial();

/* -------------------------------------------------------------------------- */
/*                            HOSPITAL SCHEMAS                                */
/* -------------------------------------------------------------------------- */

export const requestAccessSchema = z.object({
  hospitalId: z.string().min(1, 'Hospital ID is required'),
  role: z.enum(['admin', 'doctor']).optional(),
  message: z.string().optional(),
});

export const createHospitalSchema = z.object({
  name: z.string().min(1, 'Hospital name is required'),
  address: z.string().min(1, 'Address is required'),
  phone: z.string().optional(),
  email: z.string().email('Invalid email format').optional(),
  website: z.string().url('Invalid URL').optional(),
  description: z.string().optional(),
  adminEmails: z
    .array(z.string().email('Invalid email format'))
    .min(1, 'At least one admin email is required'),
});

export const updateHospitalSchema = createHospitalSchema.partial();

/* -------------------------------------------------------------------------- */
/*                        PLATFORM ADMIN SCHEMAS                              */
/* -------------------------------------------------------------------------- */

export const setPlatformAdminSchema = z.object({
  isPlatformAdmin: z.boolean(),
});

export const addHospitalAdminSchema = z.object({
  email: z.string().email('Invalid email format'),
});

/* -------------------------------------------------------------------------- */
/*                               TEAM SCHEMAS                                 */
/* -------------------------------------------------------------------------- */

export const createTeamMemberSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email format'),
  phone: z.string().min(1, 'Phone is required'),
  role: z.enum(['front_desk', 'nurse', 'accountant'], {
    message: 'Role must be one of: front_desk, nurse, accountant',
  }),
  shift: z.string().optional(),
  startDate: z.string().optional(),
  handlesCash: z.boolean().default(false),
  invitedVia: z.enum(['whatsapp', 'sms', 'email']).optional(),
  confirmDuplicate: z.boolean().optional().default(false),
});

export const updateTeamMemberSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email('Invalid email format').optional(),
  phone: z.string().optional(),
  role: z.enum(['front_desk', 'nurse', 'accountant']).optional(),
  shift: z.string().optional(),
  handlesCash: z.boolean().optional(),
});

export const teamMemberStatusSchema = z.object({
  status: z.enum(['active', 'suspended', 'deactivated']),
});

export const setPinSchema = z.object({
  pin: z.string().regex(/^\d{4}$/, 'PIN must be 4 digits'),
});

export const verifyPinSchema = z.object({
  pin: z.string().regex(/^\d{4}$/, 'PIN must be 4 digits'),
});

/* -------------------------------------------------------------------------- */
/*                          PERMISSIONS SCHEMAS                               */
/* -------------------------------------------------------------------------- */

export const updateRolePermissionsSchema = z.object({
  overrides: z.record(z.string(), z.enum(['allowed', 'needs_approval', 'blocked'])),
  discountCapAmount: z.number().min(0).optional(),
});

/* -------------------------------------------------------------------------- */
/*                          APPROVALS SCHEMAS                                 */
/* -------------------------------------------------------------------------- */

export const approveRequestSchema = z.object({
  pin: z.string().regex(/^\d{4}$/).optional(),
  note: z.string().optional(),
});

export const declineRequestSchema = z.object({
  note: z.string().optional(),
});

/* -------------------------------------------------------------------------- */
/*                          CHARGE CATALOG SCHEMAS                            */
/* -------------------------------------------------------------------------- */

export const createChargeCatalogItemSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  category: z.enum(CHARGE_CATALOG_CATEGORY_VALUES as [string, ...string[]]),
  price: z.number().min(0, 'Price cannot be negative'),
  gstPercent: z.number().min(0).default(0),
  frontDeskCanAdd: z.boolean().default(true),
  coveredByPackages: z.boolean().default(false),
});

export const updateChargeCatalogItemSchema = z.object({
  name: z.string().min(1).optional(),
  category: z
    .enum(CHARGE_CATALOG_CATEGORY_VALUES as [string, ...string[]])
    .optional(),
  frontDeskCanAdd: z.boolean().optional(),
  coveredByPackages: z.boolean().optional(),
  price: z.number().min(0).optional(),
  gstPercent: z.number().min(0).optional(),
  // Required by the service when `price` is provided.
  effectiveFrom: z.string().optional(),
});

export const chargeCatalogStatusSchema = z.object({
  status: z.enum(['active', 'archived']),
});

export const bulkReviseChargeCatalogSchema = z.object({
  itemIds: z.array(z.string()).min(1, 'Select at least one item'),
  method: z.enum(['percent', 'fixed', 'manual']),
  value: z.number().optional(),
  roundTo: z.enum(['none', '5', '10']).default('none'),
  effectiveFrom: z.string().min(1, 'Effective date is required'),
  manualPrices: z.record(z.string(), z.number().min(0)).optional(),
});

/* -------------------------------------------------------------------------- */
/*                        HOSPITAL HOLIDAY SCHEMAS                            */
/* -------------------------------------------------------------------------- */

const holidayDraftSchema = z.object({
  startsOn: z.string().min(1, 'Start date is required'),
  endsOn: z.string().min(1).optional(),
  closureType: z.enum(HOLIDAY_CLOSURE_TYPE_VALUES as [string, ...string[]]),
  halfDayUntil: z.string().optional(),
  exceptionDoctorIds: z.array(z.string()).default([]),
});

export const previewHolidayImpactSchema = holidayDraftSchema;

export const holidayResolutionSchema = z.object({
  appointmentId: z.string().min(1),
  action: z.enum(['move', 'cancel', 'keep']),
  newDate: z.string().optional(),
  newTime: z.string().optional(),
});

export const createHospitalHolidaySchema = holidayDraftSchema.extend({
  name: z.string().min(1, 'Name is required'),
  repeatsAnnually: z.boolean().default(false),
  resolutions: z.array(holidayResolutionSchema).default([]),
});

export const applyHolidayResolutionsSchema = z.object({
  resolutions: z.array(holidayResolutionSchema).default([]),
});

export const updateHospitalHolidaySchema = z.object({
  name: z.string().min(1).optional(),
  closureType: z.enum(HOLIDAY_CLOSURE_TYPE_VALUES as [string, ...string[]]).optional(),
  halfDayUntil: z.string().optional(),
  repeatsAnnually: z.boolean().optional(),
  exceptionDoctorIds: z.array(z.string()).optional(),
});

export const holidayStatusSchema = z.object({
  status: z.enum(['active', 'removed']),
});

export const generateHolidayRepeatsSchema = z.object({
  year: z.number().int(),
});

export const importTnHolidayListSchema = z.object({
  year: z.number().int(),
});

/* -------------------------------------------------------------------------- */
/*                            MEDICINE SCHEMAS                                */
/* -------------------------------------------------------------------------- */

export const createMedicineSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  genericName: z.string().optional(),
  classes: z.array(z.string()).default([]),
  form: z.enum(MEDICINE_FORM_VALUES as [string, ...string[]]),
  strength: z.string().optional(),
  defaultDose: z.string().optional(),
  defaultFrequency: z.string().optional(),
  defaultFoodTiming: z.enum(FOOD_TIMING_OPTIONS).optional(),
});

export const updateMedicineSchema = createMedicineSchema.partial();

export const medicineStatusSchema = z.object({
  status: z.enum(['active', 'archived']),
});

/* -------------------------------------------------------------------------- */
/*                          PRESCRIPTION SCHEMAS                              */
/* -------------------------------------------------------------------------- */

const prescriptionItemSchema = z.object({
  medicineId: z.string().min(1),
  medicineName: z.string().min(1),
  strength: z.string().optional(),
  form: z.string().optional(),
  dose: z.string().min(1, 'Dose is required'),
  frequency: z.string().optional(),
  foodTiming: z.enum(FOOD_TIMING_OPTIONS).optional(),
  duration: z.string().optional(),
  quantity: z.string().optional(),
  note: z.string().optional(),
});

const allergyOverrideSchema = z.object({
  medicineId: z.string().min(1),
  medicineName: z.string().min(1),
  matchedAllergyTerm: z.string().min(1),
  reason: z.string().min(1, 'A reason is required to override an allergy warning'),
});

export const savePrescriptionSchema = z.object({
  items: z.array(prescriptionItemSchema).default([]),
  allergyOverrides: z.array(allergyOverrideSchema).default([]),
  advice: z.string().optional(),
});

export const prescriptionStatusSchema = z.object({
  status: z.enum(PRESCRIPTION_STATUS_VALUES as [string, ...string[]]),
});
