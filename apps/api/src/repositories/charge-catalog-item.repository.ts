import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ChargeCatalogItem,
  ChargeCatalogItemDocument,
  ChargeCatalogPriceVersion,
} from '../schemas/charge-catalog-item.schema';
import { toPlain, toPlainList } from './mongo.util';

interface ListFilters {
  category?: string;
  status?: string;
}

@Injectable()
export class ChargeCatalogItemRepository {
  constructor(
    @InjectModel(ChargeCatalogItem.name)
    private readonly model: Model<ChargeCatalogItemDocument>,
  ) {}

  async createItem(data: any) {
    const doc = await this.model.create({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return toPlain(doc.toObject());
  }

  async getById(hospitalId: string, itemId: string) {
    const doc = await this.model.findOne({ _id: itemId, hospitalId }).lean();
    return toPlain(doc);
  }

  async listByHospital(hospitalId: string, filters: ListFilters = {}) {
    const query: Record<string, any> = { hospitalId };
    if (filters.category) query.category = filters.category;
    if (filters.status) query.status = filters.status;
    const docs = await this.model.find(query).sort({ name: 1 }).lean();
    return toPlainList(docs);
  }

  async countByHospitalAndCategory(
    hospitalId: string,
    category: string,
  ): Promise<number> {
    return this.model.countDocuments({ hospitalId, category });
  }

  // Used to decide whether a hospital's catalog still needs its one-time
  // default seed — cheaper than fetching every item just to check length.
  async countAllByHospital(hospitalId: string): Promise<number> {
    return this.model.countDocuments({ hospitalId });
  }

  async updateFields(
    hospitalId: string,
    itemId: string,
    updates: Record<string, any>,
  ) {
    const doc = await this.model
      .findOneAndUpdate(
        { _id: itemId, hospitalId },
        { $set: { ...updates, updatedAt: new Date() } },
        { new: true },
      )
      .lean();
    return toPlain(doc);
  }

  async pushPriceVersion(
    hospitalId: string,
    itemId: string,
    version: ChargeCatalogPriceVersion,
  ) {
    const doc = await this.model
      .findOneAndUpdate(
        { _id: itemId, hospitalId },
        {
          $push: { priceHistory: version },
          $set: { updatedAt: new Date() },
        },
        { new: true },
      )
      .lean();
    return toPlain(doc);
  }

  // Overwrites an already-queued future version for the same effectiveFrom
  // date instead of stacking a second entry for the same day.
  async replacePendingVersion(
    hospitalId: string,
    itemId: string,
    effectiveFrom: string,
    version: ChargeCatalogPriceVersion,
  ) {
    const doc = await this.model
      .findOneAndUpdate(
        { _id: itemId, hospitalId, 'priceHistory.effectiveFrom': effectiveFrom },
        {
          $set: {
            'priceHistory.$': version,
            updatedAt: new Date(),
          },
        },
        { new: true },
      )
      .lean();
    return toPlain(doc);
  }

  async setStatus(hospitalId: string, itemId: string, status: string) {
    const doc = await this.model
      .findOneAndUpdate(
        { _id: itemId, hospitalId },
        { $set: { status, updatedAt: new Date() } },
        { new: true },
      )
      .lean();
    return toPlain(doc);
  }
}
