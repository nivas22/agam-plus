import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { DB_COLLECTIONS } from '../constants';

export type WhatsappConfigDocument = HydratedDocument<WhatsappConfig>;

// A hospital's own WhatsApp Business Account: which number patients message,
// and the credentials to send as it.
@Schema({
  collection: DB_COLLECTIONS.WHATSAPP_CONFIGS,
  strict: false,
  timestamps: false,
})
export class WhatsappConfig {
  @Prop({ required: true })
  hospitalId: string;

  // Inbound webhooks carry this in value.metadata.phone_number_id — it's how
  // we resolve which hospital a message belongs to.
  @Prop({ required: true })
  phoneNumberId: string;

  // Both copied from Meta at connect time, for display only.
  @Prop()
  businessPhoneNumber?: string;

  @Prop()
  verifiedName?: string;

  @Prop({ required: true })
  wabaId: string;

  // AES-256-GCM ciphertext — see common/crypto.util.ts.
  @Prop({ required: true })
  accessTokenEnc: string;

  @Prop({ required: true, default: false })
  connected: boolean;

  @Prop()
  connectedAt?: Date;

  @Prop()
  connectedBy?: string;

  @Prop()
  disconnectedAt?: Date;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const WhatsappConfigSchema = SchemaFactory.createForClass(WhatsappConfig);
WhatsappConfigSchema.index({ hospitalId: 1 }, { unique: true });
WhatsappConfigSchema.index({ phoneNumberId: 1 }, { unique: true });
