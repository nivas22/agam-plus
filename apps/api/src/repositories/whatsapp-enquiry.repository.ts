import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  WhatsappEnquiry,
  WhatsappEnquiryDocument,
} from '../schemas/whatsapp-enquiry.schema';
import { WHATSAPP_ENQUIRY_STATUS } from '../constants';
import { toPlain, toPlainList } from './mongo.util';

@Injectable()
export class WhatsappEnquiryRepository {
  constructor(
    @InjectModel(WhatsappEnquiry.name)
    private readonly model: Model<WhatsappEnquiryDocument>,
  ) {}

  async create(data: {
    hospitalId: string;
    fromPhone: string;
    patientId?: string;
    patientName?: string;
    message: string;
  }) {
    const doc = await this.model.create({
      ...data,
      status: WHATSAPP_ENQUIRY_STATUS.NEW,
      createdAt: new Date(),
    });
    return toPlain(doc.toObject());
  }

  async listByHospital(hospitalId: string, status?: string) {
    const docs = await this.model
      .find({ hospitalId, ...(status ? { status } : {}) })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    return toPlainList(docs);
  }

  async resolve(hospitalId: string, enquiryId: string, userId: string) {
    const doc = await this.model
      .findOneAndUpdate(
        { _id: enquiryId, hospitalId },
        {
          $set: {
            status: WHATSAPP_ENQUIRY_STATUS.RESOLVED,
            resolvedAt: new Date(),
            resolvedBy: userId,
          },
        },
        { new: true },
      )
      .lean();
    return toPlain(doc);
  }
}
