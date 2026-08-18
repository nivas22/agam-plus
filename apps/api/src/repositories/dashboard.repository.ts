import { Inject, Injectable } from '@nestjs/common';
import { Firestore } from 'firebase-admin/firestore';
import { FIRESTORE } from '../firebase/firebase.constants';
import { FIREBASE_COLLECTIONS } from '@agam-plus/shared';

@Injectable()
export class DashboardRepository {
  constructor(@Inject(FIRESTORE) private readonly db: Firestore) {}

  async countDocuments(collection: string, conditions: Record<string, any>): Promise<number> {
    let query: FirebaseFirestore.Query = this.db.collection(collection);
    Object.entries(conditions).forEach(([field, value]) => {
      query = query.where(field, '==', value);
    });
    const snapshot = await query.get();
    return snapshot.size;
  }

  async countDocumentsBetween(collection: string, opts: { hospitalId: string; field: string; start: string; end: string }): Promise<number> {
    const { hospitalId, field, start, end } = opts;
    const snapshot = await this.db
      .collection(collection)
      .where('hospitalId', '==', hospitalId)
      .where(field, '>=', start)
      .where(field, '<=', end)
      .get();
    return snapshot.size;
  }

  async getStaffOnDutyCount(hospitalId: string): Promise<number> {
    try {
      const snapshot = await this.db
        .collection(FIREBASE_COLLECTIONS.HOSPITAL_MEMBERS)
        .where('hospitalId', '==', hospitalId)
        .where('status', '==', 'approved')
        .where('role', 'in', ['doctor', 'staff', 'nurse'])
        .get();

      return snapshot.size;
    } catch {
      return 0;
    }
  }

  async countDoctorAppointments(hospitalId: string, doctorId: string, start: string, end: string, status?: string): Promise<number> {
    let query: any = this.db
      .collection(FIREBASE_COLLECTIONS.APPOINTMENTS)
      .where('hospitalId', '==', hospitalId)
      .where('doctorProfileId', '==', doctorId)
      .where('date', '>=', start)
      .where('date', '<=', end);

    if (status) query = query.where('status', '==', status);

    const snapshot = await query.get();
    return snapshot.size;
  }

  async getDoctorPatientCount(hospitalId: string, doctorId: string): Promise<number> {
    const snapshot = await this.db
      .collection(FIREBASE_COLLECTIONS.APPOINTMENTS)
      .where('hospitalId', '==', hospitalId)
      .where('doctorProfileId', '==', doctorId)
      .get();

    const patients = new Set<string>();
    snapshot.forEach((doc) => {
      const patientId = doc.data().patientId;
      if (patientId) patients.add(patientId);
    });

    return patients.size;
  }

  async getDoctorUpcomingAppointments(hospitalId: string, doctorId: string, limit = 5) {
    const now = new Date().toISOString().split('T')[0];

    const snapshot = await this.db
      .collection(FIREBASE_COLLECTIONS.APPOINTMENTS)
      .where('hospitalId', '==', hospitalId)
      .where('doctorProfileId', '==', doctorId)
      .where('date', '>=', now)
      .orderBy('date', 'asc')
      .limit(limit)
      .get();

    const docs = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((doc: any) => doc.status === 'scheduled' || doc.status === 'confirmed' || doc.status === 'pending');

    return docs.slice(0, limit);
  }

  async getHospitalUpcomingAppointments(hospitalId: string, limit = 5) {
    const now = new Date().toISOString();

    const snapshot = await this.db
      .collection(FIREBASE_COLLECTIONS.APPOINTMENTS)
      .where('hospitalId', '==', hospitalId)
      .where('date', '>=', now)
      .orderBy('date', 'asc')
      .limit(limit)
      .get();

    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async getDocumentsByIds(collection: string, ids: string[], hospitalId?: string): Promise<any[]> {
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
