import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { DB_COLLECTIONS } from '../constants';

export type CounterDocument = HydratedDocument<Counter>;

// One document per sequence (e.g. "invoice:<hospitalId>:<year>"), advanced
// via findOneAndUpdate $inc so concurrent requests can never both read the
// same "current" value before either has written — the read-then-write race
// a plain countDocuments() has (see PaymentRepository.getNextInvoiceSequence).
@Schema({ collection: DB_COLLECTIONS.COUNTERS, timestamps: false })
export class Counter {
  @Prop({ required: true })
  _id: string;

  @Prop({ required: true, default: 0 })
  seq: number;
}

export const CounterSchema = SchemaFactory.createForClass(Counter);
