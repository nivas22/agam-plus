import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { DB_COLLECTIONS, PRESCRIPTION_STATUS_VALUES } from '../constants';

@Schema({ _id: false })
export class PrescriptionItem {
  @Prop({ required: true })
  medicineId: string;

  // Snapshotted at add-time so later catalog edits don't rewrite history.
  @Prop({ required: true })
  medicineName: string;

  @Prop()
  strength?: string;

  @Prop()
  form?: string;

  @Prop({ required: true })
  dose: string;

  @Prop()
  frequency?: string;

  @Prop()
  foodTiming?: string;

  @Prop()
  duration?: string;

  @Prop()
  quantity?: string;

  @Prop()
  note?: string;
}

export const PrescriptionItemSchema = SchemaFactory.createForClass(PrescriptionItem);

@Schema({ _id: false })
export class AllergyOverride {
  @Prop({ required: true })
  medicineId: string;

  @Prop({ required: true })
  medicineName: string;

  @Prop({ required: true })
  matchedAllergyTerm: string;

  @Prop({ required: true })
  reason: string;

  @Prop({ required: true })
  overriddenAt: Date;
}

export const AllergyOverrideSchema = SchemaFactory.createForClass(AllergyOverride);

export type PrescriptionDocument = HydratedDocument<Prescription>;

// One prescription per appointment (see the unique index below) — "editing"
// is just re-saving the same doc, matching how session notes work today.
@Schema({ collection: DB_COLLECTIONS.PRESCRIPTIONS, strict: false, timestamps: false })
export class Prescription {
  @Prop({ required: true, index: true })
  hospitalId: string;

  @Prop({ required: true, index: true })
  appointmentId: string;

  @Prop({ required: true, index: true })
  patientId: string;

  @Prop({ required: true, index: true })
  doctorProfileId: string;

  @Prop()
  patientName?: string;

  @Prop()
  doctorName?: string;

  @Prop({ type: [PrescriptionItemSchema], default: [] })
  items: PrescriptionItem[];

  @Prop({ type: [AllergyOverrideSchema], default: [] })
  allergyOverrides: AllergyOverride[];

  @Prop()
  advice?: string;

  @Prop({ required: true, enum: PRESCRIPTION_STATUS_VALUES, default: 'draft' })
  status: string;

  @Prop()
  issuedAt?: Date;

  @Prop()
  createdBy?: string;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const PrescriptionSchema = SchemaFactory.createForClass(Prescription);
PrescriptionSchema.index({ hospitalId: 1, appointmentId: 1 }, { unique: true });
PrescriptionSchema.index({ hospitalId: 1, patientId: 1 });
