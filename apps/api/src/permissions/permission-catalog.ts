import { PERMISSION_STATE, ROLE } from '../constants';

export interface PermissionActionDef {
  key: string;
  group: 'appointments' | 'money' | 'packages' | 'patients' | 'prescriptions';
  label: string;
  description: string;
  // Read-type actions can only be ALLOWED/BLOCKED — there's no natural way to
  // queue a read for approval, so NEEDS_APPROVAL collapses to BLOCKED for these.
  readOnly?: boolean;
  // True for actions with no backend enforcement hook yet — the row still
  // persists in the matrix (for completeness / future use) but has no
  // runtime effect. See the plan's "known deviations" note.
  unenforced?: boolean;
}

export const PERMISSION_CATALOG: PermissionActionDef[] = [
  { key: 'see_schedule', group: 'appointments', label: 'See the schedule', description: 'All doctors, all days', readOnly: true, unenforced: true },
  { key: 'book_reschedule', group: 'appointments', label: 'Book & reschedule', description: 'Including package series' },
  { key: 'cancel_no_show', group: 'appointments', label: 'Cancel & mark no-show', description: 'Returns package credits automatically' },
  { key: 'delete_appointment', group: 'appointments', label: 'Delete an appointment', description: 'Removes it from history entirely' },

  { key: 'collect_payment', group: 'money', label: 'Collect payment', description: 'Cash, UPI, split, mark as due' },
  { key: 'apply_discount', group: 'money', label: 'Apply a discount', description: 'On the visit bill' },
  { key: 'issue_refund', group: 'money', label: 'Issue a refund', description: 'Money leaving the building' },
  { key: 'close_day', group: 'money', label: 'Close the day', description: 'Counts the drawer and locks invoices' },
  { key: 'edit_closed_invoice', group: 'money', label: 'Edit a closed invoice', description: 'Nobody gets this — refund instead' },

  { key: 'sell_package', group: 'packages', label: 'Sell a package', description: 'Takes payment upfront' },
  { key: 'extend_expired_package', group: 'packages', label: 'Extend an expired package', description: 'Gives away visits already lapsed' },

  { key: 'add_edit_patients', group: 'patients', label: 'Add & edit patients', description: 'Contact details, not clinical data' },
  { key: 'read_session_notes', group: 'patients', label: 'Read session notes', description: 'What the doctor wrote during a visit', readOnly: true },
  { key: 'merge_duplicate_patients', group: 'patients', label: 'Merge duplicate patients', description: 'Moves visits, dues and packages', unenforced: true },

  { key: 'write_prescription', group: 'prescriptions', label: 'Write & edit prescriptions', description: 'Add medicines, override allergy warnings' },
  { key: 'manage_medicine_catalog', group: 'prescriptions', label: 'Manage the medicine catalog', description: 'Add/edit/archive medicines and their allergy tags' },
];

export type PermissionMatrix = Record<string, PERMISSION_STATE>;

const { ALLOWED, NEEDS_APPROVAL, BLOCKED } = PERMISSION_STATE;

const allAllowedExceptClosedInvoice: PermissionMatrix = Object.fromEntries(
  PERMISSION_CATALOG.map((a) => [a.key, a.key === 'edit_closed_invoice' ? BLOCKED : ALLOWED]),
);

// Doctor's default mirrors what's actually true in the codebase today (see
// the enforcement map in the plan) so introducing this permission layer
// doesn't regress any existing doctor workflow.
const DOCTOR_DEFAULTS: PermissionMatrix = { ...allAllowedExceptClosedInvoice };

const FRONT_DESK_DEFAULTS: PermissionMatrix = {
  see_schedule: ALLOWED,
  book_reschedule: ALLOWED,
  cancel_no_show: ALLOWED,
  delete_appointment: BLOCKED,
  collect_payment: ALLOWED,
  apply_discount: NEEDS_APPROVAL,
  issue_refund: NEEDS_APPROVAL,
  close_day: BLOCKED,
  edit_closed_invoice: BLOCKED,
  sell_package: ALLOWED,
  extend_expired_package: NEEDS_APPROVAL,
  add_edit_patients: ALLOWED,
  read_session_notes: BLOCKED,
  merge_duplicate_patients: NEEDS_APPROVAL,
  write_prescription: BLOCKED,
  manage_medicine_catalog: BLOCKED,
};

const NURSE_DEFAULTS: PermissionMatrix = {
  see_schedule: ALLOWED,
  book_reschedule: ALLOWED,
  cancel_no_show: ALLOWED,
  delete_appointment: BLOCKED,
  collect_payment: BLOCKED,
  apply_discount: BLOCKED,
  issue_refund: BLOCKED,
  close_day: BLOCKED,
  edit_closed_invoice: BLOCKED,
  sell_package: BLOCKED,
  extend_expired_package: BLOCKED,
  add_edit_patients: ALLOWED,
  read_session_notes: BLOCKED,
  merge_duplicate_patients: BLOCKED,
  write_prescription: BLOCKED,
  manage_medicine_catalog: BLOCKED,
};

const ACCOUNTANT_DEFAULTS: PermissionMatrix = {
  see_schedule: ALLOWED,
  book_reschedule: BLOCKED,
  cancel_no_show: BLOCKED,
  delete_appointment: BLOCKED,
  collect_payment: BLOCKED,
  apply_discount: BLOCKED,
  issue_refund: BLOCKED,
  close_day: ALLOWED,
  edit_closed_invoice: BLOCKED,
  sell_package: BLOCKED,
  extend_expired_package: BLOCKED,
  add_edit_patients: BLOCKED,
  read_session_notes: BLOCKED,
  merge_duplicate_patients: BLOCKED,
  write_prescription: BLOCKED,
  manage_medicine_catalog: BLOCKED,
};

// Owner/admin are never looked up here — PermissionsService short-circuits
// both to ALLOWED unconditionally (see the "known deviations" note: Owner
// and Hospital admin are not editable in the matrix).
export const DEFAULT_PERMISSION_MATRIX: Record<string, PermissionMatrix> = {
  [ROLE.ADMIN]: allAllowedExceptClosedInvoice,
  [ROLE.DOCTOR]: DOCTOR_DEFAULTS,
  [ROLE.FRONT_DESK]: FRONT_DESK_DEFAULTS,
  [ROLE.NURSE]: NURSE_DEFAULTS,
  [ROLE.ACCOUNTANT]: ACCOUNTANT_DEFAULTS,
};

export const DEFAULT_DISCOUNT_CAP: Record<string, number | undefined> = {
  [ROLE.FRONT_DESK]: 100,
};

// Roles that can be assigned to a Team member being created/edited from the
// Team UI — excludes 'admin' (Owner/Hospital admin are managed separately)
// and 'patient'/'doctor' (their own dedicated flows).
export const TEAM_ASSIGNABLE_ROLES = [ROLE.FRONT_DESK, ROLE.NURSE, ROLE.ACCOUNTANT];

export function isEditableRole(role: string): boolean {
  return role in DEFAULT_PERMISSION_MATRIX && role !== ROLE.ADMIN;
}
