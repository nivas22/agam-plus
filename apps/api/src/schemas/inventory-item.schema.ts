import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { DB_COLLECTIONS, INVENTORY_CATEGORY_VALUES } from '../constants';

export type InventoryItemDocument = HydratedDocument<InventoryItem>;

// What the hospital stocks. Quantities don't live here — they're the sum of
// the item's InventoryBatch quantities, so a receipt or issue only ever
// touches batch documents and can't drift out of step with an item total.
@Schema({
  collection: DB_COLLECTIONS.INVENTORY_ITEMS,
  strict: false,
  timestamps: false,
})
export class InventoryItem {
  @Prop({ required: true, index: true })
  hospitalId: string;

  @Prop({ required: true })
  name: string;

  // Auto-generated per hospital, e.g. INV-0001 (see InventoryRepository.nextItemCode).
  @Prop({ required: true })
  code: string;

  @Prop({ required: true, enum: INVENTORY_CATEGORY_VALUES, index: true })
  category: string;

  // The unit stock is counted in — "strip", "box", "piece", "ml". Free text,
  // since every hospital counts differently.
  @Prop({ required: true })
  unit: string;

  // Flagged as low stock once on-hand quantity is at or below this. 0 means
  // never flag.
  @Prop({ required: true, default: 0 })
  reorderLevel: number;

  // Off for things that don't expire (equipment, stationery) — receipts then
  // skip the batch number/expiry fields entirely.
  @Prop({ required: true, default: true })
  tracksExpiry: boolean;

  // Where it's kept, e.g. "Pharmacy shelf B", "OT store".
  @Prop()
  location?: string;

  @Prop()
  notes?: string;

  @Prop({
    required: true,
    enum: ['active', 'archived'],
    default: 'active',
    index: true,
  })
  status: string;

  @Prop()
  createdBy?: string;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const InventoryItemSchema = SchemaFactory.createForClass(InventoryItem);
InventoryItemSchema.index({ hospitalId: 1, code: 1 }, { unique: true });
InventoryItemSchema.index({ hospitalId: 1, status: 1, name: 1 });
