import { Inject, Injectable } from '@nestjs/common';
import { Firestore } from 'firebase-admin/firestore';
import { FIRESTORE } from '../firebase/firebase.constants';
import { FIREBASE_COLLECTIONS } from '../constants';

@Injectable()
export class HospitalRepository {
  constructor(@Inject(FIRESTORE) private readonly db: Firestore) {}

  async getAllHospitals() {
    const snapshot = await this.db.collection(FIREBASE_COLLECTIONS.HOSPITALS).get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async getHospitalById(hospitalId: string) {
    const doc = await this.db.collection(FIREBASE_COLLECTIONS.HOSPITALS).doc(hospitalId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
  }

  async updateHospital(hospitalId: string, data: any) {
    const hospitalRef = this.db.collection(FIREBASE_COLLECTIONS.HOSPITALS).doc(hospitalId);
    const doc = await hospitalRef.get();

    if (!doc.exists) {
      throw new Error('Hospital not found');
    }

    await hospitalRef.update({ ...data, updatedAt: new Date() });

    const updatedDoc = await hospitalRef.get();
    return { id: updatedDoc.id, ...updatedDoc.data() };
  }
}
