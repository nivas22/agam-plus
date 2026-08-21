import { Hospital } from './auth';
import { TimeSlot } from './appointment';

export interface Doctor {
  id: string;
  profileId: string;
  hospitalId: string;
  name: string;
  email: string;
  specialization: string;
  qualification: string;
  consultationFee: number;
  availability: TimeSlot[];
  bio: string;
  experience?: string;
  phone?: string;
  status: 'active' | 'inactive' | 'pending';
  membershipStatus: 'approved' | 'pending' | 'rejected';
  createdAt: any;
  isActive: boolean;
  canEdit: boolean;
  gender?: string;
  location?: string;
  maritalStatus?: string;
  appointmentDuration?: number;
  bufferMinutes?: number;
  patientsPerSlot?: number;
  address?: string;
  membershipId?: string | undefined;
  userId?: string;
}

export interface HospitalMember {
  id: string;
  hospitalId: string;
  userId: string;
  role: 'admin' | 'doctor' | 'staff' | 'patient';
  status: 'pending' | 'approved' | 'rejected';
  joinedAt: any;
  invitedBy?: string;
  hospital: Hospital;
  isDoctor: boolean;
  isProfileUpdated: boolean;
  isExperienceUpdated: boolean;
  isAvailabilityUpdated: boolean;
  specialization?: string;
  consultationFee?: number;
}
