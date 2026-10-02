import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SubscriptionInvoice, SubscriptionInvoiceDocument } from '../schemas/subscription-invoice.schema';
import { Counter, CounterDocument } from '../schemas/counter.schema';
import { toPlain, toPlainList } from './mongo.util';

@Injectable()
export class SubscriptionInvoiceRepository {
  constructor(
    @InjectModel(SubscriptionInvoice.name)
    private readonly invoiceModel: Model<SubscriptionInvoiceDocument>,
    @InjectModel(Counter.name)
    private readonly counterModel: Model<CounterDocument>,
  ) {}

  // No legacy data to reconcile against (unlike PaymentRepository's invoice
  // numbering), so a plain atomic $inc is enough to guarantee uniqueness.
  async getNextInvoiceSequence(invoiceYear: number): Promise<number> {
    const key = `subscription-invoice:${invoiceYear}`;
    const bumped = await this.counterModel.findOneAndUpdate(
      { _id: key },
      { $inc: { seq: 1 } },
      { new: true, upsert: true },
    );
    return bumped!.seq;
  }

  async createInvoice(data: any) {
    const doc = await this.invoiceModel.create({ ...data, createdAt: new Date() });
    return toPlain(doc.toObject());
  }

  async getById(invoiceId: string) {
    const doc = await this.invoiceModel.findById(invoiceId).lean();
    return toPlain(doc);
  }

  async getForHospital(hospitalId: string) {
    const docs = await this.invoiceModel.find({ hospitalId }).sort({ createdAt: -1 }).lean();
    return toPlainList(docs);
  }

  async updateById(invoiceId: string, data: any) {
    const doc = await this.invoiceModel
      .findByIdAndUpdate(invoiceId, { $set: data }, { returnDocument: 'after' })
      .lean();
    return toPlain(doc);
  }
}
