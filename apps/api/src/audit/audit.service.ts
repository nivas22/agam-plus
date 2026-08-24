import { Injectable } from '@nestjs/common';
import { AuditLogRepository, AuditLogFilters } from '../repositories/audit-log.repository';
import { toCsv } from '../common/csv.util';

export interface LogAuditEntryParams {
  hospitalId: string;
  actor: { userId: string; name: string; role: string };
  action: string;
  area: 'money' | 'appointments' | 'settings' | 'access' | 'patients';
  summary: string;
  detail?: Record<string, any>;
  amount?: number;
}

@Injectable()
export class AuditService {
  constructor(private readonly auditLogRepository: AuditLogRepository) {}

  async log(params: LogAuditEntryParams) {
    await this.auditLogRepository.create({
      hospitalId: params.hospitalId,
      at: new Date(),
      actorUserId: params.actor.userId,
      actorName: params.actor.name,
      actorRole: params.actor.role,
      action: params.action,
      area: params.area,
      summary: params.summary,
      detail: params.detail,
      amount: params.amount,
    } as any);
  }

  list(hospitalId: string, filters: AuditLogFilters) {
    return this.auditLogRepository.list(hospitalId, filters);
  }

  async getWeeklyAttendance(hospitalId: string, userId: string): Promise<Record<string, boolean>> {
    const now = new Date();
    const day = now.getDay(); // 0=Sun
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() + mondayOffset);
    const nextMonday = new Date(monday);
    nextMonday.setDate(nextMonday.getDate() + 7);

    const signInDays = await this.auditLogRepository.getSignInDays(hospitalId, userId, monday, nextMonday);

    const result: Record<string, boolean> = {};
    const labels = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      result[labels[i]] = signInDays.has(iso);
    }
    return result;
  }

  toCsv(entries: any[]): string {
    return toCsv(entries, [
      { label: 'Date', value: (e) => new Date(e.at).toLocaleDateString() },
      { label: 'Time', value: (e) => new Date(e.at).toLocaleTimeString() },
      { label: 'Actor', value: (e) => e.actorName },
      { label: 'Role', value: (e) => e.actorRole },
      { label: 'Action', value: (e) => e.action },
      { label: 'Area', value: (e) => e.area },
      { label: 'Summary', value: (e) => e.summary },
      { label: 'Amount', value: (e) => e.amount ?? '' },
    ]);
  }
}
