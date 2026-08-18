import { Inject, Injectable } from '@nestjs/common';
import { Firestore } from 'firebase-admin/firestore';
import { FIRESTORE } from '../firebase/firebase.constants';
import { FIREBASE_COLLECTIONS } from '../constants';

@Injectable()
export class AppointmentRepository {
  constructor(@Inject(FIRESTORE) private readonly db: Firestore) {}

  async getAppointmentsByHospitalId(hospitalId: string, limit?: number) {
    let query = this.db.collection(FIREBASE_COLLECTIONS.APPOINTMENTS).where('hospitalId', '==', hospitalId);
    if (limit) query = query.limit(limit);

    const snapshot = await query.get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async getAppointmentsByDoctorId(
    hospitalId: string,
    doctorId: string,
    options?: { startDate?: string; endDate?: string; status?: string; limit?: number },
  ) {
    let query = this.db
      .collection(FIREBASE_COLLECTIONS.APPOINTMENTS)
      .where('hospitalId', '==', hospitalId)
      .where('doctorId', '==', doctorId);

    if (options?.startDate) query = query.where('date', '>=', options.startDate);
    if (options?.endDate) query = query.where('date', '<=', options.endDate);
    if (options?.status) query = query.where('status', '==', options.status);
    if (options?.limit) query = query.limit(options.limit);

    const snapshot = await query.get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async getUpcomingAppointments(hospitalId: string, options?: { doctorId?: string; limit?: number }) {
    const now = new Date().toISOString();

    let query = this.db
      .collection(FIREBASE_COLLECTIONS.APPOINTMENTS)
      .where('hospitalId', '==', hospitalId)
      .where('date', '>=', now)
      .orderBy('date', 'asc');

    if (options?.doctorId) query = query.where('doctorId', '==', options.doctorId);
    if (options?.limit) query = query.limit(options.limit);

    const snapshot = await query.get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async createAppointment(appointmentData: any) {
    const appointmentRef = this.db.collection(FIREBASE_COLLECTIONS.APPOINTMENTS).doc();
    await appointmentRef.set({
      ...appointmentData,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return appointmentRef.id;
  }

  async createAppointmentsBatch(appointments: any[]) {
    const batch = this.db.batch();
    const appointmentIds: string[] = [];

    appointments.forEach((appointmentData) => {
      const appointmentRef = this.db.collection(FIREBASE_COLLECTIONS.APPOINTMENTS).doc();
      batch.set(appointmentRef, {
        ...appointmentData,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      appointmentIds.push(appointmentRef.id);
    });

    await batch.commit();
    return appointmentIds;
  }

  async updateAppointment(appointmentId: string, updates: any) {
    await this.db
      .collection(FIREBASE_COLLECTIONS.APPOINTMENTS)
      .doc(appointmentId)
      .update({ ...updates, updatedAt: new Date() });
  }

  async getAppointmentById(appointmentId: string) {
    const doc = await this.db.collection(FIREBASE_COLLECTIONS.APPOINTMENTS).doc(appointmentId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
  }

  async getAppointmentsByDoctorAndDate(doctorProfileId: string, date: string, statuses: string[] = ['scheduled', 'confirmed']) {
    const snapshot = await this.db
      .collection(FIREBASE_COLLECTIONS.APPOINTMENTS)
      .where('doctorProfileId', '==', doctorProfileId)
      .where('date', '==', date)
      .where('status', 'in', statuses)
      .get();

    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async getAppointmentsWithFilters(options: {
    hospitalId: string;
    doctorProfileId?: string;
    patientId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }) {
    let query: any = this.db.collection(FIREBASE_COLLECTIONS.APPOINTMENTS).where('hospitalId', '==', options.hospitalId);

    if (options.doctorProfileId) query = query.where('doctorProfileId', '==', options.doctorProfileId);
    if (options.patientId) query = query.where('patientId', '==', options.patientId);
    if (options.status) query = query.where('status', '==', options.status);
    if (options.startDate && options.endDate) {
      query = query.where('date', '>=', options.startDate).where('date', '<=', options.endDate);
    }

    query = query.orderBy('date', 'asc').orderBy('time', 'asc');
    if (options.limit) query = query.limit(options.limit);

    const snapshot = await query.get();
    return snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
  }
}
