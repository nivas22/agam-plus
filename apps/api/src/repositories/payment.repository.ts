import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Payment, PaymentDocument } from '../schemas/payment.schema';
import { toPlain, toPlainList } from './mongo.util';
import { PAYMENT_METHOD, PAYMENT_STATUS } from '../constants';

// Shared by aggregateCollectionByDay/ByUser — splits a paid payment's total
// into the cash/UPI legs that actually moved through the drawer vs UPI,
// mirroring PaymentsService.aggregateDayTotals' cash/UPI/split handling.
const cashLegExpr = {
  $switch: {
    branches: [
      { case: { $eq: ['$method', PAYMENT_METHOD.CASH] }, then: '$total' },
      { case: { $eq: ['$method', PAYMENT_METHOD.SPLIT] }, then: { $ifNull: ['$splitCashAmount', 0] } },
    ],
    default: 0,
  },
};
const upiLegExpr = {
  $switch: {
    branches: [
      { case: { $eq: ['$method', PAYMENT_METHOD.UPI] }, then: '$total' },
      { case: { $eq: ['$method', PAYMENT_METHOD.SPLIT] }, then: { $ifNull: ['$splitUpiAmount', 0] } },
    ],
    default: 0,
  },
};

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
    patientId?: string;
    doctorProfileId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }) {
    const filter: Record<string, any> = { hospitalId: options.hospitalId };
    if (options.status) filter.status = options.status;
    if (options.method) filter.method = options.method;
    if (options.patientId) filter.patientId = options.patientId;
    if (options.doctorProfileId)
      filter.doctorProfileId = options.doctorProfileId;
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

  // Powers the Team member profile's "Collected · <month>" stat.
  async sumCollectedByUser(hospitalId: string, userId: string, start: Date, end: Date): Promise<{ total: number; count: number }> {
    const result = await this.paymentModel.aggregate([
      {
        $match: {
          hospitalId,
          collectedByUserId: userId,
          status: 'paid',
          createdAt: { $gte: start, $lt: end },
        },
      },
      { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } },
    ]);
    return { total: result[0]?.total ?? 0, count: result[0]?.count ?? 0 };
  }

  // Powers the Charge Catalog list/detail's "Used · <month>" column — counts
  // how many bills carried each catalog item in the given window, not the
  // quantity billed.
  async countCatalogItemUsageByWindow(
    hospitalId: string,
    start: Date,
    end: Date,
  ): Promise<Record<string, number>> {
    const results = await this.paymentModel.aggregate([
      { $match: { hospitalId, createdAt: { $gte: start, $lt: end } } },
      { $unwind: '$items' },
      { $match: { 'items.chargeCatalogItemId': { $exists: true, $ne: null } } },
      { $group: { _id: '$items.chargeCatalogItemId', count: { $sum: 1 } } },
    ]);
    const usage: Record<string, number> = {};
    for (const row of results) usage[row._id] = row.count;
    return usage;
  }

  // Powers the Daily collection report's stacked bar chart — one row per day
  // in range with the cash/UPI split of that day's paid visit bills.
  async aggregateCollectionByDay(hospitalId: string, start: Date, end: Date) {
    const rows = await this.paymentModel.aggregate([
      { $match: { hospitalId, status: PAYMENT_STATUS.PAID, createdAt: { $gte: start, $lt: end } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          cash: { $sum: cashLegExpr },
          upi: { $sum: upiLegExpr },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    return rows.map((r) => ({ date: r._id as string, cash: r.cash as number, upi: r.upi as number }));
  }

  // Powers the Daily collection report's "Who collected it" table.
  async aggregateCollectionByUser(hospitalId: string, start: Date, end: Date) {
    const rows = await this.paymentModel.aggregate([
      { $match: { hospitalId, status: PAYMENT_STATUS.PAID, collectedByUserId: { $exists: true, $ne: null }, createdAt: { $gte: start, $lt: end } } },
      {
        $group: {
          _id: '$collectedByUserId',
          name: { $last: '$collectedBy' },
          cash: { $sum: cashLegExpr },
          upi: { $sum: upiLegExpr },
          paymentCount: { $sum: 1 },
        },
      },
      { $sort: { cash: -1, upi: -1 } },
    ]);
    return rows.map((r) => ({
      userId: r._id as string,
      name: r.name as string | undefined,
      cash: r.cash as number,
      upi: r.upi as number,
      paymentCount: r.paymentCount as number,
    }));
  }

  // The distinct calendar days (in range) each user actually collected a
  // payment on — used to work out what fraction of a staff member's active
  // days ended up inside a closed day (see PaymentDayCloseRepository).
  async listActiveDatesByUser(hospitalId: string, start: Date, end: Date): Promise<Record<string, string[]>> {
    const rows = await this.paymentModel.aggregate([
      { $match: { hospitalId, status: PAYMENT_STATUS.PAID, collectedByUserId: { $exists: true, $ne: null }, createdAt: { $gte: start, $lt: end } } },
      {
        $group: {
          _id: { user: '$collectedByUserId', date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } } },
        },
      },
      { $group: { _id: '$_id.user', dates: { $addToSet: '$_id.date' } } },
    ]);
    const map: Record<string, string[]> = {};
    for (const row of rows) map[row._id] = row.dates;
    return map;
  }

  // All distinct calendar days in range that had at least one paid payment —
  // the denominator for "N days were never closed" on the Daily collection report.
  async listActiveDates(hospitalId: string, start: Date, end: Date): Promise<string[]> {
    const rows = await this.paymentModel.aggregate([
      { $match: { hospitalId, status: PAYMENT_STATUS.PAID, createdAt: { $gte: start, $lt: end } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } } } },
    ]);
    return rows.map((r) => r._id as string);
  }

  // Powers the Doctor revenue report — billed/collected/outstanding/package
  // usage and visit count per doctor, over paid+due bills only (a refunded
  // bill's revenue was reversed, so it's excluded from "billed" entirely).
  async aggregateRevenueByDoctor(hospitalId: string, start: Date, end: Date) {
    const rows = await this.paymentModel.aggregate([
      {
        $match: {
          hospitalId,
          status: { $in: [PAYMENT_STATUS.PAID, PAYMENT_STATUS.DUE] },
          createdAt: { $gte: start, $lt: end },
        },
      },
      {
        $group: {
          _id: '$doctorProfileId',
          doctorName: { $last: '$doctorName' },
          billed: { $sum: '$total' },
          collected: { $sum: { $cond: [{ $eq: ['$status', PAYMENT_STATUS.PAID] }, '$total', 0] } },
          outstanding: { $sum: { $cond: [{ $eq: ['$status', PAYMENT_STATUS.DUE] }, '$total', 0] } },
          fromPackages: { $sum: { $ifNull: ['$packageCoveredAmount', 0] } },
          visits: { $sum: 1 },
        },
      },
    ]);
    return rows.map((r) => ({
      doctorProfileId: r._id as string,
      doctorName: r.doctorName as string | undefined,
      billed: r.billed as number,
      collected: r.collected as number,
      outstanding: r.outstanding as number,
      fromPackages: r.fromPackages as number,
      visits: r.visits as number,
    }));
  }

  // Every unpaid bill, oldest first — bucketed into age ranges in the
  // service layer (small dataset, and avoids fighting $dateDiff for what's
  // a one-time read). Denormalized patient/doctor names avoid a $lookup.
  async listDuePayments(hospitalId: string) {
    const docs = await this.paymentModel
      .find({ hospitalId, status: PAYMENT_STATUS.DUE })
      .sort({ createdAt: 1 })
      .lean();
    return toPlainList(docs);
  }

  // Total amount refunded in range — the Daily collection report's
  // "Refunded" tile.
  async sumRefundsInRange(hospitalId: string, start: Date, end: Date): Promise<{ total: number; count: number }> {
    const result = await this.paymentModel.aggregate([
      { $match: { hospitalId, status: PAYMENT_STATUS.REFUNDED, refundedAt: { $gte: start, $lt: end } } },
      { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } },
    ]);
    return { total: result[0]?.total ?? 0, count: result[0]?.count ?? 0 };
  }

  // Current accounts-receivable snapshot (not range-scoped — a due bill stays
  // "raised but unpaid" until it's settled or refunded, however old it is).
  async sumDueTotal(hospitalId: string): Promise<{ total: number; billCount: number; patientCount: number }> {
    const result = await this.paymentModel.aggregate([
      { $match: { hospitalId, status: PAYMENT_STATUS.DUE } },
      { $group: { _id: null, total: { $sum: '$total' }, billCount: { $sum: 1 }, patients: { $addToSet: '$patientId' } } },
    ]);
    const row = result[0];
    return { total: row?.total ?? 0, billCount: row?.billCount ?? 0, patientCount: row?.patients?.length ?? 0 };
  }

  // Value of services actually delivered in range, independent of when cash
  // changed hands: `total` already excludes any package-covered portion (see
  // PaymentsService.completeVisit), so adding it back gives the full value of
  // the visit — whether it was settled by cash/UPI/due or drawn from a
  // package credit sold earlier. Refunded bills are excluded since that
  // revenue was reversed.
  async sumEarnedInRange(hospitalId: string, start: Date, end: Date): Promise<number> {
    const result = await this.paymentModel.aggregate([
      {
        $match: {
          hospitalId,
          status: { $in: [PAYMENT_STATUS.PAID, PAYMENT_STATUS.DUE] },
          createdAt: { $gte: start, $lt: end },
        },
      },
      { $group: { _id: null, earned: { $sum: { $add: ['$total', { $ifNull: ['$packageCoveredAmount', 0] }] } } } },
    ]);
    return result[0]?.earned ?? 0;
  }

  // Due bills settled (paid off) within range — the Dues aging report's
  // "Recovered" tile.
  async sumRecoveredInRange(hospitalId: string, start: Date, end: Date): Promise<{ total: number; count: number }> {
    const result = await this.paymentModel.aggregate([
      { $match: { hospitalId, status: PAYMENT_STATUS.PAID, settledAt: { $gte: start, $lt: end } } },
      { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } },
    ]);
    return { total: result[0]?.total ?? 0, count: result[0]?.count ?? 0 };
  }
}
