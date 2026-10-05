import type { Doctor } from "./doctor";
import type { Patient } from "./patient";

// types/patient.ts
export interface TimeSlot {
  day: string;
  startTime: string;
  endTime: string;
}

// Front-desk-recorded vitals, taken at walk-in time — every field optional
// since not every desk has every instrument to hand.
export interface Vitals {
  bpSystolic?: number;
  bpDiastolic?: number;
  spo2?: number;
  pulse?: number;
  weight?: number;
  temperature?: number;
  height?: number;
}

export interface Appointment {
  id: string;
  hospitalId: string;
  patientId: string;
  doctorProfileId: string;
  date: string;
  time: string;
  status:
    | "pending"
    | "confirmed"
    | "checked-in"
    | "waiting"
    | "in-consultation"
    | "awaiting-payment"
    | "completed"
    | "cancelled"
    | "no-show"
    | "rescheduled"
    | "scheduled";
  notes?: string;
  sessionNotes?: string;
  vitals?: Vitals;
  createdAt: string;
  updatedAt: string;
  checkedInAt?: string;
  waitingAt?: string;
  consultationStartedAt?: string;
  completedAt?: string; // Timestamp the clinical session finished (awaiting-payment)
  paymentCollectedAt?: string; // Timestamp payment was collected (completed)
  bookingSource?: "scheduled" | "walk-in";
  // Desk-triggered queue priority override — see orderQueue in queueBoard.ts.
  urgentOverrideAt?: string;
  urgentOverrideReason?: string;
  patient?: Patient;
  doctor?: Doctor;
}

// An injection/dressing/test logged during the consultation — persisted on
// the appointment at session-finish time so it survives into the eventual
// bill regardless of who collects payment, or when.
export interface AppointmentGivenItem {
  name: string;
  quantity: number;
  unitPrice: number;
  chargeCatalogItemId?: string;
}

export interface AppointmentWithDetails extends Appointment {
  patientName: string;
  doctorName: string;
  doctorSpecialization?: string;
  patientPhone?: string;
  patientAge?: number;
  patientGender?: string;
  rescheduleDate?: string;
  rescheduleTime?: string;
  rescheduledAt?: string;
  reopenedAt?: string;
  cancelReason?: string;
  noShowReason?: string;
  type?: string;
  packageId?: string;
  packageVisitNumber?: number;
  givenItems?: AppointmentGivenItem[];
  // Follow-up the doctor asked for at finish-session; booking it is optional
  // and offered in the Collect payment dialog.
  followUpOption?: string;
  followUpDueDate?: string;
  // On the original visit once its follow-up is booked.
  followUpAppointmentId?: string;
  // On a follow-up appointment: the visit it follows up on.
  followUpOf?: string;
}

export type AppointmentResponse = {
  appointments: AppointmentWithDetails[];
};

export interface DateFilterOption {
  id: string;
  label: string;
  shortLabel: string;
  color: string;
  textColor: string;
}

export interface AppointmentFormData {
  doctorProfileId: string;
  patientId: string;
  startDate: string;
  preferredTime: string;
  frequency: "once" | "weekly" | "monthly";
  notes?: string;
  numberOfOccurrences?: number;
  selectedDays?: string[];
  recurringDates?: number[];
  bookingSource?: "scheduled" | "walk-in";
  // Front-desk override for the walk-in board: book `preferredTime` exactly,
  // skipping the normal slot-capacity search. See appointments.service.ts.
  forceSlot?: boolean;
  vitals?: Vitals;
  // Books this as the follow-up of that visit (type 'follow-up', once only).
  followUpOf?: string;
}

export interface AvailableSlot {
  time: string;
  remaining: number;
  capacity: number;
}

export interface SlotsResponse {
  availableSlots: AvailableSlot[];
  doctor: {
    id: string;
    name: string;
    specialization?: string;
    appointmentDuration: number;
  };
}

export interface NextAvailableSlotResponse {
  nextAvailableSlot: {
    date: string;
    time: string;
  } | null;
  doctor: {
    id: string;
    name: string;
    specialization?: string;
    appointmentDuration: number;
  };
}
