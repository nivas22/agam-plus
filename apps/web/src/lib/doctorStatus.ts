export interface DoctorStatusConfig {
  dot: string;
  bg: string;
  text: string;
  label: string;
}

export const DOCTOR_STATUS_CONFIG: Record<string, DoctorStatusConfig> = {
  approved: { dot: 'bg-status-open', bg: 'bg-status-open-soft', text: 'text-status-open', label: 'Approved' },
  pending: { dot: 'bg-status-warning', bg: 'bg-status-warning-soft', text: 'text-status-warning', label: 'Pending' },
  rejected: { dot: 'bg-status-danger', bg: 'bg-status-danger-soft', text: 'text-status-danger', label: 'Rejected' },
  inactive: { dot: 'bg-ink-500', bg: 'bg-surface-canvas', text: 'text-ink-500', label: 'Inactive' },
};

export function doctorStatusConfig(status?: string): DoctorStatusConfig {
  return (status && DOCTOR_STATUS_CONFIG[status]) || DOCTOR_STATUS_CONFIG.pending;
}
