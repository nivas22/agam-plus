import mongoose, { Model } from 'mongoose';
import { MembershipRepository } from './membership.repository';
import { HospitalMember, HospitalMemberDocument, HospitalMemberSchema } from '../schemas/hospital-member.schema';
import { Hospital, HospitalDocument, HospitalSchema } from '../schemas/hospital.schema';
import { connectTestMongo, closeTestMongo, clearTestMongo } from '../test-utils/mongo-memory';

describe('MembershipRepository', () => {
  let repo: MembershipRepository;
  let memberModel: Model<HospitalMemberDocument>;
  let hospitalModel: Model<HospitalDocument>;

  beforeAll(async () => {
    await connectTestMongo();
    memberModel = mongoose.model<HospitalMemberDocument>(HospitalMember.name, HospitalMemberSchema);
    hospitalModel = mongoose.model<HospitalDocument>(Hospital.name, HospitalSchema);
    repo = new MembershipRepository(memberModel, hospitalModel);
  });

  afterEach(async () => clearTestMongo());
  afterAll(async () => closeTestMongo());

  it('getHospitalMembership returns a Firestore-QuerySnapshot-shaped result', async () => {
    await repo.createHospitalMembership({ userId: 'u1', hospitalId: 'h1', role: 'doctor', status: 'approved' });

    const found = await repo.getHospitalMembership('h1', 'u1');
    expect(found.empty).toBe(false);
    expect(found.docs[0].data()).toMatchObject({ role: 'doctor', status: 'approved' });

    const missing = await repo.getHospitalMembership('h1', 'nope');
    expect(missing.empty).toBe(true);
  });

  it('getUserHospitalRole only matches approved memberships', async () => {
    await repo.createHospitalMembership({ userId: 'u1', hospitalId: 'h1', role: 'doctor', status: 'pending' });
    expect(await repo.getUserHospitalRole('u1', 'h1')).toBeNull();

    await memberModel.updateOne({ userId: 'u1', hospitalId: 'h1' }, { $set: { status: 'approved' } });
    expect(await repo.getUserHospitalRole('u1', 'h1')).toBe('doctor');
  });

  it('getHospitalMembers filters by optional status/role', async () => {
    await repo.createHospitalMembership({ userId: 'u1', hospitalId: 'h1', role: 'doctor', status: 'approved' });
    await repo.createHospitalMembership({ userId: 'u2', hospitalId: 'h1', role: 'front_desk', status: 'pending' });

    expect(await repo.getHospitalMembers('h1')).toHaveLength(2);
    expect(await repo.getHospitalMembers('h1', { role: 'doctor' })).toHaveLength(1);
    expect(await repo.countHospitalMembers({ hospitalId: 'h1', status: 'pending' })).toBe(1);
  });

  it('getUserHospitalsWithDetails joins membership rows with their hospital in a single query', async () => {
    const hospital = await hospitalModel.create({ name: 'General Hospital', address: '123 Main St' });
    await repo.createHospitalMembership({ userId: 'u1', hospitalId: hospital._id.toString(), role: 'doctor', status: 'approved' });

    const results = await repo.getUserHospitalsWithDetails('u1');
    expect(results).toHaveLength(1);
    expect(results[0].hospital).toMatchObject({ id: hospital._id.toString(), name: 'General Hospital' });
  });

  it('deleteHospitalMembership removes the matching membership', async () => {
    await repo.createHospitalMembership({ userId: 'u1', hospitalId: 'h1', role: 'doctor', status: 'approved' });
    await repo.deleteHospitalMembership('h1', 'u1');

    expect(await memberModel.countDocuments({ userId: 'u1', hospitalId: 'h1' })).toBe(0);
  });
});
