import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { DateTime } from 'luxon';
import { InventoryService } from './inventory.service';
import { InventoryRepository } from '../repositories/inventory.repository';
import {
  InventoryItem,
  InventoryItemSchema,
} from '../schemas/inventory-item.schema';
import {
  InventoryBatch,
  InventoryBatchSchema,
} from '../schemas/inventory-batch.schema';
import {
  InventoryMovement,
  InventoryMovementSchema,
} from '../schemas/inventory-movement.schema';
import { Counter, CounterSchema } from '../schemas/counter.schema';
import {
  connectTestMongo,
  closeTestMongo,
  clearTestMongo,
} from '../test-utils/mongo-memory';
import { ApiError } from '../common/errors/api-error';

const TZ = 'Asia/Kolkata';
const dayFromToday = (n: number) =>
  DateTime.now().setZone(TZ).plus({ days: n }).toISODate()!;

const actor: any = {
  userId: 'u1',
  name: 'Asha',
  role: 'admin',
  hospitalId: 'h1',
};

describe('InventoryService', () => {
  let service: InventoryService;
  let repo: InventoryRepository;
  const audit = { log: jest.fn() };

  beforeAll(async () => {
    await connectTestMongo();
    repo = new InventoryRepository(
      mongoose.model(InventoryItem.name, InventoryItemSchema) as any,
      mongoose.model(InventoryBatch.name, InventoryBatchSchema) as any,
      mongoose.model(InventoryMovement.name, InventoryMovementSchema) as any,
      mongoose.model(Counter.name, CounterSchema) as any,
    );
    service = new InventoryService(
      repo,
      { getTimezone: async () => TZ } as any,
      audit as any,
    );
  });

  afterEach(async () => {
    audit.log.mockClear();
    await clearTestMongo();
  });
  afterAll(async () => closeTestMongo());

  const createGloves = () =>
    service.createItem('h1', actor, {
      name: 'Nitrile gloves',
      category: 'consumables',
      unit: 'box',
      reorderLevel: 5,
      tracksExpiry: true,
    });

  it('numbers items per hospital and starts them out of stock', async () => {
    const first = await createGloves();
    const second = await service.createItem('h1', actor, {
      name: 'A4 paper',
      category: 'stationery',
      unit: 'ream',
      tracksExpiry: false,
    });
    const otherHospital = await service.createItem('h2', actor, {
      name: 'Gauze',
      category: 'surgical',
      unit: 'roll',
    });

    expect(first.code).toBe('INV-0001');
    expect(second.code).toBe('INV-0002');
    expect(otherHospital.code).toBe('INV-0001');
    expect(first).toMatchObject({ onHand: 0, stockStatus: 'out', batches: [] });
  });

  it('requires batch and expiry for expiry-tracked items, and rejects already-expired stock', async () => {
    const item = await createGloves();

    await expect(
      service.receiveStock('h1', actor, item.id, { quantity: 10 }),
    ).rejects.toThrow('Batch number');
    await expect(
      service.receiveStock('h1', actor, item.id, {
        quantity: 10,
        batchNumber: 'B1',
        expiryDate: dayFromToday(-1),
      }),
    ).rejects.toThrow('already expired');
  });

  it('ignores batch fields for items that do not track expiry', async () => {
    const paper = await service.createItem('h1', actor, {
      name: 'A4 paper',
      category: 'stationery',
      unit: 'ream',
      tracksExpiry: false,
    });
    const after = await service.receiveStock('h1', actor, paper.id, {
      quantity: 4,
      batchNumber: 'X',
      expiryDate: dayFromToday(10),
    });

    expect(after.batches[0]).toMatchObject({ quantity: 4 });
    expect(after.batches[0].batchNumber).toBeUndefined();
    expect(after.batches[0].expiryDate).toBeUndefined();
  });

  it('issues first-expiry-first-out across batches and writes one ledger row per batch', async () => {
    const item = await createGloves();
    await service.receiveStock('h1', actor, item.id, {
      quantity: 10,
      batchNumber: 'LATE',
      expiryDate: dayFromToday(300),
      unitCost: 100,
    });
    await service.receiveStock('h1', actor, item.id, {
      quantity: 4,
      batchNumber: 'SOON',
      expiryDate: dayFromToday(60),
      unitCost: 90,
    });

    const after = await service.issueStock('h1', actor, item.id, {
      quantity: 6,
      issuedTo: 'OT',
    });

    expect(after.onHand).toBe(8);
    expect(after.stockValue).toBe(800);
    expect(after.batches.map((b: any) => [b.batchNumber, b.quantity])).toEqual([
      ['LATE', 8],
    ]);

    const issued = after.movements.filter((m: any) => m.type === 'issued');
    expect(
      issued
        .map((m: any) => [m.batchNumber, m.quantity, m.batchBalanceAfter])
        .sort(),
    ).toEqual(
      [
        ['LATE', -2, 8],
        ['SOON', -4, 0],
      ].sort(),
    );
    expect(new Set(issued.map((m: any) => m.groupId)).size).toBe(1);
  });

  it('refuses to issue more than is usable and never issues from an expired batch', async () => {
    const item = await createGloves();
    await service.receiveStock('h1', actor, item.id, {
      quantity: 3,
      batchNumber: 'B1',
      expiryDate: dayFromToday(30),
    });
    // Simulate a batch that has expired since it was received.
    const expired = await repo.createBatch({
      hospitalId: 'h1',
      itemId: item.id,
      batchNumber: 'OLD',
      expiryDate: dayFromToday(-2),
      quantityReceived: 50,
      quantity: 50,
      receivedAt: new Date(0),
    });

    await expect(
      service.issueStock('h1', actor, item.id, { quantity: 5 }),
    ).rejects.toThrow('Only 3 box in usable stock');
    await expect(
      service.issueStock('h1', actor, item.id, {
        quantity: 1,
        batchId: expired.id,
      }),
    ).rejects.toThrow('write it off');
  });

  it('restores earlier batches when a later one was emptied concurrently (no-transaction fallback)', async () => {
    const item = await createGloves();
    await service.receiveStock('h1', actor, item.id, {
      quantity: 2,
      batchNumber: 'A',
      expiryDate: dayFromToday(20),
    });
    await service.receiveStock('h1', actor, item.id, {
      quantity: 2,
      batchNumber: 'B',
      expiryDate: dayFromToday(40),
    });

    // The in-memory Mongo is standalone, so the transaction attempt fails
    // and the service reruns without a session — only count those calls.
    const original = repo.takeFromBatch.bind(repo);
    let fallbackCalls = 0;
    const spy = jest
      .spyOn(repo, 'takeFromBatch')
      .mockImplementation(async (...args) => {
        if (args[3]) return original(...args);
        fallbackCalls += 1;
        return fallbackCalls === 2 ? null : original(...args);
      });

    const error = await service
      .issueStock('h1', actor, item.id, { quantity: 3 })
      .catch((e) => e);
    spy.mockRestore();
    expect(fallbackCalls).toBe(2);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.statusCode).toBe(409);
    const after = await service.getItem('h1', item.id);
    expect(after.onHand).toBe(4);
    expect(
      after.movements.filter((m: any) => m.type === 'issued'),
    ).toHaveLength(0);
  });

  it('corrects a count and writes off stock, recording signed movements', async () => {
    const item = await createGloves();
    const received = await service.receiveStock('h1', actor, item.id, {
      quantity: 10,
      batchNumber: 'B1',
      expiryDate: dayFromToday(90),
      unitCost: 50,
    });
    const batchId = received.batches[0].id;

    const counted = await service.adjustBatch('h1', actor, item.id, batchId, {
      type: 'adjusted',
      countedQuantity: 7,
      reason: 'Shelf count',
    });
    expect(counted.onHand).toBe(7);

    await expect(
      service.adjustBatch('h1', actor, item.id, batchId, {
        type: 'adjusted',
        countedQuantity: 7,
        reason: 'Again',
      }),
    ).rejects.toThrow('matches');
    await expect(
      service.adjustBatch('h1', actor, item.id, batchId, {
        type: 'damaged',
        quantity: 8,
      }),
    ).rejects.toThrow('Only 7 box left');

    const writtenOff = await service.adjustBatch(
      'h1',
      actor,
      item.id,
      batchId,
      { type: 'damaged', quantity: 2, reason: 'Torn' },
    );
    expect(writtenOff.onHand).toBe(5);
    expect(writtenOff.stockStatus).toBe('low');
    expect(writtenOff.movements.map((m: any) => [m.type, m.quantity])).toEqual([
      ['damaged', -2],
      ['adjusted', -3],
      ['received', 10],
    ]);
    expect(audit.log).toHaveBeenLastCalledWith(
      expect.objectContaining({
        action: 'inventory.stock_written_off',
        area: 'inventory',
        amount: -100,
      }),
    );
  });

  it('summarises low, out-of-stock and expiring items, ignoring archived ones', async () => {
    const gloves = await createGloves();
    await service.receiveStock('h1', actor, gloves.id, {
      quantity: 3,
      batchNumber: 'B1',
      expiryDate: dayFromToday(10),
      unitCost: 20,
    });
    await service.createItem('h1', actor, {
      name: 'Gauze',
      category: 'surgical',
      unit: 'roll',
    });
    const archived = await service.createItem('h1', actor, {
      name: 'Old item',
      category: 'other',
      unit: 'piece',
    });
    await service.setStatus('h1', archived.id, actor, 'archived');

    const summary = await service.getSummary('h1');
    expect(summary).toMatchObject({
      activeItems: 2,
      lowStock: 1,
      outOfStock: 1,
      expiringBatches: 1,
      expiredBatches: 0,
      stockValue: 60,
    });

    const lowList = await service.listItems('h1', { stock: 'low' });
    expect(lowList.items.map((i: any) => i.name).sort()).toEqual([
      'Gauze',
      'Nitrile gloves',
    ]);
    expect(lowList.counts).toMatchObject({
      all: 2,
      archived: 1,
      consumables: 1,
      surgical: 1,
    });

    const expiring = await service.listItems('h1', { stock: 'expiring' });
    expect(expiring.items.map((i: any) => i.name)).toEqual(['Nitrile gloves']);
  });
});

// Production runs on a replica set, where issues across batches are one
// transaction — check that path for real rather than only the fallback.
describe('InventoryService on a replica set', () => {
  let replSet: MongoMemoryReplSet;
  let connection: mongoose.Connection;
  let service: InventoryService;
  let repo: InventoryRepository;

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    connection = await mongoose.createConnection(replSet.getUri()).asPromise();
    repo = new InventoryRepository(
      connection.model(InventoryItem.name, InventoryItemSchema) as any,
      connection.model(InventoryBatch.name, InventoryBatchSchema) as any,
      connection.model(InventoryMovement.name, InventoryMovementSchema) as any,
      connection.model(Counter.name, CounterSchema) as any,
    );
    // Collections must exist before a transaction can write to them.
    await Promise.all(
      Object.values(connection.models).map((m) => m.createCollection()),
    );
    service = new InventoryService(
      repo,
      { getTimezone: async () => TZ } as any,
      { log: jest.fn() } as any,
    );
  }, 60000);

  afterAll(async () => {
    await connection?.close();
    await replSet?.stop();
  });

  it('rolls back every batch when one part of an issue fails', async () => {
    const item = await service.createItem('h1', actor, {
      name: 'Syringe 5ml',
      category: 'consumables',
      unit: 'piece',
    });
    await service.receiveStock('h1', actor, item.id, {
      quantity: 2,
      batchNumber: 'A',
      expiryDate: dayFromToday(20),
    });
    await service.receiveStock('h1', actor, item.id, {
      quantity: 2,
      batchNumber: 'B',
      expiryDate: dayFromToday(40),
    });

    const original = repo.takeFromBatch.bind(repo);
    let calls = 0;
    const spy = jest
      .spyOn(repo, 'takeFromBatch')
      .mockImplementation(async (...args) => {
        expect(args[3]).toBeDefined(); // always inside the transaction
        calls += 1;
        return calls === 2 ? null : original(...args);
      });
    await expect(
      service.issueStock('h1', actor, item.id, { quantity: 3 }),
    ).rejects.toThrow('Stock changed');
    spy.mockRestore();

    expect((await service.getItem('h1', item.id)).onHand).toBe(4);

    const after = await service.issueStock('h1', actor, item.id, {
      quantity: 3,
    });
    expect(after.onHand).toBe(1);
    expect(after.batches.map((b: any) => [b.batchNumber, b.quantity])).toEqual([
      ['B', 1],
    ]);
  });
});
