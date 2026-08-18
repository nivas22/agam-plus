import { GENDER } from '@agam-plus/shared';

export interface Patient {
  id: string;
  userId: string;
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
  status: 'active' | 'inactive' | 'archived' | 'approved' | 'pending';
  createdAt: any;
  updatedAt?: any;
  createdBy?: string;
  notes?: string;
  membershipId?: string | undefined;
  lookingForSpecialization?: string;
}
