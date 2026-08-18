import { Inject, Injectable } from '@nestjs/common';
import { Firestore } from 'firebase-admin/firestore';
import { FIRESTORE } from '../firebase/firebase.constants';
import { FIREBASE_COLLECTIONS } from '@agam-plus/shared';

@Injectable()
export class UserRepository {
  constructor(@Inject(FIRESTORE) private readonly db: Firestore) {}

  async getUserByFirebaseUid(firebaseUid: string) {
    const userSnap = await this.db
      .collection(FIREBASE_COLLECTIONS.USERS)
      .where('firebaseUid', '==', firebaseUid)
      .limit(1)
      .get();

    if (userSnap.empty) return null;

    const userDoc = userSnap.docs[0];
    return { id: userDoc.id, ...userDoc.data() };
  }

  async getUserByEmail(email: string) {
    const userSnap = await this.db
      .collection(FIREBASE_COLLECTIONS.USERS)
      .where('email', '==', email)
      .limit(1)
      .get();

    if (userSnap.empty) return null;

    const userDoc = userSnap.docs[0];
    return { id: userDoc.id, ...userDoc.data() };
  }

  async getUserById(userId: string) {
    const userDoc = await this.db.collection(FIREBASE_COLLECTIONS.USERS).doc(userId).get();
    if (!userDoc.exists) return null;
    return { id: userDoc.id, ...userDoc.data() };
  }

  async createUser(userData: any) {
    const newUserRef = this.db.collection(FIREBASE_COLLECTIONS.USERS).doc();
    await newUserRef.set({
      id: newUserRef.id,
      ...userData,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return newUserRef.id;
  }

  async updateUser(userId: string, updates: any) {
    await this.db
      .collection(FIREBASE_COLLECTIONS.USERS)
      .doc(userId)
      .update({ ...updates, updatedAt: new Date() });
  }

  async getUserByFirebaseUidOrEmail(firebaseUid: string, email: string) {
    let userSnap = await this.db
      .collection(FIREBASE_COLLECTIONS.USERS)
      .where('firebaseUid', '==', firebaseUid)
      .limit(1)
      .get();

    if (userSnap.empty) {
      userSnap = await this.db
        .collection(FIREBASE_COLLECTIONS.USERS)
        .where('email', '==', email)
        .limit(1)
        .get();
    }

    return userSnap;
  }
}
