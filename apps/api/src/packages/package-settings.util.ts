import { DEFAULT_PACKAGE_SETTINGS } from '../constants';
import type { PackageSettings } from '../constants';

// Fills in defaults for anything a hospital hasn't saved, so callers always
// get a complete, sane PackageSettings. Tiers are de-duplicated and sorted
// so the sell dialog shows them smallest-first.
export function resolvePackageSettings(saved: unknown): PackageSettings {
  const s = (saved && typeof saved === 'object' ? saved : {}) as Partial<PackageSettings>;

  const visitTiers = Array.isArray(s.visitTiers)
    ? Array.from(new Set(s.visitTiers.filter((n) => Number.isInteger(n) && n > 0))).sort((a, b) => a - b)
    : [];

  return {
    discountEnabled:
      typeof s.discountEnabled === 'boolean' ? s.discountEnabled : DEFAULT_PACKAGE_SETTINGS.discountEnabled,
    discountPercent:
      typeof s.discountPercent === 'number' && s.discountPercent >= 0
        ? s.discountPercent
        : DEFAULT_PACKAGE_SETTINGS.discountPercent,
    visitTiers: visitTiers.length ? visitTiers : [...DEFAULT_PACKAGE_SETTINGS.visitTiers],
    validityMonths:
      typeof s.validityMonths === 'number' && s.validityMonths > 0
        ? s.validityMonths
        : DEFAULT_PACKAGE_SETTINGS.validityMonths,
  };
}
