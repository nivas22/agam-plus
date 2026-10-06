import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model } from 'mongoose';
import {
  InventoryItem,
  InventoryItemDocument,
} from '../schemas/inventory-item.schema';
import {
  InventoryBatch,
  InventoryBatchDocument,
} from '../schemas/inventory-batch.schema';
import {
  InventoryMovement,
  InventoryMovementDocument,
} from '../schemas/inventory-movement.schema';
import { Counter, CounterDocument } from '../schemas/counter.schema';
import { runInTransaction, toPlain, toPlainList } from './mongo.util';

export interface InventoryStockTotals {
  onHand: number;
  stockValue: number;
  batchCount: number;
  nearestExpiry: string | null;
}

export interface InventoryMovementFilters {
  itemId?: string;
  type?: string;
  from?: Date;
  to?: Date;
  limit?: number;
}

@Injectable()
export class InventoryRepository {
  private readonly logger = new Logger(InventoryRepository.name);

  constructor(
    @InjectModel(InventoryItem.name)
    private readonly itemModel: Model<InventoryItemDocument>,
    @InjectModel(InventoryBatch.name)
    private readonly batchModel: Model<InventoryBatchDocument>,
    @InjectModel(InventoryMovement.name)
    private readonly movementModel: Model<InventoryMovementDocument>,
    @InjectModel(Counter.name)
    private readonly counterModel: Model<CounterDocument>,
  ) {}

  runInTransaction<T>(
    fn: (session: ClientSession | undefined) => Promise<T>,
  ): Promise<T> {
    return runInTransaction(this.batchModel.db, this.logger, fn);
  }

  /* --------------------------------- items -------------------------------- */

  // Atomic $inc on a per-hospital counter, so two items created at once can
  // never be handed the same code.
  async nextItemCode(hospitalId: string): Promise<string> {
    const counter = await this.counterModel
      .findOneAndUpdate(
        { _id: `inventory:${hospitalId}` },
        { $inc: { seq: 1 } },
        { upsert: true, returnDocument: 'after' },
      )
      .lean();
    return `INV-${String(counter!.seq).padStart(4, '0')}`;
  }

  async createItem(data: any) {
    const doc = await this.itemModel.create({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return toPlain(doc.toObject());
  }

  async getItem(hospitalId: string, itemId: string) {
    const doc = await this.itemModel
      .findOne({ _id: itemId, hospitalId })
      .lean();
    return toPlain(doc);
  }

  async listItems(
    hospitalId: string,
    filters: { category?: string; status?: string } = {},
  ) {
    const query: Record<string, any> = { hospitalId };
    if (filters.category) query.category = filters.category;
    if (filters.status) query.status = filters.status;
    const docs = await this.itemModel.find(query).sort({ name: 1 }).lean();
    return toPlainList(docs);
  }

  async updateItem(
    hospitalId: string,
    itemId: string,
    updates: Record<string, any>,
  ) {
    const doc = await this.itemModel
      .findOneAndUpdate(
        { _id: itemId, hospitalId },
        { $set: { ...updates, updatedAt: new Date() } },
        { returnDocument: 'after' },
      )
      .lean();
    return toPlain(doc);
  }

  /* -------------------------------- batches ------------------------------- */

  async createBatch(data: any, session?: ClientSession) {
    const [doc] = await this.batchModel.create([data], { session });
    return toPlain(doc.toObject());
  }

  async getBatch(hospitalId: string, batchId: string) {
    const doc = await this.batchModel
      .findOne({ _id: batchId, hospitalId })
      .lean();
    return toPlain(doc);
  }

  // First-expiry-first-out order: dated batches by expiry, then undated
  // ones, oldest receipt first within each.
  async listBatchesForItem(
    hospitalId: string,
    itemId: string,
    opts: { inStockOnly?: boolean } = {},
  ) {
    const query: Record<string, any> = { hospitalId, itemId };
    if (opts.inStockOnly) query.quantity = { $gt: 0 };
    const docs = await this.batchModel.find(query).lean();
    return toPlainList(docs).sort(compareFefo);
  }

  // Batches with stock left that expire on or before `onOrBefore` —
  // includes already-expired ones.
  async listExpiringBatches(hospitalId: string, onOrBefore: string) {
    const docs = await this.batchModel
      .find({
        hospitalId,
        quantity: { $gt: 0 },
        expiryDate: { $exists: true, $ne: null, $lte: onOrBefore },
      })
      .sort({ expiryDate: 1 })
      .lean();
    return toPlainList(docs);
  }

  // Removes `quantity` from a batch only if that much is still there —
  // returns null when it isn't (a concurrent issue got there first), and
  // the batch is left untouched.
  async takeFromBatch(
    hospitalId: string,
    batchId: string,
    quantity: number,
    session?: ClientSession,
  ) {
    const doc = await this.batchModel
      .findOneAndUpdate(
        { _id: batchId, hospitalId, quantity: { $gte: quantity } },
        { $inc: { quantity: -quantity } },
        { returnDocument: 'after', session },
      )
      .lean();
    return toPlain(doc);
  }

  // Sets a batch to an absolute count, guarded on the count the caller
  // last saw so a concurrent issue isn't silently overwritten.
  async setBatchQuantity(
    hospitalId: string,
    batchId: string,
    expectedQuantity: number,
    newQuantity: number,
    session?: ClientSession,
  ) {
    const doc = await this.batchModel
      .findOneAndUpdate(
        { _id: batchId, hospitalId, quantity: expectedQuantity },
        { $set: { quantity: newQuantity } },
        { returnDocument: 'after', session },
      )
      .lean();
    return toPlain(doc);
  }

  async addToBatch(
    hospitalId: string,
    batchId: string,
    quantity: number,
    session?: ClientSession,
  ) {
    await this.batchModel.updateOne(
      { _id: batchId, hospitalId },
      { $inc: { quantity } },
      { session },
    );
  }

  // Per-item stock totals across every batch with something left in it.
  async stockTotalsByItem(
    hospitalId: string,
    itemIds?: string[],
  ): Promise<Record<string, InventoryStockTotals>> {
    const match: Record<string, any> = { hospitalId, quantity: { $gt: 0 } };
    if (itemIds) match.itemId = { $in: itemIds };
    const rows = await this.batchModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$itemId',
          onHand: { $sum: '$quantity' },
          stockValue: {
            $sum: { $multiply: ['$quantity', { $ifNull: ['$unitCost', 0] }] },
          },
          batchCount: { $sum: 1 },
          // $min skips missing/null, so undated batches don't hide a real expiry.
          nearestExpiry: { $min: '$expiryDate' },
        },
      },
    ]);
    return Object.fromEntries(
      rows.map((r: any) => [
        r._id,
        {
          onHand: r.onHand,
          stockValue: r.stockValue,
          batchCount: r.batchCount,
          nearestExpiry: r.nearestExpiry ?? null,
        },
      ]),
    );
  }

  /* ------------------------------- movements ------------------------------ */

  async createMovements(rows: any[], session?: ClientSession) {
    const docs = await this.movementModel.insertMany(rows, { session });
    return toPlainList(docs.map((d: any) => d.toObject()));
  }

  async listMovements(
    hospitalId: string,
    filters: InventoryMovementFilters = {},
  ) {
    const query: Record<string, any> = { hospitalId };
    if (filters.itemId) query.itemId = filters.itemId;
    if (filters.type) query.type = filters.type;
    if (filters.from || filters.to) {
      query.at = {};
      if (filters.from) query.at.$gte = filters.from;
      if (filters.to) query.at.$lt = filters.to;
    }
    const docs = await this.movementModel
      .find(query)
      .sort({ at: -1, _id: -1 })
      .limit(filters.limit ?? 200)
      .lean();
    return toPlainList(docs);
  }
}

export function compareFefo(a: any, b: any): number {
  if (a.expiryDate && b.expiryDate && a.expiryDate !== b.expiryDate) {
    return a.expiryDate.localeCompare(b.expiryDate);
  }
  if (a.expiryDate && !b.expiryDate) return -1;
  if (!a.expiryDate && b.expiryDate) return 1;
  return new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime();
}
