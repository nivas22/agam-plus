import { Inject, Injectable } from '@nestjs/common';
import { Firestore } from 'firebase-admin/firestore';
import { FIRESTORE } from '../firebase/firebase.constants';
import { FIREBASE_COLLECTIONS } from '@agam-plus/shared';

@Injectable()
export class DoctorRepository {
  constructor(@Inject(FIRESTORE) private readonly db: Firestore) {}

  async getDoctorProfileById(doctorProfileId: string) {
    const doc = await this.db.collection(FIREBASE_COLLECTIONS.DOCTOR_PROFILES).doc(doctorProfileId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
  }

  async getDoctorProfileByUserId(userId: string) {
    const snapshot = await this.db.collection(FIREBASE_COLLECTIONS.DOCTOR_PROFILES).doc(userId).get();
    if (!snapshot.exists) return null;
    return { id: snapshot.id, ...snapshot.data() };
  }

  async verifyDoctorInHospital(doctorProfileId: string, hospitalId: string): Promise<boolean> {
    const doctor = await this.getDoctorProfileById(doctorProfileId);
    return doctor !== null && (doctor as any).hospitalId === hospitalId;
  }

  async getDoctorProfileByHospitalAndUserId(hospitalId: string, userId: string) {
    const snapshot = await this.db
      .collection(FIREBASE_COLLECTIONS.DOCTOR_PROFILES)
      .where('hospitalId', '==', hospitalId)
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (snapshot.empty) return null;
    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
  }

  async getDoctorProfilesByUserIds(userIds: string[]) {
    if (userIds.length === 0) return [];

    const profiles: any[] = [];
    for (let i = 0; i < userIds.length; i += 10) {
      const batch = userIds.slice(i, i + 10);
      const snapshot = await this.db
        .collection(FIREBASE_COLLECTIONS.DOCTOR_PROFILES)
        .where('userId', 'in', batch)
        .get();

      snapshot.docs.forEach((doc) => {
        profiles.push({ id: doc.id, ...doc.data() });
      });
    }

    return profiles;
  }

  async upsertDoctorProfile(userId: string, profileData: any) {
    const doctorProfileRef = this.db.collection(FIREBASE_COLLECTIONS.DOCTOR_PROFILES).doc(userId);
    await doctorProfileRef.set(
      {
        userId,
        ...profileData,
        updatedAt: new Date(),
      },
      { merge: true },
    );
    return userId;
  }

  async doctorProfileExists(userId: string): Promise<boolean> {
    const doc = await this.db.collection(FIREBASE_COLLECTIONS.DOCTOR_PROFILES).doc(userId).get();
    return doc.exists;
  }

  async updateDoctorProfile(userId: string, updates: any) {
    await this.db
      .collection(FIREBASE_COLLECTIONS.DOCTOR_PROFILES)
      .doc(userId)
      .update({ ...updates, updatedAt: new Date() });
  }

  async getDoctorProfileWithUser(doctorId: string) {
    const doctorDoc = await this.db.collection(FIREBASE_COLLECTIONS.DOCTOR_PROFILES).doc(doctorId).get();
    if (!doctorDoc.exists) return null;

    const doctorData = doctorDoc.data();
    const userDoc = await this.db.collection(FIREBASE_COLLECTIONS.USERS).doc((doctorData as any)?.userId).get();

    return { id: doctorDoc.id, ...doctorData, user: userDoc.data() || {} };
  }

  async updateDoctorProfileByUserId(userId: string, updates: any) {
    const snapshot = await this.db
      .collection(FIREBASE_COLLECTIONS.DOCTOR_PROFILES)
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (snapshot.empty) {
      throw new Error('Doctor profile not found');
    }

    await snapshot.docs[0].ref.update({ ...updates, updatedAt: new Date() });
    return snapshot.docs[0].data();
  }

  async getDoctorProfilesByIds(doctorIds: string[], hospitalId?: string) {
    if (doctorIds.length === 0) return [];

    const doctors: any[] = [];
    for (const id of doctorIds) {
      try {
        const doc = await this.db.collection(FIREBASE_COLLECTIONS.DOCTOR_PROFILES).doc(id).get();
        if (!doc.exists) continue;

        const data = doc.data();
        if (!hospitalId || !data?.hospitalId || data.hospitalId === hospitalId) {
          doctors.push({ id: doc.id, ...data });
        }
      } catch (error) {
        console.error(`Error fetching doctor ${id}:`, error);
      }
    }

    return doctors;
  }
}
