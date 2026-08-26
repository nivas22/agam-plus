import { Injectable } from '@nestjs/common';
import { PatientRepository } from '../repositories/patient.repository';
import { PatientAccountRepository } from '../repositories/patient-account.repository';
import { ApiError } from '../common/errors/api-error';
import { JwtUser } from '../auth/decorators/current-user.decorator';
import { normalizePhone } from '../common/phone.util';

const generatePatientId = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

@Injectable()
export class PatientsService {
  constructor(
    private readonly patientRepository: PatientRepository,
    private readonly patientAccountRepository: PatientAccountRepository,
  ) {}

  async listPatients(
    hospitalId: string,
    status: string | undefined,
    page: number,
    limit: number,
  ) {
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

    const patients: any[] = [];

    for (const profile of patientProfiles) {
      const prof = profile as any;
      const patientStatus = prof.status || 'active';
      if (status && patientStatus !== status) continue;

      patients.push({
        id: prof.id,
        hospitalId,
        patientId: prof.patientId || null,
        status: patientStatus,

        name: prof.name || 'Unknown Patient',
        dateOfBirth: prof.dateOfBirth || '',
        email: prof.email || 'No email',
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

    const normalizedPhone = patientData.phone
      ? normalizePhone(patientData.phone)
      : '';

    if (!patientData.confirmDuplicate && normalizedPhone) {
      const duplicates = await this.patientRepository.findPatientsByPhone(
        hospitalId,
        normalizedPhone,
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

    const emailExists = await this.patientRepository.patientExistsByEmail(
      hospitalId,
      patientData.email,
    );
    if (emailExists) {
      throw ApiError.conflict(
        `A patient with email ${patientData.email} already exists in this hospital`,
      );
    }

    const generatedPatientId = generatePatientId();

    // If this phone already belongs to a verified PatientAccount (the patient
    // app), link immediately — covers an app user visiting a new hospital as
    // a walk-in before ever booking through the app.
    const existingAccount = normalizedPhone
      ? await this.patientAccountRepository.getByPhone(normalizedPhone)
      : null;

    const patientProfileData = {
      hospitalId,
      patientId: generatedPatientId,
      patientAccountId: existingAccount?.verifiedAt
        ? existingAccount.id
        : undefined,
      name: patientData.name,
      email: patientData.email,
      dateOfBirth: patientData.dateOfBirth || '',
      phone: normalizedPhone || patientData.phone || '',
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
        hospitalId,
        name: patientData.name,
        email: patientData.email,
        status: 'active',
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
