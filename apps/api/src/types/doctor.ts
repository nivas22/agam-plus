import { Hospital } from './auth';

export interface Doctor {
  id: string;
  name: string;
  email: string;
  specialization?: string;
  phone?: string;
  status?: 'pending' | 'active' | 'inactive' | 'approved' | 'rejected';
  createdAt?: string;
  updatedAt?: string;
  licenseNumber?: string;
  experience?: number;
  qualifications?: string[];
  bio?: string;
  avatar?: string;
  gender?: string;
  maritalStatus?: string;
  location?: string;
  availability?: TimeSlot[];
  appointmentDuration?: number;
  bufferMinutes?: number;
  patientsPerSlot?: number;
}

export interface DoctorProfile {
  id: string;
  hospitalId: string;
  userId: string;
  specialization?: string;
  qualification?: string;
  consultationFee?: number;
  availability?: string[];
  bio?: string;
  status?: 'active' | 'inactive' | 'pending';
  experience?: string;
  phone?: string;
  email?: string;
  name?: string;
  location?: string;
  address?: string;
  gender?: string;
  maritalStatus?: string;
  appointmentDuration?: number;
  bufferMinutes?: number;
  patientsPerSlot?: number;
  membershipId?: string | null;
  membershipStatus?: string;
  joinedAt?: Date | string | null;
  isAcceptingBookings?: boolean;
}

export interface TimeSlot {
  day: string;
  startTime: string;
  endTime: string;
}

export interface HospitalMember {
  id: string;
  hospitalId: string;
  userId: string;
  role: 'admin' | 'doctor' | 'front_desk' | 'nurse' | 'accountant' | 'patient';
  status: 'pending' | 'approved' | 'rejected';
  joinedAt: any;
  invitedBy?: string;
  hospital: Hospital;
  isDoctor: boolean;
}
