import {
  HOSPITAL_MODULE,
  HOSPITAL_MODULE_DEPENDENCIES,
  HOSPITAL_MODULE_PLAN_FEATURE,
  HOSPITAL_MODULE_VALUES,
} from '../constants';

// Why a module isn't usable, in precedence order: the plan withholds it
// (only a platform admin can change that), the hospital admin switched it
// off, or something it builds on is unusable.
export type HospitalModuleDisabledReason = 'plan' | 'switched_off' | 'requires';

export interface ResolvedHospitalModule {
  key: HOSPITAL_MODULE;
  // The hospital admin's own switch — what the Features screen toggles.
  switchedOn: boolean;
  // Whether the module can actually be used right now.
  enabled: boolean;
  disabledReason?: HospitalModuleDisabledReason;
  // For 'requires': the dependency that's unusable.
  blockedBy?: HOSPITAL_MODULE;
}

export function resolveHospitalModules(
  saved: unknown,
  planFeatures: Record<string, boolean | undefined> | undefined,
): Record<HOSPITAL_MODULE, ResolvedHospitalModule> {
  const switches = saved && typeof saved === 'object' ? (saved as Record<string, unknown>) : {};
  const resolved = {} as Record<HOSPITAL_MODULE, ResolvedHospitalModule>;

  // HOSPITAL_MODULE_DEPENDENCIES is acyclic, so plain memoized recursion
  // resolves every module regardless of declaration order.
  const resolve = (key: HOSPITAL_MODULE): ResolvedHospitalModule => {
    if (resolved[key]) return resolved[key];

    const switchedOn = switches[key] !== false;
    const planFeature = HOSPITAL_MODULE_PLAN_FEATURE[key];
    let result: ResolvedHospitalModule;

    if (planFeature && planFeatures?.[planFeature] === false) {
      result = { key, switchedOn, enabled: false, disabledReason: 'plan' };
    } else if (!switchedOn) {
      result = { key, switchedOn, enabled: false, disabledReason: 'switched_off' };
    } else {
      const blockedBy = (HOSPITAL_MODULE_DEPENDENCIES[key] ?? []).find((dep) => !resolve(dep).enabled);
      result = blockedBy
        ? { key, switchedOn, enabled: false, disabledReason: 'requires', blockedBy }
        : { key, switchedOn, enabled: true };
    }

    resolved[key] = result;
    return result;
  };

  HOSPITAL_MODULE_VALUES.forEach(resolve);
  return resolved;
}

export function isHospitalModuleEnabled(
  module: HOSPITAL_MODULE,
  saved: unknown,
  planFeatures: Record<string, boolean | undefined> | undefined,
): boolean {
  return resolveHospitalModules(saved, planFeatures)[module].enabled;
}
