import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { DB_COLLECTIONS, GENDER } from '../constants';

export type PatientDocument = HydratedDocument<Patient>;

@Schema({ collection: DB_COLLECTIONS.PATIENTS, strict: false, timestamps: false })
export class Patient {
  @Prop({ index: true })
  userId?: string;

  // Links this hospital-scoped record to the patient's global, phone-verified
  // PatientAccount identity (the patient app) — null until the patient
  // verifies via OTP with a matching phone, or was already verified when
  // this record was created. See PatientAccount for the account itself.
  @Prop({ index: true })
  patientAccountId?: string;

  @Prop({ required: true, index: true })
  hospitalId: string;

  @Prop()
  patientId?: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true, index: true })
  email: string;

  @Prop({ required: true })
  phone: string;

  @Prop()
  secondaryPhone?: string;

  @Prop()
  dateOfBirth?: string;

  @Prop({ enum: Object.values(GENDER) })
  gender?: string;

  @Prop()
  bloodGroup?: string;

  @Prop()
  age?: string;

  @Prop()
  address?: string;

  // Free-text allergy terms (e.g. "Penicillin") — matched against a
  // Medicine's classes/name by PrescriptionsService's allergy check.
  @Prop({ type: [String], default: [] })
  allergies?: string[];

  @Prop({ default: 'active', index: true })
  status?: string;

  @Prop()
  doctorId?: string;

  @Prop()
  notes?: string;

  @Prop()
  createdBy?: string;

  @Prop()
  membershipId?: string;

  @Prop()
  lookingForSpecialization?: string;

  @Prop()
  archivedAt?: Date;

  @Prop()
  archivedBy?: string;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const PatientSchema = SchemaFactory.createForClass(Patient);
PatientSchema.index({ hospitalId: 1, doctorId: 1 });
PatientSchema.index({ hospitalId: 1, email: 1 });
