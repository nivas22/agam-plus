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

  // Powers the Daily collection report's "package sales" chart segment and
  // the sold-this-period insight — grouped by the calendar day the package
  // was sold (not when its visits get used).
  async aggregateSalesByDay(hospitalId: string, start: Date, end: Date) {
    const rows = await this.packageModel.aggregate([
      { $match: { hospitalId, createdAt: { $gte: start, $lt: end } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          amount: { $sum: '$amountPaid' },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    return rows.map((r) => ({ date: r._id as string, amount: r.amount as number }));
  }
}
