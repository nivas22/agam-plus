import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { DB_COLLECTIONS, WHATSAPP_ENQUIRY_STATUS } from '../constants';

export type WhatsappEnquiryDocument = HydratedDocument<WhatsappEnquiry>;

@Schema({
  collection: DB_COLLECTIONS.WHATSAPP_ENQUIRIES,
  strict: false,
  timestamps: false,
})
export class WhatsappEnquiry {
  @Prop({ required: true, index: true })
  hospitalId: string;

  @Prop({ required: true })
  fromPhone: string;

  @Prop()
  patientId?: string;

  @Prop()
  patientName?: string;

  @Prop({ required: true })
  message: string;

  @Prop({
    required: true,
    enum: Object.values(WHATSAPP_ENQUIRY_STATUS),
    default: WHATSAPP_ENQUIRY_STATUS.NEW,
  })
  status: string;

  @Prop()
  createdAt?: Date;

  @Prop()
  resolvedAt?: Date;

  @Prop()
  resolvedBy?: string;
}

export const WhatsappEnquirySchema = SchemaFactory.createForClass(WhatsappEnquiry);
WhatsappEnquirySchema.index({ hospitalId: 1, status: 1, createdAt: -1 });
