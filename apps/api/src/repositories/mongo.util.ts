import { Logger } from '@nestjs/common';
import type { ClientSession, Connection } from 'mongoose';
import { ApiError } from '../common/errors/api-error';

// Shared helpers to translate Mongoose lean documents into the plain
// `{ id, ...fields }` shape the rest of the app already expects (the same
// shape the old Firestore repositories returned via `{ id: doc.id, ...doc.data() }`).

// Typed as `any` throughout (matching the old Firestore repositories, whose
// `.data()` calls were implicitly `any`) — a generic mapped-type signature
// here produces Mongoose lean-document types deep enough that tsc refuses
// to serialize the inferred return type at call sites several layers up.
export function stripMongoMeta(doc: any): any {
  if (!doc) return doc;
  const { _id, __v, ...rest } = doc;
  return rest;
}

export function toPlain(doc: any): any {
  if (!doc) return null;
  return { id: String(doc._id), ...stripMongoMeta(doc) };
}

export function toPlainList(docs: any[]): any[] {
  return docs.map((doc) => toPlain(doc));
}

// Mimics the shape of a Firestore QuerySnapshot ({ empty, docs: [{ id, data() }] })
// for the handful of call sites (auth.service.ts, doctors.service.ts,
// appointments.service.ts) written against that API.
export interface SnapshotLike {
  empty: boolean;
  docs: Array<{ id: string; data: () => Record<string, any> }>;
}

export function toSnapshot(doc: any): SnapshotLike {
  if (!doc) return { empty: true, docs: [] };
  const id = String(doc._id);
  return { empty: false, docs: [{ id, data: () => stripMongoMeta(doc) }] };
}

// Runs `fn` inside a Mongo transaction. Falls back to running `fn` without
// a session if the deployment isn't a replica set/mongos (e.g. a standalone
// dev Mongo) — callers must still keep their writes individually safe
// (conditional updates) for that case.
export async function runInTransaction<T>(
  connection: Connection,
  logger: Logger,
  fn: (session: ClientSession | undefined) => Promise<T>,
): Promise<T> {
  const session = await connection.startSession();
  try {
    let result: T;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result!;
  } catch (error) {
    // A business error thrown by `fn` itself (e.g. "slot no longer
    // available") must always propagate as-is — never reinterpreted as a
    // transactions-unavailable signal and retried, which would silently
    // swallow it and re-run `fn` a second time.
    if (error instanceof ApiError) throw error;

    const message = (error as Error)?.message ?? '';
    if (
      /transaction numbers|illegalOperation|replica set|mongos|does not support retryable writes/i.test(
        message,
      )
    ) {
      logger.warn('Mongo transactions unavailable (not a replica set) — running without one');
      return fn(undefined);
    }
    throw error;
  } finally {
    await session.endSession();
  }
}
