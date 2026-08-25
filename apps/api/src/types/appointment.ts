import { Doctor } from './doctor';
import { Patient } from './patient';

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
  completedAt?: string;
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
  bookingSource?: 'scheduled' | 'walk-in';
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
