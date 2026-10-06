import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SubscriptionRepository } from '../repositories/subscription.repository';
import { SubscriptionInvoiceRepository } from '../repositories/subscription-invoice.repository';
import { SubscriptionPlanConfigRepository } from '../repositories/subscription-plan-config.repository';
import { MembershipRepository } from '../repositories/membership.repository';
import { HospitalRepository } from '../repositories/hospital.repository';
import { UserRepository } from '../repositories/user.repository';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../email/email.service';
import { ApiError } from '../common/errors/api-error';
import {
  ROLE,
  STAFF_ROLES,
  SUBSCRIPTION_BILLING_CYCLE,
  HOSPITAL_MODULE,
  HOSPITAL_MODULE_LABELS,
  SUBSCRIPTION_GRACE_DAYS,
  SUBSCRIPTION_INVOICE_STATUS,
  SUBSCRIPTION_STATUS,
  SUBSCRIPTION_TRIAL_DAYS,
  SUBSCRIPTION_TRIAL_REMINDER_DAYS_BEFORE,
} from '../constants';

export interface SubscriptionActor {
  userId: string;
  name: string;
  role: string;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addCycle(date: Date, billingCycle: string): Date {
  const next = new Date(date);
  if (billingCycle === SUBSCRIPTION_BILLING_CYCLE.ANNUAL) {
    next.setFullYear(next.getFullYear() + 1);
  } else {
    next.setMonth(next.getMonth() + 1);
  }
  return next;
}

function normalizeCycle(billingCycle: string | undefined): SUBSCRIPTION_BILLING_CYCLE {
  return billingCycle === SUBSCRIPTION_BILLING_CYCLE.ANNUAL
    ? SUBSCRIPTION_BILLING_CYCLE.ANNUAL
    : SUBSCRIPTION_BILLING_CYCLE.MONTHLY;
}

// Picks out the monthly/annual pair for the chosen cycle from the
// platform-admin-editable SubscriptionPlanConfig document.
function pricesForCycle(config: any, cycle: SUBSCRIPTION_BILLING_CYCLE) {
  const isAnnual = cycle === SUBSCRIPTION_BILLING_CYCLE.ANNUAL;
  return {
    basePrice: isAnnual ? config.basePriceAnnual : config.basePriceMonthly,
    doctorAddonPrice: isAnnual ? config.doctorAddonPriceAnnual : config.doctorAddonPriceMonthly,
    staffAddonPrice: isAnnual ? config.staffAddonPriceAnnual : config.staffAddonPriceMonthly,
  };
}

export interface InvoiceAmounts {
  baseAmount: number;
  doctorOverageAmount: number;
  staffOverageAmount: number;
  totalAmount: number;
}

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly subscriptionInvoiceRepository: SubscriptionInvoiceRepository,
    private readonly planConfigRepository: SubscriptionPlanConfigRepository,
    private readonly membershipRepository: MembershipRepository,
    private readonly hospitalRepository: HospitalRepository,
    private readonly userRepository: UserRepository,
    private readonly auditService: AuditService,
    private readonly emailService: EmailService,
  ) {}

  // Emails every approved admin of a hospital — used for trial/invoice/
  // suspension notices. Failures are logged, never thrown (a notification
  // bug shouldn't break the billing sweep itself).
  private async notifyAdmins(
    hospitalId: string,
    send: (email: string, name: string, hospitalName: string) => Promise<boolean>,
  ) {
    try {
      const [hospital, admins] = await Promise.all([
        this.hospitalRepository.getHospitalById(hospitalId),
        this.membershipRepository.getHospitalMembers(hospitalId, { role: ROLE.ADMIN, status: 'approved' }),
      ]);
      const hospitalName = (hospital as any)?.name || 'your hospital';

      await Promise.all(
        admins.map(async (admin: any) => {
          const user = await this.userRepository.getUserById(admin.userId);
          const email = (user as any)?.email;
          if (!email) return;
          await send(email, (user as any)?.name || 'there', hospitalName);
        }),
      );
    } catch (error) {
      this.logger.error(`Failed to notify admins for hospital ${hospitalId}: ${(error as Error).message}`);
    }
  }

  getPlanConfig() {
    return this.planConfigRepository.getConfig();
  }

  updatePlanConfig(data: Record<string, any>, updatedByUserId: string) {
    return this.planConfigRepository.updateConfig(data, updatedByUserId);
  }

  // trialDays is the platform admin's call per hospital (defaults to
  // SUBSCRIPTION_TRIAL_DAYS when omitted); 0 skips the trial entirely and
  // starts the hospital directly on a paid period.
  async provisionForNewHospital(hospitalId: string, billingCycle: string | undefined, trialDays?: number) {
    const cycle = normalizeCycle(billingCycle);
    const config = await this.planConfigRepository.getConfig();
    const now = new Date();
    const days = typeof trialDays === 'number' && trialDays >= 0 ? trialDays : SUBSCRIPTION_TRIAL_DAYS;
    const isTrial = days > 0;
    const periodEnd = isTrial ? addDays(now, days) : addCycle(now, cycle);

    return this.subscriptionRepository.createSubscription({
      hospitalId,
      billingCycle: cycle,
      status: isTrial ? SUBSCRIPTION_STATUS.TRIALING : SUBSCRIPTION_STATUS.ACTIVE,
      ...pricesForCycle(config, cycle),
      includedDoctors: config.includedDoctors,
      includedStaff: config.includedStaff,
      doctorCount: 0,
      staffCount: 0,
      trialEndsAt: isTrial ? periodEnd : undefined,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    });
  }

  // Hospitals created before this feature shipped have no Subscription doc.
  // Rather than 404ing on every billing screen for them, lazily provision one
  // on first lookup — grandfathered as already-active (not a fresh trial,
  // since they're an established hospital) with seat counts taken from their
  // real membership data.
  async getSubscription(hospitalId: string) {
    const subscription = await this.subscriptionRepository.getByHospitalId(hospitalId);
    if (subscription) return subscription;

    try {
      return await this.provisionForExistingHospital(hospitalId);
    } catch (error: any) {
      // Two concurrent first-lookups can both race past the check above —
      // the hospitalId unique index rejects the loser, which just re-reads.
      if (error?.code === 11000) {
        const existing = await this.subscriptionRepository.getByHospitalId(hospitalId);
        if (existing) return existing;
      }
      throw error;
    }
  }

  private async provisionForExistingHospital(hospitalId: string) {
    const cycle = SUBSCRIPTION_BILLING_CYCLE.MONTHLY;
    const config = await this.planConfigRepository.getConfig();
    const now = new Date();

    const [doctorCount, staffCount] = await Promise.all([
      this.membershipRepository.countPractisingDoctors(hospitalId, 'approved'),
      this.membershipRepository.countApprovedMembersByRoles(hospitalId, STAFF_ROLES),
    ]);

    return this.subscriptionRepository.createSubscription({
      hospitalId,
      billingCycle: cycle,
      status: SUBSCRIPTION_STATUS.ACTIVE,
      ...pricesForCycle(config, cycle),
      includedDoctors: config.includedDoctors,
      includedStaff: config.includedStaff,
      doctorCount,
      staffCount,
      currentPeriodStart: now,
      currentPeriodEnd: addCycle(now, cycle),
    });
  }

  computeInvoiceAmounts(subscription: any): InvoiceAmounts {
    const extraDoctors = Math.max(0, subscription.doctorCount - subscription.includedDoctors);
    const extraStaff = Math.max(0, subscription.staffCount - subscription.includedStaff);

    const baseAmount = subscription.basePrice;
    const doctorOverageAmount = extraDoctors * subscription.doctorAddonPrice;
    const staffOverageAmount = extraStaff * subscription.staffAddonPrice;

    return {
      baseAmount,
      doctorOverageAmount,
      staffOverageAmount,
      totalAmount: baseAmount + doctorOverageAmount + staffOverageAmount,
    };
  }

  async getBillingSummary(hospitalId: string) {
    const subscription = await this.getSubscription(hospitalId);
    const invoices = await this.subscriptionInvoiceRepository.getForHospital(hospitalId);
    return {
      subscription,
      amounts: this.computeInvoiceAmounts(subscription),
      invoices,
    };
  }

  async changePlan(hospitalId: string, billingCycle: string, actor: SubscriptionActor & { isOwner: boolean }) {
    if (!actor.isOwner) {
      throw ApiError.forbidden('Only the hospital owner can change the subscription plan');
    }

    const cycle = normalizeCycle(billingCycle);
    const subscription = await this.getSubscription(hospitalId);
    if (subscription.billingCycle === cycle) return subscription;

    const config = await this.planConfigRepository.getConfig();

    // Effective next renewal — no proration, keeps the mental model simple
    // (the current period the hospital already has runs out as paid for).
    const updated = await this.subscriptionRepository.updateByHospitalId(hospitalId, {
      billingCycle: cycle,
      ...pricesForCycle(config, cycle),
    });

    await this.auditService.log({
      hospitalId,
      actor: { userId: actor.userId, name: actor.name, role: actor.role },
      action: 'subscription.plan_changed',
      area: 'settings',
      summary: `Changed subscription billing cycle from ${subscription.billingCycle} to ${cycle}`,
    });

    return updated;
  }

  // Platform-admin-only override for pilot/demo hospitals — always passes the
  // HospitalContextGuard billing check regardless of dates/invoices.
  async setExempt(hospitalId: string, exempt: boolean, actor: SubscriptionActor) {
    const subscription = await this.getSubscription(hospitalId);
    const status = exempt
      ? SUBSCRIPTION_STATUS.EXEMPT
      : subscription.currentPeriodEnd > new Date()
        ? SUBSCRIPTION_STATUS.ACTIVE
        : SUBSCRIPTION_STATUS.PAST_DUE;

    const updated = await this.subscriptionRepository.updateByHospitalId(hospitalId, { status });

    await this.auditService.log({
      hospitalId,
      actor: { userId: actor.userId, name: actor.name, role: actor.role },
      action: exempt ? 'subscription.exempt_enabled' : 'subscription.exempt_disabled',
      area: 'settings',
      summary: exempt ? 'Marked subscription exempt from billing' : 'Removed billing exemption',
    });

    return updated;
  }

  // Platform-admin-only grant/withhold of any module for this hospital's
  // plan — see resolveHospitalModules(). The plan beats the hospital admin's
  // own switch under Settings > Features.
  // Applies several grants/withholds in one write, leaving unlisted modules as they are.
  async setFeatureFlags(hospitalId: string, changes: Partial<Record<HOSPITAL_MODULE, boolean>>, actor: SubscriptionActor) {
    const subscription = await this.getSubscription(hospitalId);
    const features = { ...subscription.features, ...changes };
    const updated = await this.subscriptionRepository.updateByHospitalId(hospitalId, { features });

    const labels = (enabled: boolean) =>
      Object.entries(changes)
        .filter(([, v]) => v === enabled)
        .map(([k]) => HOSPITAL_MODULE_LABELS[k as HOSPITAL_MODULE] ?? k)
        .join(', ');
    const added = labels(true);
    const removed = labels(false);

    await this.auditService.log({
      hospitalId,
      actor: { userId: actor.userId, name: actor.name, role: actor.role },
      action: 'subscription.feature_toggled',
      area: 'settings',
      summary: [added && `Added ${added} to the plan`, removed && `Removed ${removed} from the plan`]
        .filter(Boolean)
        .join('; '),
    });

    return updated;
  }

  // Platform-admin-only deliberate offboarding, distinct from `suspended`
  // (which assumes the hospital will eventually pay). Reactivating recomputes
  // status the same way setExempt does.
  async setCancelled(hospitalId: string, cancelled: boolean, actor: SubscriptionActor) {
    const subscription = await this.getSubscription(hospitalId);
    const status = cancelled
      ? SUBSCRIPTION_STATUS.CANCELLED
      : subscription.currentPeriodEnd > new Date()
        ? SUBSCRIPTION_STATUS.ACTIVE
        : SUBSCRIPTION_STATUS.PAST_DUE;

    const updated = await this.subscriptionRepository.updateByHospitalId(hospitalId, {
      status,
      cancelledAt: cancelled ? new Date() : null,
    });

    await this.auditService.log({
      hospitalId,
      actor: { userId: actor.userId, name: actor.name, role: actor.role },
      action: cancelled ? 'subscription.cancelled' : 'subscription.reactivated',
      area: 'settings',
      summary: cancelled ? 'Cancelled the subscription' : 'Reactivated the subscription',
    });

    return updated;
  }

  async recalculateSeatCount(hospitalId: string) {
    const subscription = await this.subscriptionRepository.getByHospitalId(hospitalId);
    if (!subscription) return;

    const [doctorCount, staffCount] = await Promise.all([
      this.membershipRepository.countPractisingDoctors(hospitalId, 'approved'),
      this.membershipRepository.countApprovedMembersByRoles(hospitalId, STAFF_ROLES),
    ]);

    await this.subscriptionRepository.updateByHospitalId(hospitalId, { doctorCount, staffCount });
  }

  private async generateInvoice(subscription: any) {
    const now = new Date();
    const invoiceYear = now.getFullYear();
    const sequence = await this.subscriptionInvoiceRepository.getNextInvoiceSequence(invoiceYear);
    const invoiceNumber = `SUB-${invoiceYear}-${String(sequence).padStart(4, '0')}`;
    const amounts = this.computeInvoiceAmounts(subscription);

    return this.subscriptionInvoiceRepository.createInvoice({
      hospitalId: subscription.hospitalId,
      subscriptionId: subscription.id,
      invoiceNumber,
      invoiceYear,
      billingCycle: subscription.billingCycle,
      doctorCount: subscription.doctorCount,
      staffCount: subscription.staffCount,
      ...amounts,
      periodStart: subscription.currentPeriodEnd,
      periodEnd: addCycle(subscription.currentPeriodEnd, subscription.billingCycle),
      status: SUBSCRIPTION_INVOICE_STATUS.DUE,
    });
  }

  async submitManualPayment(invoiceId: string, data: { reference: string } & SubscriptionActor) {
    const invoice = await this.subscriptionInvoiceRepository.getById(invoiceId);
    if (!invoice) throw ApiError.notFound('Invoice not found');
    if (invoice.status !== SUBSCRIPTION_INVOICE_STATUS.DUE) {
      throw ApiError.conflict('This invoice is not awaiting payment');
    }

    const updated = await this.subscriptionInvoiceRepository.updateById(invoiceId, {
      status: SUBSCRIPTION_INVOICE_STATUS.PAYMENT_SUBMITTED,
      paymentReference: data.reference,
      submittedAt: new Date(),
      submittedByUserId: data.userId,
    });

    await this.auditService.log({
      hospitalId: invoice.hospitalId,
      actor: { userId: data.userId, name: data.name, role: data.role },
      action: 'subscription.payment_submitted',
      area: 'money',
      summary: `Submitted payment reference "${data.reference}" for invoice ${invoice.invoiceNumber}`,
      amount: invoice.totalAmount,
    });

    return updated;
  }

  async confirmPayment(invoiceId: string, actor: SubscriptionActor) {
    const invoice = await this.subscriptionInvoiceRepository.getById(invoiceId);
    if (!invoice) throw ApiError.notFound('Invoice not found');
    if (invoice.status === SUBSCRIPTION_INVOICE_STATUS.PAID) {
      throw ApiError.conflict('Invoice already paid');
    }

    await this.subscriptionInvoiceRepository.updateById(invoiceId, {
      status: SUBSCRIPTION_INVOICE_STATUS.PAID,
      confirmedByUserId: actor.userId,
      paidAt: new Date(),
    });

    await this.subscriptionRepository.updateById(invoice.subscriptionId, {
      status: SUBSCRIPTION_STATUS.ACTIVE,
      currentPeriodStart: invoice.periodStart,
      currentPeriodEnd: invoice.periodEnd,
      graceEndsAt: null,
    });

    await this.auditService.log({
      hospitalId: invoice.hospitalId,
      actor: { userId: actor.userId, name: actor.name, role: actor.role },
      action: 'subscription.payment_confirmed',
      area: 'money',
      summary: `Confirmed payment for invoice ${invoice.invoiceNumber}`,
      amount: invoice.totalAmount,
    });

    return this.subscriptionInvoiceRepository.getById(invoiceId);
  }

  // Daily sweep: email a heads-up before trials end, roll forward
  // subscriptions whose period has ended, and suspend anything that's run
  // out its grace period unpaid. Also invoked on-demand via
  // GET /internal/cron/subscription-renewal (see InternalCronController) —
  // @nestjs/schedule's in-memory timer only fires in a long-lived process,
  // which the production Vercel serverless deployment never is.
  @Cron('0 2 * * *')
  async runRenewalSweep() {
    const now = new Date();

    const trialsEndingSoon = await this.subscriptionRepository.getTrialsEndingSoon(
      addDays(now, SUBSCRIPTION_TRIAL_REMINDER_DAYS_BEFORE),
    );
    for (const subscription of trialsEndingSoon) {
      await this.notifyAdmins(subscription.hospitalId, (email, name, hospitalName) =>
        this.emailService.sendTrialEndingSoonEmail(email, name, hospitalName, new Date(subscription.trialEndsAt)),
      );
      await this.subscriptionRepository.updateById(subscription.id, { trialReminderSentAt: now });
    }

    const dueForRenewal = await this.subscriptionRepository.getDueForRenewal(now, [
      SUBSCRIPTION_STATUS.TRIALING,
      SUBSCRIPTION_STATUS.ACTIVE,
    ]);

    for (const subscription of dueForRenewal) {
      await this.recalculateSeatCount(subscription.hospitalId);
      const refreshed = await this.subscriptionRepository.getByHospitalId(subscription.hospitalId);
      const invoice = await this.generateInvoice(refreshed);
      const graceEndsAt = addDays(now, SUBSCRIPTION_GRACE_DAYS);
      await this.subscriptionRepository.updateById(subscription.id, {
        status: SUBSCRIPTION_STATUS.PAST_DUE,
        graceEndsAt,
      });

      await this.notifyAdmins(subscription.hospitalId, (email, name, hospitalName) =>
        this.emailService.sendSubscriptionInvoiceDueEmail(
          email,
          name,
          hospitalName,
          invoice.invoiceNumber,
          invoice.totalAmount,
          graceEndsAt,
        ),
      );
    }

    const pastGrace = await this.subscriptionRepository.getPastGracePeriod(now);
    for (const subscription of pastGrace) {
      await this.subscriptionRepository.updateById(subscription.id, { status: SUBSCRIPTION_STATUS.SUSPENDED });

      await this.notifyAdmins(subscription.hospitalId, (email, name, hospitalName) =>
        this.emailService.sendSubscriptionSuspendedEmail(email, name, hospitalName),
      );
    }
  }
}
