import mongoose, { Model } from 'mongoose';
import { PatientRepository } from './patient.repository';
import { Patient, PatientDocument, PatientSchema } from '../schemas/patient.schema';
import { connectTestMongo, closeTestMongo, clearTestMongo } from '../test-utils/mongo-memory';

describe('PatientRepository', () => {
  let repo: PatientRepository;
  let model: Model<PatientDocument>;

  beforeAll(async () => {
    await connectTestMongo();
    model = mongoose.model<PatientDocument>(Patient.name, PatientSchema);
    repo = new PatientRepository(model);
  });

  afterEach(async () => clearTestMongo());
  afterAll(async () => closeTestMongo());

  it('creates and fetches a patient, and verifies hospital ownership', async () => {
    const id = await repo.createPatient({ hospitalId: 'h1', doctorId: 'd1', name: 'Pat', email: 'pat@test.com', phone: '123' });

    expect(await repo.getPatientById(id)).toMatchObject({ id, hospitalId: 'h1' });
    expect(await repo.verifyPatientInHospital(id, 'h1')).toBe(true);
    expect(await repo.verifyPatientInHospital(id, 'wrong')).toBe(false);
  });

  it('getPatientsByHospital filters by optional doctorId', async () => {
    await repo.createPatient({ hospitalId: 'h1', doctorId: 'd1', name: 'A', email: 'a@test.com', phone: '1' });
    await repo.createPatient({ hospitalId: 'h1', doctorId: 'd2', name: 'B', email: 'b@test.com', phone: '2' });

    expect(await repo.getPatientsByHospital('h1')).toHaveLength(2);
    expect(await repo.getPatientsByHospital('h1', 'd1')).toHaveLength(1);
  });

  it('patientExistsByEmail is scoped per hospital', async () => {
    await repo.createPatient({ hospitalId: 'h1', name: 'A', email: 'dup@test.com', phone: '1' });

    expect(await repo.patientExistsByEmail('h1', 'dup@test.com')).toBe(true);
    expect(await repo.patientExistsByEmail('h2', 'dup@test.com')).toBe(false);
  });

  it('getPatientsByIds collapses to a single $in query and stays hospital-scoped', async () => {
    const id1 = await repo.createPatient({ hospitalId: 'h1', name: 'A', email: 'a@test.com', phone: '1' });
    const id2 = await repo.createPatient({ hospitalId: 'h2', name: 'B', email: 'b@test.com', phone: '2' });

    const scoped = await repo.getPatientsByIds([id1, id2], 'h1');
    expect(scoped.map((p: any) => p.id)).toEqual([id1]);

    const unscoped = await repo.getPatientsByIds([id1, id2]);
    expect(unscoped).toHaveLength(2);
  });

  it('deletePatient soft-deletes via status:archived', async () => {
    const id = await repo.createPatient({ hospitalId: 'h1', name: 'A', email: 'a@test.com', phone: '1' });
    await repo.deletePatient(id, 'admin-1');

    const found = await repo.getPatientById(id);
    expect(found.status).toBe('archived');
    expect(found.archivedBy).toBe('admin-1');
    expect(await model.countDocuments({ _id: id })).toBe(1); // still present, not hard-deleted
  });
});
