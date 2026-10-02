import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { DB_COLLECTIONS, DEMO_REQUEST_STATUS } from '../constants';

export type DemoRequestDocument = HydratedDocument<DemoRequest>;

// A "Book a demo" submission from the public marketing site (apps/www) —
// unauthenticated by design. Only Platform Admin > Demo requests reads these.
@Schema({
  collection: DB_COLLECTIONS.DEMO_REQUESTS,
  strict: false,
  timestamps: false,
})
export class DemoRequest {
  @Prop({ required: true })
  hospitalName: string;

  @Prop({ required: true })
  contactName: string;

  @Prop({ required: true })
  phone: string;

  @Prop()
  email?: string;

  @Prop()
  city?: string;

  @Prop()
  doctorCount?: number;

  @Prop()
  message?: string;

  @Prop({
    required: true,
    enum: Object.values(DEMO_REQUEST_STATUS),
    default: DEMO_REQUEST_STATUS.NEW,
  })
  status: string;

  @Prop({ required: true, default: 'website' })
  source: string;

  @Prop()
  createdAt?: Date;

  @Prop()
  contactedAt?: Date;

  @Prop()
  contactedBy?: string;
}

export const DemoRequestSchema = SchemaFactory.createForClass(DemoRequest);
DemoRequestSchema.index({ status: 1, createdAt: -1 });
