import mongoose, { Model } from 'mongoose';
import { ExecutionContext, ForbiddenException, HttpException } from '@nestjs/common';
import { HospitalContextGuard } from './hospital-context.guard';
import { MembershipRepository } from '../../repositories/membership.repository';
import { HospitalRepository } from '../../repositories/hospital.repository';
import { DoctorRepository } from '../../repositories/doctor.repository';
import { SubscriptionRepository } from '../../repositories/subscription.repository';
import { HospitalMember, HospitalMemberDocument, HospitalMemberSchema } from '../../schemas/hospital-member.schema';
import { Hospital, HospitalDocument, HospitalSchema } from '../../schemas/hospital.schema';
import { DoctorProfile, DoctorProfileDocument, DoctorProfileSchema } from '../../schemas/doctor-profile.schema';
import { User, UserDocument, UserSchema } from '../../schemas/user.schema';
import { Subscription, SubscriptionDocument, SubscriptionSchema } from '../../schemas/subscription.schema';
import { connectTestMongo, closeTestMongo, clearTestMongo } from '../../test-utils/mongo-memory';
import { HOSPITAL_MODULE, SUBSCRIPTION_FEATURE } from '../../constants';
import { REQUIRES_FEATURE_KEY } from '../decorators/requires-feature.decorator';
import { REQUIRES_MODULE_KEY } from '../decorators/requires-module.decorator';

function fakeReflector(metadata: Record<string, any> = {}) {
  return { getAllAndOverride: (key: string) => metadata[key] } as any;
}

function contextFor(method: string, hospitalId: string, path: string): ExecutionContext {
  const request = {
    method,
    path,
    params: { id: hospitalId },
    user: { userId: 'u1', name: 'User', email: 'u1@test.com', uid: 'u1', sid: 's1' },
  };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('HospitalContextGuard', () => {
  let memberModel: Model<HospitalMemberDocument>;
  let hospitalModel: Model<HospitalDocument>;
  let doctorModel: Model<DoctorProfileDocument>;
  let userModel: Model<UserDocument>;
  let subscriptionModel: Model<SubscriptionDocument>;
  let membershipRepository: MembershipRepository;
  let hospitalRepository: HospitalRepository;
  let doctorRepository: DoctorRepository;
  let subscriptionRepository: SubscriptionRepository;

  beforeAll(async () => {
    await connectTestMongo();
    memberModel = mongoose.model<HospitalMemberDocument>(HospitalMember.name, HospitalMemberSchema);
    hospitalModel = mongoose.model<HospitalDocument>(Hospital.name, HospitalSchema);
    doctorModel = mongoose.model<DoctorProfileDocument>(DoctorProfile.name, DoctorProfileSchema);
    userModel = mongoose.model<UserDocument>(User.name, UserSchema);
    subscriptionModel = mongoose.model<SubscriptionDocument>(Subscription.name, SubscriptionSchema);

    membershipRepository = new MembershipRepository(memberModel, hospitalModel);
    hospitalRepository = new HospitalRepository(hospitalModel);
    doctorRepository = new DoctorRepository(doctorModel, userModel);
    subscriptionRepository = new SubscriptionRepository(subscriptionModel);
  });

  afterEach(async () => clearTestMongo());
  afterAll(async () => closeTestMongo());

  // Hospital._id is a real ObjectId (not a free-text string), so every test
  // creates a real Hospital doc first and uses its generated id throughout —
  // membership, subscription, and the request's :id param all have to agree.
  async function seedHospitalWithMembership(role = 'admin') {
    const hospital = await hospitalModel.create({ name: 'Test Hospital', address: 'Addr' });
    const hospitalId = String(hospital._id);
    await memberModel.create({ userId: 'u1', hospitalId, role, status: 'approved' });
    return hospitalId;
  }

  async function seedSubscription(hospitalId: string, data: Record<string, any>) {
    await subscriptionModel.create({
      hospitalId,
      billingCycle: 'monthly',
      basePrice: 799,
      doctorAddonPrice: 299,
      staffAddonPrice: 149,
      includedDoctors: 5,
      includedStaff: 1,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(),
      ...data,
    });
  }

  function newGuard(reflectorMetadata?: Record<string, any>) {
    return new HospitalContextGuard(
      fakeReflector(reflectorMetadata),
      membershipRepository,
      hospitalRepository,
      doctorRepository,
      subscriptionRepository,
    );
  }

  it('allows a mutating request when there is no subscription doc at all', async () => {
    const hospitalId = await seedHospitalWithMembership();
    const guard = newGuard();
    await expect(guard.canActivate(contextFor('POST', hospitalId, `/hospitals/${hospitalId}/doctors`))).resolves.toBe(
      true,
    );
  });

  it('blocks a mutating request with 402 when the subscription is suspended', async () => {
    const hospitalId = await seedHospitalWithMembership();
    await seedSubscription(hospitalId, { status: 'suspended' });
    const guard = newGuard();
    await expect(
      guard.canActivate(contextFor('POST', hospitalId, `/hospitals/${hospitalId}/doctors`)),
    ).rejects.toThrow(HttpException);
  });

  it('still allows GET requests when suspended (read-only access stays)', async () => {
    const hospitalId = await seedHospitalWithMembership();
    await seedSubscription(hospitalId, { status: 'suspended' });
    const guard = newGuard();
    await expect(guard.canActivate(contextFor('GET', hospitalId, `/hospitals/${hospitalId}/doctors`))).resolves.toBe(
      true,
    );
  });

  it('allows the billing route itself even when suspended', async () => {
    const hospitalId = await seedHospitalWithMembership();
    await seedSubscription(hospitalId, { status: 'suspended' });
    const guard = newGuard();
    await expect(
      guard.canActivate(
        contextFor('POST', hospitalId, `/hospitals/${hospitalId}/subscription/invoices/inv1/submit-payment`),
      ),
    ).resolves.toBe(true);
  });

  it('blocks a mutating request with 402 when the subscription is cancelled', async () => {
    const hospitalId = await seedHospitalWithMembership();
    await seedSubscription(hospitalId, { status: 'cancelled' });
    const guard = newGuard();
    await expect(
      guard.canActivate(contextFor('POST', hospitalId, `/hospitals/${hospitalId}/doctors`)),
    ).rejects.toThrow(HttpException);
  });

  it('allows a mutating request when exempt', async () => {
    const hospitalId = await seedHospitalWithMembership();
    await seedSubscription(hospitalId, { status: 'exempt' });
    const guard = newGuard();
    await expect(guard.canActivate(contextFor('POST', hospitalId, `/hospitals/${hospitalId}/doctors`))).resolves.toBe(
      true,
    );
  });

  it('blocks access when @RequiresFeature is set and the feature is disabled', async () => {
    const hospitalId = await seedHospitalWithMembership();
    await seedSubscription(hospitalId, {
      status: 'active',
      features: { whatsapp: false, reports: true, packages: true, medicinePacks: true },
    });
    const guard = newGuard({ [REQUIRES_FEATURE_KEY]: SUBSCRIPTION_FEATURE.WHATSAPP });
    await expect(
      guard.canActivate(contextFor('GET', hospitalId, `/hospitals/${hospitalId}/whatsapp`)),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows access when @RequiresFeature is set and the feature is enabled', async () => {
    const hospitalId = await seedHospitalWithMembership();
    await seedSubscription(hospitalId, {
      status: 'active',
      features: { whatsapp: true, reports: true, packages: true, medicinePacks: true },
    });
    const guard = newGuard({ [REQUIRES_FEATURE_KEY]: SUBSCRIPTION_FEATURE.WHATSAPP });
    await expect(
      guard.canActivate(contextFor('GET', hospitalId, `/hospitals/${hospitalId}/whatsapp`)),
    ).resolves.toBe(true);
  });

  it('blocks access when @RequiresModule is set and the hospital switched the module off', async () => {
    const hospitalId = await seedHospitalWithMembership();
    await hospitalModel.updateOne({ _id: hospitalId }, { $set: { modules: { prescriptions: false } } });
    const guard = newGuard({ [REQUIRES_MODULE_KEY]: HOSPITAL_MODULE.PRESCRIPTIONS });
    await expect(
      guard.canActivate(contextFor('GET', hospitalId, `/hospitals/${hospitalId}/appointments/a1/prescription`)),
    ).rejects.toThrow('turned off for this hospital');
  });

  it('blocks access when @RequiresModule is set and a module it depends on is off', async () => {
    const hospitalId = await seedHospitalWithMembership();
    await hospitalModel.updateOne({ _id: hospitalId }, { $set: { modules: { medicines: false } } });
    const guard = newGuard({ [REQUIRES_MODULE_KEY]: HOSPITAL_MODULE.MEDICINE_PACKS });
    await expect(
      guard.canActivate(contextFor('GET', hospitalId, `/hospitals/${hospitalId}/medicine-packs`)),
    ).rejects.toThrow(ForbiddenException);
  });

  it('blocks access when @RequiresModule is set and the plan withholds the module', async () => {
    const hospitalId = await seedHospitalWithMembership();
    await seedSubscription(hospitalId, {
      status: 'active',
      features: { whatsapp: true, reports: false, packages: true, medicinePacks: true },
    });
    const guard = newGuard({ [REQUIRES_MODULE_KEY]: HOSPITAL_MODULE.REPORTS });
    await expect(
      guard.canActivate(contextFor('GET', hospitalId, `/hospitals/${hospitalId}/reports/no-shows`)),
    ).rejects.toThrow(`isn't included on this hospital's plan`);
  });

  it('allows access when @RequiresModule is set and the hospital never configured modules', async () => {
    const hospitalId = await seedHospitalWithMembership();
    const guard = newGuard({ [REQUIRES_MODULE_KEY]: HOSPITAL_MODULE.PRESCRIPTIONS });
    await expect(
      guard.canActivate(contextFor('GET', hospitalId, `/hospitals/${hospitalId}/appointments/a1/prescription`)),
    ).resolves.toBe(true);
  });
});
