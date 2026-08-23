import type { FoodTiming } from "./medicine";

export interface PrescriptionItem {
  medicineId: string;
  medicineName: string;
  strength?: string;
  form?: string;
  dose: string;
  frequency?: string;
  foodTiming?: FoodTiming;
  duration?: string;
  quantity?: string;
  note?: string;
}

export interface AllergyOverride {
  medicineId: string;
  medicineName: string;
  matchedAllergyTerm: string;
  reason: string;
  overriddenAt: string;
}

export type PrescriptionStatus = "draft" | "signed";

export interface Prescription {
  id: string;
  hospitalId: string;
  appointmentId: string;
  patientId: string;
  doctorProfileId: string;
  patientName?: string;
  doctorName?: string;
  items: PrescriptionItem[];
  allergyOverrides: AllergyOverride[];
  advice?: string;
  status: PrescriptionStatus;
  issuedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SavePrescriptionData {
  items: PrescriptionItem[];
  allergyOverrides: AllergyOverride[];
  advice?: string;
}
