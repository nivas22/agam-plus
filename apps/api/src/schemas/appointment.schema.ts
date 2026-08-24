import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { DB_COLLECTIONS, APPOINTMENT_TYPE } from '../constants';

export type AppointmentDocument = HydratedDocument<Appointment>;

@Schema({
  collection: DB_COLLECTIONS.APPOINTMENTS,
  strict: false,
  timestamps: false,
})
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

  // Distinguishes an ad-hoc booking from a visit drawn out of a prepaid
  // package — PACKAGE appointments carry packageId/packageVisitNumber below.
  @Prop({ default: APPOINTMENT_TYPE.REGULAR, index: true })
  type?: string;

  @Prop({ index: true })
  packageId?: string;

  @Prop()
  packageVisitNumber?: number;

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
  confirmedAt?: Date;

  @Prop()
  checkedInAt?: Date;

  @Prop()
  waitingAt?: Date;

  @Prop()
  consultationStartedAt?: Date;

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
  cancelReason?: string;

  @Prop()
  noShowReason?: string;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const AppointmentSchema = SchemaFactory.createForClass(Appointment);
AppointmentSchema.index({
  hospitalId: 1,
  doctorProfileId: 1,
  patientId: 1,
  status: 1,
  date: 1,
  time: 1,
});
AppointmentSchema.index({ doctorProfileId: 1, date: 1, status: 1 });
AppointmentSchema.index({ hospitalId: 1, doctorId: 1, date: 1 });
