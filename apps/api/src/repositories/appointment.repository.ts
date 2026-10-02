import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model } from 'mongoose';
import { ACTIVE_APPOINTMENT_STATUSES, VISIT_FINISHED_STATUSES } from '../constants';
import { ApiError } from '../common/errors/api-error';
import {
  Appointment,
  AppointmentDocument,
} from '../schemas/appointment.schema';
import { toPlain, toPlainList } from './mongo.util';

// Local calendar date (not `.toISOString()`, which shifts a day back in any
// timezone ahead of UTC).
function toISODateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

@Injectable()
export class AppointmentRepository {
  private readonly logger = new Logger(AppointmentRepository.name);

  constructor(
    @InjectModel(Appointment.name)
    private readonly appointmentModel: Model<AppointmentDocument>,
  ) {}

  // Runs `fn` inside a Mongo transaction so a slot's availability check and
  // the appointment insert/update it gates can't interleave with a
  // concurrent booking for the same slot. Falls back to running `fn`
  // without a session if the deployment isn't a replica set/mongos (e.g. a
  // standalone dev Mongo) — same behavior as before this existed, just no
  // longer the only option in production.
  async runInTransaction<T>(
    fn: (session: ClientSession | undefined) => Promise<T>,
  ): Promise<T> {
    const session = await this.appointmentModel.db.startSession();
    try {
      let result: T;
      await session.withTransaction(async () => {
        result = await fn(session);
      });
      return result!;
    } catch (error) {
      // A business error thrown by `fn` itself (e.g. "slot no longer
      // available") must always propagate as-is — never reinterpreted as a
      // transactions-unavailable signal and retried, which would silently
      // swallow it and re-run `fn` a second time.
      if (error instanceof ApiError) throw error;

      const message = (error as Error)?.message ?? '';
      if (
        /transaction numbers|illegalOperation|replica set|mongos|does not support retryable writes/i.test(
          message,
        )
      ) {
        this.logger.warn(
          'Mongo transactions unavailable (not a replica set) — running without one',
        );
        return fn(undefined);
      }
      throw error;
    } finally {
      await session.endSession();
    }
  }

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

  async createAppointment(appointmentData: any, session?: ClientSession) {
    const docs = await this.appointmentModel.create(
      [
        {
          ...appointmentData,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      { session },
    );
    return docs[0]._id.toString();
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

  async updateAppointment(
    appointmentId: string,
    updates: any,
    session?: ClientSession,
  ) {
    await this.appointmentModel.updateOne(
      { _id: appointmentId },
      { $set: { ...updates, updatedAt: new Date() } },
      { session },
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
    session?: ClientSession,
  ) {
    const docs = await this.appointmentModel
      .find({ doctorProfileId, date, status: { $in: statuses } })
      .session(session ?? null)
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
    else if (options.status === 'upcoming') {
      // "upcoming" isn't a real APPOINTMENT_STATUS value — it means "still
      // active and not in the past yet", so translate it into the
      // equivalent status/date filters rather than matching it literally.
      filter.status = { $in: ACTIVE_APPOINTMENT_STATUSES };
      filter.date = { $gte: toISODateLocal(new Date()) };
    } else if (options.status) filter.status = options.status;
    if (options.type) filter.type = options.type;
    if (options.startDate && options.endDate) {
      filter.date = { $gte: options.startDate, $lte: options.endDate };
    }

    let query = this.appointmentModel.find(filter).sort({ date: 1, time: 1 });
    if (options.limit) query = query.limit(options.limit);

    const docs = await query.lean();
    return toPlainList(docs);
  }

  // Active appointments in [startDate, endDate] with a phone on file and no
  // reminder sent yet — the reminder cron narrows this further to the exact
  // lead-time window since date/time are plain strings, not one sortable field.
  async getAppointmentsNeedingReminder(
    hospitalId: string,
    startDate: string,
    endDate: string,
  ) {
    const docs = await this.appointmentModel
      .find({
        hospitalId,
        status: { $in: ACTIVE_APPOINTMENT_STATUSES },
        date: { $gte: startDate, $lte: endDate },
        patientPhone: { $exists: true, $nin: [null, ''] },
        reminderSentAt: { $exists: false },
      })
      .lean();
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
        status: { $in: VISIT_FINISHED_STATUSES },
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
