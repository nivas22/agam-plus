import mongoose, { Model } from 'mongoose';
import { UserRepository } from './user.repository';
import { User, UserDocument, UserSchema } from '../schemas/user.schema';
import { connectTestMongo, closeTestMongo, clearTestMongo } from '../test-utils/mongo-memory';

describe('UserRepository', () => {
  let repo: UserRepository;
  let userModel: Model<UserDocument>;

  beforeAll(async () => {
    await connectTestMongo();
    userModel = mongoose.model<UserDocument>(User.name, UserSchema);
    repo = new UserRepository(userModel);
  });

  afterEach(async () => clearTestMongo());
  afterAll(async () => closeTestMongo());

  it('creates a user and finds it by id', async () => {
    const id = await repo.createUser({ email: 'a@test.com', firebaseUid: 'fb-1', name: 'A' });
    const found = await repo.getUserById(id);

    expect(found).toMatchObject({ id, email: 'a@test.com', firebaseUid: 'fb-1' });
  });

  it('finds a user by email and by firebaseUid', async () => {
    await repo.createUser({ email: 'b@test.com', firebaseUid: 'fb-2' });

    expect(await repo.getUserByEmail('b@test.com')).toMatchObject({ email: 'b@test.com' });
    expect(await repo.getUserByFirebaseUid('fb-2')).toMatchObject({ firebaseUid: 'fb-2' });
    expect(await repo.getUserByEmail('missing@test.com')).toBeNull();
  });

  it('updateUser sets fields and bumps updatedAt', async () => {
    const id = await repo.createUser({ email: 'c@test.com' });
    await repo.updateUser(id, { lastHospitalId: 'hosp-1' });

    const found = await repo.getUserById(id);
    expect(found.lastHospitalId).toBe('hosp-1');
    expect(found.updatedAt).toBeInstanceOf(Date);
  });

  describe('getUserByFirebaseUidOrEmail (Firestore-QuerySnapshot-shaped return)', () => {
    it('matches by firebaseUid first', async () => {
      const id = await repo.createUser({ email: 'd@test.com', firebaseUid: 'fb-4' });

      const snap = await repo.getUserByFirebaseUidOrEmail('fb-4', 'wrong@test.com');
      expect(snap.empty).toBe(false);
      expect(snap.docs[0].id).toBe(id);
      expect(snap.docs[0].data().email).toBe('d@test.com');
    });

    it('falls back to email when firebaseUid does not match', async () => {
      const id = await repo.createUser({ email: 'e@test.com', firebaseUid: 'fb-5' });

      const snap = await repo.getUserByFirebaseUidOrEmail('fb-does-not-exist', 'e@test.com');
      expect(snap.empty).toBe(false);
      expect(snap.docs[0].id).toBe(id);
    });

    it('is empty when neither matches', async () => {
      const snap = await repo.getUserByFirebaseUidOrEmail('nope', 'nope@test.com');
      expect(snap.empty).toBe(true);
      expect(snap.docs).toHaveLength(0);
    });
  });
});
