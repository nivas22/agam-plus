import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LeaveRequest, LeaveRequestDocument } from '../schemas/leave-request.schema';
import { toPlain, toPlainList } from './mongo.util';

@Injectable()
export class LeaveRequestRepository {
  constructor(
    @InjectModel(LeaveRequest.name)
    private readonly model: Model<LeaveRequestDocument>,
  ) {}

  async create(data: any) {
    const doc = await this.model.create({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return toPlain(doc.toObject());
  }

  async getById(hospitalId: string, leaveRequestId: string) {
    const doc = await this.model.findOne({ _id: leaveRequestId, hospitalId }).lean();
    return toPlain(doc);
  }

  async listByHospital(
    hospitalId: string,
    options?: { doctorProfileId?: string; status?: string },
  ) {
    const filter: Record<string, any> = { hospitalId };
    if (options?.doctorProfileId) filter.doctorProfileId = options.doctorProfileId;
    if (options?.status) filter.status = options.status;

    const docs = await this.model.find(filter).sort({ requestedAt: -1 }).lean();
    return toPlainList(docs);
  }

  // Leave ranges that overlap [startDate, endDate] for a given doctor —
  // backs the "Your week" leave banner and the missed-follow-up-adjacent
  // pending-leave card, so both pending and already-approved leave show up.
  async getOverlappingForDoctor(
    hospitalId: string,
    doctorProfileId: string,
    startDate: string,
    endDate: string,
  ) {
    const docs = await this.model
      .find({
        hospitalId,
        doctorProfileId,
        status: { $in: ['pending', 'approved'] },
        startDate: { $lte: endDate },
        endDate: { $gte: startDate },
      })
      .lean();
    return toPlainList(docs);
  }

  async updateFields(hospitalId: string, leaveRequestId: string, updates: Record<string, any>) {
    const doc = await this.model
      .findOneAndUpdate(
        { _id: leaveRequestId, hospitalId },
        { $set: { ...updates, updatedAt: new Date() } },
        { new: true },
      )
      .lean();
    return toPlain(doc);
  }
}
