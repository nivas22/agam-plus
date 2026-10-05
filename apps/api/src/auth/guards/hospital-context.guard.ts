import { CanActivate, ExecutionContext, ForbiddenException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MembershipRepository, isPractisingDoctor } from '../../repositories/membership.repository';
import { HospitalRepository } from '../../repositories/hospital.repository';
import { DoctorRepository } from '../../repositories/doctor.repository';
import { SubscriptionRepository } from '../../repositories/subscription.repository';
import { PlatformFeatureCatalogRepository } from '../../repositories/platform-feature-catalog.repository';
import { HOSPITAL_MODULE, SUBSCRIPTION_FEATURE, SUBSCRIPTION_STATUS } from '../../constants';
import { resolveHospitalModules } from '../../hospitals/hospital-modules.util';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { REQUIRES_FEATURE_KEY } from '../decorators/requires-feature.decorator';
import { REQUIRES_MODULE_KEY } from '../decorators/requires-module.decorator';
import { JwtUser } from '../decorators/current-user.decorator';

// GET requests always pass (read-only access stays available while
// suspended/cancelled) and the billing routes themselves are always exempt —
// a suspended hospital's admin still needs to view/pay invoices to get
// unsuspended.
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const BILLING_PATH_SEGMENT = '/subscription';
const BLOCKING_STATUSES = new Set<string>([SUBSCRIPTION_STATUS.SUSPENDED, SUBSCRIPTION_STATUS.CANCELLED]);

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
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly featureCatalogRepository: PlatformFeatureCatalogRepository,
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

    const isBillingRoute = !!request.path?.includes(BILLING_PATH_SEGMENT);
    const subscription = await this.subscriptionRepository.getByHospitalId(hospitalId);

    if (!SAFE_METHODS.has(request.method) && !isBillingRoute && BLOCKING_STATUSES.has(subscription?.status)) {
      const message =
        subscription?.status === SUBSCRIPTION_STATUS.CANCELLED
          ? "This hospital's subscription has been cancelled — contact the platform team to reactivate it."
          : "This hospital's subscription is suspended — ask your hospital admin to renew it under Settings > Billing.";
      throw new HttpException(message, HttpStatus.PAYMENT_REQUIRED);
    }

    const requiredFeature = this.reflector.getAllAndOverride<SUBSCRIPTION_FEATURE | undefined>(REQUIRES_FEATURE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (requiredFeature && subscription?.features?.[requiredFeature] === false) {
      throw new ForbiddenException(`This feature isn't included on this hospital's plan.`);
    }

    const userRole = (membership as any).role || 'doctor';
    const hospitalProfile = await this.hospitalRepository.getHospitalById(hospitalId);

    const requiredModule = this.reflector.getAllAndOverride<HOSPITAL_MODULE | undefined>(REQUIRES_MODULE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (requiredModule) {
      const catalog = await this.featureCatalogRepository.getCatalog();
      const module = resolveHospitalModules(
        (hospitalProfile as any)?.modules,
        subscription?.features,
        catalog.moduleStatus,
      )[requiredModule];
      if (!module.enabled) {
        throw new ForbiddenException(
          module.disabledReason === 'hidden' || module.disabledReason === 'coming_soon'
            ? `This feature isn't available yet.`
            : module.disabledReason === 'plan'
              ? `This feature isn't included on this hospital's plan.`
              : 'This feature is turned off for this hospital — an admin can turn it on under Settings > Features.',
        );
      }
    }

    // An admin with isDoctor also practises here, so they get a doctorProfile
    // too — but their role stays 'admin', so every "doctors only see their own
    // data" check below and in the services keeps treating them as an admin.
    const isDoctor = isPractisingDoctor({ role: userRole, isDoctor: (membership as any).isDoctor });
    let doctorProfile: any | undefined;
    if (isDoctor) {
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
      isDoctor,
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
