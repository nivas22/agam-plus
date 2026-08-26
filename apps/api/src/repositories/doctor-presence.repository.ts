import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  DoctorPresence,
  DoctorPresenceDocument,
} from '../schemas/doctor-presence.schema';
import { toPlain, toPlainList } from './mongo.util';

@Injectable()
export class DoctorPresenceRepository {
  constructor(
    @InjectModel(DoctorPresence.name)
    private readonly model: Model<DoctorPresenceDocument>,
  ) {}

  async getForDate(hospitalId: string, date: string) {
    const docs = await this.model.find({ hospitalId, date }).lean();
    return toPlainList(docs);
  }

  async getForDoctorAndDate(hospitalId: string, doctorId: string, date: string) {
    const doc = await this.model.findOne({ hospitalId, doctorId, date }).lean();
    return toPlain(doc);
  }

  // One doc per hospital+doctor+date — each call replaces whatever was
  // there before, since only the latest state matters here (history is the
  // audit log's job, not this collection's).
  async upsert(
    hospitalId: string,
    doctorId: string,
    date: string,
    data: Partial<DoctorPresence>,
  ) {
    const doc = await this.model.findOneAndUpdate(
      { hospitalId, doctorId, date },
      { $set: data },
      { upsert: true, new: true },
    );
    return toPlain(doc!.toObject());
  }
}
