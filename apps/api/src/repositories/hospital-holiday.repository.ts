import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  HospitalHoliday,
  HospitalHolidayDocument,
} from '../schemas/hospital-holiday.schema';
import { Hospital, HospitalDocument } from '../schemas/hospital.schema';
import { HOSPITAL_MODULE } from '../constants';
import { isHospitalModuleEnabled } from '../hospitals/hospital-modules.util';
import { toPlain, toPlainList } from './mongo.util';

@Injectable()
export class HospitalHolidayRepository {
  constructor(
    @InjectModel(HospitalHoliday.name)
    private readonly model: Model<HospitalHolidayDocument>,
    @InjectModel(Hospital.name)
    private readonly hospitalModel: Model<HospitalDocument>,
  ) {}

  async createHoliday(data: any) {
    const doc = await this.model.create({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return toPlain(doc.toObject());
  }

  async getById(hospitalId: string, holidayId: string) {
    const doc = await this.model.findOne({ _id: holidayId, hospitalId }).lean();
    return toPlain(doc);
  }

  async listByHospitalAndYear(hospitalId: string, year: number) {
    const docs = await this.model
      .find({
        hospitalId,
        status: 'active',
        startsOn: { $lte: `${year}-12-31` },
        endsOn: { $gte: `${year}-01-01` },
      })
      .sort({ startsOn: 1 })
      .lean();
    return toPlainList(docs);
  }

  // Backs both the scheduler's holiday check and the impact-preview lookahead.
  // Returns nothing while the hospital has the Hospital holidays module
  // switched off, so saved holidays stop closing slots along with the screen
  // that manages them (and come back as-is when it's switched on again).
  async getActiveInRange(hospitalId: string, startDate: string, endDate: string) {
    const hospital = await this.hospitalModel.findById(hospitalId, { modules: 1 }).lean();
    if (!isHospitalModuleEnabled(HOSPITAL_MODULE.HOSPITAL_HOLIDAYS, hospital?.modules, undefined)) {
      return [];
    }

    const docs = await this.model
      .find({
        hospitalId,
        status: 'active',
        startsOn: { $lte: endDate },
        endsOn: { $gte: startDate },
      })
      .lean();
    return toPlainList(docs);
  }

  async updateFields(
    hospitalId: string,
    holidayId: string,
    updates: Record<string, any>,
  ) {
    const doc = await this.model
      .findOneAndUpdate(
        { _id: holidayId, hospitalId },
        { $set: { ...updates, updatedAt: new Date() } },
        { new: true },
      )
      .lean();
    return toPlain(doc);
  }

  async setStatus(hospitalId: string, holidayId: string, status: string) {
    const doc = await this.model
      .findOneAndUpdate(
        { _id: holidayId, hospitalId },
        { $set: { status, updatedAt: new Date() } },
        { new: true },
      )
      .lean();
    return toPlain(doc);
  }
}
