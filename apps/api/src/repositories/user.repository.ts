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

  async getUserByUsername(username: string) {
    const doc = await this.userModel.findOne({ username: username.toLowerCase().trim() }).lean();
    return toPlain(doc);
  }

  async getUserByPasswordResetTokenHash(tokenHash: string) {
    const doc = await this.userModel.findOne({ passwordResetTokenHash: tokenHash }).lean();
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

  // Returns the current request count for this window (after bumping), so the
  // caller can enforce the hourly cap without a second read. Mirrors
  // PatientAccountRepository.bumpRequestCount.
  async bumpOtpRequestCount(userId: string): Promise<number> {
    const user = await this.userModel.findById(userId).lean();
    if (!user) return 0;

    const now = new Date();
    const windowStart = (user as any).otpRequestWindowStart;
    const windowExpired =
      !windowStart || now.getTime() - new Date(windowStart).getTime() > 60 * 60 * 1000;

    const nextCount = windowExpired ? 1 : ((user as any).otpRequestCount || 0) + 1;

    await this.userModel.updateOne(
      { _id: userId },
      {
        $set: {
          otpRequestCount: nextCount,
          otpRequestWindowStart: windowExpired ? now : windowStart,
          updatedAt: now,
        },
      },
    );

    return nextCount;
  }

  async setOtp(userId: string, otpHash: string, expiresAt: Date) {
    await this.userModel.updateOne(
      { _id: userId },
      {
        $set: {
          otpHash,
          otpExpiresAt: expiresAt,
          otpAttempts: 0,
          otpSentAt: new Date(),
          updatedAt: new Date(),
        },
      },
    );
  }

  async incrementOtpAttempts(userId: string) {
    await this.userModel.updateOne(
      { _id: userId },
      { $inc: { otpAttempts: 1 }, $set: { updatedAt: new Date() } },
    );
  }

  async clearOtp(userId: string) {
    await this.userModel.updateOne(
      { _id: userId },
      {
        $unset: { otpHash: '', otpExpiresAt: '' },
        $set: { otpAttempts: 0, updatedAt: new Date() },
      },
    );
  }

  // Returns the attempt count after incrementing, so the caller can report
  // "N attempts left" without a second read.
  async recordFailedLogin(userId: string, maxAttempts: number, lockMs: number): Promise<number> {
    const user = await this.userModel.findById(userId).lean();
    if (!user) return 0;

    const nextCount = ((user as any).failedLoginAttempts || 0) + 1;
    const locked = nextCount >= maxAttempts;

    await this.userModel.updateOne(
      { _id: userId },
      {
        $set: {
          failedLoginAttempts: locked ? 0 : nextCount,
          ...(locked ? { lockedUntil: new Date(Date.now() + lockMs) } : {}),
          updatedAt: new Date(),
        },
      },
    );

    return nextCount;
  }

  async resetFailedLogins(userId: string) {
    await this.userModel.updateOne(
      { _id: userId },
      { $set: { failedLoginAttempts: 0, updatedAt: new Date() }, $unset: { lockedUntil: '' } },
    );
  }
}
