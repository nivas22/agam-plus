export interface PatientStatusConfig {
  dot: string;
  bg: string;
  text: string;
  label: string;
}

export const PATIENT_STATUS_CONFIG: Record<string, PatientStatusConfig> = {
  approved: { dot: 'bg-status-open', bg: 'bg-status-open-soft', text: 'text-status-open', label: 'Active' },
  active: { dot: 'bg-status-open', bg: 'bg-status-open-soft', text: 'text-status-open', label: 'Active' },
  pending: { dot: 'bg-status-warning', bg: 'bg-status-warning-soft', text: 'text-status-warning', label: 'Pending' },
  inactive: { dot: 'bg-status-danger', bg: 'bg-status-danger-soft', text: 'text-status-danger', label: 'Inactive' },
  archived: { dot: 'bg-ink-500', bg: 'bg-surface-canvas', text: 'text-ink-500', label: 'Archived' },
};

export function patientStatusConfig(status?: string): PatientStatusConfig {
  return (status && PATIENT_STATUS_CONFIG[status]) || PATIENT_STATUS_CONFIG.inactive;
}
