import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Medicine, MedicineDocument } from '../schemas/medicine.schema';
import { toPlain, toPlainList } from './mongo.util';

interface ListFilters {
  status?: string;
}

@Injectable()
export class MedicineRepository {
  constructor(
    @InjectModel(Medicine.name)
    private readonly model: Model<MedicineDocument>,
  ) {}

  async createItem(data: any) {
    const doc = await this.model.create({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return toPlain(doc.toObject());
  }

  async getById(hospitalId: string, medicineId: string) {
    const doc = await this.model.findOne({ _id: medicineId, hospitalId }).lean();
    return toPlain(doc);
  }

  async getByIds(hospitalId: string, medicineIds: string[]) {
    if (medicineIds.length === 0) return [];
    const docs = await this.model
      .find({ _id: { $in: medicineIds }, hospitalId })
      .lean();
    return toPlainList(docs);
  }

  async listByHospital(hospitalId: string, filters: ListFilters = {}) {
    const query: Record<string, any> = { hospitalId };
    if (filters.status) query.status = filters.status;
    const docs = await this.model.find(query).sort({ name: 1 }).lean();
    return toPlainList(docs);
  }

  // Used to decide whether a hospital's catalog still needs its one-time
  // default seed — cheaper than fetching every item just to check length.
  async countAllByHospital(hospitalId: string): Promise<number> {
    return this.model.countDocuments({ hospitalId });
  }

  async updateFields(hospitalId: string, medicineId: string, updates: Record<string, any>) {
    const doc = await this.model
      .findOneAndUpdate(
        { _id: medicineId, hospitalId },
        { $set: { ...updates, updatedAt: new Date() } },
        { new: true },
      )
      .lean();
    return toPlain(doc);
  }

  async setStatus(hospitalId: string, medicineId: string, status: string) {
    const doc = await this.model
      .findOneAndUpdate(
        { _id: medicineId, hospitalId },
        { $set: { status, updatedAt: new Date() } },
        { new: true },
      )
      .lean();
    return toPlain(doc);
  }
}
