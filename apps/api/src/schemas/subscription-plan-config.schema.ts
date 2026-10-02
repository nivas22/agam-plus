import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { DB_COLLECTIONS } from '../constants';

export type SubscriptionPlanConfigDocument = HydratedDocument<SubscriptionPlanConfig>;

// Single document (fixed _id: 'default') holding the platform's current
// subscription pricing — editable from Platform Admin > Subscriptions >
// Plan pricing instead of the SUBSCRIPTION_* constants requiring a deploy to
// change. Only affects NEW subscriptions and plan changes going forward —
// see Subscription schema's snapshot fields.
@Schema({ collection: DB_COLLECTIONS.SUBSCRIPTION_PLAN_CONFIG, strict: false, timestamps: false })
export class SubscriptionPlanConfig {
  @Prop({ required: true })
  _id: string;

  @Prop({ required: true })
  includedDoctors: number;

  @Prop({ required: true })
  includedStaff: number;

  @Prop({ required: true })
  basePriceMonthly: number;

  @Prop({ required: true })
  basePriceAnnual: number;

  @Prop({ required: true })
  doctorAddonPriceMonthly: number;

  @Prop({ required: true })
  doctorAddonPriceAnnual: number;

  @Prop({ required: true })
  staffAddonPriceMonthly: number;

  @Prop({ required: true })
  staffAddonPriceAnnual: number;

  @Prop()
  updatedAt?: Date;

  @Prop()
  updatedByUserId?: string;
}

export const SubscriptionPlanConfigSchema = SchemaFactory.createForClass(SubscriptionPlanConfig);
