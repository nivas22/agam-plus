export type PermissionState = "allowed" | "needs_approval" | "blocked";

export interface PermissionActionDef {
  key: string;
  group: "appointments" | "money" | "packages" | "patients" | "prescriptions";
  label: string;
  description: string;
  readOnly?: boolean;
  unenforced?: boolean;
  state: PermissionState;
}

export interface PermissionTally {
  allowed: number;
  needsApproval: number;
  blocked: number;
}

export interface RolePermissionSummary {
  role: string;
  catalog: PermissionActionDef[];
  discountCapAmount?: number;
  tally: PermissionTally;
  editable: boolean;
}

export const GROUP_LABELS: Record<string, string> = {
  appointments: "Appointments",
  money: "Money",
  packages: "Packages",
  patients: "Patients & records",
  prescriptions: "Prescriptions",
};

export const ROLE_LABELS: Record<string, string> = {
  admin: "Hospital admin",
  doctor: "Doctor",
  front_desk: "Front desk",
  nurse: "Nurse",
  accountant: "Accountant",
};
