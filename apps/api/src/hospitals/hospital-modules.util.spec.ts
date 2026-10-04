import { HOSPITAL_MODULE, HOSPITAL_MODULE_VALUES } from '../constants';
import { isHospitalModuleEnabled, resolveHospitalModules } from './hospital-modules.util';

describe('resolveHospitalModules', () => {
  it('enables every module when nothing is saved', () => {
    const resolved = resolveHospitalModules(undefined, undefined);
    expect(HOSPITAL_MODULE_VALUES.every((key) => resolved[key].enabled && resolved[key].switchedOn)).toBe(true);
  });

  it('treats only an explicit false as switched off', () => {
    const resolved = resolveHospitalModules({ reports: false, audit: true }, undefined);
    expect(resolved[HOSPITAL_MODULE.REPORTS]).toEqual({
      key: HOSPITAL_MODULE.REPORTS,
      switchedOn: false,
      enabled: false,
      disabledReason: 'switched_off',
    });
    expect(resolved[HOSPITAL_MODULE.AUDIT].enabled).toBe(true);
  });

  it('disables dependents transitively and names the blocking dependency', () => {
    const resolved = resolveHospitalModules({ appointments: false }, undefined);
    expect(resolved[HOSPITAL_MODULE.QUEUE]).toMatchObject({
      switchedOn: true,
      enabled: false,
      disabledReason: 'requires',
      blockedBy: HOSPITAL_MODULE.APPOINTMENTS,
    });
    expect(resolved[HOSPITAL_MODULE.PRESCRIPTIONS].blockedBy).toBe(HOSPITAL_MODULE.APPOINTMENTS);
    // Medicines don't depend on appointments.
    expect(resolved[HOSPITAL_MODULE.MEDICINES].enabled).toBe(true);
  });

  it('blocks prescriptions and medicine packs when medicines are off', () => {
    const resolved = resolveHospitalModules({ medicines: false }, undefined);
    expect(resolved[HOSPITAL_MODULE.PRESCRIPTIONS]).toMatchObject({ enabled: false, blockedBy: HOSPITAL_MODULE.MEDICINES });
    expect(resolved[HOSPITAL_MODULE.MEDICINE_PACKS]).toMatchObject({ enabled: false, blockedBy: HOSPITAL_MODULE.MEDICINES });
  });

  it('lets the plan override the hospital switch', () => {
    const resolved = resolveHospitalModules({ whatsapp: true }, { whatsapp: false });
    expect(resolved[HOSPITAL_MODULE.WHATSAPP]).toMatchObject({ switchedOn: true, enabled: false, disabledReason: 'plan' });
  });

  it('ignores plan features for modules the plan does not control', () => {
    expect(isHospitalModuleEnabled(HOSPITAL_MODULE.PAYMENTS, undefined, { whatsapp: false })).toBe(true);
  });
});

// Guards against a controller silently losing its module gate — the
// resolver above is only as good as the decorators that consult it.
describe('module-gated controllers', () => {
  it.each([
    ['packages', () => require('../packages/packages.controller').PackagesController, HOSPITAL_MODULE.PACKAGES],
    ['prescriptions', () => require('../prescriptions/prescriptions.controller').PrescriptionsController, HOSPITAL_MODULE.PRESCRIPTIONS],
    ['payments', () => require('../payments/payments.controller').PaymentsController, HOSPITAL_MODULE.PAYMENTS],
  ])('%s controller requires its module', (_name, load, module) => {
    const { Reflector } = require('@nestjs/core');
    const { REQUIRES_MODULE_KEY } = require('../auth/decorators/requires-module.decorator');
    expect(new Reflector().get(REQUIRES_MODULE_KEY, load())).toBe(module);
  });
});
