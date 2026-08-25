import type { Doctor } from "./doctor";
import type { Patient } from "./patient";

// types/patient.ts
export interface TimeSlot {
  day: string;
  startTime: string;
  endTime: string;
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
    | "completed"
    | "cancelled"
    | "no-show"
    | "rescheduled"
    | "scheduled";
  notes?: string;
  sessionNotes?: string;
  createdAt: string;
  updatedAt: string;
  checkedInAt?: string;
  waitingAt?: string;
  consultationStartedAt?: string;
  completedAt?: string; // Timestamp when appointment was marked as completed
  bookingSource?: "scheduled" | "walk-in";
  // Desk-triggered queue priority override — see orderQueue in queueBoard.ts.
  urgentOverrideAt?: string;
  urgentOverrideReason?: string;
  patient?: Patient;
  doctor?: Doctor;
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
