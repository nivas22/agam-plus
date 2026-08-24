import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../schemas/user.schema';
import { toPlain, toPlainList, toSnapshot } from './mongo.util';

@Injectable()
export class UserRepository {
  constructor(@InjectModel(User.name) private readonly userModel: Model<UserDocument>) {}

  async getUserByFirebaseUid(firebaseUid: string) {
    const doc = await this.userModel.findOne({ firebaseUid }).lean();
    return toPlain(doc);
  }

  async getAllUsers() {
    const docs = await this.userModel.find().sort({ createdAt: -1 }).lean();
    return toPlainList(docs);
  }

  async getUserByEmail(email: string) {
    const doc = await this.userModel.findOne({ email }).lean();
    return toPlain(doc);
  }

  async getOrCreateUserByEmail(email: string) {
    const existing = await this.getUserByEmail(email);
    if (existing) return existing;

    const newUserId = await this.createUser({ email });
    return this.getUserById(newUserId);
  }

  async getUserById(userId: string) {
    const doc = await this.userModel.findById(userId).lean();
    return toPlain(doc);
  }

  async createUser(userData: any) {
    const doc = await this.userModel.create({
      ...userData,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return doc._id.toString();
  }

  async updateUser(userId: string, updates: any) {
    await this.userModel.updateOne({ _id: userId }, { $set: { ...updates, updatedAt: new Date() } });
  }

  async getUserByFirebaseUidOrEmail(firebaseUid: string, email: string) {
    let doc = firebaseUid ? await this.userModel.findOne({ firebaseUid }).lean() : null;
    if (!doc && email) {
      doc = await this.userModel.findOne({ email }).lean();
    }
    return toSnapshot(doc);
  }
}
