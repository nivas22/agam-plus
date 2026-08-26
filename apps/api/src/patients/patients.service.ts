import { Injectable } from '@nestjs/common';
import { PatientRepository } from '../repositories/patient.repository';
import { UserRepository } from '../repositories/user.repository';
import { MembershipRepository } from '../repositories/membership.repository';
import { ApiError } from '../common/errors/api-error';
import { ROLE, MEMBERSHIP_STATUS } from '../constants';
import { JwtUser } from '../auth/decorators/current-user.decorator';

const generatePatientId = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

@Injectable()
export class PatientsService {
  constructor(
    private readonly patientRepository: PatientRepository,
    private readonly userRepository: UserRepository,
    private readonly membershipRepository: MembershipRepository,
  ) {}

  async listPatients(
    hospitalId: string,
    requesterUserId: string,
    status: string | undefined,
    page: number,
    limit: number,
  ) {
    // Source "who is a patient here" from the Patient collection itself, not
    // from a role='patient' hospital membership. A user can only hold one
    // membership per hospital (unique index on userId+hospitalId), so a
    // doctor who is also registered as a patient at this hospital has no
    // 'patient'-role membership row — but their Patient profile is real and
    // must still show up here, be searchable, and be bookable.
    const patientProfiles =
      await this.patientRepository.getPatientsByHospitalId(hospitalId);

    if (patientProfiles.length === 0) {
      return {
        patients: [],
        total: 0,
        hospitalId,
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      };
    }

    const patientMembers = await this.membershipRepository.getHospitalMembers(
      hospitalId,
      { role: ROLE.PATIENT },
    );
    const membershipByUserId = new Map(
      patientMembers.map((m: any) => [m.userId, m]),
    );

    const patients: any[] = [];

    for (const profile of patientProfiles) {
      const prof = profile as any;
      if (!prof.userId || prof.userId === requesterUserId) continue;

      const membership = membershipByUserId.get(prof.userId) as any;
      // No membership row (the doctor-also-patient case) is treated the same
      // as today's default for a patient created via the front desk: approved.
      const membershipStatus = membership?.status || 'approved';
      if (status && membershipStatus !== status) continue;

      const userData = await this.userRepository.getUserById(prof.userId);
      const user = userData as any;

      patients.push({
        id: prof.id || prof.userId,
        hospitalId,
        userId: prof.userId,
        patientId: prof.patientId || null,
        membershipId: membership?.id || null,
        membershipStatus,
        status: membershipStatus,

        name: prof.name || user?.name || 'Unknown Patient',
        dateOfBirth: prof.dateOfBirth || '',
        email: user?.email || prof.email || 'No email',
        phone: prof.phone || '',
        secondaryPhone: prof.secondaryPhone || '',
        age: prof.age || null,
        gender: prof.gender || null,
        address: prof.address || '',
        medicalHistory: prof.medicalHistory || '',
        bloodGroup: prof.bloodGroup || null,
        allergies: Array.isArray(prof.allergies) ? prof.allergies : [],
        createdAt: prof.createdAt || null,
      });
    }

    const sortedPatients = patients.sort((a, b) => {
      const nameA = a.name?.toLowerCase() || '';
      const nameB = b.name?.toLowerCase() || '';
      return nameA.localeCompare(nameB);
    });

    const total = sortedPatients.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedPatients = sortedPatients.slice(startIndex, endIndex);

    return {
      patients: paginatedPatients,
      total,
      hospitalId,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  async searchPatients(hospitalId: string, searchTerm: string) {
    const q = (searchTerm || '').trim();
    if (q.length < 2) {
      return { patients: [], total: 0 };
    }

    const patients = await this.patientRepository.searchPatientsByHospital(
      hospitalId,
      q,
    );
    return { patients, total: patients.length };
  }

  async createPatient(
    hospitalId: string,
    user: JwtUser,
    patientData: Record<string, any>,
  ) {
    const requiredFields = ['name', 'email', 'phone'];
    const missingFields = requiredFields.filter((f) => !patientData[f]);
    if (missingFields.length > 0) {
      throw ApiError.badRequest(
        `Missing required fields: ${missingFields.join(', ')}`,
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(patientData.email)) {
      throw ApiError.badRequest('Invalid email format');
    }

    if (!patientData.confirmDuplicate && patientData.phone) {
      const duplicates = await this.patientRepository.findPatientsByPhone(
        hospitalId,
        patientData.phone,
      );
      if (duplicates.length > 0) {
        throw ApiError.conflict(
          `A patient with phone ${patientData.phone} already exists in this hospital`,
          {
            duplicates: duplicates.map((d: any) => ({
              id: d.id,
              name: d.name,
              phone: d.phone,
              patientId: d.patientId,
              status: d.status,
            })),
          },
        );
      }
    }

    const existingUser = await this.userRepository.getUserByEmail(
      patientData.email,
    );

    let patientUserId: string;
    if (!existingUser) {
      patientUserId = await this.userRepository.createUser({
        email: patientData.email,
        name: patientData.name,
      });
    } else {
      patientUserId = (existingUser as any).id;
    }

    const existingMembership =
      await this.membershipRepository.getHospitalMembershipData(
        patientUserId,
        hospitalId,
      );

    if (!existingMembership) {
      await this.membershipRepository.createHospitalMembership({
        hospitalId,
        userId: patientUserId,
        role: ROLE.PATIENT,
        status: MEMBERSHIP_STATUS.APPROVED,
        invitedBy: user.uid,
      });
    }

    const generatedPatientId = generatePatientId();

    const patientProfileData = {
      userId: patientUserId,
      hospitalId,
      patientId: generatedPatientId,
      name: patientData.name,
      email: patientData.email,
      dateOfBirth: patientData.dateOfBirth || '',
      phone: patientData.phone || '',
      secondaryPhone: patientData.secondaryPhone || '',
      age: patientData.age || null,
      gender: patientData.gender || null,
      bloodGroup: patientData.bloodGroup || null,
      address: patientData.address || '',
      medicalHistory: patientData.medicalHistory || '',
      allergies: Array.isArray(patientData.allergies)
        ? patientData.allergies.filter(Boolean)
        : [],
      lookingForSpecialization: patientData.lookingForSpecialization || null,
      status: 'active',
      createdBy: user.uid,
    };

    const patientId =
      await this.patientRepository.createPatient(patientProfileData);

    return {
      success: true,
      patient: {
        id: patientId,
        profileId: patientId,
        patientId: generatedPatientId,
        userId: patientUserId,
        hospitalId,
        name: patientData.name,
        email: patientData.email,
        status: 'active',
        membershipStatus: 'approved',
        allergies: patientProfileData.allergies,
      },
    };
  }

  async getPatient(hospitalId: string, patientId: string) {
    const patient = await this.patientRepository.getPatientById(patientId);

    if (!patient || (patient as any).hospitalId !== hospitalId) {
      throw ApiError.notFound('Patient not found in this hospital');
    }

    return { patient };
  }

  async updatePatient(
    hospitalId: string,
    patientId: string,
    updates: Record<string, any>,
  ) {
    const patient = await this.patientRepository.getPatientById(patientId);

    if (!patient || (patient as any).hospitalId !== hospitalId) {
      throw ApiError.notFound('Patient not found in this hospital');
    }

    if (updates.email && updates.email !== (patient as any).email) {
      const emailExists = await this.patientRepository.patientExistsByEmail(
        hospitalId,
        updates.email,
      );

      if (emailExists) {
        throw ApiError.conflict(
          'Another patient with this email already exists in this hospital',
        );
      }

      // listPatients reads email from the linked User doc first, falling back to
      // the profile — keep them in sync or the list keeps showing the old email.
      const userId = (patient as any).userId;
      if (userId) {
        await this.userRepository.updateUser(userId, { email: updates.email });
      }
    }

    const updateData = { ...updates, updatedAt: new Date().toISOString() };
    await this.patientRepository.updatePatient(patientId, updateData);

    const updatedPatient =
      await this.patientRepository.getPatientById(patientId);

    return { success: true, patient: updatedPatient };
  }

  async deletePatient(
    hospitalId: string,
    patientId: string,
    deletedBy: string,
  ) {
    const patient = await this.patientRepository.getPatientById(patientId);

    if (!patient || (patient as any).hospitalId !== hospitalId) {
      throw ApiError.notFound('Patient not found in this hospital');
    }

    await this.patientRepository.deletePatient(patientId, deletedBy);

    return { success: true, message: 'Patient archived successfully' };
  }
}
