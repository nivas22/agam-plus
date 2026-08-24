export const ROLE_BADGE_STYLES: Record<string, string> = {
  admin: "bg-brand-violet-soft text-brand-violet",
  doctor: "bg-status-open-soft text-status-open",
  front_desk: "bg-status-warning-soft text-status-warning",
  nurse: "bg-status-open-soft text-status-open",
  accountant: "bg-[#f2ebfd] text-[#7a3fd0]",
};

export const ROLE_AVATAR_COLORS: Record<string, string> = {
  admin: "#161A2E",
  doctor: "#0D8F7C",
  front_desk: "#B4600B",
  nurse: "#0D8F7C",
  accountant: "#7a3fd0",
};

export const ROLE_LABELS: Record<string, string> = {
  admin: "Hospital admin",
  doctor: "Doctor",
  front_desk: "Front desk",
  nurse: "Nurse",
  accountant: "Accountant",
};

export function initials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
