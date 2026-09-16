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

// Singular unit noun per form, in English and Tamil — used both for the
// "N tablets" dispense-quantity display and the bilingual per-medicine
// instruction line (see prescriptionInstructionTemplate.ts).
export const MEDICINE_FORM_UNIT_NOUN: Record<
  MedicineForm,
  { en: string; ta: string }
> = {
  tablet: { en: "tablet", ta: "மாத்திரை" },
  capsule: { en: "capsule", ta: "காப்சூல்" },
  syrup: { en: "spoon", ta: "ஸ்பூன்" },
  injection: { en: "dose", ta: "ஊசி" },
  drops: { en: "drop", ta: "சொட்டு" },
  ointment: { en: "application", ta: "பூச்சு" },
  inhaler: { en: "puff", ta: "புஃப்" },
  other: { en: "dose", ta: "மருந்தளவு" },
};

// "" (OTC / unclassified) is the default — most medicines carry no schedule.
export const SCHEDULE_CLASS_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "None (OTC)" },
  { value: "H", label: "Schedule H" },
  { value: "H1", label: "Schedule H1" },
  { value: "X", label: "Schedule X" },
];

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
  brandNames?: string[];
  scheduleClass?: string;
  isFavourite?: boolean;
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
  brandNames?: string[];
  scheduleClass?: string;
}

// isFavourite is update-only — nothing is created as a favourite, it's
// toggled afterwards from the catalog.
export type UpdateMedicineData = Partial<CreateMedicineData> & {
  isFavourite?: boolean;
};
