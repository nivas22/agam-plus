import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditLogEntry, AuditLogEntryDocument } from '../schemas/audit-log.schema';
import { toPlain, toPlainList } from './mongo.util';

export interface AuditLogFilters {
  actorUserId?: string;
  area?: string;
  moneyOnly?: boolean;
  search?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

// Deliberately no update/delete methods — the audit trail is write-once (see
// audit-log.schema.ts).
@Injectable()
export class AuditLogRepository {
  constructor(
    @InjectModel(AuditLogEntry.name) private readonly model: Model<AuditLogEntryDocument>,
  ) {}

  async create(entry: Omit<AuditLogEntry, never>) {
    const doc = await this.model.create(entry);
    return toPlain(doc.toObject());
  }

  async list(hospitalId: string, filters: AuditLogFilters = {}) {
    const filter: Record<string, any> = { hospitalId };
    if (filters.actorUserId) filter.actorUserId = filters.actorUserId;
    if (filters.area) filter.area = filters.area;
    if (filters.moneyOnly) filter.area = 'money';
    if (filters.startDate || filters.endDate) {
      filter.at = {};
      if (filters.startDate) filter.at.$gte = filters.startDate;
      if (filters.endDate) filter.at.$lte = filters.endDate;
    }
    if (filters.search) {
      const re = new RegExp(filters.search.trim(), 'i');
      filter.$or = [{ summary: re }, { actorName: re }];
    }

    const docs = await this.model
      .find(filter)
      .sort({ at: -1 })
      .limit(filters.limit ?? 200)
      .lean();
    return toPlainList(docs);
  }

  // Days (as 'YYYY-MM-DD') in [start, end) that have at least one
  // 'access.signed_in' entry for this user — the real-but-lightweight
  // attendance proxy used on the Team member profile (see the plan's
  // "known deviations" note — no time-clock system exists).
  async getSignInDays(hospitalId: string, userId: string, start: Date, end: Date): Promise<Set<string>> {
    const docs = await this.model
      .find({ hospitalId, actorUserId: userId, action: 'access.signed_in', at: { $gte: start, $lt: end } })
      .select('at')
      .lean();
    return new Set(docs.map((d: any) => this.toISODate(d.at)));
  }

  private toISODate(d: Date): string {
    const date = new Date(d);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
