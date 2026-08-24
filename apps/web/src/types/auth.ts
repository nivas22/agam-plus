import type { Doctor, HospitalMember } from "./doctorNew";

// Types
export type ROLE = "admin" | "doctor" | "patient" | string;
export type STATUS = "approved" | "pending" | "active" | string;

export interface AppUser {
  id: string;
  uid: string;
  email: string;
  name: string;
  role: string;
  status: string;
  isPlatformAdmin?: boolean;
  authUid?: string;
  isShadow?: boolean;
  originalDocId?: string;
  lastLogin?: any;
  createdAt?: any;
  isNewUser?: boolean;
  [key: string]: any;
}

export interface Hospital {
  id: string;
  name: string;
  address: string;
  phone?: string;
  email?: string;
  website?: string;
  description?: string;
  createdAt: any;
}

export type LoginSuccess = {
  success: true;
  userData: AppUser;
  role: ROLE;
  hospitals: HospitalMember[];
  currentHospital?: Hospital;
};

export type LoginError = {
  success: false;
  message: string;
};

export interface AuthData {
  user: AppUser;
  hospitals: HospitalMember[];
  currentHospital?: Hospital;
}

export interface AuthError {
  message: string;
  code?: string;
}

export interface UserProfile {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone?: string;
  currentHospital: Hospital;
  role: ROLE;
  status: STATUS;
  doctorProfile?: Doctor;
}
