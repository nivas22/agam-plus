import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { DB_COLLECTIONS } from '../constants';

export type TeamMemberProfileDocument = HydratedDocument<TeamMemberProfile>;

// Mirrors DoctorProfile: one doc per user (_id = userId), holding the
// non-clinical staff fields that don't belong on the generic HospitalMember
// row (role/status live there instead, same split as doctors).
@Schema({
  collection: DB_COLLECTIONS.TEAM_MEMBER_PROFILES,
  strict: false,
  timestamps: false,
  _id: false,
})
export class TeamMemberProfile {
  @Prop({ type: String, required: true })
  _id: string; // = owning user's id

  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true, index: true })
  hospitalId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  email: string;

  @Prop()
  phone?: string;

  @Prop({ required: true, unique: true })
  employeeId: string;

  @Prop()
  shift?: string;

  @Prop()
  startDate?: string;

  @Prop({ default: false })
  handlesCash: boolean;

  // Confirmation PIN for approvals/day-close — never a login credential (see
  // the Team feature's "known deviations" note: sign-in stays Firebase-email-based).
  @Prop()
  pinHash?: string;

  @Prop()
  pinSetAt?: Date;

  @Prop({ default: 'invited' })
  status: 'invited' | 'active' | 'suspended' | 'deactivated';

  @Prop()
  invitedVia?: 'whatsapp' | 'sms' | 'email';

  @Prop()
  createdBy?: string;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const TeamMemberProfileSchema = SchemaFactory.createForClass(TeamMemberProfile);
TeamMemberProfileSchema.index({ hospitalId: 1 });
