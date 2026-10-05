import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { DB_COLLECTIONS } from '../constants';

export type InventoryBatchDocument = HydratedDocument<InventoryBatch>;

// One receipt of an item. `quantity` is what's left of it and is the only
// field that changes after creation — always via a conditional $inc (see
// InventoryRepository.takeFromBatch) so concurrent issues can't drive it
// below zero.
@Schema({
  collection: DB_COLLECTIONS.INVENTORY_BATCHES,
  strict: false,
  timestamps: false,
})
export class InventoryBatch {
  @Prop({ required: true, index: true })
  hospitalId: string;

  @Prop({ required: true, index: true })
  itemId: string;

  // Unset for items that don't track expiry.
  @Prop()
  batchNumber?: string;

  // YYYY-MM-DD, same convention as ChargeCatalogPriceVersion.effectiveFrom.
  @Prop()
  expiryDate?: string;

  @Prop({ required: true })
  quantityReceived: number;

  @Prop({ required: true, min: 0 })
  quantity: number;

  // Purchase cost per unit — drives the stock valuation, never a selling price.
  @Prop()
  unitCost?: number;

  @Prop()
  supplier?: string;

  // The supplier's invoice / delivery challan number.
  @Prop()
  invoiceNumber?: string;

  @Prop({ required: true })
  receivedAt: Date;

  @Prop()
  receivedByUserId?: string;

  @Prop()
  receivedByName?: string;
}

export const InventoryBatchSchema =
  SchemaFactory.createForClass(InventoryBatch);
InventoryBatchSchema.index({ hospitalId: 1, itemId: 1, expiryDate: 1 });
InventoryBatchSchema.index({ hospitalId: 1, quantity: 1, expiryDate: 1 });
