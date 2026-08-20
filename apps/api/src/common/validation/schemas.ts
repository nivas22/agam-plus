import { z } from 'zod';
import { GENDER, APPOINTMENT_STATUS_VALUES } from '@agam-plus/shared';

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
    })
    .optional(),
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
});

export const updateHospitalSchema = createHospitalSchema.partial();

/* -------------------------------------------------------------------------- */
/*                          AVAILABILITY SCHEMAS                              */
/* -------------------------------------------------------------------------- */

export const availabilitySlotSchema = z.object({
  day: z.enum(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
});

export const doctorAvailabilitySchema = z.object({
  availability: z.array(availabilitySlotSchema).min(1, 'At least one availability slot is required'),
  appointmentDuration: z.number().int().positive().default(30),
});
