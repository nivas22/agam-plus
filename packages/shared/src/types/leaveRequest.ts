// types/leaveRequest.ts
export type LeaveRequestStatus = "pending" | "approved" | "declined";

export interface LeaveRequestActor {
  userId: string;
  name: string;
  role: string;
  // Set on requestedBy: the requester practises (doctor role, or an admin who
  // also sees patients), so their leave affects appointments. Missing on
  // older rows — fall back to role === "doctor".
  isDoctor?: boolean;
}

export interface LeaveRequest {
  id: string;
  hospitalId: string;
  doctorProfileId: string;
  doctorName?: string;
  startDate: string;
  endDate: string;
  reason?: string;
  affectedAppointmentCount: number;
  status: LeaveRequestStatus;
  requestedBy: LeaveRequestActor;
  requestedAt: string;
  resolvedBy?: LeaveRequestActor;
  resolvedAt?: string;
  resolutionNote?: string;
  lastNudgedAt?: string;
  // Set on approval: how each booked appointment in the range was cleared.
  appointmentResolutions?: {
    appointmentId: string;
    patientName?: string;
    action: "reassign" | "reschedule";
    from: { date: string; time: string };
    to: { doctorProfileId: string; doctorName: string; date: string; time: string };
  }[];
  createdAt?: string;
  updatedAt?: string;
}

export interface LeaveRequestImpactPreview {
  startDate: string;
  endDate: string;
  affectedAppointmentCount: number;
}

export interface CreateLeaveRequestData {
  startDate: string;
  endDate: string;
  reason?: string;
}

// Admin approval: every still-booked appointment inside the leave has to be
// handed to another doctor or rescheduled before the API will approve.
export interface LeaveDoctorOption {
  doctorProfileId: string;
  name: string;
}

export interface LeaveAffectedAppointment {
  appointmentId: string;
  patientName?: string;
  patientPhone?: string;
  date: string;
  time: string;
  type?: string;
  status: string;
  // Other doctors with room at this exact date+time.
  alternativeDoctors: LeaveDoctorOption[];
  // The requester's next open slot after the leave, if any within 4 weeks.
  suggestedSlot: { date: string; time: string } | null;
}

export interface LeaveAffectedAppointments {
  appointments: LeaveAffectedAppointment[];
  doctors: LeaveDoctorOption[];
}

export type LeaveAppointmentResolution =
  | { appointmentId: string; action: "reassign"; newDoctorProfileId: string }
  | {
      appointmentId: string;
      action: "reschedule";
      newDate: string;
      newTime: string;
    };

// One approved absence, as every role sees it (no reason or notes).
export interface OnLeaveEntry {
  id: string;
  userId: string;
  name?: string;
  role: string;
  isDoctor?: boolean;
  startDate: string;
  endDate: string;
}
