import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  WhatsappSession,
  WhatsappSessionDocument,
} from '../schemas/whatsapp-session.schema';
import { WHATSAPP_SESSION_TTL_MINUTES } from '../constants';
import { toPlain } from './mongo.util';

@Injectable()
export class WhatsappSessionRepository {
  constructor(
    @InjectModel(WhatsappSession.name)
    private readonly model: Model<WhatsappSessionDocument>,
  ) {}

  // Mongo's TTL reaper only runs about once a minute, so an expired session
  // can still be present — filter on expiresAt rather than trusting deletion.
  async getActive(hospitalId: string, fromPhone: string) {
    const doc = await this.model
      .findOne({ hospitalId, fromPhone, expiresAt: { $gt: new Date() } })
      .lean();
    return toPlain(doc);
  }

  async upsertStep(
    hospitalId: string,
    fromPhone: string,
    currentStep: string,
    dataPatch: Record<string, any> = {},
  ) {
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + WHATSAPP_SESSION_TTL_MINUTES * 60 * 1000,
    );
    const setFields: Record<string, any> = {
      currentStep,
      expiresAt,
      updatedAt: now,
    };
    for (const [key, value] of Object.entries(dataPatch)) {
      setFields[`collectedData.${key}`] = value;
    }
    const doc = await this.model
      .findOneAndUpdate(
        { hospitalId, fromPhone },
        { $set: setFields, $setOnInsert: { createdAt: now } },
        { new: true, upsert: true },
      )
      .lean();
    return toPlain(doc);
  }

  async clear(hospitalId: string, fromPhone: string) {
    await this.model.deleteOne({ hospitalId, fromPhone });
  }
}
