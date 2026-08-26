import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { DB_COLLECTIONS } from '../constants';

export type PatientAccountDocument = HydratedDocument<PatientAccount>;

// The patient app's own identity — deliberately separate from `User` (staff/
// doctor/admin login). Verified by phone+OTP, not Google sign-in. One pending
// OTP is embedded directly on the doc (mirrors TeamMemberProfile.pinHash)
// rather than a separate OTP collection, since only one can be active at a time.
@Schema({ collection: DB_COLLECTIONS.PATIENT_ACCOUNTS, strict: false, timestamps: false })
export class PatientAccount {
  @Prop({ required: true, unique: true, index: true })
  phone: string;

  @Prop()
  name?: string;

  @Prop()
  email?: string;

  @Prop()
  otpHash?: string;

  @Prop()
  otpExpiresAt?: Date;

  // Failed-verify count for the CURRENT otp — capped, forces a fresh
  // requestOtp once exhausted rather than allowing indefinite guessing.
  @Prop({ default: 0 })
  otpAttempts?: number;

  // Resend cooldown anchor.
  @Prop()
  otpSentAt?: Date;

  // Separate from the cooldown: caps total OTP mints in a rolling window
  // (resets when otpRequestWindowStart ages out), so an attacker can't just
  // wait out the 60s cooldown repeatedly to mint unlimited fresh 5-attempt windows.
  @Prop({ default: 0 })
  otpRequestCount?: number;

  @Prop()
  otpRequestWindowStart?: Date;

  @Prop()
  verifiedAt?: Date;

  @Prop()
  lastLogin?: Date;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const PatientAccountSchema = SchemaFactory.createForClass(PatientAccount);
