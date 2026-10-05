import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { DB_COLLECTIONS } from '../constants';

export type PlatformFeatureCatalogDocument = HydratedDocument<PlatformFeatureCatalog>;

// A feature that isn't built yet, listed on every hospital's Settings >
// Features as "Coming soon" so they know what's on the way.
export interface UpcomingFeature {
  key: string;
  label: string;
  description?: string;
  group: string;
}

// Single document (fixed _id: 'default') holding the platform-wide release
// state of every module — editable from Platform Admin > Feature catalog.
// Same single-doc convention as SubscriptionPlanConfig.
@Schema({ collection: DB_COLLECTIONS.PLATFORM_FEATURE_CATALOG, strict: false, timestamps: false })
export class PlatformFeatureCatalog {
  @Prop({ required: true })
  _id: string;

  // HOSPITAL_MODULE -> FEATURE_RELEASE_STATUS. A missing key means available.
  @Prop({ type: Object, default: () => ({}) })
  moduleStatus: Record<string, string>;

  @Prop({ type: [Object], default: () => [] })
  upcoming: UpcomingFeature[];

  @Prop()
  updatedAt?: Date;

  @Prop()
  updatedByUserId?: string;
}

export const PlatformFeatureCatalogSchema = SchemaFactory.createForClass(PlatformFeatureCatalog);
