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

  // Follow-up the doctor asked for at finish-session ('2-weeks' etc.) and the
  // date it works out to. Booking it is optional and happens at payment.
  @Prop()
  followUpOption?: string;

  @Prop()
  followUpDueDate?: string;

  // Set on the original visit once its follow-up is booked.
  @Prop()
  followUpAppointmentId?: string;

  // Set on a follow-up appointment: the visit it follows up on.
  @Prop()
  followUpOf?: string;

  @Prop()
  packageVisitNumber?: number;

  @Prop()
  notes?: string;

  @Prop()
  sessionNotes?: string;

  // Injections/dressings/tests the doctor logged during the consultation,
  // persisted at session-finish time so they survive into the bill even if
  // payment is collected later, by someone else, on another device.
  @Prop({ type: [Object] })
  givenItems?: Record<string, any>[];

  // Recorded by the front desk at walk-in time — plain object (not a
  // sub-schema) since every field is optional and there's nothing to
  // validate/index at the Mongoose layer beyond what createAppointmentSchema
  // already enforces on the way in.
  @Prop({ type: Object })
  vitals?: {
    bpSystolic?: number;
    bpDiastolic?: number;
    spo2?: number;
    pulse?: number;
    weight?: number;
    temperature?: number;
    height?: number;
  };

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

  // Stamped when the clinical session finishes (in-consultation ->
  // awaiting-payment) — "this visit happened", regardless of billing.
  @Prop()
  completedAt?: Date;

  // Stamped when payment is actually collected (awaiting-payment ->
  // completed) — may be well after completedAt if front desk closes it out
  // later.
  @Prop()
  paymentCollectedAt?: Date;

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

  // Stamped once a WhatsApp reminder has gone out for this appointment, so
  // the reminder cron never messages the same patient twice.
  @Prop()
  reminderSentAt?: Date;
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
