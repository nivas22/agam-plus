import { Injectable } from '@nestjs/common';
import { DB_COLLECTIONS, MEMBERSHIP_STATUS, ROLE } from '@agam-plus/shared';
import { UserRepository } from '../repositories/user.repository';
import { HospitalRepository } from '../repositories/hospital.repository';
import { MembershipRepository } from '../repositories/membership.repository';
import { DashboardRepository } from '../repositories/dashboard.repository';
import { ApiError } from '../common/errors/api-error';

@Injectable()
export class PlatformAdminService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly hospitalRepository: HospitalRepository,
    private readonly membershipRepository: MembershipRepository,
    private readonly dashboardRepository: DashboardRepository,
  ) {}

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
      firebaseUid: (user as any).firebaseUid,
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
