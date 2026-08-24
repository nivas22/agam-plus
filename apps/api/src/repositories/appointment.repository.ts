import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Appointment,
  AppointmentDocument,
} from '../schemas/appointment.schema';
import { toPlain, toPlainList } from './mongo.util';

@Injectable()
export class AppointmentRepository {
  constructor(
    @InjectModel(Appointment.name)
    private readonly appointmentModel: Model<AppointmentDocument>,
  ) {}

  async getAppointmentsByHospitalId(hospitalId: string, limit?: number) {
    let query = this.appointmentModel.find({ hospitalId });
    if (limit) query = query.limit(limit);

    const docs = await query.lean();
    return toPlainList(docs);
  }

  async getAppointmentsByDoctorId(
    hospitalId: string,
    doctorId: string,
    options?: {
      startDate?: string;
      endDate?: string;
      status?: string;
      limit?: number;
    },
  ) {
    const filter: Record<string, any> = { hospitalId, doctorId };
    if (options?.startDate || options?.endDate) {
      filter.date = {};
      if (options.startDate) filter.date.$gte = options.startDate;
      if (options.endDate) filter.date.$lte = options.endDate;
    }
    if (options?.status) filter.status = options.status;

    let query = this.appointmentModel.find(filter);
    if (options?.limit) query = query.limit(options.limit);

    const docs = await query.lean();
    return toPlainList(docs);
  }

  async getUpcomingAppointments(
    hospitalId: string,
    options?: { doctorId?: string; limit?: number },
  ) {
    const now = new Date().toISOString();

    const filter: Record<string, any> = { hospitalId, date: { $gte: now } };
    if (options?.doctorId) filter.doctorId = options.doctorId;

    let query = this.appointmentModel.find(filter).sort({ date: 1 });
    if (options?.limit) query = query.limit(options.limit);

    const docs = await query.lean();
    return toPlainList(docs);
  }

  async createAppointment(appointmentData: any) {
    const doc = await this.appointmentModel.create({
      ...appointmentData,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return doc._id.toString();
  }

  async createAppointmentsBatch(appointments: any[]) {
    const now = new Date();
    const docs = await this.appointmentModel.insertMany(
      appointments.map((appointmentData) => ({
        ...appointmentData,
        createdAt: now,
        updatedAt: now,
      })),
      { ordered: false },
    );
    return docs.map((doc) => doc._id.toString());
  }

  async updateAppointment(appointmentId: string, updates: any) {
    await this.appointmentModel.updateOne(
      { _id: appointmentId },
      { $set: { ...updates, updatedAt: new Date() } },
    );
  }

  async getAppointmentById(appointmentId: string) {
    const doc = await this.appointmentModel.findById(appointmentId).lean();
    return toPlain(doc);
  }

  async getAppointmentsByDoctorAndDate(
    doctorProfileId: string,
    date: string,
    statuses: string[] = ['scheduled', 'confirmed'],
  ) {
    const docs = await this.appointmentModel
      .find({ doctorProfileId, date, status: { $in: statuses } })
      .lean();
    return toPlainList(docs);
  }

  async getAppointmentsWithFilters(options: {
    hospitalId: string;
    doctorProfileId?: string;
    patientId?: string;
    status?: string;
    statuses?: string[];
    type?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }) {
    const filter: Record<string, any> = { hospitalId: options.hospitalId };
    if (options.doctorProfileId)
      filter.doctorProfileId = options.doctorProfileId;
    if (options.patientId) filter.patientId = options.patientId;
    if (options.statuses?.length) filter.status = { $in: options.statuses };
    else if (options.status) filter.status = options.status;
    if (options.type) filter.type = options.type;
    if (options.startDate && options.endDate) {
      filter.date = { $gte: options.startDate, $lte: options.endDate };
    }

    let query = this.appointmentModel.find(filter).sort({ date: 1, time: 1 });
    if (options.limit) query = query.limit(options.limit);

    const docs = await query.lean();
    return toPlainList(docs);
  }

  async getAppointmentsByPackageId(hospitalId: string, packageId: string) {
    const docs = await this.appointmentModel
      .find({ hospitalId, packageId })
      .sort({ date: 1, time: 1 })
      .lean();
    return toPlainList(docs);
  }

  // Completed visits with no session notes at all — the doctor dashboard's
  // "waiting on you" list surfaces these so a visit's record doesn't go
  // permanently blank.
  async getCompletedWithoutNotes(
    hospitalId: string,
    doctorProfileId: string,
    sinceDate: string,
  ) {
    const docs = await this.appointmentModel
      .find({
        hospitalId,
        doctorProfileId,
        status: 'completed',
        date: { $gte: sinceDate },
        $or: [{ sessionNotes: { $exists: false } }, { sessionNotes: '' }],
      })
      .sort({ date: -1, time: -1 })
      .lean();
    return toPlainList(docs);
  }

  // Follow-up appointments (see APPOINTMENT_TYPE.FOLLOW_UP) in a date range,
  // any status — the caller classifies each as overdue/booked/due-soon.
  async getFollowUps(
    hospitalId: string,
    doctorProfileId: string,
    options: { fromDate: string; toDate: string },
  ) {
    const docs = await this.appointmentModel
      .find({
        hospitalId,
        doctorProfileId,
        type: 'follow-up',
        date: { $gte: options.fromDate, $lte: options.toDate },
      })
      .sort({ date: 1 })
      .lean();
    return toPlainList(docs);
  }

  // Count of a doctor's appointments still holding a slot in [startDate,
  // endDate] — used both for the leave-request impact count and the "Your
  // week" booked-vs-open tally for a single day.
  async getAppointmentCountInRange(
    hospitalId: string,
    doctorProfileId: string,
    startDate: string,
    endDate: string,
    options?: { excludeStatuses?: string[] },
  ) {
    const filter: Record<string, any> = {
      hospitalId,
      doctorProfileId,
      date: { $gte: startDate, $lte: endDate },
    };
    if (options?.excludeStatuses?.length) {
      filter.status = { $nin: options.excludeStatuses };
    }
    return this.appointmentModel.countDocuments(filter);
  }
}
