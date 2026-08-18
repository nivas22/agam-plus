import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { DB_COLLECTIONS, GENDER } from '@agam-plus/shared';

export type PatientDocument = HydratedDocument<Patient>;

@Schema({ collection: DB_COLLECTIONS.PATIENTS, strict: false, timestamps: false })
export class Patient {
  @Prop({ index: true })
  userId?: string;

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
