import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  WhatsappProcessedMessage,
  WhatsappProcessedMessageDocument,
} from '../schemas/whatsapp-processed-message.schema';

const RETENTION_DAYS = 7;

@Injectable()
export class WhatsappProcessedMessageRepository {
  constructor(
    @InjectModel(WhatsappProcessedMessage.name)
    private readonly model: Model<WhatsappProcessedMessageDocument>,
  ) {}

  // Atomically claims a message ID for processing. Returns false if it was
  // already claimed (a Meta retry of a message already handled) — the
  // unique index on messageId is what makes this race-safe across
  // concurrent webhook deliveries, not the read-then-write itself.
  async tryClaim(messageId: string): Promise<boolean> {
    const now = new Date();
    try {
      await this.model.create({
        messageId,
        receivedAt: now,
        expiresAt: new Date(now.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000),
      });
      return true;
    } catch (error) {
      if ((error as any)?.code === 11000) return false;
      throw error;
    }
  }
}
