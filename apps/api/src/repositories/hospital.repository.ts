import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Hospital, HospitalDocument } from '../schemas/hospital.schema';
import { toPlain, toPlainList } from './mongo.util';

@Injectable()
export class HospitalRepository {
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

  async updateHospital(hospitalId: string, data: any) {
    const doc = await this.hospitalModel
      .findByIdAndUpdate(hospitalId, { $set: { ...data, updatedAt: new Date() } }, { returnDocument: 'after' })
      .lean();

    if (!doc) {
      throw new Error('Hospital not found');
    }

    return toPlain(doc);
  }

  async deleteHospital(hospitalId: string) {
    await this.hospitalModel.deleteOne({ _id: hospitalId });
  }
}
