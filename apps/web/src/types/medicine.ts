export type MedicineForm =
  | "tablet"
  | "capsule"
  | "syrup"
  | "injection"
  | "drops"
  | "ointment"
  | "inhaler"
  | "other";

export const MEDICINE_FORM_OPTIONS: { value: MedicineForm; label: string }[] = [
  { value: "tablet", label: "Tablet" },
  { value: "capsule", label: "Capsule" },
  { value: "syrup", label: "Syrup" },
  { value: "injection", label: "Injection" },
  { value: "drops", label: "Drops" },
  { value: "ointment", label: "Ointment" },
  { value: "inhaler", label: "Inhaler" },
  { value: "other", label: "Other" },
];

export type FoodTiming = "before_food" | "after_food" | "with_food" | "anytime";

export const FOOD_TIMING_OPTIONS: { value: FoodTiming; label: string }[] = [
  { value: "before_food", label: "Before food" },
  { value: "after_food", label: "After food" },
  { value: "with_food", label: "With food" },
  { value: "anytime", label: "Anytime" },
];

export type MedicineStatus = "active" | "archived";

export interface Medicine {
  id: string;
  hospitalId: string;
  name: string;
  genericName?: string;
  classes: string[];
  form: MedicineForm;
  strength?: string;
  defaultDose?: string;
  defaultFrequency?: string;
  defaultFoodTiming?: FoodTiming;
  status: MedicineStatus;
  createdAt: string;
  updatedAt: string;
}

export interface MedicineListResponse {
  items: Medicine[];
  counts: Record<string, number>;
}

export interface CreateMedicineData {
  name: string;
  genericName?: string;
  classes: string[];
  form: MedicineForm;
  strength?: string;
  defaultDose?: string;
  defaultFrequency?: string;
  defaultFoodTiming?: FoodTiming;
}

export type UpdateMedicineData = Partial<CreateMedicineData>;
