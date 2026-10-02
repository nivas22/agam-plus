import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { ApprovalRequestRepository } from '../repositories/approval-request.repository';
import { TeamMemberRepository } from '../repositories/team-member.repository';
import { PaymentsService } from '../payments/payments.service';
import { PackagesService } from '../packages/packages.service';
import { AppointmentsService } from '../appointments/appointments.service';
import { AuditService } from '../audit/audit.service';
import { ApiError } from '../common/errors/api-error';
import { HospitalUserProfile, JwtUser } from '../auth/decorators/current-user.decorator';

const MONEY_ACTIONS = new Set(['issue_refund', 'close_day', 'apply_discount']);

@Injectable()
export class ApprovalsService {
  constructor(
    private readonly approvalRequestRepository: ApprovalRequestRepository,
    private readonly teamMemberRepository: TeamMemberRepository,
    private readonly paymentsService: PaymentsService,
    private readonly packagesService: PackagesService,
    private readonly appointmentsService: AppointmentsService,
    private readonly auditService: AuditService,
  ) {}

  list(hospitalId: string, status?: string) {
    return this.approvalRequestRepository.list(hospitalId, status);
  }

  private asJwtUser(profile: HospitalUserProfile): JwtUser {
    // Synthetic — this JwtUser is only ever used as a data carrier passed
    // directly into service methods below (never through JwtAuthGuard), so
    // there's no real session to reference.
    return { uid: profile.userId, userId: profile.userId, email: profile.email, name: profile.name, sid: '' };
  }

  // Replays the original action using the payload captured when it was
  // queued (see PermissionsService.enforce / PermissionGuard) — the same
  // service method the guard would have let straight through if the actor
  // had been allowed instead of needing approval.
  private async replay(hospitalId: string, action: string, resolver: HospitalUserProfile, payload: Record<string, any>) {
    const body = payload.body || {};
    const params = payload.params || {};
    const query = payload.query || {};
    const user = this.asJwtUser(resolver);

    switch (action) {
      case 'issue_refund':
        return this.paymentsService.refundPayment(hospitalId, resolver, params.paymentId, body);
      case 'close_day':
        return this.paymentsService.closeDay(hospitalId, resolver, body);
      case 'extend_expired_package':
        return this.packagesService.extendPackage(hospitalId, params.packageId, resolver, body);
      case 'sell_package':
        return this.packagesService.sellPackage(hospitalId, user, resolver, body);
      case 'collect_payment':
        return this.paymentsService.completeVisit(hospitalId, user, resolver, body);
      case 'book_reschedule':
        return body.appointmentId
          ? this.appointmentsService.updateAppointment(hospitalId, user, resolver, body)
          : this.appointmentsService.createAppointment(hospitalId, user, resolver, body);
      case 'cancel_no_show':
        return this.appointmentsService.updateAppointment(hospitalId, user, resolver, body);
      case 'delete_appointment':
        return this.appointmentsService.deleteAppointment(hospitalId, resolver, query.id);
      default:
        throw ApiError.badRequest(`Don't know how to carry out a queued '${action}' request`);
    }
  }

  async approve(hospitalId: string, approvalId: string, resolver: HospitalUserProfile, body: { pin?: string; note?: string }) {
    const approval = await this.approvalRequestRepository.getById(hospitalId, approvalId);
    if (!approval) throw ApiError.notFound('Approval request not found');
    if ((approval as any).status !== 'pending') throw ApiError.conflict('This request has already been resolved');

    // Mirrors the mockup's warning: "You can't approve a request you raised yourself."
    if ((approval as any).requestedBy.userId === resolver.userId) {
      throw ApiError.forbidden("You can't approve a request you raised yourself");
    }

    if (MONEY_ACTIONS.has((approval as any).action)) {
      const resolverProfile = await this.teamMemberRepository.getByUserId(resolver.userId);
      const pinHash = (resolverProfile as any)?.pinHash;
      if (pinHash) {
        if (!body.pin) throw ApiError.badRequest('Your PIN is required to approve this');
        const valid = await bcrypt.compare(body.pin, pinHash);
        if (!valid) throw ApiError.unauthorized('Incorrect PIN');
      }
    }

    const result = await this.replay(hospitalId, (approval as any).action, resolver, (approval as any).payload);

    await this.approvalRequestRepository.resolve(approvalId, {
      status: 'approved',
      resolvedBy: { userId: resolver.userId, name: resolver.name, role: resolver.role },
      resolutionNote: body.note,
    });

    await this.auditService.log({
      hospitalId,
      actor: { userId: resolver.userId, name: resolver.name, role: resolver.role },
      action: `${(approval as any).action}.approved`,
      area: MONEY_ACTIONS.has((approval as any).action) ? 'money' : 'appointments',
      summary: `Approved ${(approval as any).action.replace(/_/g, ' ')} requested by ${(approval as any).requestedBy.name}${body.note ? ` · "${body.note}"` : ''}`,
      detail: { requestedBy: (approval as any).requestedBy, approvalId },
    });

    return { success: true, result };
  }

  async decline(hospitalId: string, approvalId: string, resolver: HospitalUserProfile, body: { note?: string }) {
    const approval = await this.approvalRequestRepository.getById(hospitalId, approvalId);
    if (!approval) throw ApiError.notFound('Approval request not found');
    if ((approval as any).status !== 'pending') throw ApiError.conflict('This request has already been resolved');

    await this.approvalRequestRepository.resolve(approvalId, {
      status: 'declined',
      resolvedBy: { userId: resolver.userId, name: resolver.name, role: resolver.role },
      resolutionNote: body.note,
    });

    await this.auditService.log({
      hospitalId,
      actor: { userId: resolver.userId, name: resolver.name, role: resolver.role },
      action: `${(approval as any).action}.declined`,
      area: MONEY_ACTIONS.has((approval as any).action) ? 'money' : 'appointments',
      summary: `Declined ${(approval as any).action.replace(/_/g, ' ')} requested by ${(approval as any).requestedBy.name}${body.note ? ` · "${body.note}"` : ''}`,
      detail: { requestedBy: (approval as any).requestedBy, approvalId },
    });

    return { success: true };
  }
}
