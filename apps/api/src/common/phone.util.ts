// Historical Patient.phone values are free-text with no format validation, so
// normalize to the last 10 digits at every write site (PatientAccount and new
// Patient records) to keep auto-link matching reliable going forward.
// Pre-existing inconsistently-formatted Patient docs are NOT backfilled here.
export function normalizePhone(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '');
  return digits.slice(-10);
}
