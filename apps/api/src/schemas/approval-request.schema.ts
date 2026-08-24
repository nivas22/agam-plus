import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { DB_COLLECTIONS } from '../constants';

export type ApprovalRequestDocument = HydratedDocument<ApprovalRequest>;

@Schema({ _id: false })
class ApprovalActor {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  role: string;
}
const ApprovalActorSchema = SchemaFactory.createForClass(ApprovalActor);

@Schema({
  collection: DB_COLLECTIONS.APPROVAL_REQUESTS,
  strict: false,
  timestamps: false,
})
export class ApprovalRequest {
  @Prop({ required: true, index: true })
  hospitalId: string;

  // Permission action key from permission-catalog.ts, e.g. 'issue_refund'.
  @Prop({ required: true })
  action: string;

  @Prop({ required: true, enum: ['pending', 'approved', 'declined'], index: true, default: 'pending' })
  status: string;

  @Prop({ type: ApprovalActorSchema, required: true })
  requestedBy: ApprovalActor;

  @Prop({ required: true })
  requestedAt: Date;

  @Prop()
  reason?: string;

  // The original request body + route params, replayed against the real
  // service method once approved (see ApprovalsService.approve).
  @Prop({ type: Object, required: true })
  payload: Record<string, any>;

  @Prop({ type: ApprovalActorSchema })
  resolvedBy?: ApprovalActor;

  @Prop()
  resolvedAt?: Date;

  @Prop()
  resolutionNote?: string;
}

export const ApprovalRequestSchema = SchemaFactory.createForClass(ApprovalRequest);
ApprovalRequestSchema.index({ hospitalId: 1, status: 1, requestedAt: -1 });
