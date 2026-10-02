import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Prescription, PrescriptionDocument } from '../schemas/prescription.schema';
import { Counter, CounterDocument } from '../schemas/counter.schema';
import { toPlain, toPlainList } from './mongo.util';
import { PRESCRIPTION_STATUS } from '../constants';

@Injectable()
export class PrescriptionRepository {
  constructor(
    @InjectModel(Prescription.name)
    private readonly model: Model<PrescriptionDocument>,
    @InjectModel(Counter.name)
    private readonly counterModel: Model<CounterDocument>,
  ) {}

  async getByAppointment(hospitalId: string, appointmentId: string) {
    const doc = await this.model.findOne({ hospitalId, appointmentId }).lean();
    return toPlain(doc);
  }

  async getById(hospitalId: string, prescriptionId: string) {
    const doc = await this.model.findOne({ _id: prescriptionId, hospitalId }).lean();
    return toPlain(doc);
  }

  async listByPatient(hospitalId: string, patientId: string) {
    const docs = await this.model
      .find({ hospitalId, patientId })
      .sort({ createdAt: -1 })
      .lean();
    return toPlainList(docs);
  }

  // Backs "Repeat last" in the prescription writer — deliberately scoped to
  // the SAME doctor, not just the same patient, so a repeat only offers
  // continuity of care the requesting doctor actually gave.
  async getLastSignedByDoctorAndPatient(
    hospitalId: string,
    doctorProfileId: string,
    patientId: string,
  ) {
    const doc = await this.model
      .findOne({ hospitalId, doctorProfileId, patientId, status: PRESCRIPTION_STATUS.SIGNED })
      .sort({ issuedAt: -1 })
      .lean();
    return toPlain(doc);
  }

  // Same atomic-counter pattern as PaymentRepository.getNextInvoiceSequence:
  // upsert-then-reconcile-then-$inc so concurrent sign requests can never be
  // handed the same sequence number.
  async getNextRxSequence(hospitalId: string): Promise<number> {
    const key = `rx:${hospitalId}`;

    await this.counterModel.updateOne({ _id: key }, { $setOnInsert: { seq: 0 } }, { upsert: true });

    const highest = await this.model
      .findOne({ hospitalId, rxNumber: { $exists: true } })
      .sort({ rxNumber: -1 })
      .select('rxNumber')
      .lean();
    const highestSeq = highest
      ? parseInt((highest as any).rxNumber?.split('-').pop() || '0', 10) || 0
      : 0;
    await this.counterModel.updateOne(
      { _id: key, seq: { $lt: highestSeq } },
      { $set: { seq: highestSeq } },
    );

    const bumped = await this.counterModel.findOneAndUpdate(
      { _id: key },
      { $inc: { seq: 1 } },
      { new: true },
    );
    return bumped!.seq;
  }

  // Upserts the single draft/signed doc for this appointment (see the
  // {hospitalId, appointmentId} unique index) — a save on an existing
  // prescription just overwrites its editable fields in place.
  async createOrUpdate(
    hospitalId: string,
    appointmentId: string,
    createFields: Record<string, any>,
    updateFields: Record<string, any>,
  ) {
    const doc = await this.model
      .findOneAndUpdate(
        { hospitalId, appointmentId },
        {
          $set: { ...updateFields, updatedAt: new Date() },
          $setOnInsert: { ...createFields, createdAt: new Date() },
        },
        { new: true, upsert: true },
      )
      .lean();
    return toPlain(doc);
  }

  // Backs the doctor dashboard's "unsigned prescriptions" and
  // "prescriptions signed yesterday" lookups.
  async listByHospitalAndDoctor(
    hospitalId: string,
    doctorProfileId: string,
    options?: { status?: string; fromDate?: string; toDate?: string },
  ) {
    const filter: Record<string, any> = { hospitalId, doctorProfileId };
    if (options?.status) filter.status = options.status;
    if (options?.fromDate || options?.toDate) {
      filter.issuedAt = {};
      if (options.fromDate) filter.issuedAt.$gte = new Date(`${options.fromDate}T00:00:00.000`);
      if (options.toDate) filter.issuedAt.$lte = new Date(`${options.toDate}T23:59:59.999`);
    }

    const docs = await this.model.find(filter).sort({ updatedAt: -1 }).lean();
    return toPlainList(docs);
  }

  async updateFields(hospitalId: string, prescriptionId: string, updates: Record<string, any>) {
    const doc = await this.model
      .findOneAndUpdate(
        { _id: prescriptionId, hospitalId },
        { $set: { ...updates, updatedAt: new Date() } },
        { new: true },
      )
      .lean();
    return toPlain(doc);
  }
}
