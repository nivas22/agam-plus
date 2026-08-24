import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { DB_COLLECTIONS, HOLIDAY_CLOSURE_TYPE } from '../constants';

export type HospitalHolidayDocument = HydratedDocument<HospitalHoliday>;

@Schema({
  collection: DB_COLLECTIONS.HOSPITAL_HOLIDAYS,
  strict: false,
  timestamps: false,
})
export class HospitalHoliday {
  @Prop({ required: true, index: true })
  hospitalId: string;

  @Prop({ required: true })
  name: string;

  // YYYY-MM-DD, inclusive range.
  @Prop({ required: true })
  startsOn: string;

  @Prop({ required: true })
  endsOn: string;

  @Prop({ required: true, enum: Object.values(HOLIDAY_CLOSURE_TYPE) })
  closureType: string;

  // "HH:MM" — required only when closureType is HALF_DAY.
  @Prop()
  halfDayUntil?: string;

  // Only for fixed-date holidays — lunar festivals must be confirmed yearly.
  @Prop({ required: true, default: false })
  repeatsAnnually: boolean;

  // doctorProfileIds who still see patients this day.
  @Prop({ type: [String], default: [] })
  exceptionDoctorIds: string[];

  @Prop({ required: true, enum: ['active', 'removed'], default: 'active', index: true })
  status: string;

  // Set when this row was created by "generate-repeats" — points at the
  // prior year's row it was copied from.
  @Prop()
  sourceHolidayId?: string;

  @Prop()
  createdBy?: string;

  @Prop()
  createdByName?: string;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const HospitalHolidaySchema = SchemaFactory.createForClass(HospitalHoliday);
HospitalHolidaySchema.index({ hospitalId: 1, startsOn: 1 });
HospitalHolidaySchema.index({ hospitalId: 1, status: 1 });
