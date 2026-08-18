import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { DB_COLLECTIONS } from '@agam-plus/shared';

export type AppointmentDocument = HydratedDocument<Appointment>;

@Schema({ collection: DB_COLLECTIONS.APPOINTMENTS, strict: false, timestamps: false })
export class Appointment {
  @Prop({ required: true, index: true })
  hospitalId: string;

  @Prop({ index: true })
  doctorId?: string;

  @Prop({ index: true })
  doctorProfileId?: string;

  @Prop({ required: true, index: true })
  patientId: string;

  // Kept as ISO date/time strings (not native Date) to match existing
  // lexicographic range-query and sort behavior from Firestore.
  @Prop({ required: true })
  date: string;

  @Prop()
  time?: string;

  @Prop({ default: 'scheduled', index: true })
  status?: string;

  @Prop()
  notes?: string;

  @Prop()
  sessionNotes?: string;

  // Denormalized display copies — kept as-is rather than $lookup, matching
  // the existing Firestore repository's write-time denormalization.
  @Prop()
  patientName?: string;

  @Prop()
  doctorName?: string;

  @Prop()
  doctorSpecialization?: string;

  @Prop()
  patientPhone?: string;

  @Prop()
  patientAge?: number;

  @Prop()
  patientGender?: string;

  @Prop()
  completedAt?: Date;

  @Prop()
  rescheduleDate?: string;

  @Prop()
  rescheduleTime?: string;

  @Prop()
  rescheduledAt?: Date;

  @Prop()
  reopenedAt?: Date;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const AppointmentSchema = SchemaFactory.createForClass(Appointment);
AppointmentSchema.index({ hospitalId: 1, doctorProfileId: 1, patientId: 1, status: 1, date: 1, time: 1 });
AppointmentSchema.index({ doctorProfileId: 1, date: 1, status: 1 });
AppointmentSchema.index({ hospitalId: 1, doctorId: 1, date: 1 });
