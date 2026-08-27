import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { UserRepository } from '../repositories/user.repository';
import { MembershipRepository } from '../repositories/membership.repository';
import { HospitalRepository } from '../repositories/hospital.repository';
import { DoctorRepository } from '../repositories/doctor.repository';
import { TeamMemberRepository } from '../repositories/team-member.repository';
import { SessionRepository } from '../repositories/session.repository';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../email/email.service';
import { SmsService } from '../sms/sms.service';
import { ApiError } from '../common/errors/api-error';
import { JwtUser } from './decorators/current-user.decorator';
import { normalizePhone } from '../common/phone.util';
import { describeUserAgent } from '../common/user-agent.util';

const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour — email-link flow
const OTP_RESET_TOKEN_TTL_MS = 10 * 60 * 1000; // 10 minutes — freshly OTP-verified

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_MAX_REQUESTS_PER_WINDOW = 5;

const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCK_MS = 15 * 60 * 1000;

const GOOGLE_TOKEN_TTL = '7d';
const KEEP_SIGNED_IN_TOKEN_TTL = '30d';
const DEFAULT_PASSWORD_TOKEN_TTL = '1d';

const generateOtp = (): string => Math.floor(100000 + Math.random() * 900000).toString();

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function maskPhone(phone: string): string {
  const d = normalizePhone(phone);
  if (d.length < 7) return phone;
  return `+91 ${d.slice(0, 3)}••••${d.slice(7)}`;
}

// Server-internal-only fields on User that must never reach the client.
const SENSITIVE_USER_FIELDS = [
  'passwordHash',
  'otpHash',
  'otpExpiresAt',
  'otpAttempts',
  'otpSentAt',
  'otpRequestCount',
  'otpRequestWindowStart',
  'passwordResetTokenHash',
  'passwordResetExpires',
  'failedLoginAttempts',
  'lockedUntil',
] as const;

function sanitizeUser(user: any) {
  if (!user) return user;
  const clone = { ...user };
  for (const field of SENSITIVE_USER_FIELDS) delete clone[field];
  return clone;
}

const formatDate = (value: any) => {
  // MongoDB returns Date fields as native Date instances (Firestore returned
  // a {_seconds, _nanoseconds} Timestamp instead) — handle both shapes.
  if (value instanceof Date) return value.toLocaleDateString();
  if (!value?._seconds) return value;
  return new Date(value._seconds * 1000).toLocaleDateString();
};

@Injectable()
export class AuthService {
  private readonly googleClient: OAuth2Client;

  constructor(
    private readonly config: ConfigService,
    private readonly userRepository: UserRepository,
    private readonly membershipRepository: MembershipRepository,
    private readonly hospitalRepository: HospitalRepository,
    private readonly doctorRepository: DoctorRepository,
    private readonly teamMemberRepository: TeamMemberRepository,
    private readonly sessionRepository: SessionRepository,
    private readonly auditService: AuditService,
    private readonly emailService: EmailService,
    private readonly smsService: SmsService,
  ) {
    this.googleClient = new OAuth2Client(
      this.config.get<string>('GOOGLE_CLIENT_ID'),
    );
  }

  private signToken(payload: JwtUser, expiresIn: string): string {
    return jwt.sign(payload, this.config.get<string>('JWT_SECRET')!, {
      expiresIn,
    } as jwt.SignOptions);
  }

  async login(idToken: string, clientInfo: { userAgent?: string; ip?: string } = {}) {
    // The token is Google's own ID token (verified against our OAuth client ID), minted
    // fresh by the sign-in flow on every call — unlike Firebase's session tokens there's
    // no long-lived client session to stale-check, so no separate recency check is needed.
    let payload: { sub: string; email?: string; name?: string } | undefined;
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: this.config.get<string>('GOOGLE_CLIENT_ID'),
      });
      payload = ticket.getPayload();
    } catch {
      throw ApiError.unauthorized('Invalid or expired Google token');
    }

    if (!payload?.sub || !payload.email) {
      throw ApiError.unauthorized(
        'Unable to retrieve verified Google account email',
      );
    }

    const decodedToken = {
      uid: payload.sub,
      email: payload.email,
      name: payload.name,
    };

    const userSnap = await this.userRepository.getUserByFirebaseUidOrEmail(
      decodedToken.uid,
      decodedToken.email || '',
    );

    let userData: any;
    if (!userSnap.empty) {
      const userDoc = userSnap.docs[0];
      await this.userRepository.updateUser(userDoc.id, {
        lastLogin: new Date(),
        firebaseUid: decodedToken.uid,
        authProvider: 'google',
        name: decodedToken.name,
      });
      userData = { id: userDoc.id, uid: decodedToken.uid, ...userDoc.data() };
    } else {
      const newUserData = {
        firebaseUid: decodedToken.uid,
        email: decodedToken.email,
        name: decodedToken.name || decodedToken.email,
        authProvider: 'google',
        lastLogin: new Date(),
      };
      const newUserId = await this.userRepository.createUser(newUserData);
      userData = { id: newUserId, uid: decodedToken.uid, ...newUserData };
    }

    return this.finalizeLogin(userData, decodedToken.uid, {
      ...clientInfo,
      expiresIn: GOOGLE_TOKEN_TTL,
    });
  }

  // Shared by Google login and password login: resolves the user's current
  // hospital, logs the sign-in, creates a session, and signs the app JWT.
  private async finalizeLogin(
    userData: any,
    uid: string,
    opts: { userAgent?: string; ip?: string; expiresIn: string },
  ) {
    const hospitals =
      await this.membershipRepository.getUserHospitalsWithDetails(userData.id);

    let currentHospital: any = null;
    const approvedHospital = hospitals.find(
      (h: any) => h.status === 'approved',
    );
    if (approvedHospital) {
      currentHospital = approvedHospital.hospital;
    } else if (hospitals.length > 0) {
      currentHospital = hospitals[0].hospital;
    }

    if (currentHospital) {
      await this.userRepository.updateUser(userData.id, {
        lastHospitalId: currentHospital.id,
      });

      const role = approvedHospital ? approvedHospital.role : undefined;
      if (role) {
        await this.auditService.log({
          hospitalId: currentHospital.id,
          actor: {
            userId: userData.id,
            name: userData.name || userData.email,
            role,
          },
          action: 'access.signed_in',
          area: 'access',
          summary: `Signed in`,
        });
      }
    }

    const sessionId = await this.sessionRepository.create({
      userId: userData.id,
      userAgent: opts.userAgent,
      ip: opts.ip,
    });

    const token = this.signToken(
      {
        uid,
        userId: userData.id,
        email: userData.email || '',
        name: userData.name || '',
        sid: sessionId,
      },
      opts.expiresIn,
    );

    return {
      success: true,
      token,
      user: sanitizeUser(userData),
      hospitals,
      currentHospital,
      mustChangePassword: !!userData.mustChangePassword,
    };
  }

  async loginWithPassword(
    username: string,
    password: string,
    opts: { keepSignedIn?: boolean; userAgent?: string; ip?: string } = {},
  ) {
    const userSnap = await this.userRepository.getUserByUsername(username);
    // Generic error for both "no such username" and "no/wrong password" so a
    // caller can't use this endpoint to enumerate valid usernames.
    if (!userSnap || !(userSnap as any).passwordHash) {
      throw ApiError.unauthorized('Invalid username or password');
    }

    const userId = (userSnap as any).id;
    const lockedUntil = (userSnap as any).lockedUntil;
    if (lockedUntil && new Date(lockedUntil) > new Date()) {
      const minutesLeft = Math.ceil((new Date(lockedUntil).getTime() - Date.now()) / 60000);
      throw ApiError.unauthorized(
        `Account locked. Try again in ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}.`,
      );
    }

    const isMatch = await bcrypt.compare(password, (userSnap as any).passwordHash);
    if (!isMatch) {
      const attemptCount = await this.userRepository.recordFailedLogin(
        userId,
        LOGIN_MAX_ATTEMPTS,
        LOGIN_LOCK_MS,
      );
      if (attemptCount >= LOGIN_MAX_ATTEMPTS) {
        throw ApiError.unauthorized(
          `Too many failed attempts. Account locked for ${LOGIN_LOCK_MS / 60000} minutes.`,
        );
      }
      const attemptsLeft = LOGIN_MAX_ATTEMPTS - attemptCount;
      throw ApiError.unauthorized(
        `That password doesn't match. ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} left before the account locks for ${LOGIN_LOCK_MS / 60000} minutes.`,
        { attemptsLeft },
      );
    }

    await this.userRepository.resetFailedLogins(userId);
    await this.userRepository.updateUser(userId, { lastLogin: new Date() });

    return this.finalizeLogin(userSnap, userId, {
      userAgent: opts.userAgent,
      ip: opts.ip,
      expiresIn: opts.keepSignedIn ? KEEP_SIGNED_IN_TOKEN_TTL : DEFAULT_PASSWORD_TOKEN_TTL,
    });
  }

  private async resolvePhoneForUser(userId: string): Promise<string | null> {
    const doctorProfile = await this.doctorRepository.getDoctorProfileByUserId(userId);
    if ((doctorProfile as any)?.phone) return (doctorProfile as any).phone;

    const teamProfile = await this.teamMemberRepository.getByUserId(userId);
    if ((teamProfile as any)?.phone) return (teamProfile as any).phone;

    return null;
  }

  async requestPasswordOtp(username: string, _channel: 'sms' | 'whatsapp') {
    const userSnap = await this.userRepository.getUserByUsername(username);
    if (!userSnap) {
      throw ApiError.badRequest('No account found for that username');
    }
    const userId = (userSnap as any).id;

    const phone = await this.resolvePhoneForUser(userId);
    if (!phone) {
      throw ApiError.badRequest(
        'No phone number on file for this account — ask your hospital admin to reset your password from the Team screen.',
      );
    }

    const now = Date.now();
    const otpSentAt = (userSnap as any).otpSentAt;
    if (otpSentAt && now - new Date(otpSentAt).getTime() < OTP_RESEND_COOLDOWN_MS) {
      throw ApiError.conflict('Please wait before requesting another code');
    }

    const requestCount = await this.userRepository.bumpOtpRequestCount(userId);
    if (requestCount > OTP_MAX_REQUESTS_PER_WINDOW) {
      throw ApiError.conflict('Too many code requests — please try again later');
    }

    const otp = generateOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    await this.userRepository.setOtp(userId, otpHash, new Date(now + OTP_TTL_MS));

    // Both delivery channels route through the same placeholder SMS sender —
    // there's no real WhatsApp Business integration wired up anywhere in this
    // codebase yet, same limitation SmsService already has for plain SMS.
    await this.smsService.sendSms({
      to: normalizePhone(phone),
      message: `Your Agam Plus verification code is ${otp}. It expires in 5 minutes.`,
    });

    return { success: true, maskedPhone: maskPhone(phone) };
  }

  async verifyPasswordOtp(username: string, otp: string) {
    const userSnap = await this.userRepository.getUserByUsername(username);
    if (!userSnap || !(userSnap as any).otpHash) {
      throw ApiError.unauthorized('No pending code for this account — request a new one');
    }
    const userId = (userSnap as any).id;

    if (((userSnap as any).otpAttempts || 0) >= OTP_MAX_ATTEMPTS) {
      throw ApiError.unauthorized('Too many incorrect attempts — please request a new code');
    }

    if (
      !(userSnap as any).otpExpiresAt ||
      new Date((userSnap as any).otpExpiresAt).getTime() < Date.now()
    ) {
      throw ApiError.unauthorized('Code has expired — please request a new one');
    }

    const matches = await bcrypt.compare(otp, (userSnap as any).otpHash);
    if (!matches) {
      await this.userRepository.incrementOtpAttempts(userId);
      throw ApiError.unauthorized('Incorrect code');
    }

    await this.userRepository.clearOtp(userId);

    const token = crypto.randomBytes(32).toString('hex');
    await this.userRepository.updateUser(userId, {
      passwordResetTokenHash: hashToken(token),
      passwordResetExpires: new Date(Date.now() + OTP_RESET_TOKEN_TTL_MS),
    });

    return { success: true, resetToken: token };
  }

  async listSessions(user: JwtUser) {
    const sessions = await this.sessionRepository.getActiveByUser(user.userId);
    return {
      sessions: sessions.map((s: any) => ({
        id: s.id,
        device: describeUserAgent(s.userAgent),
        ip: s.ip || null,
        createdAt: s.createdAt,
        lastUsedAt: s.lastUsedAt,
        current: s.id === user.sid,
      })),
    };
  }

  async revokeSession(user: JwtUser, sessionId: string) {
    const session = await this.sessionRepository.getById(sessionId);
    if (!session || (session as any).userId !== user.userId) {
      throw ApiError.notFound('Session not found');
    }
    await this.sessionRepository.revoke(sessionId);
    return { success: true };
  }

  async revokeOtherSessions(user: JwtUser) {
    await this.sessionRepository.revokeAllExcept(user.userId, user.sid);
    return { success: true };
  }

  async forgotPassword(username: string) {
    const userSnap = await this.userRepository.getUserByUsername(username);
    // Always respond the same way regardless of whether the username exists,
    // so this endpoint can't be used to enumerate valid usernames.
    if (userSnap) {
      const token = crypto.randomBytes(32).toString('hex');
      await this.userRepository.updateUser((userSnap as any).id, {
        passwordResetTokenHash: hashToken(token),
        passwordResetExpires: new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS),
      });

      const appUrl = this.config.get<string>('NEXT_PUBLIC_APP_URL') || 'https://yourhospital.com';
      const resetLink = `${appUrl}/reset-password?token=${token}`;
      try {
        await this.emailService.sendPasswordResetEmail(
          (userSnap as any).email,
          (userSnap as any).name || (userSnap as any).username,
          resetLink,
        );
      } catch (err) {
        console.error('Failed to send password reset email:', err);
      }
    }

    return { success: true, message: 'If that account exists, a reset link has been sent.' };
  }

  async resetPassword(token: string, newPassword: string) {
    const userSnap = await this.userRepository.getUserByPasswordResetTokenHash(hashToken(token));
    if (!userSnap || !(userSnap as any).passwordResetExpires || new Date((userSnap as any).passwordResetExpires) < new Date()) {
      throw ApiError.badRequest('This reset link is invalid or has expired');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    const userId = (userSnap as any).id;
    await this.userRepository.updateUser(userId, {
      passwordHash,
      mustChangePassword: false,
      passwordResetTokenHash: null,
      passwordResetExpires: null,
    });
    await this.userRepository.resetFailedLogins(userId);
    // A password reset always signs the account out everywhere — there's no
    // "current session" to keep, since this request itself isn't signed in.
    await this.sessionRepository.revokeAll(userId);

    return { success: true };
  }

  async changePassword(
    user: JwtUser,
    currentPassword: string,
    newPassword: string,
    signOutOthers?: boolean,
  ) {
    const userDoc = await this.userRepository.getUserById(user.userId);
    if (!userDoc || !(userDoc as any).passwordHash) {
      throw ApiError.badRequest('No password set for this account yet — use "Forgot password" instead');
    }

    const isMatch = await bcrypt.compare(currentPassword, (userDoc as any).passwordHash);
    if (!isMatch) {
      throw ApiError.badRequest('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.userRepository.updateUser(user.userId, {
      passwordHash,
      mustChangePassword: false,
    });

    if (signOutOthers) {
      await this.sessionRepository.revokeAllExcept(user.userId, user.sid);
    }

    return { success: true };
  }

  async getMe(user: JwtUser) {
    const userDoc = await this.userRepository.getUserById(user.userId);
    if (!userDoc) {
      throw ApiError.notFound('User not found');
    }

    const userData = {
      ...sanitizeUser(userDoc),
      uid: user.uid,
      hasPassword: !!(userDoc as any).passwordHash,
    };

    const hospitals =
      await this.membershipRepository.getUserHospitalsWithDetails(user.userId, {
        formatJoinedAt: formatDate,
        includeAvailability: true,
      });

    let currentHospital: any = null;
    const lastHospitalId = userDoc.lastHospitalId;
    if (lastHospitalId) {
      currentHospital =
        await this.hospitalRepository.getHospitalById(lastHospitalId);
    }

    if (!currentHospital) {
      const approvedHospital = hospitals.find(
        (h: any) => h.status === 'approved',
      );
      if (approvedHospital) currentHospital = approvedHospital.hospital;
    }

    return { user: userData, hospitals, currentHospital };
  }

  async getSession(user: JwtUser) {
    const userDoc = await this.userRepository.getUserById(user.userId);
    const status = userDoc?.status || 'approved';

    return {
      user: {
        uid: user.uid,
        email: user.email,
        userId: user.userId,
        status,
      },
    };
  }

  async switchHospital(user: JwtUser, hospitalId: string) {
    const membershipData =
      await this.membershipRepository.getHospitalMembershipData(
        user.userId,
        hospitalId,
      );
    if (!membershipData) {
      throw ApiError.forbidden('No access to this hospital');
    }

    const userRole = membershipData.role || 'doctor';
    await this.userRepository.updateUser(user.userId, {
      lastHospitalId: hospitalId,
    });

    return { success: true, hospitalId, role: userRole };
  }

  async logout(user?: JwtUser) {
    if (user?.sid) {
      await this.sessionRepository.revoke(user.sid);
    }
    return { success: true, message: 'Logged out successfully' };
  }
}
