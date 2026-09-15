/**
 * Queue-facing appointment shape.
 *
 * Deliberately narrower than `Appointment` in @agam/shared: ordering only
 * needs identity, how the patient got here, and two timestamps. The extra
 * fields below that are what the four screens render.
 */
export interface Appointment {
  id: string;
  /** Token number the desk gives the patient. */
  token: number;
  name: string;
  ageSex: string;
  reason: string;

  /** How the patient reached today's list. Drives the fairness rule. */
  source: 'booked' | 'walk_in';
  /** ISO timestamp the desk checked them in. Absent until they arrive. */
  checkedInAt?: string;
  /** ISO timestamp of the booked slot. Absent for walk-ins. */
  scheduledStart?: string;

  /** Standing facts shown as tags on the queue row. */
  allergy?: string;
  packageProgress?: string;
  unpaidAmount?: number;
  room?: string;
  weightKg?: number;
}

export interface OrderedEntry {
  appointment: Appointment;
  readyAt: number;
  /** Human-readable justification for this position, shown to the doctor. */
  reason: string;
}
