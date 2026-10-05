import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { DB_COLLECTIONS, INVENTORY_MOVEMENT_TYPE_VALUES } from '../constants';

export type InventoryMovementDocument = HydratedDocument<InventoryMovement>;

// Append-only stock ledger — never edited or deleted. One row per batch
// touched, so an issue that spans two batches writes two rows sharing a
// `groupId`. Item/batch labels are snapshotted so the ledger still reads
// correctly after an item is renamed or archived.
@Schema({
  collection: DB_COLLECTIONS.INVENTORY_MOVEMENTS,
  strict: false,
  timestamps: false,
})
export class InventoryMovement {
  @Prop({ required: true, index: true })
  hospitalId: string;

  @Prop({ required: true, index: true })
  itemId: string;

  @Prop({ required: true })
  itemName: string;

  @Prop()
  unit?: string;

  @Prop({ required: true })
  batchId: string;

  @Prop()
  batchNumber?: string;

  @Prop()
  expiryDate?: string;

  @Prop({ required: true, enum: INVENTORY_MOVEMENT_TYPE_VALUES, index: true })
  type: string;

  // Signed: positive adds stock, negative removes it.
  @Prop({ required: true })
  quantity: number;

  // What was left in the batch right after this movement.
  @Prop({ required: true })
  batchBalanceAfter: number;

  @Prop()
  groupId?: string;

  // Who or where an issue went to — "OT", "Ward 2", "Dr. Priya".
  @Prop()
  issuedTo?: string;

  @Prop()
  reason?: string;

  @Prop({ required: true, index: true })
  at: Date;

  @Prop({ required: true })
  actorUserId: string;

  @Prop()
  actorName?: string;
}

export const InventoryMovementSchema =
  SchemaFactory.createForClass(InventoryMovement);
InventoryMovementSchema.index({ hospitalId: 1, at: -1 });
InventoryMovementSchema.index({ hospitalId: 1, itemId: 1, at: -1 });
