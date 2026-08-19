export interface DoctorStatusConfig {
  dot: string;
  bg: string;
  text: string;
  label: string;
}

export const DOCTOR_STATUS_CONFIG: Record<string, DoctorStatusConfig> = {
  approved: { dot: 'bg-emerald-500', bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Approved' },
  pending: { dot: 'bg-amber-500', bg: 'bg-amber-100', text: 'text-amber-700', label: 'Pending' },
  rejected: { dot: 'bg-rose-500', bg: 'bg-rose-100', text: 'text-rose-700', label: 'Rejected' },
  inactive: { dot: 'bg-slate-400', bg: 'bg-slate-100', text: 'text-slate-600', label: 'Inactive' },
};

export function doctorStatusConfig(status?: string): DoctorStatusConfig {
  return (status && DOCTOR_STATUS_CONFIG[status]) || DOCTOR_STATUS_CONFIG.pending;
}
