import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Subscription, SubscriptionDocument } from '../schemas/subscription.schema';
import { toPlain } from './mongo.util';

@Injectable()
export class SubscriptionRepository {
  constructor(@InjectModel(Subscription.name) private readonly subscriptionModel: Model<SubscriptionDocument>) {}

  async createSubscription(data: any) {
    const doc = await this.subscriptionModel.create({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return toPlain(doc.toObject());
  }

  async getByHospitalId(hospitalId: string) {
    const doc = await this.subscriptionModel.findOne({ hospitalId }).lean();
    return toPlain(doc);
  }

  async getById(subscriptionId: string) {
    const doc = await this.subscriptionModel.findById(subscriptionId).lean();
    return toPlain(doc);
  }

  async updateByHospitalId(hospitalId: string, data: any) {
    const doc = await this.subscriptionModel
      .findOneAndUpdate({ hospitalId }, { $set: { ...data, updatedAt: new Date() } }, { returnDocument: 'after' })
      .lean();
    return toPlain(doc);
  }

  async updateById(subscriptionId: string, data: any) {
    const doc = await this.subscriptionModel
      .findByIdAndUpdate(subscriptionId, { $set: { ...data, updatedAt: new Date() } }, { returnDocument: 'after' })
      .lean();
    return toPlain(doc);
  }

  // Used by the daily renewal sweep — subscriptions whose current period has
  // elapsed and are still in a billable state (active/past_due).
  async getDueForRenewal(now: Date, statuses: string[]) {
    const docs = await this.subscriptionModel
      .find({ currentPeriodEnd: { $lte: now }, status: { $in: statuses } })
      .lean();
    return docs.map((doc) => toPlain(doc));
  }

  async getPastGracePeriod(now: Date) {
    const docs = await this.subscriptionModel
      .find({ status: 'past_due', graceEndsAt: { $lte: now } })
      .lean();
    return docs.map((doc) => toPlain(doc));
  }

  // Trialing subscriptions whose trial ends within `windowEnd` that haven't
  // already gotten the one-time heads-up email.
  async getTrialsEndingSoon(windowEnd: Date) {
    const docs = await this.subscriptionModel
      .find({ status: 'trialing', trialEndsAt: { $lte: windowEnd }, trialReminderSentAt: { $exists: false } })
      .lean();
    return docs.map((doc) => toPlain(doc));
  }
}
