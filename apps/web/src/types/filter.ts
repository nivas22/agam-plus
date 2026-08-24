export interface PageFilter {
  APPOINTMENT: string;
}

export interface FilterOption {
  id: string;
  label: string;
  shortLabel: string;
  color: string;
  textColor: string;
}

export const PageFilterOptions = {
  PATIENT: "patient",
  DOCTOR: "doctor",
  APPOINTMENT: "appointment",
};

export const GenderFilterOptions = {
  ALL: "all",
  MALE: "GENDER.MALE",
  FEMALE: "GENDER.FEMALE",
  OTHER: "GENDER.OTHER",
};

export const StatusFilterOptions = {
  ALL: "all",
  ACTIVE: "active",
  INACTIVE: "inactive",
  PENDING: "pending",
};
