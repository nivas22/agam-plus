import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { DB_COLLECTIONS, MEMBERSHIP_STATUS, ROLE } from '../constants';

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

  // One admin membership per hospital can be flagged the owner — always full
  // permissions (not editable in the Roles & permissions matrix), and the
  // last remaining owner can't be demoted/removed. Distinct from `role`
  // itself: an owner's role is still 'admin'.
  @Prop({ default: false })
  isOwner?: boolean;

  @Prop()
  isDoctor?: boolean;

  @Prop()
  isProfileUpdated?: boolean;

  @Prop()
  isExperienceUpdated?: boolean;

  @Prop()
  isAvailabilityUpdated?: boolean;

  // Whether this doctor is currently bookable at this specific hospital —
  // deliberately separate from `status` (membership approval workflow) and
  // scoped per hospital, since DoctorProfile is one document per user shared
  // across every hospital they belong to.
  @Prop({ default: true })
  isAcceptingBookings?: boolean;

  @Prop()
  availability?: unknown[];

  @Prop()
  appointmentDuration?: number;

  @Prop()
  bufferMinutes?: number;

  @Prop()
  patientsPerSlot?: number;

  // Walk-in carve-out settings, all hospital-scoped like the fields above.
  @Prop()
  acceptWalkIns?: boolean;

  @Prop()
  heldSlotsPerSession?: number;

  // Minutes before a session's end that unclaimed held slots open up to online
  // booking; null means they're never released automatically. Explicit
  // `type: Number` because @nestjs/mongoose can't infer a type from a union
  // via reflection (design:type metadata collapses `number | null` to Object).
  @Prop({ type: Number, default: null })
  releaseHeldSlotsBeforeMinutes?: number | null;

  @Prop({ enum: ['allow', 'warn', 'block'] })
  overCapacityPolicy?: string;

  @Prop()
  lateArrivalGraceMinutes?: number;

  @Prop()
  noShowReleaseMinutes?: number;
}

export const HospitalMemberSchema = SchemaFactory.createForClass(HospitalMember);
HospitalMemberSchema.index({ userId: 1, hospitalId: 1 }, { unique: true });
HospitalMemberSchema.index({ hospitalId: 1, role: 1, status: 1 });
