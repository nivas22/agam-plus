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
}
