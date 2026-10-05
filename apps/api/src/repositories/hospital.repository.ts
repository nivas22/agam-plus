import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Hospital, HospitalDocument } from '../schemas/hospital.schema';
import { toPlain, toPlainList } from './mongo.util';
import { resolveTimezone } from '../common/hospital-time.util';

const TIMEZONE_CACHE_MS = 60_000;

@Injectable()
export class HospitalRepository {
  private readonly timezoneCache = new Map<string, { tz: string; expiresAt: number }>();

  constructor(@InjectModel(Hospital.name) private readonly hospitalModel: Model<HospitalDocument>) {}

  async getAllHospitals() {
    const docs = await this.hospitalModel.find().lean();
    return toPlainList(docs);
  }

  async createHospital(data: any) {
    const doc = await this.hospitalModel.create({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return toPlain(doc.toObject());
  }

  async getHospitalById(hospitalId: string) {
    const doc = await this.hospitalModel.findById(hospitalId).lean();
    return toPlain(doc);
  }

  // IANA zone the hospital's appointment dates/times are written in; falls
  // back to DEFAULT_HOSPITAL_TIMEZONE when unset or invalid. Briefly cached —
  // slot searches ask once per candidate date.
  async getTimezone(hospitalId: string): Promise<string> {
    const cached = this.timezoneCache.get(hospitalId);
    if (cached && cached.expiresAt > Date.now()) return cached.tz;
    const doc = await this.hospitalModel.findById(hospitalId, { timezone: 1 }).lean();
    const tz = resolveTimezone((doc as any)?.timezone);
    this.timezoneCache.set(hospitalId, { tz, expiresAt: Date.now() + TIMEZONE_CACHE_MS });
    return tz;
  }

  async updateHospital(hospitalId: string, data: any) {
    const doc = await this.hospitalModel
      .findByIdAndUpdate(hospitalId, { $set: { ...data, updatedAt: new Date() } }, { returnDocument: 'after' })
      .lean();

    if (!doc) {
      throw new Error('Hospital not found');
    }

    this.timezoneCache.delete(hospitalId);
    return toPlain(doc);
  }

  async deleteHospital(hospitalId: string) {
    await this.hospitalModel.deleteOne({ _id: hospitalId });
  }
}
