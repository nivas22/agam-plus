import type { GENDER } from "../constants";

export interface Patient {
  id: string;
  userId?: string;
  hospitalId: string;
  patientId?: string;
  name: string;
  email: string;
  phone: string;
  secondaryPhone?: string;
  dateOfBirth: string;
  gender: GENDER;
  bloodGroup?: string;
  age?: string;
  address: string;
  allergies?: string[];
  status: "active" | "inactive" | "archived" | "approved" | "pending";
  createdAt: any;
  updatedAt?: any;
  createdBy?: string;
  notes?: string;
  membershipId?: string | undefined;
  lookingForSpecialization?: string;
}

export interface PatientsResponse {
  patients: Patient[];
  filters: {
    statuses: string[];
    genders: string[];
  };
  total: number;
  hospitalId: string;
}

export interface CreatePatientData {
  name: string;
  email: string;
  phone: string;
  secondaryPhone?: string;
  dateOfBirth: string;
  gender: GENDER;
  bloodGroup?: string;
  address: string;
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
  medicalHistory?: string[];
  allergies?: string[];
  currentMedications?: string[];
  insuranceInfo?: {
    provider: string;
    policyNumber: string;
    groupNumber?: string;
  };
  assignedDoctorId?: string;
  lookingForSpecialization?: string;
  // Set once staff have seen the phone-duplicate warning and chosen to create anyway.
  confirmDuplicate?: boolean;
}

export interface UpdatePatientData {
  name?: string;
  email?: string;
  phone?: string;
  secondaryPhone?: string;
  dateOfBirth?: string;
  gender?: GENDER;
  bloodGroup?: string;
  address?: string;
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
  medicalHistory?: string[];
  allergies?: string[];
  currentMedications?: string[];
  insuranceInfo?: {
    provider: string;
    policyNumber: string;
    groupNumber?: string;
  };
  status?: "active" | "inactive" | "archived";
  assignedDoctorId?: string;
  lookingForSpecialization?: string;
}
