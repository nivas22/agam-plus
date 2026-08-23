import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { DB_COLLECTIONS, CHARGE_CATALOG_CATEGORY } from '../constants';

// One entry per price ever set on an item. Never edited or removed once its
// effectiveFrom date has passed — Payment items snapshot name/unitPrice at
// billing time, so this history exists purely for the catalog UI, not to
// recompute past invoices.
@Schema({ _id: false })
export class ChargeCatalogPriceVersion {
  @Prop({ required: true })
  price: number;

  @Prop({ required: true, default: 0 })
  gstPercent: number;

  // YYYY-MM-DD — the day the desk starts billing this price. Same-day as
  // creation means "right away"; a future date means "queued".
  @Prop({ required: true })
  effectiveFrom: string;

  @Prop({ required: true })
  createdAt: Date;

  @Prop()
  createdByUserId?: string;

  @Prop()
  createdByName?: string;
}

export const ChargeCatalogPriceVersionSchema = SchemaFactory.createForClass(
  ChargeCatalogPriceVersion,
);

export type ChargeCatalogItemDocument = HydratedDocument<ChargeCatalogItem>;

@Schema({
  collection: DB_COLLECTIONS.CHARGE_CATALOG_ITEMS,
  strict: false,
  timestamps: false,
})
export class ChargeCatalogItem {
  @Prop({ required: true, index: true })
  hospitalId: string;

  @Prop({ required: true })
  name: string;

  // Auto-generated (see CHARGE_CATALOG_CODE_PREFIX), e.g. CH-1001.
  @Prop({ required: true })
  code: string;

  @Prop({ required: true, enum: Object.values(CHARGE_CATALOG_CATEGORY), index: true })
  category: string;

  @Prop({ type: [ChargeCatalogPriceVersionSchema], default: [] })
  priceHistory: ChargeCatalogPriceVersion[];

  // Off means only a doctor can put this on a bill.
  @Prop({ required: true, default: true })
  frontDeskCanAdd: boolean;

  // Display-only today — does not change how a Package's value is computed
  // or deducted at visit completion. See the Charge Catalog plan's "known
  // deviations" note.
  @Prop({ required: true, default: false })
  coveredByPackages: boolean;

  @Prop({ required: true, enum: ['active', 'archived'], default: 'active', index: true })
  status: string;

  @Prop()
  createdBy?: string;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const ChargeCatalogItemSchema =
  SchemaFactory.createForClass(ChargeCatalogItem);
ChargeCatalogItemSchema.index({ hospitalId: 1, category: 1 });
ChargeCatalogItemSchema.index({ hospitalId: 1, status: 1 });
ChargeCatalogItemSchema.index({ hospitalId: 1, code: 1 }, { unique: true });
