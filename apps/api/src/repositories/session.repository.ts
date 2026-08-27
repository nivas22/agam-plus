import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Session, SessionDocument } from '../schemas/session.schema';
import { toPlain, toPlainList } from './mongo.util';

const LAST_USED_STALE_MS = 5 * 60 * 1000;

@Injectable()
export class SessionRepository {
  constructor(@InjectModel(Session.name) private readonly sessionModel: Model<SessionDocument>) {}

  async create(data: { userId: string; userAgent?: string; ip?: string }) {
    const now = new Date();
    const doc = await this.sessionModel.create({
      ...data,
      createdAt: now,
      lastUsedAt: now,
    });
    return doc._id.toString();
  }

  async getById(sessionId: string) {
    const doc = await this.sessionModel.findById(sessionId).lean();
    return toPlain(doc);
  }

  async getActiveByUser(userId: string) {
    const docs = await this.sessionModel
      .find({ userId, revokedAt: { $exists: false } })
      .sort({ lastUsedAt: -1 })
      .lean();
    return toPlainList(docs);
  }

  // Only writes when the last touch is stale, to bound write volume on a
  // collection hit by every authenticated request.
  async touchIfStale(sessionId: string) {
    const cutoff = new Date(Date.now() - LAST_USED_STALE_MS);
    await this.sessionModel.updateOne(
      { _id: sessionId, lastUsedAt: { $lt: cutoff } },
      { $set: { lastUsedAt: new Date() } },
    );
  }

  async revoke(sessionId: string) {
    await this.sessionModel.updateOne({ _id: sessionId }, { $set: { revokedAt: new Date() } });
  }

  async revokeAllExcept(userId: string, keepSessionId: string) {
    await this.sessionModel.updateMany(
      { userId, _id: { $ne: keepSessionId }, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date() } },
    );
  }

  async revokeAll(userId: string) {
    await this.sessionModel.updateMany(
      { userId, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date() } },
    );
  }
}
