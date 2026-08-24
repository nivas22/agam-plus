import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { DB_COLLECTIONS, MEDICINE_FORM_VALUES } from '../constants';

export type MedicineDocument = HydratedDocument<Medicine>;

@Schema({ collection: DB_COLLECTIONS.MEDICINES, strict: false, timestamps: false })
export class Medicine {
  @Prop({ required: true, index: true })
  hospitalId: string;

  @Prop({ required: true })
  name: string;

  @Prop()
  genericName?: string;

  // Free-text allergy-class tags (lowercased at write time), e.g. ["penicillin"].
  // Not a fixed enum — a hospital's own vocabulary, matched against a
  // patient's `allergies` strings by the prescription writer.
  @Prop({ type: [String], default: [] })
  classes: string[];

  @Prop({ required: true, enum: MEDICINE_FORM_VALUES })
  form: string;

  @Prop()
  strength?: string;

  @Prop()
  defaultDose?: string;

  @Prop()
  defaultFrequency?: string;

  @Prop()
  defaultFoodTiming?: string;

  @Prop({ required: true, enum: ['active', 'archived'], default: 'active', index: true })
  status: string;

  @Prop()
  createdBy?: string;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const MedicineSchema = SchemaFactory.createForClass(Medicine);
MedicineSchema.index({ hospitalId: 1, status: 1 });
MedicineSchema.index({ hospitalId: 1, name: 1 });
