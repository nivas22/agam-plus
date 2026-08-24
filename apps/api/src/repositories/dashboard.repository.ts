import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { DB_COLLECTIONS, ACTIVE_APPOINTMENT_STATUSES } from '../constants';
import { toPlainList } from './mongo.util';

// Generic collection-name-driven queries (mirrors the old Firestore
// DashboardRepository/QueryRepository, which were near-duplicates of each
// other and are merged here). Uses the raw driver via the Mongoose
// connection since the target collection is a runtime string, not a
// statically-known schema/model.
@Injectable()
export class DashboardRepository {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  async countDocuments(collection: string, conditions: Record<string, any>): Promise<number> {
    return this.connection.collection(collection).countDocuments(conditions);
  }

  async countDocumentsBetween(collection: string, opts: { hospitalId: string; field: string; start: string; end: string }): Promise<number> {
    const { hospitalId, field, start, end } = opts;
    return this.connection.collection(collection).countDocuments({
      hospitalId,
      [field]: { $gte: start, $lte: end },
    });
  }

  async getStaffOnDutyCount(hospitalId: string): Promise<number> {
    try {
      return await this.connection.collection(DB_COLLECTIONS.HOSPITAL_MEMBERS).countDocuments({
        hospitalId,
        status: 'approved',
        role: { $in: ['doctor', 'front_desk', 'nurse', 'accountant'] },
      });
    } catch {
      return 0;
    }
  }

  async countDoctorAppointments(hospitalId: string, doctorId: string, start: string, end: string, status?: string): Promise<number> {
    const filter: Record<string, any> = {
      hospitalId,
      doctorProfileId: doctorId,
      date: { $gte: start, $lte: end },
    };
    if (status) filter.status = status;

    return this.connection.collection(DB_COLLECTIONS.APPOINTMENTS).countDocuments(filter);
  }

  async getDoctorPatientCount(hospitalId: string, doctorId: string): Promise<number> {
    const patientIds = await this.connection
      .collection(DB_COLLECTIONS.APPOINTMENTS)
      .distinct('patientId', { hospitalId, doctorProfileId: doctorId });

    return patientIds.filter(Boolean).length;
  }

  async getDoctorUpcomingAppointments(hospitalId: string, doctorId: string, limit = 5) {
    const now = new Date().toISOString().split('T')[0];

    const docs = await this.connection
      .collection(DB_COLLECTIONS.APPOINTMENTS)
      .find({ hospitalId, doctorProfileId: doctorId, date: { $gte: now } })
      .sort({ date: 1 })
      .toArray();

    const activeStatuses: string[] = [...ACTIVE_APPOINTMENT_STATUSES, 'scheduled'];
    const filtered = toPlainList(docs as any[]).filter((doc: any) => activeStatuses.includes(doc.status));

    return filtered.slice(0, limit);
  }

  async getHospitalUpcomingAppointments(hospitalId: string, limit = 5) {
    const now = new Date().toISOString();

    const docs = await this.connection
      .collection(DB_COLLECTIONS.APPOINTMENTS)
      .find({ hospitalId, date: { $gte: now } })
      .sort({ date: 1 })
      .limit(limit)
      .toArray();

    return toPlainList(docs as any[]);
  }
}
