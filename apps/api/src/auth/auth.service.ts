import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { UserRepository } from '../repositories/user.repository';
import { MembershipRepository } from '../repositories/membership.repository';
import { HospitalRepository } from '../repositories/hospital.repository';
import { AuditService } from '../audit/audit.service';
import { ApiError } from '../common/errors/api-error';
import { JwtUser } from './decorators/current-user.decorator';

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
    private readonly auditService: AuditService,
  ) {
    this.googleClient = new OAuth2Client(
      this.config.get<string>('GOOGLE_CLIENT_ID'),
    );
  }

  private signToken(payload: JwtUser): string {
    return jwt.sign(payload, this.config.get<string>('JWT_SECRET')!, {
      expiresIn: '7d',
    });
  }

  async login(idToken: string) {
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

    const token = this.signToken({
      uid: decodedToken.uid,
      userId: userData.id,
      email: decodedToken.email || '',
      name: decodedToken.name || '',
    });

    return { success: true, token, user: userData, hospitals, currentHospital };
  }

  async getMe(user: JwtUser) {
    const userDoc = await this.userRepository.getUserById(user.userId);
    if (!userDoc) {
      throw ApiError.notFound('User not found');
    }

    const userData = { ...userDoc, uid: user.uid };

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

  logout() {
    return { success: true, message: 'Logged out successfully' };
  }
}
