import { Inject, Injectable } from '@nestjs/common';
import { Firestore } from 'firebase-admin/firestore';
import { FIRESTORE } from '../firebase/firebase.constants';

@Injectable()
export class QueryRepository {
  constructor(@Inject(FIRESTORE) private readonly db: Firestore) {}

  async countWhere(collection: string, conditions: Record<string, any>) {
    let query: FirebaseFirestore.Query = this.db.collection(collection);
    Object.entries(conditions).forEach(([field, value]) => {
      query = query.where(field, '==', value);
    });
    return (await query.get()).size;
  }

  async countBetween(collection: string, opts: { hospitalId: string; field: string; start: string; end: string }) {
    const { hospitalId, field, start, end } = opts;
    const snapshot = await this.db
      .collection(collection)
      .where('hospitalId', '==', hospitalId)
      .where(field, '>=', start)
      .where(field, '<=', end)
      .get();
    return snapshot.size;
  }

  async batchGetDocuments(collection: string, ids: string[], hospitalId?: string): Promise<any[]> {
    const results: any[] = [];
    for (const id of ids) {
      try {
        const doc = await this.db.collection(collection).doc(id).get();
        if (!doc.exists) continue;

        const data = doc.data();
        if (!hospitalId || !data?.hospitalId || data.hospitalId === hospitalId) {
          results.push({ id: doc.id, ...data });
        }
      } catch (error) {
        console.error(`Error fetching document ${id}:`, error);
      }
    }
    return results;
  }
}
