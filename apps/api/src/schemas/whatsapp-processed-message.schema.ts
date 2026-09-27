import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { DB_COLLECTIONS } from '../constants';

export type WhatsappProcessedMessageDocument =
  HydratedDocument<WhatsappProcessedMessage>;

// One row per inbound WhatsApp message ID the webhook has already handled.
// Meta's webhook delivery is at-least-once, so the same message can arrive
// more than once (retries, brief endpoint blips) — this is what lets the
// webhook tell a genuine retry apart from a new message and skip reprocessing
// it (which would otherwise double-book/double-cancel an appointment).
@Schema({
  collection: DB_COLLECTIONS.WHATSAPP_PROCESSED_MESSAGES,
  strict: false,
  timestamps: false,
})
export class WhatsappProcessedMessage {
  @Prop({ required: true, unique: true })
  messageId: string;

  @Prop({ required: true })
  receivedAt: Date;

  // TTL cutoff — Meta doesn't redeliver indefinitely, so there's no need to
  // remember a message ID forever.
  @Prop({ required: true })
  expiresAt: Date;
}

export const WhatsappProcessedMessageSchema = SchemaFactory.createForClass(
  WhatsappProcessedMessage,
);
WhatsappProcessedMessageSchema.index({ messageId: 1 }, { unique: true });
WhatsappProcessedMessageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
