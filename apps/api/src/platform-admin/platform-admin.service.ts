import { Injectable } from '@nestjs/common';
import { DB_COLLECTIONS, MEMBERSHIP_STATUS, ROLE, SUBSCRIPTION_FEATURE } from '../constants';
import { UserRepository } from '../repositories/user.repository';
import { HospitalRepository } from '../repositories/hospital.repository';
import { MembershipRepository } from '../repositories/membership.repository';
import { DashboardRepository } from '../repositories/dashboard.repository';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { DemoRequestRepository } from '../repositories/demo-request.repository';
import { ApiError } from '../common/errors/api-error';

@Injectable()
export class PlatformAdminService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly hospitalRepository: HospitalRepository,
    private readonly membershipRepository: MembershipRepository,
    private readonly dashboardRepository: DashboardRepository,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly demoRequestRepository: DemoRequestRepository,
  ) {}

  listDemoRequests(status?: string) {
    return this.demoRequestRepository.list(status);
  }

  markDemoRequestContacted(id: string, platformAdmin: { userId: string }) {
    return this.demoRequestRepository.markContacted(id, platformAdmin.userId);
  }

  confirmSubscriptionPayment(invoiceId: string, platformAdmin: { userId: string; name: string }) {
    return this.subscriptionsService.confirmPayment(invoiceId, {
      userId: platformAdmin.userId,
      name: platformAdmin.name,
      role: 'platform_admin',
    });
  }

  setSubscriptionExempt(hospitalId: string, exempt: boolean, platformAdmin: { userId: string; name: string }) {
    return this.subscriptionsService.setExempt(hospitalId, exempt, {
      userId: platformAdmin.userId,
      name: platformAdmin.name,
      role: 'platform_admin',
    });
  }

  setSubscriptionCancelled(hospitalId: string, cancelled: boolean, platformAdmin: { userId: string; name: string }) {
    return this.subscriptionsService.setCancelled(hospitalId, cancelled, {
      userId: platformAdmin.userId,
      name: platformAdmin.name,
      role: 'platform_admin',
    });
  }

  getSubscriptionSummary(hospitalId: string) {
    return this.subscriptionsService.getBillingSummary(hospitalId);
  }

  setSubscriptionFeature(
    hospitalId: string,
    feature: SUBSCRIPTION_FEATURE,
    enabled: boolean,
    platformAdmin: { userId: string; name: string },
  ) {
    return this.subscriptionsService.setFeatureFlag(hospitalId, feature, enabled, {
      userId: platformAdmin.userId,
      name: platformAdmin.name,
      role: 'platform_admin',
    });
  }

  getPlanConfig() {
    return this.subscriptionsService.getPlanConfig();
  }

  updatePlanConfig(data: Record<string, any>, userId: string) {
    return this.subscriptionsService.updatePlanConfig(data, userId);
  }

  // Platform Admin > Subscriptions overview — one row per hospital, reusing
  // getBillingSummary (which already lazily provisions a subscription for a
  // hospital that predates this feature) rather than a separate bulk query.
  async listSubscriptions() {
    const hospitals = await this.hospitalRepository.getAllHospitals();

    return Promise.all(
      hospitals.map(async (hospital: any) => {
        const { subscription, amounts, invoices } = await this.subscriptionsService.getBillingSummary(hospital.id);
        const pendingInvoice =
          invoices.find((invoice: any) => invoice.status === 'due' || invoice.status === 'payment_submitted') || null;

        return {
          hospitalId: hospital.id,
          hospitalName: hospital.name,
          billingCycle: subscription.billingCycle,
          status: subscription.status,
          doctorCount: subscription.doctorCount,
          staffCount: subscription.staffCount,
          totalAmount: amounts.totalAmount,
          features: subscription.features,
          pendingInvoice,
        };
      }),
    );
  }

  async getStats() {
    const [hospitals, users, doctors, patients, appointments] = await Promise.all([
      this.hospitalRepository.getAllHospitals(),
      this.userRepository.getAllUsers(),
      this.dashboardRepository.countDocuments(DB_COLLECTIONS.DOCTOR_PROFILES, {}),
      this.dashboardRepository.countDocuments(DB_COLLECTIONS.PATIENTS, {}),
      this.dashboardRepository.countDocuments(DB_COLLECTIONS.APPOINTMENTS, {}),
    ]);

    return {
      totalHospitals: hospitals.length,
      totalUsers: users.length,
      totalDoctors: doctors,
      totalPatients: patients,
      totalAppointments: appointments,
    };
  }

  async getAllUsers() {
    const users = await this.userRepository.getAllUsers();
    return users.map((user: any) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      isPlatformAdmin: !!user.isPlatformAdmin,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
    }));
  }

  async getHospitalMembers(hospitalId: string) {
    const hospital = await this.hospitalRepository.getHospitalById(hospitalId);
    if (!hospital) {
      throw ApiError.notFound('Hospital not found');
    }

    const members = await this.membershipRepository.getHospitalMembers(hospitalId);

    return Promise.all(
      members.map(async (member: any) => {
        const user = await this.userRepository.getUserById(member.userId);
        return {
          membershipId: member.id,
          userId: member.userId,
          name: (user as any)?.name || null,
          email: (user as any)?.email || null,
          role: member.role,
          status: member.status,
          joinedAt: member.joinedAt,
        };
      }),
    );
  }

  async addHospitalAdmin(hospitalId: string, invitedByUserId: string, email: string) {
    const hospital = await this.hospitalRepository.getHospitalById(hospitalId);
    if (!hospital) {
      throw ApiError.notFound('Hospital not found');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.userRepository.getOrCreateUserByEmail(normalizedEmail);

    const existing = await this.membershipRepository.getHospitalMembershipData((user as any).id, hospitalId);
    if (existing) {
      throw ApiError.conflict('This user is already a member of this hospital');
    }

    await this.membershipRepository.createHospitalMembership({
      hospitalId,
      userId: (user as any).id,
      role: ROLE.ADMIN,
      status: MEMBERSHIP_STATUS.APPROVED,
      invitedBy: invitedByUserId,
      isProfileUpdated: false,
      isExperienceUpdated: false,
      isAvailabilityUpdated: false,
    });

    return { success: true };
  }

  async removeHospitalMember(hospitalId: string, membershipId: string) {
    const membership = await this.membershipRepository.getHospitalMembershipById(membershipId);
    if (!membership || (membership as any).hospitalId !== hospitalId) {
      throw ApiError.notFound('Membership not found for this hospital');
    }

    await this.membershipRepository.deleteHospitalMembershipById(membershipId);
    return { success: true };
  }

  async setPlatformAdmin(userId: string, isPlatformAdmin: boolean) {
    const user = await this.userRepository.getUserById(userId);
    if (!user) {
      throw ApiError.notFound('User not found');
    }

    await this.userRepository.updateUser(userId, { isPlatformAdmin });
    return { success: true, userId, isPlatformAdmin };
  }
}
