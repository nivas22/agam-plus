import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PatientAccount, PatientAccountDocument } from '../schemas/patient-account.schema';
import { toPlain } from './mongo.util';

const OTP_REQUEST_WINDOW_MS = 60 * 60 * 1000;

@Injectable()
export class PatientAccountRepository {
  constructor(
    @InjectModel(PatientAccount.name)
    private readonly patientAccountModel: Model<PatientAccountDocument>,
  ) {}

  async getByPhone(phone: string) {
    const doc = await this.patientAccountModel.findOne({ phone }).lean();
    return toPlain(doc);
  }

  async getById(id: string) {
    const doc = await this.patientAccountModel.findById(id).lean();
    return toPlain(doc);
  }

  async createOrGetByPhone(phone: string) {
    const existing = await this.getByPhone(phone);
    if (existing) return existing;

    const doc = await this.patientAccountModel.create({
      phone,
      otpAttempts: 0,
      otpRequestCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return toPlain(doc.toObject());
  }

  // Returns the current request count for this window (after bumping), so the
  // caller can enforce the hourly cap without a second read.
  async bumpRequestCount(accountId: string): Promise<number> {
    const account = await this.patientAccountModel.findById(accountId).lean();
    if (!account) return 0;

    const now = new Date();
    const windowStart = (account as any).otpRequestWindowStart;
    const windowExpired =
      !windowStart || now.getTime() - new Date(windowStart).getTime() > OTP_REQUEST_WINDOW_MS;

    const nextCount = windowExpired ? 1 : ((account as any).otpRequestCount || 0) + 1;

    await this.patientAccountModel.updateOne(
      { _id: accountId },
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

  async setOtp(accountId: string, otpHash: string, expiresAt: Date) {
    await this.patientAccountModel.updateOne(
      { _id: accountId },
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

  async incrementOtpAttempts(accountId: string) {
    await this.patientAccountModel.updateOne(
      { _id: accountId },
      { $inc: { otpAttempts: 1 }, $set: { updatedAt: new Date() } },
    );
  }

  async clearOtp(accountId: string) {
    await this.patientAccountModel.updateOne(
      { _id: accountId },
      {
        $unset: { otpHash: '', otpExpiresAt: '' },
        $set: { otpAttempts: 0, updatedAt: new Date() },
      },
    );
  }

  async markVerified(accountId: string) {
    const now = new Date();
    await this.patientAccountModel.updateOne(
      { _id: accountId },
      { $set: { verifiedAt: now, lastLogin: now, updatedAt: now } },
    );
  }
}
