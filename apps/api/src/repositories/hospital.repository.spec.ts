import mongoose, { Model } from 'mongoose';
import { HospitalRepository } from './hospital.repository';
import { Hospital, HospitalDocument, HospitalSchema } from '../schemas/hospital.schema';
import { connectTestMongo, closeTestMongo, clearTestMongo } from '../test-utils/mongo-memory';

describe('HospitalRepository', () => {
  let repo: HospitalRepository;
  let model: Model<HospitalDocument>;

  beforeAll(async () => {
    await connectTestMongo();
    model = mongoose.model<HospitalDocument>(Hospital.name, HospitalSchema);
    repo = new HospitalRepository(model);
  });

  afterEach(async () => clearTestMongo());
  afterAll(async () => closeTestMongo());

  it('createHospital persists the document and stamps timestamps', async () => {
    const created = await repo.createHospital({ name: 'New Hospital', address: '1 Main St' });

    expect(created).toMatchObject({ name: 'New Hospital', address: '1 Main St' });
    expect(created.createdAt).toBeInstanceOf(Date);
    expect(await repo.getHospitalById(created.id)).toMatchObject({ name: 'New Hospital' });
  });

  it('getAllHospitals / getHospitalById', async () => {
    const h1 = await model.create({ name: 'H1' });
    const h2 = await model.create({ name: 'H2' });

    expect(await repo.getAllHospitals()).toHaveLength(2);
    expect(await repo.getHospitalById(h1._id.toString())).toMatchObject({ name: 'H1' });
    expect(await repo.getHospitalById(h2._id.toString())).toMatchObject({ name: 'H2' });
  });

  it('updateHospital applies updates in a single round trip and returns the fresh document', async () => {
    const h1 = await model.create({ name: 'Old Name' });

    const updated = await repo.updateHospital(h1._id.toString(), { name: 'New Name' });
    expect(updated).toMatchObject({ id: h1._id.toString(), name: 'New Name' });
    expect(updated.updatedAt).toBeInstanceOf(Date);
  });

  it('updateHospital throws when the hospital does not exist', async () => {
    await expect(repo.updateHospital(new mongoose.Types.ObjectId().toString(), { name: 'X' })).rejects.toThrow('Hospital not found');
  });
});
