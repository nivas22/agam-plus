import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TeamMemberProfile, TeamMemberProfileDocument } from '../schemas/team-member-profile.schema';
import { toPlain, toPlainList } from './mongo.util';

@Injectable()
export class TeamMemberRepository {
  constructor(
    @InjectModel(TeamMemberProfile.name) private readonly model: Model<TeamMemberProfileDocument>,
  ) {}

  async getByUserId(userId: string) {
    // _id is the owning user's id for this collection (same convention as DoctorProfile).
    const doc = await this.model.findById(userId).lean();
    return toPlain(doc);
  }

  async getByHospital(hospitalId: string) {
    const docs = await this.model.find({ hospitalId }).lean();
    return toPlainList(docs);
  }

  async countByHospital(hospitalId: string): Promise<number> {
    return this.model.countDocuments({ hospitalId });
  }

  async upsert(userId: string, data: Record<string, any>) {
    await this.model.findByIdAndUpdate(
      userId,
      { $set: { userId, ...data, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
      { upsert: true, setDefaultsOnInsert: true },
    );
    return userId;
  }

  async update(userId: string, updates: Record<string, any>) {
    await this.model.updateOne({ _id: userId }, { $set: { ...updates, updatedAt: new Date() } });
  }

  async findByPhone(hospitalId: string, phone: string, excludeUserId?: string) {
    const filter: Record<string, any> = { hospitalId, phone };
    if (excludeUserId) filter._id = { $ne: excludeUserId };
    const docs = await this.model.find(filter).lean();
    return toPlainList(docs);
  }

  async setPin(userId: string, pinHash: string) {
    await this.model.updateOne({ _id: userId }, { $set: { pinHash, pinSetAt: new Date() } });
  }

  async clearPin(userId: string) {
    await this.model.updateOne({ _id: userId }, { $unset: { pinHash: '', pinSetAt: '' } });
  }
}
