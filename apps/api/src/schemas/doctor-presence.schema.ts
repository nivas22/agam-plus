import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { DB_COLLECTIONS } from '../constants';

export type DoctorPresenceDocument = HydratedDocument<DoctorPresence>;

// Current presence flag for one doctor on one day — front desk or the
// doctor themself sets it (see DoctorPresenceController); superseded
// whenever a new one is set for the same hospital+doctor+date, so this
// collection only ever holds the LATEST state. Full history of who changed
// what and when lives in the audit log instead (see DoctorPresenceService,
// action 'doctor.presence_changed') rather than duplicating it here.
@Schema({
  collection: DB_COLLECTIONS.DOCTOR_PRESENCE,
  strict: false,
  timestamps: false,
})
export class DoctorPresence {
  @Prop({ required: true, index: true })
  hospitalId: string;

  @Prop({ required: true, index: true })
  doctorId: string;

  // YYYY-MM-DD, hospital-local — same convention as Appointment.date.
  @Prop({ required: true })
  date: string;

  @Prop({
    required: true,
    enum: ['here', 'runningLate', 'onBreak', 'notIn', 'leftForDay'],
  })
  kind: string;

  // runningLate
  @Prop()
  expectedTime?: string;

  // onBreak
  @Prop()
  returnTime?: string;

  // notIn
  @Prop()
  reason?: string;

  @Prop()
  toldBy?: string;

  @Prop()
  note?: string;

  @Prop({ required: true })
  setByUserId: string;

  @Prop({ required: true })
  setByName: string;

  @Prop({ required: true })
  setAt: Date;
}

export const DoctorPresenceSchema =
  SchemaFactory.createForClass(DoctorPresence);
DoctorPresenceSchema.index(
  { hospitalId: 1, doctorId: 1, date: 1 },
  { unique: true },
);
