// types/doctor.ts

import { Hospital } from "./auth";

export const DOCTOR_STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "approved", label: "Approved" },
  { value: "pending", label: "Pending" },
  { value: "rejected", label: "Rejected" }
];

export interface Doctor {
  id: string;
  name: string;
  email: string;
  specialization?: string;
  phone?: string;
  status?: "pending" | "active" | "inactive" | "approved" | "rejected";
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
  membershipId?: string | null;
  membershipStatus?: string;
}

export interface HospitalMember {
  id: string;
  hospitalId: string;
  userId: string;
  role: "admin" | "doctor" | "front_desk" | "nurse" | "accountant" | "patient";
  status: "pending" | "approved" | "rejected" | "suspended" | "deactivated";
  joinedAt: any;
  invitedBy?: string;
  hospital: Hospital;
  isDoctor: boolean;
}

export interface TimeSlot {
  day: string;
  startTime: string;
  endTime: string;
}

export interface AvailabilitySlot {
  day: string;
  startTime: string;
  endTime: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  doctors?: T[];
}

// types/doctor.ts
export interface TimeSlot {
  day: string;
  startTime: string;
  endTime: string;
}

export type DoctorResponse = {
  doctors: Doctor[];
};