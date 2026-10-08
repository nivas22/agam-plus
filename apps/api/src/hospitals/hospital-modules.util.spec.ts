import { HOSPITAL_MODULE, HOSPITAL_MODULE_DEFAULT_OFF, HOSPITAL_MODULE_VALUES } from '../constants';
import { isHospitalModuleEnabled, resolveHospitalModules } from './hospital-modules.util';

describe('resolveHospitalModules', () => {
  it('enables every module except the opt-in ones when nothing is saved', () => {
    const resolved = resolveHospitalModules(undefined, undefined);
    const regular = HOSPITAL_MODULE_VALUES.filter((key) => !HOSPITAL_MODULE_DEFAULT_OFF.has(key));
    expect(regular.every((key) => resolved[key].enabled && resolved[key].switchedOn)).toBe(true);
    expect(resolved[HOSPITAL_MODULE.QUEUE_V2]).toEqual({
      key: HOSPITAL_MODULE.QUEUE_V2,
      switchedOn: false,
      enabled: false,
      disabledReason: 'switched_off',
    });
  });

  it('turns an opt-in module on only with an explicit true, and still needs its dependency', () => {
    expect(resolveHospitalModules({ queueV2: true }, undefined)[HOSPITAL_MODULE.QUEUE_V2].enabled).toBe(true);
    expect(resolveHospitalModules({ queueV2: true, queue: false }, undefined)[HOSPITAL_MODULE.QUEUE_V2]).toMatchObject({
      switchedOn: true,
      enabled: false,
      blockedBy: HOSPITAL_MODULE.QUEUE,
    });
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

  it('lets the plan withhold any module, cascading to dependents', () => {
    const resolved = resolveHospitalModules(undefined, { payments: false });
    expect(resolved[HOSPITAL_MODULE.PAYMENTS]).toMatchObject({ enabled: false, disabledReason: 'plan' });
    expect(resolved[HOSPITAL_MODULE.CHARGE_CATALOG]).toMatchObject({ enabled: false, blockedBy: HOSPITAL_MODULE.PAYMENTS });
    expect(resolved[HOSPITAL_MODULE.AUDIT].enabled).toBe(true);
  });

  it('puts the platform release status above the plan and the switch', () => {
    const resolved = resolveHospitalModules(
      { reports: false },
      { reports: false, audit: false },
      { reports: 'coming_soon', audit: 'hidden', queue: 'available' },
    );
    expect(resolved[HOSPITAL_MODULE.REPORTS]).toMatchObject({ enabled: false, disabledReason: 'coming_soon' });
    expect(resolved[HOSPITAL_MODULE.AUDIT]).toMatchObject({ enabled: false, disabledReason: 'hidden' });
    expect(resolved[HOSPITAL_MODULE.QUEUE].enabled).toBe(true);
  });

  it('blocks dependents of a coming-soon module', () => {
    expect(
      resolveHospitalModules(undefined, undefined, { medicines: 'coming_soon' })[HOSPITAL_MODULE.MEDICINE_PACKS],
    ).toMatchObject({ enabled: false, disabledReason: 'requires', blockedBy: HOSPITAL_MODULE.MEDICINES });
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
