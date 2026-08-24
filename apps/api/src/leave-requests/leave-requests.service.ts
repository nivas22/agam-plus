import { Injectable } from '@nestjs/common';
import { LeaveRequestRepository } from '../repositories/leave-request.repository';
import { AppointmentRepository } from '../repositories/appointment.repository';
import { AuditService } from '../audit/audit.service';
import { ApiError } from '../common/errors/api-error';
import { HospitalUserProfile } from '../auth/decorators/current-user.decorator';
import { LEAVE_REQUEST_STATUS } from '../constants';

interface LeaveRequestDraft {
  startDate: string;
  endDate: string;
  reason?: string;
}

@Injectable()
export class LeaveRequestsService {
  constructor(
    private readonly leaveRequestRepository: LeaveRequestRepository,
    private readonly appointmentRepository: AppointmentRepository,
    private readonly auditService: AuditService,
  ) {}

  async list(hospitalId: string, options?: { doctorProfileId?: string; status?: string }) {
    return this.leaveRequestRepository.listByHospital(hospitalId, options);
  }

  // Preview-only — no appointment is moved or cancelled here (see the
  // schema's affectedAppointmentCount comment). The caller shows this count
  // before the doctor confirms the request.
  async previewImpact(hospitalId: string, doctorProfileId: string, draft: LeaveRequestDraft) {
    if (!draft.startDate || !draft.endDate || draft.endDate < draft.startDate) {
      throw ApiError.badRequest('A valid start and end date are required');
    }

    const affectedAppointmentCount = await this.appointmentRepository.getAppointmentCountInRange(
      hospitalId,
      doctorProfileId,
      draft.startDate,
      draft.endDate,
      { excludeStatuses: ['cancelled', 'no-show'] },
    );

    return { startDate: draft.startDate, endDate: draft.endDate, affectedAppointmentCount };
  }

  async create(hospitalId: string, actor: HospitalUserProfile, draft: LeaveRequestDraft) {
    const { affectedAppointmentCount } = await this.previewImpact(hospitalId, actor.userId, draft);

    const leaveRequest = await this.leaveRequestRepository.create({
      hospitalId,
      doctorProfileId: actor.userId,
      doctorName: actor.name,
      startDate: draft.startDate,
      endDate: draft.endDate,
      reason: draft.reason,
      affectedAppointmentCount,
      status: LEAVE_REQUEST_STATUS.PENDING,
      requestedBy: { userId: actor.userId, name: actor.name, role: actor.role },
      requestedAt: new Date(),
    });

    await this.auditService.log({
      hospitalId,
      actor: { userId: actor.userId, name: actor.name, role: actor.role },
      action: 'leave_request.created',
      area: 'appointments',
      summary: `${actor.name} applied for leave ${draft.startDate}${draft.endDate !== draft.startDate ? ` – ${draft.endDate}` : ''} — ${affectedAppointmentCount} appointment(s) would need moving`,
    });

    return leaveRequest;
  }

  async nudge(hospitalId: string, leaveRequestId: string, actor: HospitalUserProfile) {
    const existing = await this.leaveRequestRepository.getById(hospitalId, leaveRequestId);
    if (!existing) throw ApiError.notFound('Leave request not found');
    if ((existing as any).doctorProfileId !== actor.userId) {
      throw ApiError.forbidden('You can only nudge your own leave request');
    }
    if ((existing as any).status !== LEAVE_REQUEST_STATUS.PENDING) {
      throw ApiError.badRequest('This leave request has already been resolved');
    }

    return this.leaveRequestRepository.updateFields(hospitalId, leaveRequestId, {
      lastNudgedAt: new Date(),
    });
  }

  async approve(
    hospitalId: string,
    leaveRequestId: string,
    actor: HospitalUserProfile,
    body: { note?: string },
  ) {
    return this.resolve(hospitalId, leaveRequestId, actor, LEAVE_REQUEST_STATUS.APPROVED, body.note);
  }

  async decline(
    hospitalId: string,
    leaveRequestId: string,
    actor: HospitalUserProfile,
    body: { note?: string },
  ) {
    return this.resolve(hospitalId, leaveRequestId, actor, LEAVE_REQUEST_STATUS.DECLINED, body.note);
  }

  private async resolve(
    hospitalId: string,
    leaveRequestId: string,
    actor: HospitalUserProfile,
    status: LEAVE_REQUEST_STATUS,
    note?: string,
  ) {
    const existing = await this.leaveRequestRepository.getById(hospitalId, leaveRequestId);
    if (!existing) throw ApiError.notFound('Leave request not found');
    if ((existing as any).status !== LEAVE_REQUEST_STATUS.PENDING) {
      throw ApiError.badRequest('This leave request has already been resolved');
    }

    const updated = await this.leaveRequestRepository.updateFields(hospitalId, leaveRequestId, {
      status,
      resolvedBy: { userId: actor.userId, name: actor.name, role: actor.role },
      resolvedAt: new Date(),
      resolutionNote: note,
    });

    await this.auditService.log({
      hospitalId,
      actor: { userId: actor.userId, name: actor.name, role: actor.role },
      action: status === LEAVE_REQUEST_STATUS.APPROVED ? 'leave_request.approved' : 'leave_request.declined',
      area: 'appointments',
      summary: `${status === LEAVE_REQUEST_STATUS.APPROVED ? 'Approved' : 'Declined'} ${(existing as any).doctorName ?? 'a'}'s leave request for ${(existing as any).startDate}${(existing as any).endDate !== (existing as any).startDate ? ` – ${(existing as any).endDate}` : ''}`,
    });

    return updated;
  }
}
