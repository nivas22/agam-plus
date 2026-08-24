import { Injectable } from '@nestjs/common';
import { PrescriptionRepository } from '../repositories/prescription.repository';
import { AppointmentRepository } from '../repositories/appointment.repository';
import { PatientRepository } from '../repositories/patient.repository';
import { MedicineRepository } from '../repositories/medicine.repository';
import { AuditService } from '../audit/audit.service';
import { ApiError } from '../common/errors/api-error';
import { PRESCRIPTION_STATUS } from '../constants';
import { HospitalUserProfile } from '../auth/decorators/current-user.decorator';

interface PrescriptionItemInput {
  medicineId: string;
  medicineName: string;
  strength?: string;
  form?: string;
  dose: string;
  frequency?: string;
  foodTiming?: string;
  duration?: string;
  quantity?: string;
  note?: string;
}

interface AllergyOverrideInput {
  medicineId: string;
  medicineName: string;
  matchedAllergyTerm: string;
  reason: string;
}

interface SavePrescriptionData {
  items: PrescriptionItemInput[];
  allergyOverrides: AllergyOverrideInput[];
  advice?: string;
}

// Bidirectional substring match, lowercased — catches both a patient allergy
// that names a drug class ("Penicillin" matching a medicine tagged
// "penicillin") and one that names the medicine itself.
function findAllergyMatch(allergies: string[], medicine: any): string | null {
  const haystacks = [medicine.name, medicine.genericName, ...(medicine.classes || [])]
    .filter(Boolean)
    .map((s: string) => s.toLowerCase());

  for (const rawAllergy of allergies) {
    const allergy = rawAllergy.trim().toLowerCase();
    if (!allergy) continue;
    const matches = haystacks.some(
      (h) => h.includes(allergy) || allergy.includes(h),
    );
    if (matches) return rawAllergy;
  }
  return null;
}

@Injectable()
export class PrescriptionsService {
  constructor(
    private readonly prescriptionRepository: PrescriptionRepository,
    private readonly appointmentRepository: AppointmentRepository,
    private readonly patientRepository: PatientRepository,
    private readonly medicineRepository: MedicineRepository,
    private readonly auditService: AuditService,
  ) {}

  private async getVerifiedAppointment(hospitalId: string, appointmentId: string) {
    const appointment = await this.appointmentRepository.getAppointmentById(appointmentId);
    if (!appointment || (appointment as any).hospitalId !== hospitalId) {
      throw ApiError.notFound('Appointment not found in this hospital');
    }
    return appointment as any;
  }

  async getPrescription(hospitalId: string, appointmentId: string) {
    await this.getVerifiedAppointment(hospitalId, appointmentId);
    const prescription = await this.prescriptionRepository.getByAppointment(hospitalId, appointmentId);
    return { prescription: prescription || null };
  }

  // Re-derives every allergy conflict server-side even though the writer UI
  // already checks client-side — a client bug or a stale medicine list
  // client-side can't be trusted to enforce a safety check on its own.
  async save(
    hospitalId: string,
    appointmentId: string,
    actor: HospitalUserProfile,
    data: SavePrescriptionData,
  ) {
    const appointment = await this.getVerifiedAppointment(hospitalId, appointmentId);
    const patient = await this.patientRepository.getPatientById(appointment.patientId);
    const allergies: string[] = (patient as any)?.allergies || [];

    const medicineIds = [...new Set(data.items.map((i) => i.medicineId))];
    const medicines = await this.medicineRepository.getByIds(hospitalId, medicineIds);
    const medicineById = new Map(medicines.map((m: any) => [m.id, m]));

    const overrideByMedicineId = new Map(
      data.allergyOverrides.map((o) => [o.medicineId, o]),
    );

    if (allergies.length > 0) {
      for (const item of data.items) {
        const medicine = medicineById.get(item.medicineId);
        if (!medicine) continue;
        const matchedTerm = findAllergyMatch(allergies, medicine);
        if (matchedTerm && !overrideByMedicineId.has(item.medicineId)) {
          throw ApiError.badRequest(
            `${item.medicineName} conflicts with this patient's "${matchedTerm}" allergy — override with a reason to proceed`,
          );
        }
      }
    }

    const allergyOverrides = data.allergyOverrides.map((o) => ({
      ...o,
      overriddenAt: new Date(),
    }));

    const prescription = await this.prescriptionRepository.createOrUpdate(
      hospitalId,
      appointmentId,
      {
        patientId: appointment.patientId,
        doctorProfileId: appointment.doctorProfileId,
        patientName: appointment.patientName,
        doctorName: appointment.doctorName,
        status: PRESCRIPTION_STATUS.DRAFT,
        createdBy: actor.userId,
      },
      {
        items: data.items,
        allergyOverrides,
        advice: data.advice,
      },
    );

    await this.auditService.log({
      hospitalId,
      actor: { userId: actor.userId, name: actor.name, role: actor.role },
      action: 'prescription.saved',
      area: 'patients',
      summary: `Saved a prescription for ${appointment.patientName} (${data.items.length} item${data.items.length === 1 ? '' : 's'})`,
    });

    return prescription;
  }

  async setStatus(
    hospitalId: string,
    appointmentId: string,
    actor: HospitalUserProfile,
    status: 'draft' | 'signed',
  ) {
    const appointment = await this.getVerifiedAppointment(hospitalId, appointmentId);
    const existing = await this.prescriptionRepository.getByAppointment(hospitalId, appointmentId);
    if (!existing) throw ApiError.notFound('No prescription to update for this appointment');

    const updates: Record<string, any> = { status };
    if (status === PRESCRIPTION_STATUS.SIGNED) updates.issuedAt = new Date();

    const updated = await this.prescriptionRepository.updateFields(hospitalId, existing.id, updates);

    await this.auditService.log({
      hospitalId,
      actor: { userId: actor.userId, name: actor.name, role: actor.role },
      action: status === PRESCRIPTION_STATUS.SIGNED ? 'prescription.signed' : 'prescription.reopened',
      area: 'patients',
      summary: `${status === PRESCRIPTION_STATUS.SIGNED ? 'Signed' : 'Reopened'} the prescription for ${appointment.patientName}`,
    });

    return updated;
  }
}
