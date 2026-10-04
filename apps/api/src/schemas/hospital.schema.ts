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

  // Hospital-admin-configurable list offered in the doctor specialization
  // dropdown (AddEditDoctor). Falls back to a hardcoded default list on the
  // frontend when empty.
  @Prop({ type: [String], default: [] })
  specializations?: string[];

  // Hospital-admin-configured fields for the patient form's Notes section
  // (built-ins on/off + relabelled, plus custom fields). Empty means the
  // built-in defaults — see HospitalsService.getPatientNoteFields.
  @Prop({ type: [Object], default: undefined })
  patientNoteFields?: Record<string, any>[];

  // Hospital-admin on/off switches per HOSPITAL_MODULE (Settings > Features).
  // A missing key means on — see resolveHospitalModules.
  @Prop({ type: Object, default: undefined })
  modules?: Record<string, boolean>;

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
