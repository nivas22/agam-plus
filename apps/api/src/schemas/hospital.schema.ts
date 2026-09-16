import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { DB_COLLECTIONS } from '../constants';

export type HospitalDocument = HydratedDocument<Hospital>;

@Schema({ collection: DB_COLLECTIONS.HOSPITALS, strict: false, timestamps: false })
export class Hospital {
  @Prop({ required: true })
  name: string;

  @Prop()
  address?: string;

  // Shown on the prescription preview's "Reg. No." line when present; no
  // admin UI to edit this yet, so it's set directly in the DB for now.
  @Prop()
  registrationNumber?: string;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const HospitalSchema = SchemaFactory.createForClass(Hospital);
