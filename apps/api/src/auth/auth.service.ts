import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { FIREBASE_AUTH } from '../firebase/firebase.constants';
import { UserRepository } from '../repositories/user.repository';
import { MembershipRepository } from '../repositories/membership.repository';
import { HospitalRepository } from '../repositories/hospital.repository';
import { ApiError } from '../common/errors/api-error';
import { JwtUser } from './decorators/current-user.decorator';

const formatDate = (value: any) => {
  if (!value?._seconds) return value;
  return new Date(value._seconds * 1000).toLocaleDateString();
};

@Injectable()
export class AuthService {
  constructor(
    @Inject(FIREBASE_AUTH) private readonly firebaseAuth: import('firebase-admin').auth.Auth,
    private readonly config: ConfigService,
    private readonly userRepository: UserRepository,
    private readonly membershipRepository: MembershipRepository,
    private readonly hospitalRepository: HospitalRepository,
  ) {}

  private signToken(payload: JwtUser): string {
    return jwt.sign(payload, this.config.get<string>('JWT_SECRET')!, { expiresIn: '7d' });
  }

  async login(idToken: string) {
    const decodedToken = await this.firebaseAuth.verifyIdToken(idToken);

    if (new Date().getTime() / 1000 - decodedToken.auth_time > 5 * 60) {
      throw ApiError.unauthorized('Recent sign in required');
    }

    const userSnap = await this.userRepository.getUserByFirebaseUidOrEmail(decodedToken.uid, decodedToken.email || '');

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

    const hospitals = await this.membershipRepository.getUserHospitalsWithDetails(userData.id);

    let currentHospital: any = null;
    const approvedHospital = hospitals.find((h: any) => h.status === 'approved');
    if (approvedHospital) {
      currentHospital = approvedHospital.hospital;
    } else if (hospitals.length > 0) {
      currentHospital = hospitals[0].hospital;
    }

    if (currentHospital) {
      await this.userRepository.updateUser(userData.id, { lastHospitalId: currentHospital.id });
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

    const hospitals = await this.membershipRepository.getUserHospitalsWithDetails(user.userId, {
      formatJoinedAt: formatDate,
      includeAvailability: true,
    });

    let currentHospital: any = null;
    const lastHospitalId = (userDoc as any).lastHospitalId;
    if (lastHospitalId) {
      currentHospital = await this.hospitalRepository.getHospitalById(lastHospitalId);
    }

    if (!currentHospital) {
      const approvedHospital = hospitals.find((h: any) => h.status === 'approved');
      if (approvedHospital) currentHospital = approvedHospital.hospital;
    }

    return { user: userData, hospitals, currentHospital };
  }

  async getSession(user: JwtUser) {
    const userDoc = await this.userRepository.getUserById(user.userId);
    const status = (userDoc as any)?.status || 'approved';

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
    const membershipData = await this.membershipRepository.getHospitalMembershipData(user.userId, hospitalId);
    if (!membershipData) {
      throw ApiError.forbidden('No access to this hospital');
    }

    const userRole = (membershipData as any).role || 'doctor';
    await this.userRepository.updateUser(user.userId, { lastHospitalId: hospitalId });

    return { success: true, hospitalId, role: userRole };
  }

  logout() {
    return { success: true, message: 'Logged out successfully' };
  }
}
