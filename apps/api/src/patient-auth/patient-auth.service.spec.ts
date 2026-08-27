import mongoose, { Model } from 'mongoose';
import * as jwt from 'jsonwebtoken';
import { PatientAuthService } from './patient-auth.service';
import { PatientAccountRepository } from '../repositories/patient-account.repository';
import { PatientRepository } from '../repositories/patient.repository';
import { HospitalRepository } from '../repositories/hospital.repository';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { AuditService } from '../audit/audit.service';
import { SmsService } from '../sms/sms.service';
import {
  PatientAccount,
  PatientAccountDocument,
  PatientAccountSchema,
} from '../schemas/patient-account.schema';
import { Patient, PatientDocument, PatientSchema } from '../schemas/patient.schema';
import { Hospital, HospitalDocument, HospitalSchema } from '../schemas/hospital.schema';
import {
  AuditLogEntry,
  AuditLogEntryDocument,
  AuditLogEntrySchema,
} from '../schemas/audit-log.schema';
import { connectTestMongo, closeTestMongo, clearTestMongo } from '../test-utils/mongo-memory';

const JWT_SECRET = 'test-secret';
const fakeConfig = { get: (key: string) => (key === 'JWT_SECRET' ? JWT_SECRET : undefined) } as any;

// Reaches past the private otpHash to read the raw OTP for test purposes only
// — bcrypt.compare isn't reversible, so tests capture the code via the
// stubbed SmsService instead of the account doc.
class CapturingSmsService extends SmsService {
  public lastMessage = '';
  async sendSms({ message }: { to: string; message: string }) {
    this.lastMessage = message;
    return true;
  }
}

function extractOtp(message: string): string {
  const match = message.match(/\d{6}/);
  if (!match) throw new Error('No OTP found in message: ' + message);
  return match[0];
}

describe('PatientAuthService', () => {
  let service: PatientAuthService;
  let sms: CapturingSmsService;
  let patientModel: Model<PatientDocument>;
  let auditLogModel: Model<AuditLogEntryDocument>;

  beforeAll(async () => {
    await connectTestMongo();
    const accountModel = mongoose.model<PatientAccountDocument>(
      PatientAccount.name,
      PatientAccountSchema,
    );
    patientModel = mongoose.model<PatientDocument>(Patient.name, PatientSchema);
    const hospitalModel = mongoose.model<HospitalDocument>(Hospital.name, HospitalSchema);
    auditLogModel = mongoose.model<AuditLogEntryDocument>(
      AuditLogEntry.name,
      AuditLogEntrySchema,
    );

    sms = new CapturingSmsService(fakeConfig);
    service = new PatientAuthService(
      fakeConfig,
      new PatientAccountRepository(accountModel),
      new PatientRepository(patientModel),
      new HospitalRepository(hospitalModel),
      new AuditService(new AuditLogRepository(auditLogModel)),
      sms,
    );
  });

  afterEach(async () => clearTestMongo());
  afterAll(async () => closeTestMongo());

  it('requestOtp then verifyOtp with the correct code issues a scope:patient token', async () => {
    await service.requestOtp('9876543210');
    const otp = extractOtp(sms.lastMessage);

    const result = await service.verifyOtp('9876543210', otp);

    expect(result.success).toBe(true);
    expect(result.token).toBeTruthy();
    const payload = jwt.verify(result.token, JWT_SECRET) as any;
    expect(payload.scope).toBe('patient');
    expect(payload.phone).toBe('9876543210');
  });

  it('rejects an incorrect OTP and increments the attempt counter', async () => {
    await service.requestOtp('9111111111');

    await expect(service.verifyOtp('9111111111', '000000')).rejects.toMatchObject({
      statusCode: 401,
    });

    // The correct OTP still works after one wrong guess.
    const otp = extractOtp(sms.lastMessage);
    const result = await service.verifyOtp('9111111111', otp);
    expect(result.success).toBe(true);
  });

  it('locks out after too many incorrect attempts, even with the correct OTP', async () => {
    await service.requestOtp('9222222222');
    const otp = extractOtp(sms.lastMessage);

    for (let i = 0; i < 5; i++) {
      await expect(service.verifyOtp('9222222222', '000000')).rejects.toMatchObject({
        statusCode: 401,
      });
    }

    await expect(service.verifyOtp('9222222222', otp)).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it('enforces the resend cooldown', async () => {
    await service.requestOtp('9333333333');
    await expect(service.requestOtp('9333333333')).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it('auto-links matching Patient docs across hospitals on verify and audits each hospital', async () => {
    await patientModel.create({
      hospitalId: 'h1',
      name: 'Walk-in One',
      email: 'w1@test.com',
      phone: '9444444444',
    });
    await patientModel.create({
      hospitalId: 'h2',
      name: 'Walk-in Two',
      email: 'w2@test.com',
      phone: '9444444444',
    });
    // Different phone — must not get linked.
    await patientModel.create({
      hospitalId: 'h3',
      name: 'Unrelated',
      email: 'w3@test.com',
      phone: '9555555555',
    });

    await service.requestOtp('9444444444');
    const otp = extractOtp(sms.lastMessage);
    const result = await service.verifyOtp('9444444444', otp);

    const linked = await patientModel.find({ patientAccountId: result.account.id }).lean();
    expect(linked.map((p: any) => p.hospitalId).sort()).toEqual(['h1', 'h2']);

    const unrelated = await patientModel.findOne({ hospitalId: 'h3' }).lean();
    expect((unrelated as any).patientAccountId).toBeUndefined();

    const auditEntries = await auditLogModel
      .find({ action: 'patient.account_linked' })
      .lean();
    expect(auditEntries.map((e: any) => e.hospitalId).sort()).toEqual(['h1', 'h2']);
  });

  it('getMyRecords returns a minimal, non-clinical view joined with hospital name', async () => {
    const hospitalModel = mongoose.model<HospitalDocument>(Hospital.name);
    const hospital = await hospitalModel.create({ name: 'Test Hospital' });
    await patientModel.create({
      hospitalId: hospital._id.toString(),
      name: 'Jane',
      email: 'jane@test.com',
      phone: '9666666666',
      allergies: ['Penicillin'],
      notes: 'sensitive clinical note',
    });

    await service.requestOtp('9666666666');
    const otp = extractOtp(sms.lastMessage);
    const { account } = await service.verifyOtp('9666666666', otp);

    const { records } = await service.getMyRecords(account.id);

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      hospitalId: hospital._id.toString(),
      hospitalName: 'Test Hospital',
      name: 'Jane',
      status: 'active',
    });
    expect(records[0]).not.toHaveProperty('allergies');
    expect(records[0]).not.toHaveProperty('notes');
  });
});
