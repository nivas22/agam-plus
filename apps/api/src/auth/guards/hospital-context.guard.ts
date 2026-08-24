import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MembershipRepository } from '../../repositories/membership.repository';
import { HospitalRepository } from '../../repositories/hospital.repository';
import { DoctorRepository } from '../../repositories/doctor.repository';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { JwtUser } from '../decorators/current-user.decorator';

/**
 * Direct port of the old verifyContext()/withVerification() pair — re-checks
 * hospital membership from Firestore on every request rather than trusting
 * anything cached in the JWT (the JWT only carries stable identity).
 */
@Injectable()
export class HospitalContextGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly membershipRepository: MembershipRepository,
    private readonly hospitalRepository: HospitalRepository,
    private readonly doctorRepository: DoctorRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user: JwtUser = request.user;
    const hospitalId: string | undefined = request.params?.id;
    const doctorId: string | undefined = request.params?.doctorId;

    if (!hospitalId) {
      throw new ForbiddenException('Hospital ID is required');
    }

    const membership = await this.membershipRepository.getHospitalMembershipData(user.userId, hospitalId);
    if (!membership) {
      throw new ForbiddenException('Forbidden');
    }

    const userRole = (membership as any).role || 'doctor';
    const hospitalProfile = await this.hospitalRepository.getHospitalById(hospitalId);

    let doctorProfile: any | undefined;
    if (userRole === 'doctor') {
      doctorProfile = await this.doctorRepository.getDoctorProfileByHospitalAndUserId(hospitalId, user.userId);
    }

    request.userProfile = {
      id: user.userId,
      userId: user.userId,
      hospitalId,
      name: user.name || '',
      email: user.email || '',
      specialization: doctorProfile?.specialization || '',
      role: userRole,
      isOwner: !!(membership as any).isOwner,
      currentHospital: hospitalProfile,
      doctorProfile,
    };

    const roles = this.reflector.getAllAndOverride<string[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (doctorId && userRole === 'doctor' && user.userId !== doctorId) {
      throw new ForbiddenException(`You are not authorized to update this doctor ${doctorId}`);
    }

    if (roles?.length && !roles.includes(userRole)) {
      throw new ForbiddenException(`Forbidden: Requires one of [${roles.join(', ')}], got ${userRole}`);
    }

    return true;
  }
}
