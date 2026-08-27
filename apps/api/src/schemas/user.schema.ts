import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { DB_COLLECTIONS } from '../constants';

export type UserDocument = HydratedDocument<User>;

@Schema({ collection: DB_COLLECTIONS.USERS, strict: false, timestamps: false })
export class User {
  @Prop({ required: true, unique: true, trim: true, lowercase: true })
  email: string;

  // Holds Google's `sub` claim (stable per-account ID) — named firebaseUid for
  // historical reasons from when Firebase Auth brokered Google sign-in.
  @Prop({ index: true, sparse: true, unique: true })
  firebaseUid?: string;

  // Login handle for username+password sign-in — always email-shaped
  // (x@y.tld) but not necessarily a real, deliverable address, distinct
  // from `email` which is used for actual communication.
  @Prop({ index: true, sparse: true, unique: true, trim: true, lowercase: true })
  username?: string;

  @Prop()
  passwordHash?: string;

  // Set true when an admin sets a temporary password at creation time;
  // cleared once the user picks their own password.
  @Prop({ default: false })
  mustChangePassword?: boolean;

  @Prop()
  passwordResetTokenHash?: string;

  @Prop()
  passwordResetExpires?: Date;

  // One pending OTP embedded directly on the doc (mirrors PatientAccount's
  // otp* fields) — used for the phone-based "forgot password" flow.
  @Prop()
  otpHash?: string;

  @Prop()
  otpExpiresAt?: Date;

  @Prop({ default: 0 })
  otpAttempts?: number;

  @Prop()
  otpSentAt?: Date;

  @Prop({ default: 0 })
  otpRequestCount?: number;

  @Prop()
  otpRequestWindowStart?: Date;

  // Login-lockout counters for password sign-in — reset on a successful login.
  @Prop({ default: 0 })
  failedLoginAttempts?: number;

  @Prop()
  lockedUntil?: Date;

  @Prop()
  name?: string;

  @Prop()
  authProvider?: string;

  @Prop()
  lastHospitalId?: string;

  @Prop({ default: false })
  isPlatformAdmin?: boolean;

  @Prop()
  lastLogin?: Date;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
