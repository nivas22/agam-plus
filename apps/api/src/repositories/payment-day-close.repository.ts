import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  PaymentDayClose,
  PaymentDayCloseDocument,
} from '../schemas/payment-day-close.schema';
import { toPlain } from './mongo.util';

@Injectable()
export class PaymentDayCloseRepository {
  constructor(
    @InjectModel(PaymentDayClose.name)
    private readonly model: Model<PaymentDayCloseDocument>,
  ) {}

  async getByDate(hospitalId: string, date: string) {
    const doc = await this.model.findOne({ hospitalId, date }).lean();
    return toPlain(doc);
  }

  async create(data: any) {
    const doc = await this.model.create({ ...data, closedAt: new Date() });
    return toPlain(doc.toObject());
  }

  // Powers the Team member profile's "Drawer variance" stat.
  async sumVarianceByUser(hospitalId: string, userId: string): Promise<{ total: number; days: number }> {
    const result = await this.model.aggregate([
      { $match: { hospitalId, closedByUserId: userId } },
      { $group: { _id: null, total: { $sum: '$variance' }, days: { $sum: 1 } } },
    ]);
    return { total: result[0]?.total ?? 0, days: result[0]?.days ?? 0 };
  }

  // The set of calendar dates (in range) that have been closed, regardless
  // of who closed them — powers the Daily collection report's "days closed"
  // tile and the per-user "days closed" ratio.
  async listClosedDatesInRange(hospitalId: string, startDate: string, endDate: string): Promise<string[]> {
    const docs = await this.model
      .find({ hospitalId, date: { $gte: startDate, $lte: endDate } }, { date: 1 })
      .lean();
    return docs.map((d) => d.date);
  }

  // Total drawer variance per staff member in range — a range-scoped sibling
  // of sumVarianceByUser (which is all-time).
  async aggregateVarianceByUserInRange(hospitalId: string, startDate: string, endDate: string) {
    const rows = await this.model.aggregate([
      { $match: { hospitalId, date: { $gte: startDate, $lte: endDate } } },
      { $group: { _id: '$closedByUserId', total: { $sum: '$variance' }, days: { $sum: 1 } } },
    ]);
    return rows.map((r) => ({ userId: r._id as string, total: r.total as number, days: r.days as number }));
  }
}
