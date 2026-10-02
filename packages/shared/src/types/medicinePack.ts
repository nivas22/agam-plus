import type { FoodTiming } from "./medicine";
import type { HowOften } from "./prescription";

export interface MedicinePackItem {
  medicineId: string;
  medicineName: string;
  howOften: HowOften;
  foodTiming: FoodTiming;
  days: number;
  note?: string;
}

export type MedicinePackStatus = "active" | "archived";

export interface MedicinePack {
  id: string;
  hospitalId: string;
  name: string;
  items: MedicinePackItem[];
  status: MedicinePackStatus;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MedicinePackListResponse {
  items: MedicinePack[];
  counts: Record<string, number>;
}

export interface CreateMedicinePackData {
  name: string;
  items: MedicinePackItem[];
}

export type UpdateMedicinePackData = Partial<CreateMedicinePackData>;
