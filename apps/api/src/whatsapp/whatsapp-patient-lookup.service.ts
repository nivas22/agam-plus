import { Injectable, Logger } from '@nestjs/common';
import { PatientRepository } from '../repositories/patient.repository';
import { PatientAccountRepository } from '../repositories/patient-account.repository';
import { normalizePhone } from '../common/phone.util';

// Resolves a WhatsApp sender to a hospital-scoped Patient record.
//
// This deliberately does not go through PatientsService.createPatient: that
// path throws a 409 on any phone duplicate and waits for a human to confirm,
// which would strand an unattended WhatsApp user with no way forward.
@Injectable()
export class WhatsappPatientLookupService {
  private readonly logger = new Logger(WhatsappPatientLookupService.name);

  constructor(
    private readonly patientRepository: PatientRepository,
    private readonly patientAccountRepository: PatientAccountRepository,
  ) {}

  async findOrCreate(
    hospitalId: string,
    rawPhone: string,
    displayName: string,
  ): Promise<{ patientId: string; created: boolean }> {
    const phone = normalizePhone(rawPhone);
    const matches = await this.patientRepository.findPatientsByPhone(
      hospitalId,
      phone,
    );

    if (matches.length === 1) {
      return { patientId: matches[0].id, created: false };
    }

    // Legacy Patient.phone values were never normalized, so duplicates on the
    // same number do exist. Newest wins — it's the record staff most likely
    // touched last — and the appointment stays PENDING for them to correct.
    if (matches.length > 1) {
      this.logger.warn(
        `${matches.length} patients share phone ${phone} at hospital ${hospitalId}; using the most recent`,
      );
      const newest = [...matches].sort(
        (a, b) =>
          new Date(b.createdAt ?? 0).getTime() -
          new Date(a.createdAt ?? 0).getTime(),
      )[0];
      return { patientId: newest.id, created: false };
    }

    // Patient.email is required by the schema and WhatsApp never gives us one.
    // The placeholder is greppable and staff can replace it from the patient
    // screen once the person turns up.
    const account = await this.patientAccountRepository.getByPhone(phone);
    const patientId = await this.patientRepository.createPatient({
      hospitalId,
      patientId: this.generatePatientId(),
      name: displayName?.trim() || 'WhatsApp Patient',
      email: `wa-${phone}@whatsapp.local`,
      phone,
      status: 'active',
      createdBy: 'whatsapp-bot',
      ...(account?.verifiedAt ? { patientAccountId: account.id } : {}),
    });

    return { patientId, created: true };
  }

  private generatePatientId(): string {
    return String(Math.floor(100000 + Math.random() * 900000));
  }
}
