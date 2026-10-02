import { Doctor } from "./doctor";

export const PATIENT_STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' }
];

// types/patient.ts
export interface Patient {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  gender?: string;
  dateOfBirth?: string;
  age?: number;
  address?: string;
  medicalHistory?: string;
  assignedDoctor?: Doctor;
  frequency?: string;
  status?: string;
  avatar?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PatientFormData {
  name: string;
  email: string;
  phone: string;
  secondaryPhone?: string;
  gender: string;
  dateOfBirth?: string;
  notes?: string;
  age?: number;
  address: string;
  medicalHistory?: string;
  assignedDoctorId?: string;
  frequency?: string;
  startDate?: string;
  endDate?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  patients?: T;
  doctors?: T;
}

export type PatientsResponse = {
  patients: Patient[];
};