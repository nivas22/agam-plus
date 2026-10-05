import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { InventoryRepository } from '../repositories/inventory.repository';
import { HospitalRepository } from '../repositories/hospital.repository';
import { AuditService } from '../audit/audit.service';
import { ApiError } from '../common/errors/api-error';
import { HospitalUserProfile } from '../auth/decorators/current-user.decorator';
import { addDaysIso, todayIso } from '../common/hospital-time.util';
import {
  INVENTORY_CATEGORY_VALUES,
  INVENTORY_EXPIRY_WARNING_DAYS,
  INVENTORY_MOVEMENT_TYPE,
} from '../constants';

export type InventoryStockStatus = 'ok' | 'low' | 'out';
export type InventoryExpiryStatus = 'expired' | 'expiring' | null;

interface ItemData {
  name?: string;
  category?: string;
  unit?: string;
  reorderLevel?: number;
  tracksExpiry?: boolean;
  location?: string;
  notes?: string;
}

interface ReceiveData {
  quantity: number;
  batchNumber?: string;
  expiryDate?: string;
  unitCost?: number;
  supplier?: string;
  invoiceNumber?: string;
  note?: string;
}

interface IssueData {
  quantity: number;
  batchId?: string;
  issuedTo?: string;
  note?: string;
}

type AdjustData =
  | { type: 'adjusted'; countedQuantity: number; reason: string }
  | {
      type: 'expired' | 'damaged' | 'returned';
      quantity: number;
      reason?: string;
    };

const WRITE_OFF_LABELS: Record<string, string> = {
  [INVENTORY_MOVEMENT_TYPE.EXPIRED]: 'expired',
  [INVENTORY_MOVEMENT_TYPE.DAMAGED]: 'damaged',
  [INVENTORY_MOVEMENT_TYPE.RETURNED]: 'returned to supplier',
};

function qty(n: number, unit?: string) {
  return unit ? `${n} ${unit}` : String(n);
}

@Injectable()
export class InventoryService {
  constructor(
    private readonly inventoryRepository: InventoryRepository,
    private readonly hospitalRepository: HospitalRepository,
    private readonly auditService: AuditService,
  ) {}

  private async today(hospitalId: string) {
    return todayIso(await this.hospitalRepository.getTimezone(hospitalId));
  }

  private expiryStatus(
    expiryDate: string | null | undefined,
    today: string,
  ): InventoryExpiryStatus {
    if (!expiryDate) return null;
    if (expiryDate < today) return 'expired';
    if (expiryDate <= addDaysIso(today, INVENTORY_EXPIRY_WARNING_DAYS))
      return 'expiring';
    return null;
  }

  private enrich(item: any, totals: any, today: string) {
    const onHand = totals?.onHand ?? 0;
    const stockStatus: InventoryStockStatus =
      onHand <= 0
        ? 'out'
        : item.reorderLevel > 0 && onHand <= item.reorderLevel
          ? 'low'
          : 'ok';
    const nearestExpiry = totals?.nearestExpiry ?? null;
    return {
      ...item,
      onHand,
      stockValue: totals?.stockValue ?? 0,
      batchCount: totals?.batchCount ?? 0,
      nearestExpiry,
      stockStatus,
      expiryStatus: this.expiryStatus(nearestExpiry, today),
    };
  }

  private async requireItem(hospitalId: string, itemId: string) {
    const item = await this.inventoryRepository.getItem(hospitalId, itemId);
    if (!item) throw ApiError.notFound('Inventory item not found');
    return item;
  }

  private async requireBatch(
    hospitalId: string,
    itemId: string,
    batchId: string,
  ) {
    const batch = await this.inventoryRepository.getBatch(hospitalId, batchId);
    if (!batch || batch.itemId !== itemId)
      throw ApiError.notFound('Batch not found for this item');
    return batch;
  }

  private actorOf(actor: HospitalUserProfile) {
    return { userId: actor.userId, name: actor.name, role: actor.role };
  }

  /* --------------------------------- reads -------------------------------- */

  async listItems(
    hospitalId: string,
    filters: {
      category?: string;
      status?: string;
      search?: string;
      stock?: string;
    },
  ) {
    const [allItems, totals, today] = await Promise.all([
      this.inventoryRepository.listItems(hospitalId),
      this.inventoryRepository.stockTotalsByItem(hospitalId),
      this.today(hospitalId),
    ]);
    const enriched = allItems.map((item: any) =>
      this.enrich(item, totals[item.id], today),
    );

    const counts: Record<string, number> = {
      all: enriched.filter((i: any) => i.status !== 'archived').length,
      archived: enriched.filter((i: any) => i.status === 'archived').length,
    };
    for (const category of INVENTORY_CATEGORY_VALUES) {
      counts[category] = enriched.filter(
        (i: any) => i.category === category && i.status !== 'archived',
      ).length;
    }

    const search = filters.search?.trim().toLowerCase();
    const status = filters.status || 'active';
    const items = enriched.filter((i: any) => {
      if (i.status !== status) return false;
      if (filters.category && i.category !== filters.category) return false;
      if (filters.stock === 'low' && i.stockStatus === 'ok') return false;
      if (filters.stock === 'out' && i.stockStatus !== 'out') return false;
      if (filters.stock === 'expiring' && !i.expiryStatus) return false;
      if (
        search &&
        !i.name.toLowerCase().includes(search) &&
        !i.code.toLowerCase().includes(search)
      ) {
        return false;
      }
      return true;
    });

    return { items, counts };
  }

  async getSummary(hospitalId: string) {
    const today = await this.today(hospitalId);
    const [{ items }, expiringBatches] = await Promise.all([
      this.listItems(hospitalId, {}),
      this.inventoryRepository.listExpiringBatches(
        hospitalId,
        addDaysIso(today, INVENTORY_EXPIRY_WARNING_DAYS),
      ),
    ]);
    return {
      activeItems: items.length,
      lowStock: items.filter((i: any) => i.stockStatus === 'low').length,
      outOfStock: items.filter((i: any) => i.stockStatus === 'out').length,
      expiringBatches: expiringBatches.filter((b: any) => b.expiryDate >= today)
        .length,
      expiredBatches: expiringBatches.filter((b: any) => b.expiryDate < today)
        .length,
      stockValue: items.reduce((sum: number, i: any) => sum + i.stockValue, 0),
      expiryWarningDays: INVENTORY_EXPIRY_WARNING_DAYS,
    };
  }

  async getItem(hospitalId: string, itemId: string) {
    const item = await this.requireItem(hospitalId, itemId);
    const [totals, batches, movements, today] = await Promise.all([
      this.inventoryRepository.stockTotalsByItem(hospitalId, [itemId]),
      this.inventoryRepository.listBatchesForItem(hospitalId, itemId, {
        inStockOnly: true,
      }),
      this.inventoryRepository.listMovements(hospitalId, { itemId, limit: 50 }),
      this.today(hospitalId),
    ]);
    return {
      ...this.enrich(item, totals[itemId], today),
      batches: batches.map((b: any) => ({
        ...b,
        expiryStatus: this.expiryStatus(b.expiryDate, today),
      })),
      movements,
    };
  }

  // Batches with stock left expiring within `withinDays` (default the
  // standard warning window), already-expired ones first.
  async listExpiringBatches(hospitalId: string, withinDays?: number) {
    const today = await this.today(hospitalId);
    const days =
      withinDays && withinDays > 0 ? withinDays : INVENTORY_EXPIRY_WARNING_DAYS;
    const [batches, items] = await Promise.all([
      this.inventoryRepository.listExpiringBatches(
        hospitalId,
        addDaysIso(today, days),
      ),
      this.inventoryRepository.listItems(hospitalId),
    ]);
    const itemById = new Map(items.map((i: any) => [i.id, i]));
    return {
      batches: batches.map((b: any) => {
        const item: any = itemById.get(b.itemId);
        return {
          ...b,
          itemName: item?.name ?? 'Unknown item',
          itemCode: item?.code,
          unit: item?.unit,
          expiryStatus: b.expiryDate < today ? 'expired' : 'expiring',
        };
      }),
      withinDays: days,
    };
  }

  listMovements(
    hospitalId: string,
    filters: {
      itemId?: string;
      type?: string;
      from?: string;
      to?: string;
      limit?: number;
    },
  ) {
    return this.inventoryRepository.listMovements(hospitalId, {
      itemId: filters.itemId,
      type: filters.type,
      from: filters.from ? new Date(filters.from) : undefined,
      to: filters.to ? new Date(filters.to) : undefined,
      limit:
        filters.limit && filters.limit > 0 ? Math.min(filters.limit, 500) : 200,
    });
  }

  /* --------------------------------- items -------------------------------- */

  async createItem(
    hospitalId: string,
    actor: HospitalUserProfile,
    data: Required<Pick<ItemData, 'name' | 'category' | 'unit'>> & ItemData,
  ) {
    const code = await this.inventoryRepository.nextItemCode(hospitalId);
    const item = await this.inventoryRepository.createItem({
      hospitalId,
      code,
      name: data.name,
      category: data.category,
      unit: data.unit,
      reorderLevel: data.reorderLevel ?? 0,
      tracksExpiry: data.tracksExpiry ?? true,
      location: data.location || undefined,
      notes: data.notes || undefined,
      status: 'active',
      createdBy: actor.userId,
    });

    await this.auditService.log({
      hospitalId,
      actor: this.actorOf(actor),
      action: 'inventory.item_created',
      area: 'inventory',
      summary: `Added "${data.name}" to inventory · ${code}`,
    });

    return this.getItem(hospitalId, item.id);
  }

  async updateItem(
    hospitalId: string,
    itemId: string,
    actor: HospitalUserProfile,
    updates: ItemData,
  ) {
    const existing = await this.requireItem(hospitalId, itemId);

    const fieldUpdates: Record<string, any> = {};
    for (const key of [
      'name',
      'category',
      'unit',
      'reorderLevel',
      'tracksExpiry',
      'location',
      'notes',
    ] as const) {
      if (updates[key] !== undefined) fieldUpdates[key] = updates[key];
    }
    if (Object.keys(fieldUpdates).length > 0) {
      await this.inventoryRepository.updateItem(
        hospitalId,
        itemId,
        fieldUpdates,
      );
    }

    await this.auditService.log({
      hospitalId,
      actor: this.actorOf(actor),
      action: 'inventory.item_updated',
      area: 'inventory',
      summary: `Updated "${existing.name}" in inventory`,
      detail: { changes: fieldUpdates },
    });

    return this.getItem(hospitalId, itemId);
  }

  // Archiving keeps the item, its batches and its ledger — it just drops
  // out of the stock list and can't be received or issued.
  async setStatus(
    hospitalId: string,
    itemId: string,
    actor: HospitalUserProfile,
    status: 'active' | 'archived',
  ) {
    const existing = await this.requireItem(hospitalId, itemId);
    await this.inventoryRepository.updateItem(hospitalId, itemId, { status });

    await this.auditService.log({
      hospitalId,
      actor: this.actorOf(actor),
      action:
        status === 'archived'
          ? 'inventory.item_archived'
          : 'inventory.item_restored',
      area: 'inventory',
      summary: `${status === 'archived' ? 'Archived' : 'Restored'} "${existing.name}" in inventory`,
    });

    return { success: true };
  }

  /* -------------------------------- stock in ------------------------------ */

  async receiveStock(
    hospitalId: string,
    actor: HospitalUserProfile,
    itemId: string,
    data: ReceiveData,
  ) {
    const item = await this.requireItem(hospitalId, itemId);
    if (item.status !== 'active')
      throw ApiError.badRequest(
        'Restore this item before receiving stock for it',
      );

    if (item.tracksExpiry) {
      if (!data.batchNumber)
        throw ApiError.badRequest('Batch number is required for this item');
      if (!data.expiryDate)
        throw ApiError.badRequest('Expiry date is required for this item');
      if (data.expiryDate < (await this.today(hospitalId))) {
        throw ApiError.badRequest(
          "This batch has already expired — don't receive it into stock",
        );
      }
    }

    const now = new Date();
    const batchNumber = item.tracksExpiry ? data.batchNumber : undefined;
    const expiryDate = item.tracksExpiry ? data.expiryDate : undefined;

    const batch = await this.inventoryRepository.runInTransaction(
      async (session) => {
        const created = await this.inventoryRepository.createBatch(
          {
            hospitalId,
            itemId,
            batchNumber,
            expiryDate,
            quantityReceived: data.quantity,
            quantity: data.quantity,
            unitCost: data.unitCost,
            supplier: data.supplier || undefined,
            invoiceNumber: data.invoiceNumber || undefined,
            receivedAt: now,
            receivedByUserId: actor.userId,
            receivedByName: actor.name,
          },
          session,
        );
        await this.inventoryRepository.createMovements(
          [
            {
              hospitalId,
              itemId,
              itemName: item.name,
              unit: item.unit,
              batchId: created.id,
              batchNumber,
              expiryDate,
              type: INVENTORY_MOVEMENT_TYPE.RECEIVED,
              quantity: data.quantity,
              batchBalanceAfter: data.quantity,
              reason:
                [
                  data.supplier,
                  data.invoiceNumber && `Invoice ${data.invoiceNumber}`,
                  data.note,
                ]
                  .filter(Boolean)
                  .join(' · ') || undefined,
              at: now,
              actorUserId: actor.userId,
              actorName: actor.name,
            },
          ],
          session,
        );
        return created;
      },
    );

    await this.auditService.log({
      hospitalId,
      actor: this.actorOf(actor),
      action: 'inventory.stock_received',
      area: 'inventory',
      summary: `Received ${qty(data.quantity, item.unit)} of "${item.name}"${batchNumber ? ` · batch ${batchNumber}` : ''}`,
      detail: {
        itemId,
        batchId: batch.id,
        supplier: data.supplier,
        invoiceNumber: data.invoiceNumber,
      },
      amount:
        data.unitCost !== undefined ? data.unitCost * data.quantity : undefined,
    });

    return this.getItem(hospitalId, itemId);
  }

  /* ------------------------------- stock out ------------------------------ */

  // Takes stock first-expiry-first-out unless a batch is named. Expired
  // batches are never issued from — they have to be written off instead.
  async issueStock(
    hospitalId: string,
    actor: HospitalUserProfile,
    itemId: string,
    data: IssueData,
  ) {
    const item = await this.requireItem(hospitalId, itemId);
    if (item.status !== 'active')
      throw ApiError.badRequest(
        'Restore this item before issuing stock from it',
      );

    const today = await this.today(hospitalId);
    const isUsable = (b: any) => !b.expiryDate || b.expiryDate >= today;

    let candidates: any[];
    if (data.batchId) {
      const batch = await this.requireBatch(hospitalId, itemId, data.batchId);
      if (!isUsable(batch))
        throw ApiError.badRequest(
          'This batch has expired — write it off instead of issuing it',
        );
      candidates = [batch];
    } else {
      const batches = await this.inventoryRepository.listBatchesForItem(
        hospitalId,
        itemId,
        { inStockOnly: true },
      );
      candidates = batches.filter(isUsable);
    }

    const available = candidates.reduce((sum, b) => sum + b.quantity, 0);
    if (available < data.quantity) {
      throw ApiError.badRequest(
        available > 0
          ? `Only ${qty(available, item.unit)} in usable stock${data.batchId ? ' in this batch' : ''}`
          : 'No usable stock to issue',
      );
    }

    // Planned against the snapshot above; takeFromBatch re-checks each
    // batch atomically, so a concurrent issue makes this fail cleanly
    // rather than over-issue.
    const plan: { batch: any; take: number }[] = [];
    let remaining = data.quantity;
    for (const batch of candidates) {
      if (remaining <= 0) break;
      const take = Math.min(batch.quantity, remaining);
      plan.push({ batch, take });
      remaining -= take;
    }

    const groupId = randomUUID();
    const now = new Date();
    await this.inventoryRepository.runInTransaction(async (session) => {
      const taken: { batchId: string; take: number }[] = [];
      const rows: any[] = [];
      for (const { batch, take } of plan) {
        const updated = await this.inventoryRepository.takeFromBatch(
          hospitalId,
          batch.id,
          take,
          session,
        );
        if (!updated) {
          // Without a transaction (standalone Mongo) nothing rolls the
          // earlier batches back for us.
          if (!session) {
            for (const t of taken)
              await this.inventoryRepository.addToBatch(
                hospitalId,
                t.batchId,
                t.take,
              );
          }
          throw ApiError.conflict(
            'Stock changed while you were issuing — check the quantity and try again',
          );
        }
        taken.push({ batchId: batch.id, take });
        rows.push({
          hospitalId,
          itemId,
          itemName: item.name,
          unit: item.unit,
          batchId: batch.id,
          batchNumber: batch.batchNumber,
          expiryDate: batch.expiryDate,
          type: INVENTORY_MOVEMENT_TYPE.ISSUED,
          quantity: -take,
          batchBalanceAfter: updated.quantity,
          groupId,
          issuedTo: data.issuedTo || undefined,
          reason: data.note || undefined,
          at: now,
          actorUserId: actor.userId,
          actorName: actor.name,
        });
      }
      await this.inventoryRepository.createMovements(rows, session);
    });

    return this.getItem(hospitalId, itemId);
  }

  // Either a stock count (set the batch to what's on the shelf) or a
  // write-off (expired / damaged / returned to supplier). Allowed on
  // archived items too, so leftover stock can still be cleared.
  async adjustBatch(
    hospitalId: string,
    actor: HospitalUserProfile,
    itemId: string,
    batchId: string,
    data: AdjustData,
  ) {
    const item = await this.requireItem(hospitalId, itemId);
    const batch = await this.requireBatch(hospitalId, itemId, batchId);

    let delta: number;
    let updated: any;
    const now = new Date();

    await this.inventoryRepository.runInTransaction(async (session) => {
      if (data.type === INVENTORY_MOVEMENT_TYPE.ADJUSTED) {
        delta = data.countedQuantity - batch.quantity;
        if (delta === 0)
          throw ApiError.badRequest(
            'The count matches what is already recorded',
          );
        updated = await this.inventoryRepository.setBatchQuantity(
          hospitalId,
          batchId,
          batch.quantity,
          data.countedQuantity,
          session,
        );
      } else {
        if (data.quantity > batch.quantity) {
          throw ApiError.badRequest(
            `Only ${qty(batch.quantity, item.unit)} left in this batch`,
          );
        }
        delta = -data.quantity;
        updated = await this.inventoryRepository.takeFromBatch(
          hospitalId,
          batchId,
          data.quantity,
          session,
        );
      }
      if (!updated) {
        throw ApiError.conflict(
          'Stock changed while you were adjusting — reopen the batch and try again',
        );
      }

      await this.inventoryRepository.createMovements(
        [
          {
            hospitalId,
            itemId,
            itemName: item.name,
            unit: item.unit,
            batchId,
            batchNumber: batch.batchNumber,
            expiryDate: batch.expiryDate,
            type: data.type,
            quantity: delta,
            batchBalanceAfter: updated.quantity,
            reason: data.reason || undefined,
            at: now,
            actorUserId: actor.userId,
            actorName: actor.name,
          },
        ],
        session,
      );
    });

    const batchLabel = batch.batchNumber ? ` · batch ${batch.batchNumber}` : '';
    await this.auditService.log({
      hospitalId,
      actor: this.actorOf(actor),
      action:
        data.type === INVENTORY_MOVEMENT_TYPE.ADJUSTED
          ? 'inventory.stock_counted'
          : 'inventory.stock_written_off',
      area: 'inventory',
      summary:
        data.type === INVENTORY_MOVEMENT_TYPE.ADJUSTED
          ? `Corrected "${item.name}" count from ${batch.quantity} to ${data.countedQuantity}${batchLabel}`
          : `Wrote off ${qty(-delta!, item.unit)} of "${item.name}" as ${WRITE_OFF_LABELS[data.type]}${batchLabel}`,
      detail: { itemId, batchId, reason: data.reason },
      amount:
        batch.unitCost !== undefined ? batch.unitCost * delta! : undefined,
    });

    return this.getItem(hospitalId, itemId);
  }
}
