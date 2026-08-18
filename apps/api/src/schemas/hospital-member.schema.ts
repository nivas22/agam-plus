import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { DB_COLLECTIONS, MEMBERSHIP_STATUS, ROLE } from '@agam-plus/shared';

export type HospitalMemberDocument = HydratedDocument<HospitalMember>;

@Schema({ collection: DB_COLLECTIONS.HOSPITAL_MEMBERS, strict: false, timestamps: false })
export class HospitalMember {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true, index: true })
  hospitalId: string;

  @Prop({ enum: Object.values(ROLE) })
  role?: string;

  @Prop({ enum: Object.values(MEMBERSHIP_STATUS), index: true })
  status?: string;

  @Prop()
  joinedAt?: Date;

  @Prop()
  approvedAt?: Date;

  @Prop()
  updatedAt?: Date;

  @Prop()
  invitedBy?: string;

  @Prop()
  isDoctor?: boolean;

  @Prop()
  isProfileUpdated?: boolean;

  @Prop()
  isExperienceUpdated?: boolean;

  @Prop()
  isAvailabilityUpdated?: boolean;

  @Prop()
  availability?: unknown[];

  @Prop()
  appointmentDuration?: number;
}

export const HospitalMemberSchema = SchemaFactory.createForClass(HospitalMember);
HospitalMemberSchema.index({ userId: 1, hospitalId: 1 }, { unique: true });
HospitalMemberSchema.index({ hospitalId: 1, role: 1, status: 1 });
