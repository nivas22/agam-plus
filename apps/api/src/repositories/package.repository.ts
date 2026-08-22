import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Package, PackageDocument } from '../schemas/package.schema';
import { toPlain, toPlainList } from './mongo.util';

@Injectable()
export class PackageRepository {
  constructor(
    @InjectModel(Package.name)
    private readonly packageModel: Model<PackageDocument>,
  ) {}

  async createPackage(data: any) {
    const doc = await this.packageModel.create({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return toPlain(doc.toObject());
  }

  async getPackageById(hospitalId: string, packageId: string) {
    const doc = await this.packageModel
      .findOne({ _id: packageId, hospitalId })
      .lean();
    return toPlain(doc);
  }

  async getPackagesByHospital(
    hospitalId: string,
    patientId?: string,
    doctorProfileId?: string,
  ) {
    const filter: Record<string, any> = { hospitalId };
    if (patientId) filter.patientId = patientId;
    if (doctorProfileId) filter.doctorProfileId = doctorProfileId;

    const docs = await this.packageModel
      .find(filter)
      .sort({ createdAt: -1 })
      .lean();
    return toPlainList(docs);
  }

  async updatePackage(hospitalId: string, packageId: string, updates: any) {
    const doc = await this.packageModel
      .findOneAndUpdate(
        { _id: packageId, hospitalId },
        { $set: { ...updates, updatedAt: new Date() } },
        { new: true },
      )
      .lean();
    return toPlain(doc);
  }
}
