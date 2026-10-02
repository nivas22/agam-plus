import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { DB_COLLECTIONS, HOW_OFTEN_VALUES, FOOD_TIMING_OPTIONS } from '../constants';

@Schema({ _id: false })
export class MedicinePackItem {
  @Prop({ required: true })
  medicineId: string;

  // Snapshotted at add-time, same as PrescriptionItem — later catalog edits
  // don't rewrite an already-authored pack.
  @Prop({ required: true })
  medicineName: string;

  @Prop({ required: true, enum: HOW_OFTEN_VALUES })
  howOften: string;

  @Prop({ required: true, enum: FOOD_TIMING_OPTIONS })
  foodTiming: string;

  @Prop({ required: true })
  days: number;

  @Prop()
  note?: string;
}

export const MedicinePackItemSchema = SchemaFactory.createForClass(MedicinePackItem);

export type MedicinePackDocument = HydratedDocument<MedicinePack>;

// Hospital-wide, admin-managed treatment-protocol templates (e.g. "Fever
// pack") the prescription writer can apply in one click. Unlike the charge
// catalog, there's no price history here — just a name and a list of
// medicines with preset doses.
@Schema({ collection: DB_COLLECTIONS.MEDICINE_PACKS, strict: false, timestamps: false })
export class MedicinePack {
  @Prop({ required: true, index: true })
  hospitalId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ type: [MedicinePackItemSchema], default: [] })
  items: MedicinePackItem[];

  @Prop({ required: true, enum: ['active', 'archived'], default: 'active', index: true })
  status: string;

  @Prop()
  createdBy?: string;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const MedicinePackSchema = SchemaFactory.createForClass(MedicinePack);
MedicinePackSchema.index({ hospitalId: 1, status: 1 });
MedicinePackSchema.index({ hospitalId: 1, name: 1 });
