import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DemoRequest, DemoRequestDocument } from '../schemas/demo-request.schema';
import { DEMO_REQUEST_STATUS } from '../constants';
import { toPlain, toPlainList } from './mongo.util';

@Injectable()
export class DemoRequestRepository {
  constructor(
    @InjectModel(DemoRequest.name)
    private readonly model: Model<DemoRequestDocument>,
  ) {}

  async create(data: {
    hospitalName: string;
    contactName: string;
    phone: string;
    email?: string;
    city?: string;
    doctorCount?: number;
    message?: string;
  }) {
    const doc = await this.model.create({
      ...data,
      status: DEMO_REQUEST_STATUS.NEW,
      source: 'website',
      createdAt: new Date(),
    });
    return toPlain(doc.toObject());
  }

  async list(status?: string) {
    const docs = await this.model
      .find(status ? { status } : {})
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();
    return toPlainList(docs);
  }

  async markContacted(id: string, userId: string) {
    const doc = await this.model
      .findByIdAndUpdate(
        id,
        {
          $set: {
            status: DEMO_REQUEST_STATUS.CONTACTED,
            contactedAt: new Date(),
            contactedBy: userId,
          },
        },
        { new: true },
      )
      .lean();
    return toPlain(doc);
  }
}
