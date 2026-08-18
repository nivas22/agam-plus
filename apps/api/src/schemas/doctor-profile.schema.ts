import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { DB_COLLECTIONS } from '@agam-plus/shared';

export type DoctorProfileDocument = HydratedDocument<DoctorProfile>;

// _id is the owning user's id (mirrors the Firestore doc-per-userId keying
// trick this collection relied on) so getDoctorProfileByUserId is a plain findById.
@Schema({ collection: DB_COLLECTIONS.DOCTOR_PROFILES, strict: false, timestamps: false, _id: false })
export class DoctorProfile {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ index: true })
  hospitalId?: string;

  @Prop()
  specialization?: string;

  @Prop()
  qualification?: string;

  @Prop()
  consultationFee?: number;

  @Prop()
  availability?: unknown[];

  @Prop()
  bio?: string;

  @Prop()
  status?: string;

  @Prop()
  experience?: string;

  @Prop()
  phone?: string;

  @Prop()
  email?: string;

  @Prop()
  name?: string;

  @Prop()
  location?: string;

  @Prop()
  address?: string;

  @Prop()
  gender?: string;

  @Prop()
  maritalStatus?: string;

  @Prop()
  appointmentDuration?: number;

  @Prop()
  membershipId?: string;

  @Prop()
  membershipStatus?: string;

  @Prop()
  updatedAt?: Date;
}

export const DoctorProfileSchema = SchemaFactory.createForClass(DoctorProfile);
DoctorProfileSchema.index({ hospitalId: 1, userId: 1 });
