import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { DB_COLLECTIONS } from '../constants';

export type AuditLogEntryDocument = HydratedDocument<AuditLogEntry>;

// Write-only/immutable — deliberately no update/delete methods anywhere in
// AuditLogRepository, matching "entries cannot be edited or deleted by
// anyone, including the owner" from the audit trail mockup.
@Schema({
  collection: DB_COLLECTIONS.AUDIT_LOG,
  strict: false,
  timestamps: false,
})
export class AuditLogEntry {
  @Prop({ required: true, index: true })
  hospitalId: string;

  @Prop({ required: true, index: true })
  at: Date;

  @Prop({ required: true })
  actorUserId: string;

  @Prop({ required: true })
  actorName: string;

  @Prop({ required: true })
  actorRole: string;

  // e.g. 'refund.approved', 'team_member.created', 'role.updated', 'day_close.closed', 'access.signed_in'
  @Prop({ required: true })
  action: string;

  @Prop({ required: true, enum: ['money', 'appointments', 'settings', 'access', 'patients', 'doctors'], index: true })
  area: string;

  @Prop({ required: true })
  summary: string;

  @Prop({ type: Object })
  detail?: Record<string, any>;

  @Prop()
  amount?: number;
}

export const AuditLogEntrySchema = SchemaFactory.createForClass(AuditLogEntry);
AuditLogEntrySchema.index({ hospitalId: 1, at: -1 });
AuditLogEntrySchema.index({ hospitalId: 1, actorUserId: 1, at: -1 });
