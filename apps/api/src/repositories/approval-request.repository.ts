import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ApprovalRequest, ApprovalRequestDocument } from '../schemas/approval-request.schema';
import { toPlain, toPlainList } from './mongo.util';

@Injectable()
export class ApprovalRequestRepository {
  constructor(
    @InjectModel(ApprovalRequest.name) private readonly model: Model<ApprovalRequestDocument>,
  ) {}

  async create(data: Omit<ApprovalRequest, 'status' | 'requestedAt'> & { requestedAt?: Date }) {
    const doc = await this.model.create({
      ...data,
      status: 'pending',
      requestedAt: data.requestedAt ?? new Date(),
    });
    return toPlain(doc.toObject());
  }

  async getById(hospitalId: string, id: string) {
    const doc = await this.model.findOne({ _id: id, hospitalId }).lean();
    return toPlain(doc);
  }

  async list(hospitalId: string, status?: string) {
    const filter: Record<string, any> = { hospitalId };
    if (status) filter.status = status;
    const docs = await this.model.find(filter).sort({ requestedAt: -1 }).lean();
    return toPlainList(docs);
  }

  async countByRequesterAndAction(hospitalId: string, requesterUserId: string, action: string): Promise<number> {
    return this.model.countDocuments({ hospitalId, 'requestedBy.userId': requesterUserId, action });
  }

  async resolve(
    id: string,
    updates: { status: 'approved' | 'declined'; resolvedBy: { userId: string; name: string; role: string }; resolutionNote?: string },
  ) {
    await this.model.updateOne(
      { _id: id },
      { $set: { ...updates, resolvedAt: new Date() } },
    );
  }
}
