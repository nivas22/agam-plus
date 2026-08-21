import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { DB_COLLECTIONS } from '../constants';

export type PaymentDayCloseDocument = HydratedDocument<PaymentDayClose>;

// One record per hospital per day — its existence is what "locks" that
// day's invoices (see PaymentsService.updatePayment's day-lock check).
@Schema({
  collection: DB_COLLECTIONS.PAYMENT_DAY_CLOSES,
  strict: false,
  timestamps: false,
})
export class PaymentDayClose {
  @Prop({ required: true, index: true })
  hospitalId: string;

  // YYYY-MM-DD
  @Prop({ required: true })
  date: string;

  @Prop({ required: true, default: 0 })
  openingFloat: number;

  @Prop({ required: true })
  cashCollected: number;

  @Prop({ required: true })
  upiCollected: number;

  @Prop({ required: true, default: 0 })
  refundsPaidOut: number;

  @Prop({ required: true })
  expectedDrawer: number;

  @Prop({ required: true })
  countedAmount: number;

  @Prop({ required: true })
  variance: number;

  @Prop()
  note?: string;

  @Prop({ required: true })
  closedBy: string;

  @Prop()
  closedAt?: Date;
}

export const PaymentDayCloseSchema =
  SchemaFactory.createForClass(PaymentDayClose);
PaymentDayCloseSchema.index({ hospitalId: 1, date: 1 }, { unique: true });
