import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MedicinePack, MedicinePackDocument } from '../schemas/medicine-pack.schema';
import { toPlain, toPlainList } from './mongo.util';

interface ListFilters {
  status?: string;
}

@Injectable()
export class MedicinePackRepository {
  constructor(
    @InjectModel(MedicinePack.name)
    private readonly model: Model<MedicinePackDocument>,
  ) {}

  async createItem(data: any) {
    const doc = await this.model.create({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return toPlain(doc.toObject());
  }

  async getById(hospitalId: string, packId: string) {
    const doc = await this.model.findOne({ _id: packId, hospitalId }).lean();
    return toPlain(doc);
  }

  async listByHospital(hospitalId: string, filters: ListFilters = {}) {
    const query: Record<string, any> = { hospitalId };
    if (filters.status) query.status = filters.status;
    const docs = await this.model.find(query).sort({ name: 1 }).lean();
    return toPlainList(docs);
  }

  async updateFields(hospitalId: string, packId: string, updates: Record<string, any>) {
    const doc = await this.model
      .findOneAndUpdate(
        { _id: packId, hospitalId },
        { $set: { ...updates, updatedAt: new Date() } },
        { new: true },
      )
      .lean();
    return toPlain(doc);
  }

  async setStatus(hospitalId: string, packId: string, status: string) {
    const doc = await this.model
      .findOneAndUpdate(
        { _id: packId, hospitalId },
        { $set: { status, updatedAt: new Date() } },
        { new: true },
      )
      .lean();
    return toPlain(doc);
  }
}
