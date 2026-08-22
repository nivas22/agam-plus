export type HolidayClosureType = "full" | "opd_closed" | "half_day";

export type HolidayResolutionAction = "move" | "cancel" | "keep";

export interface HospitalHoliday {
  id: string;
  hospitalId: string;
  name: string;
  startsOn: string;
  endsOn: string;
  closureType: HolidayClosureType;
  halfDayUntil?: string;
  repeatsAnnually: boolean;
  exceptionDoctorIds: string[];
  status: "active" | "removed";
  sourceHolidayId?: string;
  createdBy?: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
  bookedCount: number;
  isPast: boolean;
}

export interface PendingHolidayRepeat {
  name: string;
  fromYear: number;
}

export interface HospitalHolidayListResponse {
  holidays: HospitalHoliday[];
  pendingRepeats: PendingHolidayRepeat[];
}

export interface HolidayDraft {
  startsOn: string;
  endsOn?: string;
  closureType: HolidayClosureType;
  halfDayUntil?: string;
  exceptionDoctorIds: string[];
}

export interface HolidayImpactAppointmentRow {
  appointmentId: string;
  patientName: string;
  patientPhone?: string;
  time: string;
  type: "regular" | "package";
  packageId?: string;
  packageVisitNumber?: number;
  defaultAction: HolidayResolutionAction;
  proposedSlot: { date: string; time: string } | null;
  reason: string | null;
}

export interface HolidayImpactDoctorGroup {
  doctorProfileId: string;
  doctorName?: string;
  worksThatDay: boolean;
  appointments: HolidayImpactAppointmentRow[];
}

export interface HolidayImpactPreview {
  startsOn: string;
  endsOn: string;
  counts: { moved: number; cancelled: number; kept: number };
  doctors: HolidayImpactDoctorGroup[];
}

export interface HolidayResolution {
  appointmentId: string;
  action: HolidayResolutionAction;
  newDate?: string;
  newTime?: string;
}

export interface CreateHospitalHolidayData {
  name: string;
  startsOn: string;
  endsOn?: string;
  closureType: HolidayClosureType;
  halfDayUntil?: string;
  repeatsAnnually: boolean;
  exceptionDoctorIds: string[];
  resolutions: HolidayResolution[];
}

export interface UpdateHospitalHolidayData {
  name?: string;
  closureType?: HolidayClosureType;
  halfDayUntil?: string;
  repeatsAnnually?: boolean;
  exceptionDoctorIds?: string[];
}

export const HOLIDAY_CLOSURE_TYPE_OPTIONS: {
  value: HolidayClosureType;
  label: string;
  description: string;
}[] = [
  {
    value: "full",
    label: "Closed all day",
    description: "No bookings at all. Emergency handled elsewhere.",
  },
  {
    value: "opd_closed",
    label: "OPD closed — emergency open",
    description: "No appointments, but the hospital is staffed.",
  },
  {
    value: "half_day",
    label: "Half day",
    description: "Morning slots only. Everything after a cut-off closes.",
  },
];
