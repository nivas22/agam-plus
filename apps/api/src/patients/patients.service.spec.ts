import mongoose, { Model } from 'mongoose';
import { PatientsService } from './patients.service';
import { PatientRepository } from '../repositories/patient.repository';
import { PatientAccountRepository } from '../repositories/patient-account.repository';
import { Patient, PatientDocument, PatientSchema } from '../schemas/patient.schema';
import {
  PatientAccount,
  PatientAccountDocument,
  PatientAccountSchema,
} from '../schemas/patient-account.schema';
import { connectTestMongo, closeTestMongo, clearTestMongo } from '../test-utils/mongo-memory';
import { ApiError } from '../common/errors/api-error';
import { JwtUser } from '../auth/decorators/current-user.decorator';

describe('PatientsService', () => {
  let service: PatientsService;
  let model: Model<PatientDocument>;
  let accountModel: Model<PatientAccountDocument>;

  const requester: JwtUser = {
    uid: 'staff-1',
    userId: 'staff-1',
    email: 'staff@test.com',
    name: 'Staff',
    sid: 'session-1',
  };

  beforeAll(async () => {
    await connectTestMongo();
    model = mongoose.model<PatientDocument>(Patient.name, PatientSchema);
    accountModel = mongoose.model<PatientAccountDocument>(
      PatientAccount.name,
      PatientAccountSchema,
    );
    service = new PatientsService(
      new PatientRepository(model),
      new PatientAccountRepository(accountModel),
    );
  });

  afterEach(async () => clearTestMongo());
  afterAll(async () => closeTestMongo());

  it('creates a patient without touching users or hospitalMembers collections', async () => {
    const result = await service.createPatient('h1', requester, {
      name: 'Pat',
      email: 'pat@test.com',
      phone: '111',
    });

    expect(result.success).toBe(true);
    expect(result.patient).not.toHaveProperty('userId');
    expect(result.patient).not.toHaveProperty('membershipStatus');

    const { collections } = mongoose.connection;
    expect(collections.users).toBeUndefined();
    expect(collections.hospitalMembers).toBeUndefined();
  });

  it('allows the same email to be registered independently in two different hospitals', async () => {
    const h1 = await service.createPatient('h1', requester, {
      name: 'Pat One',
      email: 'shared@test.com',
      phone: '111',
    });
    const h2 = await service.createPatient('h2', requester, {
      name: 'Pat Two',
      email: 'shared@test.com',
      phone: '222',
    });

    expect(h1.patient.id).not.toBe(h2.patient.id);
    expect(h1.patient.hospitalId).toBe('h1');
    expect(h2.patient.hospitalId).toBe('h2');
  });

  it('rejects a duplicate email within the same hospital', async () => {
    await service.createPatient('h1', requester, {
      name: 'Pat',
      email: 'dup@test.com',
      phone: '111',
    });

    await expect(
      service.createPatient('h1', requester, {
        name: 'Other Pat',
        email: 'dup@test.com',
        phone: '222',
      }),
    ).rejects.toMatchObject({ statusCode: ApiError.conflict('x').statusCode });
  });

  it('listPatients returns patients directly from the Patient collection without a userId lookup', async () => {
    await service.createPatient('h1', requester, {
      name: 'Pat',
      email: 'pat@test.com',
      phone: '111',
    });

    const { patients } = await service.listPatients('h1', undefined, 1, 10);

    expect(patients).toHaveLength(1);
    expect(patients[0]).toMatchObject({
      name: 'Pat',
      email: 'pat@test.com',
      status: 'active',
    });
    expect(patients[0]).not.toHaveProperty('userId');
  });

  it('links a new walk-in to an already-verified PatientAccount matching by phone', async () => {
    const account = await accountModel.create({
      phone: '9876543210',
      verifiedAt: new Date(),
    });

    const result = await service.createPatient('h1', requester, {
      name: 'App User',
      email: 'appuser@test.com',
      phone: '9876543210',
    });

    const stored = await model.findById(result.patient.id).lean();
    expect((stored as any).patientAccountId).toBe(account._id.toString());
  });

  it('does not link a walk-in when the matching account is not yet verified', async () => {
    await accountModel.create({ phone: '9123456780' });

    const result = await service.createPatient('h1', requester, {
      name: 'Pending User',
      email: 'pending@test.com',
      phone: '9123456780',
    });

    const stored = await model.findById(result.patient.id).lean();
    expect((stored as any).patientAccountId).toBeUndefined();
  });
});
