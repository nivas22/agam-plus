import { ForbiddenException, Injectable } from '@nestjs/common';
import { RolePermissionRepository } from '../repositories/role-permission.repository';
import { ApprovalRequestRepository } from '../repositories/approval-request.repository';
import { ApiError } from '../common/errors/api-error';
import { ROLE, PERMISSION_STATE } from '../constants';
import { HospitalUserProfile } from '../auth/decorators/current-user.decorator';
import { ApprovalRequiredException } from './errors/approval-required.exception';
import {
  DEFAULT_PERMISSION_MATRIX,
  DEFAULT_DISCOUNT_CAP,
  PERMISSION_CATALOG,
  PermissionMatrix,
  isEditableRole,
} from './permission-catalog';

@Injectable()
export class PermissionsService {
  constructor(
    private readonly rolePermissionRepository: RolePermissionRepository,
    private readonly approvalRequestRepository: ApprovalRequestRepository,
  ) {}

  // Shared by PermissionGuard (whole-route actions) and any service that
  // needs to gate one specific branch of a multi-purpose endpoint (e.g.
  // AppointmentsService.updateAppointment, where reschedule vs cancel vs
  // other status transitions need different actions checked against the
  // same route). Returns silently when allowed; otherwise throws — either a
  // 403 (blocked) or an ApprovalRequiredException (needs_approval, 202).
  async enforce(
    hospitalId: string,
    userProfile: HospitalUserProfile,
    action: string,
    payload: Record<string, any>,
  ): Promise<void> {
    const state = await this.getActionState(hospitalId, userProfile.role, action, {
      isOwner: userProfile.isOwner,
    });
    if (state === PERMISSION_STATE.ALLOWED) return;

    if (state === PERMISSION_STATE.BLOCKED) {
      throw new ForbiddenException(`Your role can't do this — ask an admin`);
    }

    const approval = await this.approvalRequestRepository.create({
      hospitalId,
      action,
      requestedBy: { userId: userProfile.userId, name: userProfile.name, role: userProfile.role },
      payload,
    } as any);
    throw new ApprovalRequiredException(approval.id, action);
  }

  // Owner and Hospital admin are always fully permitted and are never
  // editable in the matrix (see the plan's "known deviations" note).
  private isAlwaysAllowed(role: string, isOwner?: boolean): boolean {
    return role === ROLE.ADMIN || !!isOwner;
  }

  async getEffectivePermissions(hospitalId: string, role: string): Promise<PermissionMatrix> {
    const defaults = DEFAULT_PERMISSION_MATRIX[role];
    if (!defaults) {
      // Unknown/uneditable role (e.g. 'patient') — treat everything as blocked.
      return Object.fromEntries(PERMISSION_CATALOG.map((a) => [a.key, PERMISSION_STATE.BLOCKED]));
    }

    const override = await this.rolePermissionRepository.getByHospitalAndRole(hospitalId, role);
    if (!override) return { ...defaults };

    return { ...defaults, ...(override as any).overrides };
  }

  async getActionState(
    hospitalId: string,
    role: string,
    action: string,
    opts?: { isOwner?: boolean },
  ): Promise<PERMISSION_STATE> {
    if (this.isAlwaysAllowed(role, opts?.isOwner)) return PERMISSION_STATE.ALLOWED;

    const matrix = await this.getEffectivePermissions(hospitalId, role);
    const state = (matrix[action] as PERMISSION_STATE) ?? PERMISSION_STATE.BLOCKED;

    const def = PERMISSION_CATALOG.find((a) => a.key === action);
    // Read-type actions can't be queued for approval — collapse to BLOCKED.
    if (def?.readOnly && state === PERMISSION_STATE.NEEDS_APPROVAL) {
      return PERMISSION_STATE.BLOCKED;
    }
    return state;
  }

  async getDiscountCap(hospitalId: string, role: string, opts?: { isOwner?: boolean }): Promise<number | undefined> {
    if (this.isAlwaysAllowed(role, opts?.isOwner)) return undefined;

    const override = await this.rolePermissionRepository.getByHospitalAndRole(hospitalId, role);
    if (override && (override as any).discountCapAmount !== undefined) {
      return (override as any).discountCapAmount;
    }
    return DEFAULT_DISCOUNT_CAP[role];
  }

  async getRoleSummary(hospitalId: string, role: string) {
    const matrix = await this.getEffectivePermissions(hospitalId, role);
    const discountCapAmount = await this.getDiscountCap(hospitalId, role);
    const catalog = PERMISSION_CATALOG.map((a) => ({ ...a, state: matrix[a.key] ?? PERMISSION_STATE.BLOCKED }));
    const tally = {
      allowed: catalog.filter((a) => a.state === PERMISSION_STATE.ALLOWED).length,
      needsApproval: catalog.filter((a) => a.state === PERMISSION_STATE.NEEDS_APPROVAL).length,
      blocked: catalog.filter((a) => a.state === PERMISSION_STATE.BLOCKED).length,
    };
    return { role, catalog, discountCapAmount, tally, editable: isEditableRole(role) };
  }

  async updatePermissions(
    hospitalId: string,
    role: string,
    updates: { overrides: Record<string, string>; discountCapAmount?: number },
    updatedBy: string,
  ) {
    if (!isEditableRole(role)) {
      throw ApiError.badRequest(`The '${role}' role's permissions can't be edited`);
    }

    const validKeys = new Set(PERMISSION_CATALOG.map((a) => a.key));
    const validStates = new Set(Object.values(PERMISSION_STATE));
    for (const [key, value] of Object.entries(updates.overrides)) {
      if (!validKeys.has(key)) throw ApiError.badRequest(`Unknown permission action '${key}'`);
      if (!validStates.has(value as PERMISSION_STATE)) throw ApiError.badRequest(`Invalid state '${value}' for '${key}'`);
    }

    await this.rolePermissionRepository.upsert(hospitalId, role, {
      overrides: updates.overrides,
      discountCapAmount: updates.discountCapAmount,
      updatedBy,
    });

    return this.getRoleSummary(hospitalId, role);
  }
}
