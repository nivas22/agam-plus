export interface AuditLogEntry {
  id: string;
  hospitalId: string;
  at: string;
  actorUserId: string;
  actorName: string;
  actorRole: string;
  action: string;
  area: "money" | "appointments" | "settings" | "access" | "patients";
  summary: string;
  detail?: Record<string, any>;
  amount?: number;
}

export interface ApprovalActor {
  userId: string;
  name: string;
  role: string;
}

export interface ApprovalRequest {
  id: string;
  hospitalId: string;
  action: string;
  status: "pending" | "approved" | "declined";
  requestedBy: ApprovalActor;
  requestedAt: string;
  reason?: string;
  payload: Record<string, any>;
  resolvedBy?: ApprovalActor;
  resolvedAt?: string;
  resolutionNote?: string;
}
