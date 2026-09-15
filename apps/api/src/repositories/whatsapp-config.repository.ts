import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  WhatsappConfig,
  WhatsappConfigDocument,
} from '../schemas/whatsapp-config.schema';
import { decrypt, encrypt } from '../common/crypto.util';
import { toPlain, toPlainList } from './mongo.util';

// A hospital's own access token never leaves this class in plaintext except
// through getDecryptedAccessToken, so no caller handles ciphertext.
@Injectable()
export class WhatsappConfigRepository {
  constructor(
    @InjectModel(WhatsappConfig.name)
    private readonly model: Model<WhatsappConfigDocument>,
    private readonly config: ConfigService,
  ) {}

  private encryptionKey(): string {
    return this.config.get<string>('WHATSAPP_TOKEN_ENCRYPTION_KEY') || '';
  }

  async getByHospitalId(hospitalId: string) {
    const doc = await this.model.findOne({ hospitalId }).lean();
    return toPlain(doc);
  }

  // Inbound webhooks only identify the destination by phone number ID.
  async getByPhoneNumberId(phoneNumberId: string) {
    const doc = await this.model.findOne({ phoneNumberId }).lean();
    return toPlain(doc);
  }

  async saveHospitalCredentials(
    hospitalId: string,
    data: {
      phoneNumberId: string;
      wabaId: string;
      accessToken: string;
      businessPhoneNumber?: string;
      verifiedName?: string;
      connectedBy?: string;
    },
  ) {
    const { accessToken, ...rest } = data;
    const now = new Date();
    const doc = await this.model
      .findOneAndUpdate(
        { hospitalId },
        {
          $set: {
            ...rest,
            hospitalId,
            accessTokenEnc: encrypt(accessToken, this.encryptionKey()),
            connected: true,
            connectedAt: now,
            updatedAt: now,
          },
          $setOnInsert: { createdAt: now },
        },
        { new: true, upsert: true },
      )
      .lean();
    return toPlain(doc);
  }

  async getDecryptedAccessToken(hospitalId: string): Promise<string | null> {
    const doc = await this.model.findOne({ hospitalId }).lean();
    if (!doc?.accessTokenEnc) return null;
    return decrypt(doc.accessTokenEnc, this.encryptionKey());
  }

  async deleteForHospital(hospitalId: string) {
    await this.model.deleteOne({ hospitalId });
  }

  async setConnected(hospitalId: string, connected: boolean) {
    const now = new Date();
    const doc = await this.model
      .findOneAndUpdate(
        { hospitalId },
        {
          $set: {
            connected,
            updatedAt: now,
            ...(connected ? { connectedAt: now } : { disconnectedAt: now }),
          },
        },
        { new: true },
      )
      .lean();
    return toPlain(doc);
  }
}
