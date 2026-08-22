import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Payment, PaymentDocument } from '../schemas/payment.schema';
import { toPlain, toPlainList } from './mongo.util';

@Injectable()
export class PaymentRepository {
  constructor(
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<PaymentDocument>,
  ) {}

  async getPaymentByAppointmentId(hospitalId: string, appointmentId: string) {
    const doc = await this.paymentModel
      .findOne({ hospitalId, appointmentId })
      .lean();
    return toPlain(doc);
  }

  async getPaymentById(hospitalId: string, paymentId: string) {
    const doc = await this.paymentModel
      .findOne({ _id: paymentId, hospitalId })
      .lean();
    return toPlain(doc);
  }

  async getPaymentsWithFilters(options: {
    hospitalId: string;
    status?: string;
    method?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }) {
    const filter: Record<string, any> = { hospitalId: options.hospitalId };
    if (options.status) filter.status = options.status;
    if (options.method) filter.method = options.method;
    if (options.startDate || options.endDate) {
      filter.createdAt = {};
      if (options.startDate)
        filter.createdAt.$gte = new Date(options.startDate);
      if (options.endDate) filter.createdAt.$lte = new Date(options.endDate);
    }

    let query = this.paymentModel.find(filter).sort({ createdAt: -1 });
    if (options.limit) query = query.limit(options.limit);

    const docs = await query.lean();
    return toPlainList(docs);
  }

  async countPaymentsForYear(hospitalId: string, invoiceYear: number) {
    return this.paymentModel.countDocuments({ hospitalId, invoiceYear });
  }

  async getPaymentsForDateRange(hospitalId: string, start: Date, end: Date) {
    const docs = await this.paymentModel
      .find({ hospitalId, createdAt: { $gte: start, $lt: end } })
      .lean();
    return toPlainList(docs);
  }

  async getPaymentsByAppointmentIds(
    hospitalId: string,
    appointmentIds: string[],
  ) {
    if (appointmentIds.length === 0) return [];
    const docs = await this.paymentModel
      .find({ hospitalId, appointmentId: { $in: appointmentIds } })
      .lean();
    return toPlainList(docs);
  }

  async createPayment(paymentData: any) {
    const doc = await this.paymentModel.create({
      ...paymentData,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return toPlain(doc.toObject());
  }

  async updatePayment(hospitalId: string, paymentId: string, updates: any) {
    await this.paymentModel.updateOne(
      { _id: paymentId, hospitalId },
      { $set: { ...updates, updatedAt: new Date() } },
    );
  }
}
