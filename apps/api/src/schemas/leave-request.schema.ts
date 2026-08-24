import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { DB_COLLECTIONS, LEAVE_REQUEST_STATUS_VALUES } from '../constants';

export type LeaveRequestDocument = HydratedDocument<LeaveRequest>;

@Schema({ _id: false })
class LeaveRequestActor {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  role: string;
}
const LeaveRequestActorSchema = SchemaFactory.createForClass(LeaveRequestActor);

@Schema({
  collection: DB_COLLECTIONS.LEAVE_REQUESTS,
  strict: false,
  timestamps: false,
})
export class LeaveRequest {
  @Prop({ required: true, index: true })
  hospitalId: string;

  @Prop({ required: true, index: true })
  doctorProfileId: string;

  @Prop()
  doctorName?: string;

  // YYYY-MM-DD, inclusive range.
  @Prop({ required: true })
  startDate: string;

  @Prop({ required: true })
  endDate: string;

  @Prop()
  reason?: string;

  // Snapshotted when the request was filed — how many of the doctor's own
  // appointments fell inside [startDate, endDate] at that moment. Purely
  // informational; approving a leave request does not move or cancel
  // appointments (see hospital-holidays for the module that actually does
  // that kind of reschedule).
  @Prop({ required: true, default: 0 })
  affectedAppointmentCount: number;

  @Prop({ required: true, enum: LEAVE_REQUEST_STATUS_VALUES, default: 'pending', index: true })
  status: string;

  @Prop({ type: LeaveRequestActorSchema, required: true })
  requestedBy: LeaveRequestActor;

  @Prop({ required: true })
  requestedAt: Date;

  @Prop({ type: LeaveRequestActorSchema })
  resolvedBy?: LeaveRequestActor;

  @Prop()
  resolvedAt?: Date;

  @Prop()
  resolutionNote?: string;

  // Bumped by the doctor's "Nudge" action on a stale pending request — no
  // notification channel exists yet, so this is just a timestamp for the UI
  // to show "nudged 3d ago" and disable repeat-nudging on the same day.
  @Prop()
  lastNudgedAt?: Date;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const LeaveRequestSchema = SchemaFactory.createForClass(LeaveRequest);
LeaveRequestSchema.index({ hospitalId: 1, doctorProfileId: 1, status: 1 });
LeaveRequestSchema.index({ hospitalId: 1, status: 1 });
