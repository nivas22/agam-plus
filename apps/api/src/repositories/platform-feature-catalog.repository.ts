import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  PlatformFeatureCatalog,
  PlatformFeatureCatalogDocument,
  UpcomingFeature,
} from '../schemas/platform-feature-catalog.schema';

const CATALOG_ID = 'default';
// Read by HospitalContextGuard on every module-gated request, so it's held
// in memory briefly. Updates invalidate it on this instance; other instances
// pick the change up within the TTL.
const CACHE_TTL_MS = 30_000;

export interface FeatureCatalog {
  moduleStatus: Record<string, string>;
  upcoming: UpcomingFeature[];
  updatedAt?: Date;
}

@Injectable()
export class PlatformFeatureCatalogRepository {
  private cache: { value: FeatureCatalog; expiresAt: number } | null = null;

  constructor(
    @InjectModel(PlatformFeatureCatalog.name)
    private readonly catalogModel: Model<PlatformFeatureCatalogDocument>,
  ) {}

  // Nothing is seeded — an absent document means every module is available
  // and nothing is upcoming.
  async getCatalog(): Promise<FeatureCatalog> {
    if (this.cache && this.cache.expiresAt > Date.now()) return this.cache.value;

    const doc: any = await this.catalogModel.findById(CATALOG_ID).lean();
    const value: FeatureCatalog = {
      moduleStatus: doc?.moduleStatus || {},
      upcoming: doc?.upcoming || [],
      updatedAt: doc?.updatedAt,
    };
    this.cache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
    return value;
  }

  async updateCatalog(data: Partial<Pick<FeatureCatalog, 'moduleStatus' | 'upcoming'>>, updatedByUserId: string) {
    await this.catalogModel.findByIdAndUpdate(
      CATALOG_ID,
      { $set: { ...data, updatedAt: new Date(), updatedByUserId } },
      { upsert: true },
    );
    this.cache = null;
    return this.getCatalog();
  }
}
