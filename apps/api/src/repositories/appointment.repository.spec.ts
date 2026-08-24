import mongoose, { Model } from 'mongoose';
import { AppointmentRepository } from './appointment.repository';
import { Appointment, AppointmentDocument, AppointmentSchema } from '../schemas/appointment.schema';
import { connectTestMongo, closeTestMongo, clearTestMongo } from '../test-utils/mongo-memory';

describe('AppointmentRepository', () => {
  let repo: AppointmentRepository;
  let model: Model<AppointmentDocument>;

  beforeAll(async () => {
    await connectTestMongo();
    model = mongoose.model<AppointmentDocument>(Appointment.name, AppointmentSchema);
    repo = new AppointmentRepository(model);
  });

  afterEach(async () => clearTestMongo());
  afterAll(async () => closeTestMongo());

  const seed = () =>
    Promise.all([
      repo.createAppointment({
        hospitalId: 'h1',
        doctorId: 'd1',
        doctorProfileId: 'd1',
        patientId: 'p1',
        date: '2026-08-10',
        time: '09:00',
        status: 'scheduled',
      }),
      repo.createAppointment({
        hospitalId: 'h1',
        doctorId: 'd1',
        doctorProfileId: 'd1',
        patientId: 'p2',
        date: '2026-08-12',
        time: '10:00',
        status: 'completed',
      }),
      repo.createAppointment({
        hospitalId: 'h1',
        doctorId: 'd2',
        doctorProfileId: 'd2',
        patientId: 'p1',
        date: '2026-08-11',
        time: '11:00',
        status: 'scheduled',
      }),
      repo.createAppointment({
        hospitalId: 'h2',
        doctorId: 'd3',
        doctorProfileId: 'd3',
        patientId: 'p3',
        date: '2026-08-10',
        time: '09:00',
        status: 'scheduled',
      }),
    ]);

  it('getAppointmentsWithFilters applies the dynamic compound filter and sorts by date/time', async () => {
    await seed();

    const results = await repo.getAppointmentsWithFilters({
      hospitalId: 'h1',
      doctorProfileId: 'd1',
      startDate: '2026-08-01',
      endDate: '2026-08-31',
    });

    expect(results).toHaveLength(2);
    expect(results.map((r: any) => r.date)).toEqual(['2026-08-10', '2026-08-12']);
  });

  it('getAppointmentsByDoctorId filters by hospital+doctor and optional date range/status', async () => {
    await seed();

    const results = await repo.getAppointmentsByDoctorId('h1', 'd1', { status: 'scheduled' });
    expect(results).toHaveLength(1);
    expect(results[0].patientId).toBe('p1');
  });

  it('getAppointmentsByDoctorAndDate filters by status "in" list', async () => {
    await seed();

    const results = await repo.getAppointmentsByDoctorAndDate('d1', '2026-08-10', ['scheduled', 'confirmed']);
    expect(results).toHaveLength(1);

    const noneCompleted = await repo.getAppointmentsByDoctorAndDate('d1', '2026-08-12', ['scheduled', 'confirmed']);
    expect(noneCompleted).toHaveLength(0);
  });

  it('createAppointmentsBatch inserts all documents and returns their ids', async () => {
    const ids = await repo.createAppointmentsBatch([
      { hospitalId: 'h3', doctorId: 'd4', patientId: 'p4', date: '2026-08-15', status: 'scheduled' },
      { hospitalId: 'h3', doctorId: 'd4', patientId: 'p5', date: '2026-08-16', status: 'scheduled' },
    ]);

    expect(ids).toHaveLength(2);
    expect(await model.countDocuments({ hospitalId: 'h3' })).toBe(2);
  });

  it('updateAppointment sets fields and bumps updatedAt', async () => {
    const id = await repo.createAppointment({ hospitalId: 'h1', doctorId: 'd1', patientId: 'p1', date: '2026-08-10', status: 'scheduled' });
    await repo.updateAppointment(id, { status: 'completed' });

    const found = await repo.getAppointmentById(id);
    expect(found.status).toBe('completed');
    expect(found.updatedAt).toBeInstanceOf(Date);
  });
});
