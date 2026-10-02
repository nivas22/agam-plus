import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { DB_COLLECTIONS, SUBSCRIPTION_BILLING_CYCLE, SUBSCRIPTION_INVOICE_STATUS } from '../constants';

export type SubscriptionInvoiceDocument = HydratedDocument<SubscriptionInvoice>;

// One doc per billing period for a hospital's subscription. Amounts are
// broken out (base/doctor overage/staff overage) rather than stored as a
// single lump sum so the billing UI can show how the total was built, the
// same way a Payment's bill is itemized.
@Schema({ collection: DB_COLLECTIONS.SUBSCRIPTION_INVOICES, strict: false, timestamps: false })
export class SubscriptionInvoice {
  @Prop({ required: true, index: true })
  hospitalId: string;

  @Prop({ required: true, index: true })
  subscriptionId: string;

  // Sequential via the shared Counter collection, key `subscription-invoice:<year>`
  // — mirrors Payment.invoiceNumber (see PaymentRepository.getNextInvoiceSequence).
  @Prop({ required: true, unique: true })
  invoiceNumber: string;

  @Prop({ required: true })
  invoiceYear: number;

  @Prop({ required: true, enum: Object.values(SUBSCRIPTION_BILLING_CYCLE) })
  billingCycle: string;

  @Prop({ required: true })
  doctorCount: number;

  @Prop({ required: true })
  staffCount: number;

  @Prop({ required: true })
  baseAmount: number;

  @Prop({ required: true, default: 0 })
  doctorOverageAmount: number;

  @Prop({ required: true, default: 0 })
  staffOverageAmount: number;

  @Prop({ required: true })
  totalAmount: number;

  @Prop({ required: true })
  periodStart: Date;

  @Prop({ required: true })
  periodEnd: Date;

  @Prop({ required: true, enum: Object.values(SUBSCRIPTION_INVOICE_STATUS), index: true })
  status: string;

  // Submitted by the hospital admin as proof of an offline UPI/bank payment —
  // confirmed by a platform admin since no payment gateway is wired yet.
  @Prop()
  paymentReference?: string;

  @Prop()
  submittedAt?: Date;

  @Prop()
  submittedByUserId?: string;

  @Prop()
  confirmedByUserId?: string;

  @Prop()
  paidAt?: Date;

  @Prop()
  createdAt?: Date;
}

export const SubscriptionInvoiceSchema = SchemaFactory.createForClass(SubscriptionInvoice);
SubscriptionInvoiceSchema.index({ hospitalId: 1, createdAt: -1 });
SubscriptionInvoiceSchema.index({ subscriptionId: 1, status: 1 });
