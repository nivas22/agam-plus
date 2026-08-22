export type TeamRole = "front_desk" | "nurse" | "accountant";

export const TEAM_ROLE_OPTIONS: { value: TeamRole; label: string; description: string }[] = [
  {
    value: "front_desk",
    label: "Front desk",
    description: "Books, collects payment, sells packages. Refunds need approval",
  },
  {
    value: "nurse",
    label: "Nurse",
    description: "Sees the day's schedule and patient basics. No money, no notes",
  },
  {
    value: "accountant",
    label: "Accountant",
    description: "Read-only on everything, plus day close and exports",
  },
];

export const SHIFT_OPTIONS = [
  { value: "morning", label: "Morning · 8 am – 2 pm" },
  { value: "evening", label: "Evening · 2 – 9 pm" },
  { value: "full_day", label: "Full day" },
  { value: "part_time", label: "Part time" },
];

export type TeamMemberStatus = "invited" | "active" | "suspended" | "deactivated";

export interface TeamMember {
  id: string;
  userId: string;
  hospitalId: string;
  name: string;
  email: string;
  phone?: string;
  employeeId: string;
  role: TeamRole;
  shift?: string | null;
  startDate?: string | null;
  handlesCash: boolean;
  pinSet: boolean;
  status: TeamMemberStatus;
  joinedAt?: string | null;
}

export interface TeamMemberStats {
  collectedThisMonth: number;
  collectedCount: number;
  refundsRequested: number;
  drawerVarianceTotal: number;
  drawerVarianceDays: number;
}

export interface TeamMemberProfileResponse extends TeamMember {
  stats: TeamMemberStats;
  attendance: Record<string, boolean>;
  permissions: import("./permissions").RolePermissionSummary;
}

export interface CreateTeamMemberData {
  name: string;
  email: string;
  phone: string;
  role: TeamRole;
  shift?: string;
  startDate?: string;
  handlesCash: boolean;
  invitedVia?: "whatsapp" | "sms" | "email";
  confirmDuplicate?: boolean;
}

export interface UpdateTeamMemberData {
  name?: string;
  email?: string;
  phone?: string;
  role?: TeamRole;
  shift?: string;
  handlesCash?: boolean;
}
