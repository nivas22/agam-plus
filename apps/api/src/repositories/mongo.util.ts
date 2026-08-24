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
