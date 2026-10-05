import { Injectable } from '@nestjs/common';
import { ApiError } from '../common/errors/api-error';
import type { HospitalUserProfile } from '../auth/decorators/current-user.decorator';
import { AppointmentRepository } from '../repositories/appointment.repository';
import { PatientRepository } from '../repositories/patient.repository';
import { PrescriptionRepository } from '../repositories/prescription.repository';
import { GeminiService } from './gemini.service';
import type { GenerateSessionNotesBody } from './ai-notes.types';

const SYSTEM_INSTRUCTION = `You are a clinical documentation assistant for doctors at an outpatient clinic in India.
Turn the doctor's rough consultation notes into a clean, concise consultation note.

Rules:
- Use ONLY information given in the doctor's notes and the visit context. Never invent symptoms, findings, diagnoses, test results, medicines or doses.
- Keep the doctor's clinical meaning exactly. Expand common abbreviations only when unambiguous (e.g. "c/o" -> "complains of", "x 3d" -> "for 3 days").
- Use these headings, each on its own line followed by a colon, and leave out any heading with nothing to put under it:
  Chief complaint, History, Examination, Assessment, Plan, Follow-up
- Include vitals under Examination when provided. Mention known allergies under Plan only if relevant to treatment.
- Under Plan, summarise the prescription if one is given.
- Plain text only: no markdown, no asterisks, no bold. Short lines or "- " bullets.
- Output only the note — no preamble, no disclaimers, no patient name.`;

type Vitals = {
  bpSystolic?: number;
  bpDiastolic?: number;
  spo2?: number;
  pulse?: number;
  weight?: number;
  temperature?: number;
  height?: number;
};

@Injectable()
export class AiNotesService {
  constructor(
    private readonly appointmentRepository: AppointmentRepository,
    private readonly patientRepository: PatientRepository,
    private readonly prescriptionRepository: PrescriptionRepository,
    private readonly geminiService: GeminiService,
  ) {}

  async generateSessionNotes(hospitalId: string, userProfile: HospitalUserProfile, body: GenerateSessionNotesBody) {
    const appointment = (await this.appointmentRepository.getAppointmentById(body.appointmentId)) as any;
    if (!appointment || appointment.hospitalId !== hospitalId) {
      throw ApiError.notFound('Appointment not found');
    }
    if (userProfile?.role === 'doctor' && appointment.doctorProfileId !== userProfile.userId) {
      throw ApiError.forbidden('You can only write notes for your own appointments');
    }

    const [patient, prescription, previousNotes] = await Promise.all([
      appointment.patientId ? this.patientRepository.getPatientById(appointment.patientId) : null,
      this.prescriptionRepository.getByAppointment(hospitalId, appointment.id),
      this.getPreviousVisitNotes(hospitalId, appointment),
    ]);

    const prompt = this.buildPrompt(body.draft, appointment, patient as any, prescription as any, previousNotes);
    const notes = await this.geminiService.generateText({ systemInstruction: SYSTEM_INSTRUCTION, prompt });
    return { notes };
  }

  // Most recent earlier visit of the same patient at this hospital that has
  // notes — gives the model continuity ("follow-up of ...") without the
  // doctor retyping it.
  private async getPreviousVisitNotes(hospitalId: string, appointment: any): Promise<string | undefined> {
    if (!appointment.patientId) return undefined;
    const visits = await this.appointmentRepository.getAppointmentsWithFilters({
      hospitalId,
      patientId: appointment.patientId,
    });
    const previous = (visits as any[])
      .filter((v) => v.id !== appointment.id && v.sessionNotes && v.date <= appointment.date)
      .pop();
    return previous ? `${previous.date}: ${String(previous.sessionNotes).slice(0, 1500)}` : undefined;
  }

  // Deliberately leaves out name, phone, address and IDs — the model only
  // needs clinical context to format the note.
  private buildPrompt(draft: string, appointment: any, patient: any, prescription: any, previousNotes?: string) {
    const lines: string[] = ['VISIT CONTEXT'];

    const age = appointment.patientAge ?? patient?.age;
    const gender = appointment.patientGender || patient?.gender;
    if (age || gender) lines.push(`Patient: ${[age ? `${age} years` : '', gender || ''].filter(Boolean).join(', ')}`);
    if (appointment.doctorSpecialization) lines.push(`Doctor specialty: ${appointment.doctorSpecialization}`);

    const vitals = this.formatVitals(appointment.vitals);
    if (vitals) lines.push(`Vitals: ${vitals}`);
    if (patient?.allergies?.length) lines.push(`Known allergies: ${patient.allergies.join(', ')}`);
    if (patient?.conditions?.length) lines.push(`Known conditions: ${patient.conditions.join(', ')}`);

    const rx = this.formatPrescription(prescription);
    if (rx) lines.push(`Prescription for this visit:\n${rx}`);
    if (previousNotes) lines.push(`Previous visit notes (for context only):\n${previousNotes}`);

    lines.push('', "DOCTOR'S ROUGH NOTES", draft.trim());
    return lines.join('\n');
  }

  private formatVitals(vitals?: Vitals): string {
    if (!vitals) return '';
    const parts: string[] = [];
    if (vitals.bpSystolic != null && vitals.bpDiastolic != null) parts.push(`BP ${vitals.bpSystolic}/${vitals.bpDiastolic} mmHg`);
    if (vitals.pulse != null) parts.push(`Pulse ${vitals.pulse} bpm`);
    if (vitals.spo2 != null) parts.push(`SpO2 ${vitals.spo2}%`);
    if (vitals.temperature != null) parts.push(`Temp ${vitals.temperature}°F`);
    if (vitals.weight != null) parts.push(`Weight ${vitals.weight} kg`);
    if (vitals.height != null) parts.push(`Height ${vitals.height} cm`);
    return parts.join(', ');
  }

  private formatPrescription(prescription: any): string {
    const items: any[] = prescription?.items ?? [];
    const rows = items.map((item) =>
      `- ${[item.medicineName, item.strength, item.dose, item.frequency, item.foodTiming, item.duration]
        .filter(Boolean)
        .join(' ')}`,
    );
    if (prescription?.advice) rows.push(`Advice: ${prescription.advice}`);
    return rows.join('\n');
  }
}
