import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Prescription, PrescriptionDocument } from '../schemas/prescription.schema';
import { toPlain, toPlainList } from './mongo.util';

@Injectable()
export class PrescriptionRepository {
  constructor(
    @InjectModel(Prescription.name)
    private readonly model: Model<PrescriptionDocument>,
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
