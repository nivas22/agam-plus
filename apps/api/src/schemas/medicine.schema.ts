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

  // Alternate trade names shown under the generic name on the prescription
  // preview, e.g. ["Azithral", "Azee", "Zithrox"] for genericName "Azithromycin".
  @Prop({ type: [String], default: [] })
  brandNames?: string[];

  // Drugs & Cosmetics Act schedule, e.g. "H", "H1", "X" — undefined/"" means
  // OTC/unclassified. Shown as a badge on the prescription and drives no
  // enforcement here, just a printed label for the pharmacy.
  @Prop()
  scheduleClass?: string;

  // Hospital-wide (not per-doctor) quick-access flag, toggled from the
  // catalog — surfaces in the prescription writer's "My favourites" filter.
  @Prop({ default: false, index: true })
  isFavourite?: boolean;

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
