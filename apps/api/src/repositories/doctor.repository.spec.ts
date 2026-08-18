import mongoose, { Model } from 'mongoose';
import { DoctorRepository } from './doctor.repository';
import { DoctorProfile, DoctorProfileDocument, DoctorProfileSchema } from '../schemas/doctor-profile.schema';
import { User, UserDocument, UserSchema } from '../schemas/user.schema';
import { connectTestMongo, closeTestMongo, clearTestMongo } from '../test-utils/mongo-memory';

describe('DoctorRepository', () => {
  let repo: DoctorRepository;
  let doctorModel: Model<DoctorProfileDocument>;
  let userModel: Model<UserDocument>;

  beforeAll(async () => {
    await connectTestMongo();
    doctorModel = mongoose.model<DoctorProfileDocument>(DoctorProfile.name, DoctorProfileSchema);
    userModel = mongoose.model<UserDocument>(User.name, UserSchema);
    repo = new DoctorRepository(doctorModel, userModel);
  });

  afterEach(async () => clearTestMongo());
  afterAll(async () => closeTestMongo());

  it('upsertDoctorProfile keys the document by userId (replicates the Firestore doc-per-userId trick)', async () => {
    const userId = 'user-123';

    await repo.upsertDoctorProfile(userId, { hospitalId: 'hosp-1', specialization: 'Cardiology' });
    let profile = await repo.getDoctorProfileByUserId(userId);
    expect(profile).toMatchObject({ id: userId, userId, hospitalId: 'hosp-1', specialization: 'Cardiology' });

    // second call is an upsert-merge onto the same _id, not a new document
    await repo.upsertDoctorProfile(userId, { bio: 'Updated bio' });
    profile = await repo.getDoctorProfileByUserId(userId);
    expect(profile).toMatchObject({ id: userId, specialization: 'Cardiology', bio: 'Updated bio' });

    expect(await doctorModel.countDocuments({})).toBe(1);
  });

  it('getDoctorProfileByHospitalAndUserId finds the compound match', async () => {
    await repo.upsertDoctorProfile('user-456', { hospitalId: 'hosp-2' });

    const found = await repo.getDoctorProfileByHospitalAndUserId('hosp-2', 'user-456');
    expect(found).toMatchObject({ id: 'user-456', hospitalId: 'hosp-2' });
    expect(await repo.getDoctorProfileByHospitalAndUserId('hosp-wrong', 'user-456')).toBeNull();
  });

  it('getDoctorProfilesByUserIds and getDoctorProfilesByIds collapse to single $in queries', async () => {
    await repo.upsertDoctorProfile('u1', { hospitalId: 'h1' });
    await repo.upsertDoctorProfile('u2', { hospitalId: 'h1' });
    await repo.upsertDoctorProfile('u3', { hospitalId: 'h2' });

    const byUserIds = await repo.getDoctorProfilesByUserIds(['u1', 'u3', 'missing']);
    expect(byUserIds.map((d: any) => d.id).sort()).toEqual(['u1', 'u3']);

    const byIdsScoped = await repo.getDoctorProfilesByIds(['u1', 'u2', 'u3'], 'h1');
    expect(byIdsScoped.map((d: any) => d.id).sort()).toEqual(['u1', 'u2']);
  });

  it('getDoctorProfileWithUser joins the owning user document', async () => {
    await userModel.create({ _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'), email: 'doc@test.com', name: 'Dr. Test' });
    const userId = '507f1f77bcf86cd799439011';
    await repo.upsertDoctorProfile(userId, { hospitalId: 'h1' });

    const combined = await repo.getDoctorProfileWithUser(userId);
    expect(combined.id).toBe(userId);
    expect(combined.user.email).toBe('doc@test.com');
  });

  it('doctorProfileExists / updateDoctorProfile', async () => {
    expect(await repo.doctorProfileExists('nope')).toBe(false);

    await repo.upsertDoctorProfile('u9', { hospitalId: 'h1' });
    expect(await repo.doctorProfileExists('u9')).toBe(true);

    await repo.updateDoctorProfile('u9', { bio: 'new bio' });
    const found = await repo.getDoctorProfileByUserId('u9');
    expect(found.bio).toBe('new bio');
  });
});
