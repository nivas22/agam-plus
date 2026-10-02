import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { DB_COLLECTIONS, WHATSAPP_STEP } from '../constants';

export type WhatsappSessionDocument = HydratedDocument<WhatsappSession>;

@Schema({
  collection: DB_COLLECTIONS.WHATSAPP_SESSIONS,
  strict: false,
  timestamps: false,
})
export class WhatsappSession {
  @Prop({ required: true })
  hospitalId: string;

  // Meta's wa_id: digits, no '+'. Not run through normalizePhone — that trims
  // to the last 10 digits, which would collide across country codes.
  @Prop({ required: true })
  fromPhone: string;

  @Prop({ required: true, enum: Object.values(WHATSAPP_STEP) })
  currentStep: string;

  @Prop({ type: Object, default: {} })
  collectedData: Record<string, any>;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const WhatsappSessionSchema = SchemaFactory.createForClass(WhatsappSession);
WhatsappSessionSchema.index({ hospitalId: 1, fromPhone: 1 }, { unique: true });
// Mongo TTL — abandoned conversations clean themselves up.
WhatsappSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
