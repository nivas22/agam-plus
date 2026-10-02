import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { DB_COLLECTIONS, SUBSCRIPTION_BILLING_CYCLE, SUBSCRIPTION_STATUS } from '../constants';

// Modules a platform admin can individually disable per hospital — see
// SUBSCRIPTION_FEATURE in constants.ts and RequiresFeature(). All default to
// enabled so no existing hospital loses access until explicitly toggled off.
@Schema({ _id: false })
export class SubscriptionFeatures {
  @Prop({ required: true, default: true })
  whatsapp: boolean;

  @Prop({ required: true, default: true })
  reports: boolean;

  @Prop({ required: true, default: true })
  packages: boolean;

  @Prop({ required: true, default: true })
  medicinePacks: boolean;
}

export const SubscriptionFeaturesSchema = SchemaFactory.createForClass(SubscriptionFeatures);

export type SubscriptionDocument = HydratedDocument<Subscription>;

// One doc per hospital — created by SubscriptionsService.provisionForNewHospital
// right after HospitalsService.createHospital(). Pricing/allowance fields are
// snapshotted at creation/plan-change time from the (DB-backed, platform-admin
// editable) SubscriptionPlanConfig — same convention as PaymentItem.unitPrice
// on payment.schema.ts — so a later price edit never retroactively re-prices
// an existing hospital.
@Schema({ collection: DB_COLLECTIONS.SUBSCRIPTIONS, strict: false, timestamps: false })
export class Subscription {
  @Prop({ required: true, unique: true, index: true })
  hospitalId: string;

  @Prop({ required: true, enum: Object.values(SUBSCRIPTION_BILLING_CYCLE) })
  billingCycle: string;

  @Prop({ required: true, enum: Object.values(SUBSCRIPTION_STATUS), index: true })
  status: string;

  @Prop({ required: true })
  basePrice: number;

  @Prop({ required: true })
  doctorAddonPrice: number;

  @Prop({ required: true })
  staffAddonPrice: number;

  @Prop({ required: true })
  includedDoctors: number;

  @Prop({ required: true })
  includedStaff: number;

  // Last-known billable counts — kept in sync by
  // SubscriptionsService.recalculateSeatCount whenever a doctor/staff
  // membership is approved, suspended, deactivated, or reactivated.
  @Prop({ required: true, default: 0 })
  doctorCount: number;

  @Prop({ required: true, default: 0 })
  staffCount: number;

  @Prop()
  trialEndsAt?: Date;

  @Prop({ required: true })
  currentPeriodStart: Date;

  @Prop({ required: true })
  currentPeriodEnd: Date;

  // Set when status flips to past_due; runRenewalSweep suspends the
  // subscription once this date passes without payment.
  @Prop()
  graceEndsAt?: Date;

  @Prop({ type: SubscriptionFeaturesSchema, default: () => ({}) })
  features: SubscriptionFeatures;

  // Set once runRenewalSweep emails a trial-ending-soon notice, so the sweep
  // (which runs daily) doesn't re-send it every day until the trial lapses.
  @Prop()
  trialReminderSentAt?: Date;

  // Set when a platform admin cancels the subscription (SubscriptionsService
  // setCancelled) — distinct from `suspended`, which assumes the hospital
  // will eventually pay; cancelled is a deliberate offboarding.
  @Prop()
  cancelledAt?: Date;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const SubscriptionSchema = SchemaFactory.createForClass(Subscription);
