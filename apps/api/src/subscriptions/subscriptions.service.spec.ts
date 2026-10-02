import mongoose, { Model } from 'mongoose';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionRepository } from '../repositories/subscription.repository';
import { SubscriptionInvoiceRepository } from '../repositories/subscription-invoice.repository';
import { SubscriptionPlanConfigRepository } from '../repositories/subscription-plan-config.repository';
import { MembershipRepository } from '../repositories/membership.repository';
import { Subscription, SubscriptionDocument, SubscriptionSchema } from '../schemas/subscription.schema';
import {
  SubscriptionInvoice,
  SubscriptionInvoiceDocument,
  SubscriptionInvoiceSchema,
} from '../schemas/subscription-invoice.schema';
import {
  SubscriptionPlanConfig,
  SubscriptionPlanConfigDocument,
  SubscriptionPlanConfigSchema,
} from '../schemas/subscription-plan-config.schema';
import { HospitalMember, HospitalMemberDocument, HospitalMemberSchema } from '../schemas/hospital-member.schema';
import { Hospital, HospitalDocument, HospitalSchema } from '../schemas/hospital.schema';
import { Counter, CounterDocument, CounterSchema } from '../schemas/counter.schema';
import { User, UserDocument, UserSchema } from '../schemas/user.schema';
import { AuditLogEntry, AuditLogEntryDocument, AuditLogEntrySchema } from '../schemas/audit-log.schema';
import { HospitalRepository } from '../repositories/hospital.repository';
import { UserRepository } from '../repositories/user.repository';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../email/email.service';
import { connectTestMongo, closeTestMongo, clearTestMongo } from '../test-utils/mongo-memory';
import { SUBSCRIPTION_FEATURE, SUBSCRIPTION_STATUS } from '../constants';

// A real EmailService backed by a stub ConfigService — RESEND_API_KEY stays
// unset so every send takes the "log instead of calling the provider" path
// (see EmailService.sendEmail), with no network calls in tests.
const fakeConfigService = { get: () => undefined } as any;

const PLATFORM_ADMIN_ACTOR = { userId: 'platform-admin-1', name: 'Platform Admin', role: 'platform_admin' };
const HOSPITAL_ADMIN_ACTOR = { userId: 'admin-1', name: 'Hospital Admin', role: 'admin' };

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;
  let subscriptionModel: Model<SubscriptionDocument>;
  let invoiceModel: Model<SubscriptionInvoiceDocument>;
  let planConfigModel: Model<SubscriptionPlanConfigDocument>;
  let memberModel: Model<HospitalMemberDocument>;
  let hospitalModel: Model<HospitalDocument>;
  let counterModel: Model<CounterDocument>;
  let userModel: Model<UserDocument>;
  let auditLogModel: Model<AuditLogEntryDocument>;

  beforeAll(async () => {
    await connectTestMongo();
    subscriptionModel = mongoose.model<SubscriptionDocument>(Subscription.name, SubscriptionSchema);
    invoiceModel = mongoose.model<SubscriptionInvoiceDocument>(SubscriptionInvoice.name, SubscriptionInvoiceSchema);
    planConfigModel = mongoose.model<SubscriptionPlanConfigDocument>(
      SubscriptionPlanConfig.name,
      SubscriptionPlanConfigSchema,
    );
    memberModel = mongoose.model<HospitalMemberDocument>(HospitalMember.name, HospitalMemberSchema);
    hospitalModel = mongoose.model<HospitalDocument>(Hospital.name, HospitalSchema);
    counterModel = mongoose.model<CounterDocument>(Counter.name, CounterSchema);
    userModel = mongoose.model<UserDocument>(User.name, UserSchema);
    auditLogModel = mongoose.model<AuditLogEntryDocument>(AuditLogEntry.name, AuditLogEntrySchema);

    service = new SubscriptionsService(
      new SubscriptionRepository(subscriptionModel),
      new SubscriptionInvoiceRepository(invoiceModel, counterModel),
      new SubscriptionPlanConfigRepository(planConfigModel),
      new MembershipRepository(memberModel, hospitalModel),
      new HospitalRepository(hospitalModel),
      new UserRepository(userModel),
      new AuditService(new AuditLogRepository(auditLogModel)),
      new EmailService(fakeConfigService),
    );
  });

  afterEach(async () => clearTestMongo());
  afterAll(async () => closeTestMongo());

  it('provisions a trialing subscription with the base bundle snapshotted, defaulting to 14 trial days', async () => {
    await service.provisionForNewHospital('h1', 'monthly');
    const subscription = await service.getSubscription('h1');

    expect(subscription.status).toBe(SUBSCRIPTION_STATUS.TRIALING);
    expect(subscription.basePrice).toBe(799);
    expect(subscription.includedDoctors).toBe(5);
    expect(subscription.includedStaff).toBe(1);

    const daysUntilTrialEnd = Math.round(
      (new Date(subscription.trialEndsAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000),
    );
    expect(daysUntilTrialEnd).toBe(14);
  });

  it('honors a platform-admin-chosen trial length', async () => {
    await service.provisionForNewHospital('h1', 'monthly', 30);
    const subscription = await service.getSubscription('h1');

    expect(subscription.status).toBe(SUBSCRIPTION_STATUS.TRIALING);
    const daysUntilTrialEnd = Math.round(
      (new Date(subscription.trialEndsAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000),
    );
    expect(daysUntilTrialEnd).toBe(30);
  });

  it('skips the trial entirely and starts billing immediately when trialDays is 0', async () => {
    await service.provisionForNewHospital('h1', 'monthly', 0);
    const subscription = await service.getSubscription('h1');

    expect(subscription.status).toBe(SUBSCRIPTION_STATUS.ACTIVE);
    expect(subscription.trialEndsAt).toBeFalsy();
  });

  it('lazily provisions an already-active subscription for a hospital that predates this feature', async () => {
    // No provisionForNewHospital call — simulates a hospital created before
    // the Subscription schema existed, which has no doc for it at all.
    await memberModel.create([
      { userId: 'd1', hospitalId: 'h-legacy', role: 'doctor', status: 'approved' },
      { userId: 'f1', hospitalId: 'h-legacy', role: 'front_desk', status: 'approved' },
    ]);

    const subscription = await service.getSubscription('h-legacy');

    expect(subscription.status).toBe(SUBSCRIPTION_STATUS.ACTIVE);
    expect(subscription.billingCycle).toBe('monthly');
    expect(subscription.doctorCount).toBe(1);
    expect(subscription.staffCount).toBe(1);

    // A second lookup must reuse the same doc, not create another.
    const again = await service.getSubscription('h-legacy');
    expect(again.id).toBe(subscription.id);
    expect(await subscriptionModel.countDocuments({ hospitalId: 'h-legacy' })).toBe(1);
  });

  it('recalculateSeatCount only counts approved doctor/staff memberships, never admins', async () => {
    await service.provisionForNewHospital('h1', 'monthly');

    await memberModel.create([
      { userId: 'd1', hospitalId: 'h1', role: 'doctor', status: 'approved' },
      { userId: 'd2', hospitalId: 'h1', role: 'doctor', status: 'approved' },
      { userId: 'd3', hospitalId: 'h1', role: 'doctor', status: 'pending' }, // not approved yet
      { userId: 'f1', hospitalId: 'h1', role: 'front_desk', status: 'approved' },
      { userId: 'n1', hospitalId: 'h1', role: 'nurse', status: 'approved' },
      { userId: 'a1', hospitalId: 'h1', role: 'admin', status: 'approved' }, // never billed
    ]);

    await service.recalculateSeatCount('h1');
    const subscription = await service.getSubscription('h1');

    expect(subscription.doctorCount).toBe(2);
    expect(subscription.staffCount).toBe(2); // front_desk + nurse share one allowance
  });

  it('computeInvoiceAmounts only charges for seats beyond the included allowance', async () => {
    await service.provisionForNewHospital('h1', 'monthly');
    await memberModel.insertMany(
      Array.from({ length: 7 }, (_, i) => ({ userId: `d${i}`, hospitalId: 'h1', role: 'doctor', status: 'approved' })),
    );
    await memberModel.create({ userId: 'f1', hospitalId: 'h1', role: 'front_desk', status: 'approved' });
    await service.recalculateSeatCount('h1');

    const subscription = await service.getSubscription('h1');
    const amounts = service.computeInvoiceAmounts(subscription);

    // 7 doctors - 5 included = 2 extra * 299; 1 staff - 1 included = 0 extra
    expect(amounts.baseAmount).toBe(799);
    expect(amounts.doctorOverageAmount).toBe(598);
    expect(amounts.staffOverageAmount).toBe(0);
    expect(amounts.totalAmount).toBe(1397);
  });

  it('runRenewalSweep moves an elapsed subscription to past_due and generates an invoice', async () => {
    await service.provisionForNewHospital('h1', 'monthly');
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await subscriptionModel.updateOne({ hospitalId: 'h1' }, { $set: { status: SUBSCRIPTION_STATUS.ACTIVE, currentPeriodEnd: past } });

    await service.runRenewalSweep();

    const subscription = await service.getSubscription('h1');
    expect(subscription.status).toBe(SUBSCRIPTION_STATUS.PAST_DUE);
    expect(subscription.graceEndsAt).toBeTruthy();

    const invoices = await invoiceModel.find({ hospitalId: 'h1' }).lean();
    expect(invoices).toHaveLength(1);
    expect(invoices[0].status).toBe('due');
  });

  it('runRenewalSweep suspends a past_due subscription once its grace period elapses', async () => {
    await service.provisionForNewHospital('h1', 'monthly');
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await subscriptionModel.updateOne(
      { hospitalId: 'h1' },
      { $set: { status: SUBSCRIPTION_STATUS.PAST_DUE, graceEndsAt: past } },
    );

    await service.runRenewalSweep();

    const subscription = await service.getSubscription('h1');
    expect(subscription.status).toBe(SUBSCRIPTION_STATUS.SUSPENDED);
  });

  it('confirmPayment activates the subscription and advances the period', async () => {
    await service.provisionForNewHospital('h1', 'monthly');
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await subscriptionModel.updateOne({ hospitalId: 'h1' }, { $set: { status: SUBSCRIPTION_STATUS.ACTIVE, currentPeriodEnd: past } });
    await service.runRenewalSweep();

    const invoice = await invoiceModel.findOne({ hospitalId: 'h1' }).lean();
    await service.submitManualPayment(String(invoice!._id), { reference: 'UPI123', ...HOSPITAL_ADMIN_ACTOR });
    await service.confirmPayment(String(invoice!._id), PLATFORM_ADMIN_ACTOR);

    const subscription = await service.getSubscription('h1');
    expect(subscription.status).toBe(SUBSCRIPTION_STATUS.ACTIVE);
    expect(subscription.currentPeriodEnd.getTime()).toBeGreaterThan(past.getTime());

    const confirmedInvoice = await invoiceModel.findById(invoice!._id).lean();
    expect(confirmedInvoice!.status).toBe('paid');
  });

  it('seeds the plan config from the SUBSCRIPTION_* constants on first read', async () => {
    const config = await service.getPlanConfig();

    expect(config.basePriceMonthly).toBe(799);
    expect(config.basePriceAnnual).toBe(7990);
    expect(config.includedDoctors).toBe(5);
    expect(config.includedStaff).toBe(1);

    // Second read reuses the same seeded doc, not a fresh one.
    const again = await service.getPlanConfig();
    expect(again.id).toBe(config.id);
    expect(await planConfigModel.countDocuments({})).toBe(1);
  });

  it('provisionForNewHospital and changePlan pick up an edited plan config, not the hardcoded constants', async () => {
    await service.updatePlanConfig(
      {
        includedDoctors: 5,
        includedStaff: 1,
        basePriceMonthly: 999,
        basePriceAnnual: 9990,
        doctorAddonPriceMonthly: 349,
        doctorAddonPriceAnnual: 3490,
        staffAddonPriceMonthly: 199,
        staffAddonPriceAnnual: 1990,
      },
      'platform-admin-1',
    );

    await service.provisionForNewHospital('h1', 'monthly', 0);
    const subscription = await service.getSubscription('h1');
    expect(subscription.basePrice).toBe(999);
    expect(subscription.doctorAddonPrice).toBe(349);

    await service.changePlan('h1', 'annual', { ...HOSPITAL_ADMIN_ACTOR, isOwner: true });
    const switched = await service.getSubscription('h1');
    expect(switched.basePrice).toBe(9990);
    expect(switched.doctorAddonPrice).toBe(3490);
  });

  it('setFeatureFlag toggles a single feature without affecting the others', async () => {
    await service.provisionForNewHospital('h1', 'monthly', 0);

    let subscription = await service.getSubscription('h1');
    expect(subscription.features).toMatchObject({
      whatsapp: true,
      reports: true,
      packages: true,
      medicinePacks: true,
    });

    await service.setFeatureFlag('h1', SUBSCRIPTION_FEATURE.WHATSAPP, false, PLATFORM_ADMIN_ACTOR);
    subscription = await service.getSubscription('h1');
    expect(subscription.features.whatsapp).toBe(false);
    expect(subscription.features.reports).toBe(true);

    await service.setFeatureFlag('h1', SUBSCRIPTION_FEATURE.WHATSAPP, true, PLATFORM_ADMIN_ACTOR);
    subscription = await service.getSubscription('h1');
    expect(subscription.features.whatsapp).toBe(true);
  });

  it('setExempt and setCancelled toggle status and leave an audit trail', async () => {
    await service.provisionForNewHospital('h1', 'monthly', 0);

    await service.setExempt('h1', true, PLATFORM_ADMIN_ACTOR);
    expect((await service.getSubscription('h1')).status).toBe(SUBSCRIPTION_STATUS.EXEMPT);

    await service.setExempt('h1', false, PLATFORM_ADMIN_ACTOR);
    expect((await service.getSubscription('h1')).status).toBe(SUBSCRIPTION_STATUS.ACTIVE);

    await service.setCancelled('h1', true, PLATFORM_ADMIN_ACTOR);
    expect((await service.getSubscription('h1')).status).toBe(SUBSCRIPTION_STATUS.CANCELLED);

    await service.setCancelled('h1', false, PLATFORM_ADMIN_ACTOR);
    expect((await service.getSubscription('h1')).status).toBe(SUBSCRIPTION_STATUS.ACTIVE);

    const entries = await auditLogModel.find({ hospitalId: 'h1' }).lean();
    const actions = entries.map((e: any) => e.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        'subscription.exempt_enabled',
        'subscription.exempt_disabled',
        'subscription.cancelled',
        'subscription.reactivated',
      ]),
    );
  });

  it('sends a trial-ending-soon email once, not on every sweep', async () => {
    const hospital = await hospitalModel.create({ name: 'Test Hospital', address: 'Addr' });
    const hospitalId = String(hospital._id);
    const admin = await userModel.create({ email: 'admin@test.com', name: 'Admin' });
    await memberModel.create({ userId: String(admin._id), hospitalId, role: 'admin', status: 'approved' });

    await service.provisionForNewHospital(hospitalId, 'monthly', 14);
    const soon = new Date();
    soon.setDate(soon.getDate() + 2); // within SUBSCRIPTION_TRIAL_REMINDER_DAYS_BEFORE (3)
    await subscriptionModel.updateOne({ hospitalId }, { $set: { trialEndsAt: soon } });

    const sendSpy = jest.spyOn(service['emailService'], 'sendTrialEndingSoonEmail');

    await service.runRenewalSweep();
    expect(sendSpy).toHaveBeenCalledTimes(1);

    await service.runRenewalSweep();
    expect(sendSpy).toHaveBeenCalledTimes(1); // trialReminderSentAt now set — no repeat

    sendSpy.mockRestore();
  });
});
