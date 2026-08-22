import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Patient, PatientDocument } from '../schemas/patient.schema';
import { toPlain, toPlainList } from './mongo.util';

@Injectable()
export class PatientRepository {
  constructor(
    @InjectModel(Patient.name)
    private readonly patientModel: Model<PatientDocument>,
  ) {}

  async getPatientById(patientId: string) {
    const doc = await this.patientModel.findById(patientId).lean();
    return toPlain(doc);
  }

  async verifyPatientInHospital(
    patientId: string,
    hospitalId: string,
  ): Promise<boolean> {
    const patient = await this.getPatientById(patientId);
    return patient !== null && (patient as any).hospitalId === hospitalId;
  }

  async getPatientsByHospital(hospitalId: string, doctorId?: string) {
    const filter: Record<string, any> = { hospitalId };
    if (doctorId) filter.doctorId = doctorId;

    const docs = await this.patientModel.find(filter).lean();
    return toPlainList(docs);
  }

  async patientExistsByEmail(
    hospitalId: string,
    email: string,
  ): Promise<boolean> {
    const count = await this.patientModel.countDocuments({ hospitalId, email });
    return count > 0;
  }

  async createPatient(patientData: any) {
    const doc = await this.patientModel.create({
      ...patientData,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return doc._id.toString();
  }

  async getPatientsByHospitalId(hospitalId: string) {
    const docs = await this.patientModel.find({ hospitalId }).lean();
    return toPlainList(docs);
  }

  async searchPatientsByHospital(
    hospitalId: string,
    searchTerm: string,
    limit = 20,
  ) {
    // Escape regex metacharacters — searchTerm is free-text user input.
    const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(escaped, 'i');

    const docs = await this.patientModel
      .find({
        hospitalId,
        $or: [{ name: pattern }, { phone: pattern }, { patientId: pattern }],
      })
      .limit(limit)
      .lean();
    return toPlainList(docs);
  }

  async getPatientsByUserIds(userIds: string[], hospitalId: string) {
    if (userIds.length === 0) return [];

    const docs = await this.patientModel
      .find({ userId: { $in: userIds }, hospitalId })
      .lean();
    return toPlainList(docs);
  }

  async getPatientsByIds(patientIds: string[], hospitalId?: string) {
    if (patientIds.length === 0) return [];

    const filter: Record<string, any> = { _id: { $in: patientIds } };
    if (hospitalId) filter.hospitalId = hospitalId;

    const docs = await this.patientModel.find(filter).lean();
    return toPlainList(docs);
  }

  async updatePatient(patientId: string, updates: any) {
    await this.patientModel.updateOne(
      { _id: patientId },
      { $set: { ...updates, updatedAt: new Date() } },
    );
  }

  async deletePatient(patientId: string, deletedBy: string) {
    await this.patientModel.updateOne(
      { _id: patientId },
      {
        $set: {
          status: 'archived',
          updatedAt: new Date(),
          archivedAt: new Date(),
          archivedBy: deletedBy,
        },
      },
    );
  }
}
