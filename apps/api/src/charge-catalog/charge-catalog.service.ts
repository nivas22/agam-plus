import { Injectable } from '@nestjs/common';
import { ChargeCatalogItemRepository } from '../repositories/charge-catalog-item.repository';
import { PaymentRepository } from '../repositories/payment.repository';
import { AuditService } from '../audit/audit.service';
import { ApiError } from '../common/errors/api-error';
import { HospitalUserProfile } from '../auth/decorators/current-user.decorator';
import {
  CHARGE_CATALOG_CATEGORY_VALUES,
  CHARGE_CATALOG_CODE_PREFIX,
  DEFAULT_CHARGE_CATALOG_ITEMS,
} from '../constants';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

interface CreateItemData {
  name: string;
  category: string;
  price: number;
  gstPercent: number;
  frontDeskCanAdd: boolean;
  coveredByPackages: boolean;
}

interface UpdateItemData {
  name?: string;
  category?: string;
  frontDeskCanAdd?: boolean;
  coveredByPackages?: boolean;
  price?: number;
  gstPercent?: number;
  effectiveFrom?: string;
}

interface BulkReviseBody {
  itemIds: string[];
  method: 'percent' | 'fixed' | 'manual';
  value?: number;
  roundTo: 'none' | '5' | '10';
  effectiveFrom: string;
  manualPrices?: Record<string, number>;
}

@Injectable()
export class ChargeCatalogService {
  constructor(
    private readonly chargeCatalogItemRepository: ChargeCatalogItemRepository,
    private readonly paymentRepository: PaymentRepository,
    private readonly auditService: AuditService,
  ) {}

  // Among all price versions, the one currently in effect — the last one
  // whose effectiveFrom is today or earlier.
  private getEffectiveVersion(item: any, asOf: string = todayIso()) {
    const sorted = [...(item.priceHistory || [])].sort((a, b) =>
      a.effectiveFrom.localeCompare(b.effectiveFrom),
    );
    let effective: any = null;
    for (const version of sorted) {
      if (version.effectiveFrom <= asOf) effective = version;
    }
    return effective;
  }

  // The next version queued to take effect after `asOf`, if any.
  private getScheduledVersion(item: any, asOf: string = todayIso()) {
    const sorted = [...(item.priceHistory || [])].sort((a, b) =>
      a.effectiveFrom.localeCompare(b.effectiveFrom),
    );
    return sorted.find((version) => version.effectiveFrom > asOf) || null;
  }

  private enrich(item: any, usageMap: Record<string, number>) {
    const effective = this.getEffectiveVersion(item);
    const scheduled = this.getScheduledVersion(item);
    return {
      ...item,
      priceHistory: [...(item.priceHistory || [])].sort((a, b) =>
        b.effectiveFrom.localeCompare(a.effectiveFrom),
      ),
      currentPrice: effective?.price ?? 0,
      currentGstPercent: effective?.gstPercent ?? 0,
      scheduledPrice: scheduled?.price ?? null,
      scheduledEffectiveFrom: scheduled?.effectiveFrom ?? null,
      usageThisMonth: usageMap[item.id] ?? 0,
      lastChangedAt: effective?.createdAt ?? item.createdAt,
    };
  }

  private async usageThisMonthMap(hospitalId: string) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return this.paymentRepository.countCatalogItemUsageByWindow(
      hospitalId,
      start,
      end,
    );
  }

  private async generateCode(hospitalId: string, category: string) {
    const prefix = CHARGE_CATALOG_CODE_PREFIX[category];
    const countInCategory =
      await this.chargeCatalogItemRepository.countByHospitalAndCategory(
        hospitalId,
        category,
      );
    return `CH-${prefix}${String(countInCategory + 1).padStart(2, '0')}`;
  }

  // Gives every hospital a sensible starting catalog the first time it's
  // read, instead of an empty list with no quick-add options at all. Runs
  // at most once per hospital — subsequent reads see real items and skip
  // this entirely. Not attributed to any user/audit entry since no admin
  // action triggered it.
  private async seedDefaultsIfEmpty(hospitalId: string) {
    const existingCount =
      await this.chargeCatalogItemRepository.countAllByHospital(hospitalId);
    if (existingCount > 0) return;

    for (const defaultItem of DEFAULT_CHARGE_CATALOG_ITEMS) {
      const code = await this.generateCode(hospitalId, defaultItem.category);
      await this.chargeCatalogItemRepository.createItem({
        hospitalId,
        name: defaultItem.name,
        code,
        category: defaultItem.category,
        frontDeskCanAdd: true,
        coveredByPackages: false,
        status: 'active',
        priceHistory: [
          {
            price: defaultItem.price,
            gstPercent: defaultItem.gstPercent,
            effectiveFrom: todayIso(),
            createdAt: new Date(),
            createdByName: 'Default catalog',
          },
        ],
      });
    }
  }

  async listItems(
    hospitalId: string,
    filters: { category?: string; status?: string; search?: string },
  ) {
    await this.seedDefaultsIfEmpty(hospitalId);

    const [items, usageMap] = await Promise.all([
      this.chargeCatalogItemRepository.listByHospital(hospitalId, {
        category: filters.category,
        status: filters.status,
      }),
      this.usageThisMonthMap(hospitalId),
    ]);

    const search = filters.search?.trim().toLowerCase();
    const filtered = search
      ? items.filter(
          (item: any) =>
            item.name.toLowerCase().includes(search) ||
            item.code.toLowerCase().includes(search),
        )
      : items;

    const enriched = filtered.map((item: any) => this.enrich(item, usageMap));

    const allForCounts = filters.category
      ? await this.chargeCatalogItemRepository.listByHospital(hospitalId, {
          status: filters.status,
        })
      : items;
    const counts: Record<string, number> = { all: allForCounts.length };
    for (const category of CHARGE_CATALOG_CATEGORY_VALUES) {
      counts[category] = allForCounts.filter(
        (item: any) => item.category === category && item.status !== 'archived',
      ).length;
    }
    counts.archived = allForCounts.filter(
      (item: any) => item.status === 'archived',
    ).length;

    return { items: enriched, counts };
  }

  async getItem(hospitalId: string, itemId: string) {
    const item = await this.chargeCatalogItemRepository.getById(
      hospitalId,
      itemId,
    );
    if (!item) throw ApiError.notFound('Charge catalog item not found');
    const usageMap = await this.usageThisMonthMap(hospitalId);
    return this.enrich(item, usageMap);
  }

  async createItem(
    hospitalId: string,
    actor: HospitalUserProfile,
    data: CreateItemData,
  ) {
    const code = await this.generateCode(hospitalId, data.category);

    const item = await this.chargeCatalogItemRepository.createItem({
      hospitalId,
      name: data.name,
      code,
      category: data.category,
      frontDeskCanAdd: data.frontDeskCanAdd,
      coveredByPackages: data.coveredByPackages,
      status: 'active',
      priceHistory: [
        {
          price: data.price,
          gstPercent: data.gstPercent,
          effectiveFrom: todayIso(),
          createdAt: new Date(),
          createdByUserId: actor.userId,
          createdByName: actor.name,
        },
      ],
      createdBy: actor.userId,
    });

    await this.auditService.log({
      hospitalId,
      actor: { userId: actor.userId, name: actor.name, role: actor.role },
      action: 'charge_catalog.created',
      area: 'settings',
      summary: `Added "${data.name}" to the charge catalog · ${code}`,
    });

    const usageMap = await this.usageThisMonthMap(hospitalId);
    return this.enrich(item, usageMap);
  }

  async updateItem(
    hospitalId: string,
    itemId: string,
    actor: HospitalUserProfile,
    updates: UpdateItemData,
  ) {
    const existing = await this.chargeCatalogItemRepository.getById(
      hospitalId,
      itemId,
    );
    if (!existing) throw ApiError.notFound('Charge catalog item not found');

    const fieldUpdates: Record<string, any> = {};
    for (const key of ['name', 'category', 'frontDeskCanAdd', 'coveredByPackages'] as const) {
      if (updates[key] !== undefined) fieldUpdates[key] = updates[key];
    }
    if (Object.keys(fieldUpdates).length > 0) {
      await this.chargeCatalogItemRepository.updateFields(
        hospitalId,
        itemId,
        fieldUpdates,
      );
    }

    let priceChanged = false;
    if (updates.price !== undefined) {
      if (!updates.effectiveFrom) {
        throw ApiError.badRequest(
          'An effective date is required when changing the price',
        );
      }
      if (updates.effectiveFrom < todayIso()) {
        throw ApiError.badRequest(
          "Effective date can't be in the past — nothing already billed can change",
        );
      }
      const currentEffective = this.getEffectiveVersion(existing);
      const version = {
        price: updates.price,
        gstPercent: updates.gstPercent ?? currentEffective?.gstPercent ?? 0,
        effectiveFrom: updates.effectiveFrom,
        createdAt: new Date(),
        createdByUserId: actor.userId,
        createdByName: actor.name,
      };

      const alreadyQueuedForDate = (existing.priceHistory || []).some(
        (v: any) =>
          v.effectiveFrom === updates.effectiveFrom &&
          v.effectiveFrom > todayIso(),
      );
      if (alreadyQueuedForDate) {
        await this.chargeCatalogItemRepository.replacePendingVersion(
          hospitalId,
          itemId,
          updates.effectiveFrom,
          version as any,
        );
      } else {
        await this.chargeCatalogItemRepository.pushPriceVersion(
          hospitalId,
          itemId,
          version as any,
        );
      }
      priceChanged = true;
    }

    await this.auditService.log({
      hospitalId,
      actor: { userId: actor.userId, name: actor.name, role: actor.role },
      action: priceChanged ? 'charge_catalog.price_changed' : 'charge_catalog.updated',
      area: 'settings',
      summary: priceChanged
        ? `Changed "${existing.name}"'s price to ₹${updates.price} from ${updates.effectiveFrom}`
        : `Updated "${existing.name}" in the charge catalog`,
    });

    return this.getItem(hospitalId, itemId);
  }

  async setStatus(
    hospitalId: string,
    itemId: string,
    actor: HospitalUserProfile,
    status: 'active' | 'archived',
  ) {
    const existing = await this.chargeCatalogItemRepository.getById(
      hospitalId,
      itemId,
    );
    if (!existing) throw ApiError.notFound('Charge catalog item not found');

    await this.chargeCatalogItemRepository.setStatus(
      hospitalId,
      itemId,
      status,
    );

    await this.auditService.log({
      hospitalId,
      actor: { userId: actor.userId, name: actor.name, role: actor.role },
      action: status === 'archived' ? 'charge_catalog.archived' : 'charge_catalog.restored',
      area: 'settings',
      summary: `${status === 'archived' ? 'Archived' : 'Restored'} "${existing.name}" in the charge catalog`,
    });

    return { success: true };
  }

  private applyRounding(price: number, roundTo: 'none' | '5' | '10'): number {
    if (roundTo === 'none') return Math.round(price);
    const step = Number(roundTo);
    return Math.round(price / step) * step;
  }

  async bulkRevise(
    hospitalId: string,
    actor: HospitalUserProfile,
    body: BulkReviseBody,
  ) {
    if (body.effectiveFrom < todayIso()) {
      throw ApiError.badRequest(
        "Effective date can't be in the past — nothing already billed can change",
      );
    }
    if (body.method !== 'manual' && (body.value === undefined || body.value === null)) {
      throw ApiError.badRequest('A value is required for this method');
    }

    const items = await Promise.all(
      body.itemIds.map((id) =>
        this.chargeCatalogItemRepository.getById(hospitalId, id),
      ),
    );

    const changes: { id: string; name: string; oldPrice: number; newPrice: number }[] = [];
    let packageCoveredCount = 0;

    for (const item of items) {
      if (!item) continue;
      const currentEffective = this.getEffectiveVersion(item);
      const oldPrice = currentEffective?.price ?? 0;

      let newPrice: number;
      if (body.method === 'percent') {
        newPrice = this.applyRounding(
          oldPrice * (1 + (body.value as number) / 100),
          body.roundTo,
        );
      } else if (body.method === 'fixed') {
        newPrice = this.applyRounding(oldPrice + (body.value as number), body.roundTo);
      } else {
        const manual = body.manualPrices?.[item.id];
        if (manual === undefined) {
          throw ApiError.badRequest(`A new price is required for "${item.name}"`);
        }
        newPrice = manual;
      }

      if (item.coveredByPackages) packageCoveredCount += 1;

      const version = {
        price: newPrice,
        gstPercent: currentEffective?.gstPercent ?? 0,
        effectiveFrom: body.effectiveFrom,
        createdAt: new Date(),
        createdByUserId: actor.userId,
        createdByName: actor.name,
      };

      const alreadyQueuedForDate = (item.priceHistory || []).some(
        (v: any) => v.effectiveFrom === body.effectiveFrom && v.effectiveFrom > todayIso(),
      );
      if (alreadyQueuedForDate) {
        await this.chargeCatalogItemRepository.replacePendingVersion(
          hospitalId,
          item.id,
          body.effectiveFrom,
          version as any,
        );
      } else {
        await this.chargeCatalogItemRepository.pushPriceVersion(
          hospitalId,
          item.id,
          version as any,
        );
      }

      changes.push({ id: item.id, name: item.name, oldPrice, newPrice });
    }

    await this.auditService.log({
      hospitalId,
      actor: { userId: actor.userId, name: actor.name, role: actor.role },
      action: 'charge_catalog.bulk_price_revision',
      area: 'settings',
      summary: `Queued a price revision for ${changes.length} charge catalog item(s) effective ${body.effectiveFrom}`,
      detail: { changes },
    });

    return { changes, packageCoveredCount };
  }
}
