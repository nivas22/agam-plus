import mongoose from 'mongoose';
import { DashboardRepository } from './dashboard.repository';
import { DB_COLLECTIONS } from '@agam-plus/shared';
import { connectTestMongo, closeTestMongo, clearTestMongo } from '../test-utils/mongo-memory';

describe('DashboardRepository', () => {
  let repo: DashboardRepository;

  beforeAll(async () => {
    await connectTestMongo();
    repo = new DashboardRepository(mongoose.connection);
  });

  afterEach(async () => clearTestMongo());
  afterAll(async () => closeTestMongo());

  const appointments = () => mongoose.connection.collection(DB_COLLECTIONS.APPOINTMENTS);
  const members = () => mongoose.connection.collection(DB_COLLECTIONS.HOSPITAL_MEMBERS);

  it('countDocuments / countDocumentsBetween run generic field-equality and range queries', async () => {
    await appointments().insertMany([
      { hospitalId: 'h1', status: 'scheduled', date: '2026-08-10' },
      { hospitalId: 'h1', status: 'completed', date: '2026-08-20' },
      { hospitalId: 'h2', status: 'scheduled', date: '2026-08-10' },
    ]);

    expect(await repo.countDocuments(DB_COLLECTIONS.APPOINTMENTS, { hospitalId: 'h1' })).toBe(2);
    expect(
      await repo.countDocumentsBetween(DB_COLLECTIONS.APPOINTMENTS, { hospitalId: 'h1', field: 'date', start: '2026-08-01', end: '2026-08-15' }),
    ).toBe(1);
  });

  it('getStaffOnDutyCount counts approved doctor/staff/nurse memberships', async () => {
    await members().insertMany([
      { hospitalId: 'h1', status: 'approved', role: 'doctor' },
      { hospitalId: 'h1', status: 'approved', role: 'nurse' },
      { hospitalId: 'h1', status: 'pending', role: 'doctor' },
      { hospitalId: 'h1', status: 'approved', role: 'admin' },
    ]);

    expect(await repo.getStaffOnDutyCount('h1')).toBe(2);
  });

  it('getDoctorPatientCount deduplicates patients via distinct', async () => {
    await appointments().insertMany([
      { hospitalId: 'h1', doctorProfileId: 'd1', patientId: 'p1' },
      { hospitalId: 'h1', doctorProfileId: 'd1', patientId: 'p1' },
      { hospitalId: 'h1', doctorProfileId: 'd1', patientId: 'p2' },
    ]);

    expect(await repo.getDoctorPatientCount('h1', 'd1')).toBe(2);
  });

  it('getDoctorUpcomingAppointments filters by status and limits results', async () => {
    const future = new Date(Date.now() + 86_400_000).toISOString().split('T')[0];
    await appointments().insertMany([
      { hospitalId: 'h1', doctorProfileId: 'd1', date: future, status: 'scheduled' },
      { hospitalId: 'h1', doctorProfileId: 'd1', date: future, status: 'cancelled' },
      { hospitalId: 'h1', doctorProfileId: 'd1', date: future, status: 'confirmed' },
    ]);

    const results = await repo.getDoctorUpcomingAppointments('h1', 'd1', 5);
    expect(results.every((r: any) => r.status !== 'cancelled')).toBe(true);
    expect(results).toHaveLength(2);
  });
});
