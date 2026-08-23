import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { TeamMemberRepository } from '../repositories/team-member.repository';
import { MembershipRepository } from '../repositories/membership.repository';
import { UserRepository } from '../repositories/user.repository';
import { PaymentRepository } from '../repositories/payment.repository';
import { PaymentDayCloseRepository } from '../repositories/payment-day-close.repository';
import { ApprovalRequestRepository } from '../repositories/approval-request.repository';
import { PermissionsService } from '../permissions/permissions.service';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../email/email.service';
import { ApiError } from '../common/errors/api-error';
import { HospitalUserProfile } from '../auth/decorators/current-user.decorator';
import { MEMBERSHIP_STATUS } from '../constants';
import { TEAM_ASSIGNABLE_ROLES } from '../permissions/permission-catalog';

interface CreateTeamMemberData {
  name: string;
  email: string;
  phone: string;
  role: string;
  shift?: string;
  startDate?: string;
  handlesCash: boolean;
  invitedVia?: string;
  confirmDuplicate?: boolean;
}

@Injectable()
export class TeamService {
  constructor(
    private readonly teamMemberRepository: TeamMemberRepository,
    private readonly membershipRepository: MembershipRepository,
    private readonly userRepository: UserRepository,
    private readonly paymentRepository: PaymentRepository,
    private readonly paymentDayCloseRepository: PaymentDayCloseRepository,
    private readonly approvalRequestRepository: ApprovalRequestRepository,
    private readonly permissionsService: PermissionsService,
    private readonly auditService: AuditService,
    private readonly emailService: EmailService,
  ) {}

  async listMembers(hospitalId: string) {
    const profiles = await this.teamMemberRepository.getByHospital(hospitalId);
    const members = await Promise.all(
      profiles.map(async (profile: any) => {
        const membership = await this.membershipRepository.getHospitalMembershipData(profile.userId, hospitalId);
        return this.toListItem(profile, membership);
      }),
    );
    return { members, total: members.length };
  }

  private toListItem(profile: any, membership: any) {
    return {
      id: profile.userId,
      userId: profile.userId,
      hospitalId: profile.hospitalId,
      name: profile.name,
      email: profile.email,
      phone: profile.phone,
      employeeId: profile.employeeId,
      role: membership?.role,
      shift: profile.shift || null,
      startDate: profile.startDate || null,
      handlesCash: !!profile.handlesCash,
      pinSet: !!profile.pinHash,
      status: profile.status,
      joinedAt: membership?.joinedAt || null,
    };
  }

  private async findByPhone(hospitalId: string, phone: string, excludeUserId?: string) {
    const matches = await this.teamMemberRepository.findByPhone(hospitalId, phone, excludeUserId);
    return matches.map((m: any) => ({ id: m.userId, name: m.name, phone: m.phone, employeeId: m.employeeId }));
  }

  async createTeamMember(hospitalId: string, invitedBy: HospitalUserProfile, data: CreateTeamMemberData) {
    if (!TEAM_ASSIGNABLE_ROLES.includes(data.role as any)) {
      throw ApiError.badRequest(`'${data.role}' can't be assigned from the Team screen`);
    }

    const existingUser = await this.userRepository.getUserByEmail(data.email);
    const existingUserId = existingUser ? (existingUser as any).id : undefined;

    if (!data.confirmDuplicate && data.phone) {
      const duplicates = await this.findByPhone(hospitalId, data.phone, existingUserId);
      if (duplicates.length > 0) {
        throw ApiError.conflict(`A team member with phone ${data.phone} already exists in this hospital`, { duplicates });
      }
    }

    let userId: string;
    if (!existingUser) {
      userId = await this.userRepository.createUser({ email: data.email, name: data.name });
    } else {
      userId = existingUserId;
    }

    // One role per (userId, hospitalId) membership — same constraint
    // DoctorsService.createDoctor enforces, so this person can't already be
    // a doctor/admin/patient etc. at this hospital.
    const existingMembership = await this.membershipRepository.getHospitalMembershipData(userId, hospitalId);
    if (existingMembership && (existingMembership as any).role !== data.role) {
      throw ApiError.conflict(
        `This person is already a ${(existingMembership as any).role} at this hospital and can't also be added to the team as a ${data.role}`,
      );
    }

    if (!existingMembership) {
      await this.membershipRepository.createHospitalMembership({
        hospitalId,
        userId,
        role: data.role,
        status: MEMBERSHIP_STATUS.PENDING,
        invitedBy: invitedBy.userId,
      });
    } else if ((existingMembership as any).role !== data.role) {
      await this.membershipRepository.updateHospitalMembership((existingMembership as any).id, { role: data.role });
    }

    const employeeId = `EMP-${String((await this.teamMemberRepository.countByHospital(hospitalId)) + 1).padStart(4, '0')}`;

    await this.teamMemberRepository.upsert(userId, {
      hospitalId,
      name: data.name,
      email: data.email,
      phone: data.phone,
      employeeId,
      shift: data.shift,
      startDate: data.startDate,
      handlesCash: data.handlesCash,
      status: 'invited',
      invitedVia: data.invitedVia,
      createdBy: invitedBy.userId,
    });

    try {
      await this.emailService.sendTeamMemberWelcomeEmail(data.email, data.name, invitedBy.currentHospital?.name || 'your hospital');
    } catch (err) {
      console.error('Failed to send team member welcome email:', err);
    }

    await this.auditService.log({
      hospitalId,
      actor: { userId: invitedBy.userId, name: invitedBy.name, role: invitedBy.role },
      action: 'team_member.created',
      area: 'settings',
      summary: `Added ${data.name} as ${data.role.replace('_', ' ')} · ${employeeId}`,
    });

    return { success: true, member: { id: userId, userId, employeeId, hospitalId, name: data.name, role: data.role } };
  }

  async getMemberProfile(hospitalId: string, memberId: string) {
    const profile = await this.teamMemberRepository.getByUserId(memberId);
    if (!profile || (profile as any).hospitalId !== hospitalId) {
      throw ApiError.notFound('Team member not found');
    }
    const membership = await this.membershipRepository.getHospitalMembershipData(memberId, hospitalId);
    if (!membership) {
      throw ApiError.notFound('Team member not found in this hospital');
    }
    const role = (membership as any).role;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [collected, refundsRequested, drawerVariance, attendance, permissions] = await Promise.all([
      this.paymentRepository.sumCollectedByUser(hospitalId, memberId, monthStart, monthEnd),
      this.approvalRequestRepository.countByRequesterAndAction(hospitalId, memberId, 'issue_refund'),
      this.paymentDayCloseRepository.sumVarianceByUser(hospitalId, memberId),
      this.auditService.getWeeklyAttendance(hospitalId, memberId),
      this.permissionsService.getRoleSummary(hospitalId, role),
    ]);

    return {
      ...this.toListItem(profile, membership),
      stats: {
        collectedThisMonth: collected.total,
        collectedCount: collected.count,
        refundsRequested,
        drawerVarianceTotal: drawerVariance.total,
        drawerVarianceDays: drawerVariance.days,
      },
      attendance,
      permissions,
    };
  }

  async updateMember(hospitalId: string, memberId: string, updates: Record<string, any>, actor: HospitalUserProfile) {
    const profile = await this.teamMemberRepository.getByUserId(memberId);
    if (!profile || (profile as any).hospitalId !== hospitalId) {
      throw ApiError.notFound('Team member not found');
    }
    const membership = await this.membershipRepository.getHospitalMembershipData(memberId, hospitalId);
    if (!membership) {
      throw ApiError.notFound('Team member not found in this hospital');
    }

    const profileUpdates: Record<string, any> = {};
    for (const key of ['name', 'email', 'phone', 'shift'] as const) {
      if (updates[key] !== undefined) profileUpdates[key] = updates[key];
    }
    if (updates.handlesCash !== undefined) profileUpdates.handlesCash = updates.handlesCash;

    if (updates.email && updates.email !== (profile as any).email) {
      await this.userRepository.updateUser(memberId, { email: updates.email });
    }
    if (Object.keys(profileUpdates).length > 0) {
      await this.teamMemberRepository.update(memberId, profileUpdates);
    }

    const previousRole = (membership as any).role;
    if (updates.role && updates.role !== previousRole) {
      if (!TEAM_ASSIGNABLE_ROLES.includes(updates.role)) {
        throw ApiError.badRequest(`'${updates.role}' can't be assigned from the Team screen`);
      }
      await this.membershipRepository.updateHospitalMembership((membership as any).id, { role: updates.role });

      await this.auditService.log({
        hospitalId,
        actor: { userId: actor.userId, name: actor.name, role: actor.role },
        action: 'team_member.role_changed',
        area: 'settings',
        summary: `Changed ${(profile as any).name}'s role from ${previousRole} to ${updates.role}`,
        detail: { from: previousRole, to: updates.role },
      });
    }

    return { success: true };
  }

  async updateStatus(hospitalId: string, memberId: string, status: 'active' | 'suspended' | 'deactivated', actor: HospitalUserProfile) {
    const profile = await this.teamMemberRepository.getByUserId(memberId);
    if (!profile || (profile as any).hospitalId !== hospitalId) {
      throw ApiError.notFound('Team member not found');
    }
    const membership = await this.membershipRepository.getHospitalMembershipData(memberId, hospitalId);
    if (!membership) {
      throw ApiError.notFound('Team member not found in this hospital');
    }

    await this.teamMemberRepository.update(memberId, { status });

    const membershipStatus =
      status === 'active'
        ? MEMBERSHIP_STATUS.APPROVED
        : status === 'suspended'
          ? MEMBERSHIP_STATUS.SUSPENDED
          : MEMBERSHIP_STATUS.DEACTIVATED;
    await this.membershipRepository.updateHospitalMembershipStatus((membership as any).id, membershipStatus);

    await this.auditService.log({
      hospitalId,
      actor: { userId: actor.userId, name: actor.name, role: actor.role },
      action: `team_member.${status}`,
      area: 'settings',
      summary: `${status === 'active' ? 'Reactivated' : status === 'suspended' ? 'Suspended' : 'Deactivated'} ${(profile as any).name}`,
    });

    return { success: true };
  }

  async resetPin(hospitalId: string, memberId: string, actor: HospitalUserProfile) {
    const profile = await this.teamMemberRepository.getByUserId(memberId);
    if (!profile || (profile as any).hospitalId !== hospitalId) {
      throw ApiError.notFound('Team member not found');
    }
    await this.teamMemberRepository.clearPin(memberId);

    await this.auditService.log({
      hospitalId,
      actor: { userId: actor.userId, name: actor.name, role: actor.role },
      action: 'team_member.pin_reset',
      area: 'settings',
      summary: `Reset ${(profile as any).name}'s PIN — they'll set a new one at next sign-in`,
    });

    return { success: true };
  }

  async setOwnPin(hospitalId: string, actor: HospitalUserProfile, pin: string) {
    const pinHash = await bcrypt.hash(pin, 10);
    await this.teamMemberRepository.setPin(actor.userId, pinHash);
    return { success: true };
  }

  async verifyOwnPin(actor: HospitalUserProfile, pin: string): Promise<boolean> {
    const profile = await this.teamMemberRepository.getByUserId(actor.userId);
    const pinHash = (profile as any)?.pinHash;
    if (!pinHash) return false;
    return bcrypt.compare(pin, pinHash);
  }
}
