import { Inject, Injectable } from '@nestjs/common';
import { Firestore } from 'firebase-admin/firestore';
import { FIRESTORE } from '../firebase/firebase.constants';
import { FIREBASE_COLLECTIONS } from '../constants';

@Injectable()
export class MembershipRepository {
  constructor(@Inject(FIRESTORE) private readonly db: Firestore) {}

  async getUserHospitalMemberships(userId: string, status?: string) {
    let query = this.db.collection(FIREBASE_COLLECTIONS.HOSPITAL_MEMBERS).where('userId', '==', userId);
    if (status) query = query.where('status', '==', status);

    const snapshot = await query.get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async getHospitalMembership(hospitalId: string, userId: string) {
    return this.db
      .collection(FIREBASE_COLLECTIONS.HOSPITAL_MEMBERS)
      .where('userId', '==', userId)
      .where('hospitalId', '==', hospitalId)
      .limit(1)
      .get();
  }

  async getHospitalMembershipData(userId: string, hospitalId: string) {
    const snapshot = await this.db
      .collection(FIREBASE_COLLECTIONS.HOSPITAL_MEMBERS)
      .where('userId', '==', userId)
      .where('hospitalId', '==', hospitalId)
      .limit(1)
      .get();

    if (snapshot.empty) return null;
    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
  }

  async getUserHospitalRole(userId: string, hospitalId: string): Promise<string | null> {
    try {
      const query = await this.db
        .collection(FIREBASE_COLLECTIONS.HOSPITAL_MEMBERS)
        .where('userId', '==', userId)
        .where('hospitalId', '==', hospitalId)
        .where('status', '==', 'approved')
        .limit(1)
        .get();

      return query.empty ? null : query.docs[0].data().role || null;
    } catch (error) {
      console.error('Error checking user role', error);
      return null;
    }
  }

  async getHospitalMembers(hospitalId: string, options?: { status?: string; role?: string }) {
    let query = this.db.collection(FIREBASE_COLLECTIONS.HOSPITAL_MEMBERS).where('hospitalId', '==', hospitalId);
    if (options?.status) query = query.where('status', '==', options.status);
    if (options?.role) query = query.where('role', '==', options.role);

    const snapshot = await query.get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async createHospitalMembership(membershipData: any) {
    const membershipRef = await this.db.collection(FIREBASE_COLLECTIONS.HOSPITAL_MEMBERS).add({
      ...membershipData,
      joinedAt: new Date(),
    });
    return membershipRef.id;
  }

  async updateHospitalMembership(membershipId: string, updates: any) {
    await this.db
      .collection(FIREBASE_COLLECTIONS.HOSPITAL_MEMBERS)
      .doc(membershipId)
      .update({ ...updates, updatedAt: new Date() });
  }

  async getUserHospitalsWithDetails(
    userId: string,
    options?: { formatJoinedAt?: (value: any) => any; includeAvailability?: boolean },
  ) {
    const hospitalMemberships = await this.getUserHospitalMemberships(userId);
    const hospitals: any[] = [];

    for (const memberData of hospitalMemberships) {
      const member = memberData as any;
      if (!member.hospitalId) continue;

      const hospitalDoc = await this.db.collection(FIREBASE_COLLECTIONS.HOSPITALS).doc(member.hospitalId).get();

      if (hospitalDoc.exists) {
        const hospitalInfo: any = {
          id: member.id,
          hospitalId: member.hospitalId,
          hospital: { id: hospitalDoc.id, ...hospitalDoc.data() },
          role: member.role,
          status: member.status,
          joinedAt: options?.formatJoinedAt ? options.formatJoinedAt(member.joinedAt) : member.joinedAt,
          isDoctor: member.isDoctor || false,
          isProfileUpdated: member.isProfileUpdated || false,
          isExperienceUpdated: member.isExperienceUpdated || false,
          userId: member.userId,
        };

        if (options?.includeAvailability) {
          hospitalInfo.isAvailabilityUpdated = member.isAvailabilityUpdated || false;
        }

        hospitals.push(hospitalInfo);
      }
    }

    return hospitals;
  }

  async getHospitalMembershipById(membershipId: string) {
    const doc = await this.db.collection(FIREBASE_COLLECTIONS.HOSPITAL_MEMBERS).doc(membershipId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
  }

  async updateHospitalMembershipStatus(membershipId: string, status: string) {
    await this.db
      .collection(FIREBASE_COLLECTIONS.HOSPITAL_MEMBERS)
      .doc(membershipId)
      .update({
        status,
        updatedAt: new Date(),
        ...(status === 'approved' && { approvedAt: new Date() }),
      });
  }

  async deleteHospitalMembership(hospitalId: string, userId: string) {
    const snapshot = await this.db
      .collection(FIREBASE_COLLECTIONS.HOSPITAL_MEMBERS)
      .where('hospitalId', '==', hospitalId)
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (!snapshot.empty) {
      await snapshot.docs[0].ref.delete();
    }
  }

  async countHospitalMembers(criteria: { hospitalId: string; role?: string; status?: string }) {
    let query = this.db.collection(FIREBASE_COLLECTIONS.HOSPITAL_MEMBERS).where('hospitalId', '==', criteria.hospitalId);
    if (criteria.role) query = query.where('role', '==', criteria.role);
    if (criteria.status) query = query.where('status', '==', criteria.status);

    const snapshot = await query.get();
    return snapshot.size;
  }
}
