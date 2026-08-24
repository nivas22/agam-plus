// types/leaveRequest.ts
export type LeaveRequestStatus = "pending" | "approved" | "declined";

export interface LeaveRequestActor {
  userId: string;
  name: string;
  role: string;
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
