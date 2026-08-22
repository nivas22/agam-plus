import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import {
  DB_COLLECTIONS,
  PACKAGE_STATUS,
  PACKAGE_PAYMENT_METHOD,
} from '../constants';

export type PackageDocument = HydratedDocument<Package>;

@Schema({
  collection: DB_COLLECTIONS.PACKAGES,
  strict: false,
  timestamps: false,
})
export class Package {
  @Prop({ required: true, index: true })
  hospitalId: string;

  @Prop({ required: true, index: true })
  patientId: string;

  // Denormalized display copies, snapshotted at sale time — matches the
  // convention already used on Appointment and Payment.
  @Prop()
  patientName?: string;

  @Prop()
  patientPhone?: string;

  @Prop({ required: true, index: true })
  doctorProfileId: string;

  @Prop()
  doctorName?: string;

  @Prop({ required: true })
  totalVisits: number;

  // Visits already turned into appointments (at sale time, or later — the
  // "book more from remaining credits" flow isn't built yet).
  @Prop({ required: true, default: 0 })
  usedVisits: number;

  @Prop({ required: true })
  pricePerVisit: number;

  @Prop({ required: true })
  totalPrice: number;

  @Prop({ required: true, enum: Object.values(PACKAGE_STATUS), index: true })
  status: string;

  // YYYY-MM-DD
  @Prop({ required: true })
  validUntil: string;

  @Prop({ required: true, enum: Object.values(PACKAGE_PAYMENT_METHOD) })
  paymentMethod: string;

  @Prop({ required: true })
  amountPaid: number;

  @Prop()
  collectedBy?: string;

  // Set when a lapsed/unused package is refunded instead of extended.
  @Prop()
  refundedAmount?: number;

  @Prop()
  refundedAt?: Date;

  @Prop()
  refundedBy?: string;

  @Prop()
  createdBy?: string;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const PackageSchema = SchemaFactory.createForClass(Package);
PackageSchema.index({ hospitalId: 1, patientId: 1 });
PackageSchema.index({ hospitalId: 1, doctorProfileId: 1 });
