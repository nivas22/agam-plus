import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { DB_COLLECTIONS, PAYMENT_METHOD, PAYMENT_STATUS } from '../constants';

@Schema({ _id: false })
export class PaymentItem {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, default: 1 })
  quantity: number;

  @Prop({ required: true })
  unitPrice: number;

  // Auto-added from the doctor's consultation fee — kept distinct from
  // anything added during the visit so the bill UI can lock it from editing.
  @Prop({ default: false })
  isAuto?: boolean;
}

export const PaymentItemSchema = SchemaFactory.createForClass(PaymentItem);

export type PaymentDocument = HydratedDocument<Payment>;

@Schema({
  collection: DB_COLLECTIONS.PAYMENTS,
  strict: false,
  timestamps: false,
})
export class Payment {
  @Prop({ required: true, index: true })
  hospitalId: string;

  // One bill per appointment — enforced here rather than relying solely on
  // the unique index, so completeVisit can raise a clear ApiError.conflict.
  @Prop({ required: true, unique: true, index: true })
  appointmentId: string;

  @Prop({ required: true, index: true })
  patientId: string;

  // Denormalized display copies, snapshotted from the appointment at
  // completion time — matches the appointment schema's own convention for
  // avoiding a $lookup on every list/table render.
  @Prop()
  patientName?: string;

  @Prop()
  patientPhone?: string;

  @Prop({ index: true })
  doctorProfileId?: string;

  @Prop()
  doctorName?: string;

  @Prop({ required: true, unique: true })
  invoiceNumber: string;

  // Kept alongside invoiceNumber (rather than parsed back out of it) so
  // invoice numbering can stay sequential per hospital per year via a plain count query.
  @Prop({ required: true })
  invoiceYear: number;

  @Prop({ type: [PaymentItemSchema], default: [] })
  items: PaymentItem[];

  @Prop({ required: true })
  subtotal: number;

  @Prop({ default: 0 })
  discount: number;

  @Prop({ required: true })
  total: number;

  @Prop({ required: true, enum: Object.values(PAYMENT_METHOD) })
  method: string;

  @Prop({ required: true, enum: Object.values(PAYMENT_STATUS), index: true })
  status: string;

  // cash
  @Prop()
  amountTendered?: number;

  @Prop()
  changeDue?: number;

  @Prop()
  collectedBy?: string;

  // upi
  @Prop()
  upiReference?: string;

  // split (cash + upi)
  @Prop()
  splitCashAmount?: number;

  @Prop()
  splitUpiAmount?: number;

  // due
  @Prop()
  dueReason?: string;

  @Prop()
  settledAt?: Date;

  // refund
  @Prop()
  refundedAt?: Date;

  @Prop()
  refundReason?: string;

  @Prop()
  sendReceiptWhatsApp?: boolean;

  @Prop()
  createdBy?: string;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
PaymentSchema.index({ hospitalId: 1, createdAt: -1 });
PaymentSchema.index({ hospitalId: 1, status: 1 });
