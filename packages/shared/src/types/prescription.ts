import type { FoodTiming } from "./medicine";

export type HowOften = "1-0-0" | "0-0-1" | "1-0-1" | "1-1-1" | "SOS";

export const HOW_OFTEN_OPTIONS: {
  value: HowOften;
  label: string;
  timesPerDay: number;
}[] = [
  { value: "1-0-0", label: "1-0-0", timesPerDay: 1 },
  { value: "0-0-1", label: "0-0-1", timesPerDay: 1 },
  { value: "1-0-1", label: "1-0-1", timesPerDay: 2 },
  { value: "1-1-1", label: "1-1-1", timesPerDay: 3 },
  { value: "SOS", label: "SOS", timesPerDay: 0 },
];

export const DAYS_PRESET_OPTIONS = [3, 5, 7, 10] as const;

// Structured authoring source for a prescription item's dose. Optional so a
// prescription signed before this existed keeps rendering from its old
// dose/frequency/duration/quantity strings — see prescriptionDose.ts.
export interface PrescriptionItemStructuredDose {
  howOften: HowOften;
  foodTiming: FoodTiming;
  days: number;
  dispenseQty: number;
  dispenseOverridden?: boolean;
}

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
  structuredDose?: PrescriptionItemStructuredDose;
}

export interface AllergyOverride {
  medicineId: string;
  medicineName: string;
  matchedAllergyTerm: string;
  reason: string;
  overriddenAt: string;
}

export type PrescriptionStatus = "draft" | "signed";

export type FollowUpOption = "none" | "1-week" | "2-weeks" | "1-month";

export const FOLLOW_UP_REVIEW_OPTIONS: { value: FollowUpOption; label: string }[] = [
  { value: "none", label: "None" },
  { value: "1-week", label: "1 week" },
  { value: "2-weeks", label: "2 weeks" },
  { value: "1-month", label: "1 month" },
];

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
  rxNumber?: string;
  followUpOption?: FollowUpOption;
  followUpAppointmentId?: string;
  issuedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SavePrescriptionData {
  items: PrescriptionItem[];
  allergyOverrides: AllergyOverride[];
  advice?: string;
  followUpOption?: FollowUpOption;
}
