import { Inject, Injectable } from '@nestjs/common';
import { Firestore } from 'firebase-admin/firestore';
import { FIRESTORE } from '../firebase/firebase.constants';
import { FIREBASE_COLLECTIONS } from '@agam-plus/shared';

@Injectable()
export class PatientRepository {
  constructor(@Inject(FIRESTORE) private readonly db: Firestore) {}

  async getPatientById(patientId: string) {
    const patientDoc = await this.db.collection(FIREBASE_COLLECTIONS.PATIENTS).doc(patientId).get();
    if (!patientDoc.exists) return null;
    return { id: patientDoc.id, ...patientDoc.data() };
  }

  async verifyPatientInHospital(patientId: string, hospitalId: string): Promise<boolean> {
    const patient = await this.getPatientById(patientId);
    return patient !== null && (patient as any).hospitalId === hospitalId;
  }

  async getPatientsByHospital(hospitalId: string, doctorId?: string) {
    let query = this.db.collection(FIREBASE_COLLECTIONS.PATIENTS).where('hospitalId', '==', hospitalId);
    if (doctorId) query = query.where('doctorId', '==', doctorId);

    const snapshot = await query.get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async patientExistsByEmail(hospitalId: string, email: string): Promise<boolean> {
    const snapshot = await this.db
      .collection(FIREBASE_COLLECTIONS.PATIENTS)
      .where('hospitalId', '==', hospitalId)
      .where('email', '==', email)
      .get();

    return !snapshot.empty;
  }

  async createPatient(patientData: any) {
    const patientRef = this.db.collection(FIREBASE_COLLECTIONS.PATIENTS).doc();
    await patientRef.set({
      id: patientRef.id,
      ...patientData,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return patientRef.id;
  }

  async getPatientsByHospitalId(hospitalId: string) {
    const snapshot = await this.db.collection(FIREBASE_COLLECTIONS.PATIENTS).where('hospitalId', '==', hospitalId).get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async getPatientsByUserIds(userIds: string[]) {
    if (userIds.length === 0) return [];

    const patients: any[] = [];
    for (let i = 0; i < userIds.length; i += 10) {
      const batch = userIds.slice(i, i + 10);
      const snapshot = await this.db.collection(FIREBASE_COLLECTIONS.PATIENTS).where('userId', 'in', batch).get();

      snapshot.docs.forEach((doc) => {
        patients.push({ id: doc.id, ...doc.data() });
      });
    }

    return patients;
  }

  async getPatientsByIds(patientIds: string[], hospitalId?: string) {
    if (patientIds.length === 0) return [];

    const patients: any[] = [];
    for (const id of patientIds) {
      try {
        const doc = await this.db.collection(FIREBASE_COLLECTIONS.PATIENTS).doc(id).get();
        if (!doc.exists) continue;

        const data = doc.data();
        if (!hospitalId || !data?.hospitalId || data.hospitalId === hospitalId) {
          patients.push({ id: doc.id, ...data });
        }
      } catch (error) {
        console.error(`Error fetching patient ${id}:`, error);
      }
    }

    return patients;
  }

  async updatePatient(patientId: string, updates: any) {
    await this.db
      .collection(FIREBASE_COLLECTIONS.PATIENTS)
      .doc(patientId)
      .update({ ...updates, updatedAt: new Date() });
  }

  async deletePatient(patientId: string, deletedBy: string) {
    await this.db.collection(FIREBASE_COLLECTIONS.PATIENTS).doc(patientId).update({
      status: 'archived',
      updatedAt: new Date(),
      archivedAt: new Date(),
      archivedBy: deletedBy,
    });
  }
}
