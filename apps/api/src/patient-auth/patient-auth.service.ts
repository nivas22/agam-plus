import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { PatientAccountRepository } from '../repositories/patient-account.repository';
import { PatientRepository } from '../repositories/patient.repository';
import { HospitalRepository } from '../repositories/hospital.repository';
import { AuditService } from '../audit/audit.service';
import { SmsService } from '../sms/sms.service';
import { ApiError } from '../common/errors/api-error';
import { normalizePhone } from '../common/phone.util';

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_MAX_REQUESTS_PER_WINDOW = 5;

// Patient-app JWTs are a placeholder — 30d, no refresh-token flow yet. A real
// refresh story is follow-up work, not built here.
const PATIENT_TOKEN_TTL = '30d';

const generateOtp = (): string =>
  Math.floor(100000 + Math.random() * 900000).toString();

@Injectable()
export class PatientAuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly patientAccountRepository: PatientAccountRepository,
    private readonly patientRepository: PatientRepository,
    private readonly hospitalRepository: HospitalRepository,
    private readonly auditService: AuditService,
    private readonly smsService: SmsService,
  ) {}

  private signToken(accountId: string, phone: string): string {
    return jwt.sign(
      { sub: accountId, phone, scope: 'patient' },
      this.config.get<string>('JWT_SECRET')!,
      { expiresIn: PATIENT_TOKEN_TTL },
    );
  }

  async requestOtp(rawPhone: string) {
    const phone = normalizePhone(rawPhone);
    if (!phone) {
      throw ApiError.badRequest('A valid phone number is required');
    }

    const account = await this.patientAccountRepository.createOrGetByPhone(phone);

    const now = Date.now();
    if (
      account.otpSentAt &&
      now - new Date(account.otpSentAt).getTime() < OTP_RESEND_COOLDOWN_MS
    ) {
      throw ApiError.conflict('Please wait before requesting another OTP');
    }

    const requestCount = await this.patientAccountRepository.bumpRequestCount(
      account.id,
    );
    if (requestCount > OTP_MAX_REQUESTS_PER_WINDOW) {
      throw ApiError.conflict(
        'Too many OTP requests — please try again later',
      );
    }

    const otp = generateOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    await this.patientAccountRepository.setOtp(
      account.id,
      otpHash,
      new Date(now + OTP_TTL_MS),
    );

    await this.smsService.sendSms({
      to: phone,
      message: `Your verification code is ${otp}. It expires in 5 minutes.`,
    });

    return { success: true };
  }

  async verifyOtp(rawPhone: string, otp: string) {
    const phone = normalizePhone(rawPhone);
    const account = await this.patientAccountRepository.getByPhone(phone);

    if (!account || !account.otpHash) {
      throw ApiError.unauthorized('No pending OTP for this phone number');
    }

    if ((account.otpAttempts || 0) >= OTP_MAX_ATTEMPTS) {
      throw ApiError.unauthorized(
        'Too many incorrect attempts — please request a new OTP',
      );
    }

    if (!account.otpExpiresAt || new Date(account.otpExpiresAt).getTime() < Date.now()) {
      throw ApiError.unauthorized('OTP has expired — please request a new one');
    }

    const matches = await bcrypt.compare(otp, account.otpHash);
    if (!matches) {
      await this.patientAccountRepository.incrementOtpAttempts(account.id);
      throw ApiError.unauthorized('Incorrect OTP');
    }

    await this.patientAccountRepository.clearOtp(account.id);
    await this.patientAccountRepository.markVerified(account.id);

    const linkedHospitalIds =
      await this.patientRepository.linkPatientsByPhoneToAccount(
        phone,
        account.id,
      );

    for (const hospitalId of linkedHospitalIds) {
      await this.auditService.log({
        hospitalId,
        actor: { userId: account.id, name: phone, role: 'patient' },
        action: 'patient.account_linked',
        area: 'patients',
        summary: `Patient app account linked to this hospital's record (self-claim by phone verification)`,
      });
    }

    const token = this.signToken(account.id, phone);

    return {
      success: true,
      token,
      account: { id: account.id, phone },
    };
  }

  async getMyRecords(accountId: string) {
    const patients = await this.patientRepository.getPatientsByAccountId(
      accountId,
    );

    const hospitalIds = Array.from(
      new Set(patients.map((p: any) => p.hospitalId)),
    );
    const hospitals = await Promise.all(
      hospitalIds.map((id) => this.hospitalRepository.getHospitalById(id)),
    );
    const hospitalNameById = new Map(
      hospitals.filter(Boolean).map((h: any) => [h.id, h.name]),
    );

    // Deliberately minimal — excludes allergies/notes/medicalHistory. Full
    // clinical-record exposure to a patient-facing endpoint is a separate,
    // bigger decision (consent, per-hospital opt-in) not covered here.
    return {
      records: patients.map((p: any) => ({
        hospitalId: p.hospitalId,
        hospitalName: hospitalNameById.get(p.hospitalId) || 'Unknown Hospital',
        patientId: p.patientId || null,
        name: p.name,
        status: p.status || 'active',
      })),
    };
  }
}
