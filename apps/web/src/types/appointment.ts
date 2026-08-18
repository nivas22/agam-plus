import { Doctor } from "./doctor";
import { Patient } from "./patient";

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
  status: 'scheduled' | 'completed' | 'cancelled' | 'no-show';
  notes?: string;
  sessionNotes?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string; // Timestamp when appointment was marked as completed
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
  frequency: 'once' | 'weekly' | 'monthly';
  notes?: string;
  numberOfOccurrences?: number;
  selectedDays?: string[];
  recurringDates?: number[];
}

export interface SlotsResponse {
  availableSlots: string[];
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