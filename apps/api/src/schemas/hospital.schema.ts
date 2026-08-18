import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { DB_COLLECTIONS } from '@agam-plus/shared';

export type HospitalDocument = HydratedDocument<Hospital>;

@Schema({ collection: DB_COLLECTIONS.HOSPITALS, strict: false, timestamps: false })
export class Hospital {
  @Prop({ required: true })
  name: string;

  @Prop()
  address?: string;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const HospitalSchema = SchemaFactory.createForClass(Hospital);
