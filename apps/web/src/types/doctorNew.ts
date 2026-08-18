import { Hospital } from "./auth";
import { TimeSlot } from "./appointment";

export const DOCTOR_STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "approved", label: "Approved" },
  { value: "pending", label: "Pending" },
  { value: "rejected", label: "Rejected" }
];

// types/doctor.ts
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
  experience?: string; // Changed from number to string
  phone?: string;
  status: 'active' | 'inactive' | 'pending';
  membershipStatus: 'approved' | 'pending' | 'rejected';
  createdAt: any;
  isActive: boolean;
  canEdit: boolean;
  // Optional fields for backward compatibility
  gender?: string;
  location?: string;
  maritalStatus?: string;
  appointmentDuration?: number;
  address?: string;
  membershipId?: string | undefined;
  userId?: string;
}

export interface HospitalMember {
  id: string;
  hospitalId: string;
  userId: string;
  role: "admin" | "doctor" | "staff" | "patient";
  status: "pending" | "approved" | "rejected";
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

export interface DoctorsResponse {
  doctors: Doctor[];
  total: number;
  filters: any;
  hospitalId: string;
}

export interface CreateDoctorData {
  name: string;
  email: string;
  location?: string;
  gender?: string;
  maritalStatus?: string;
  appointmentDuration?: number;
  hospitalId: string;
  specialization?: string;
  qualification?: string;
  consultationFee?: number;
  availability?: TimeSlot[];
  bio?: string;
  experience?: string; // Changed from number to string
  phone?: string;
  status?: 'active' | 'inactive' | 'pending';
  address?: string;
}

export interface UpdateDoctorData {
  specialization?: string;
  qualification?: string;
  consultationFee?: number;
  availability?: TimeSlot[];
  bio?: string;
  experience?: string; // Changed from number to string
  phone?: string;
  status?: 'active' | 'inactive' | 'pending';
  isProfileUpdated?: boolean;
  isExperienceUpdated?: boolean;
}

export interface UpdateDoctorStatus {
  status: 'approved' | 'pending' | 'rejected';
}

export type DoctorResponse = {
  doctors: Doctor[];
};
