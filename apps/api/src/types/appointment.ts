import { Doctor } from './doctor';
import { Patient } from './patient';

export interface TimeSlot {
  day: string;
  startTime: string;
  endTime: string;
}

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
    | 'pending'
    | 'confirmed'
    | 'checked-in'
    | 'waiting'
    | 'in-consultation'
    | 'awaiting-payment'
    | 'completed'
    | 'cancelled'
    | 'no-show'
    | 'rescheduled'
    | 'scheduled';
  notes?: string;
  sessionNotes?: string;
  vitals?: Vitals;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  paymentCollectedAt?: string;
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
