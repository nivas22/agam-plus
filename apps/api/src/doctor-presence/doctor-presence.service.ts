import { Injectable } from '@nestjs/common';
import { DoctorPresenceRepository } from '../repositories/doctor-presence.repository';
import { DoctorRepository } from '../repositories/doctor.repository';
import { MembershipRepository } from '../repositories/membership.repository';
import { AuditService } from '../audit/audit.service';
import { ApiError } from '../common/errors/api-error';
import type { HospitalUserProfile } from '../auth/decorators/current-user.decorator';

export interface SetDoctorPresenceBody {
  date: string;
  kind: 'here' | 'runningLate' | 'onBreak' | 'notIn' | 'leftForDay';
  expectedTime?: string;
  returnTime?: string;
  reason?: string;
  toldBy?: string;
  note?: string;
}

const KIND_LABEL: Record<SetDoctorPresenceBody['kind'], string> = {
  here: "here",
  runningLate: 'running late',
  onBreak: 'on break',
  notIn: 'not coming in today',
  leftForDay: 'left for the day',
};

@Injectable()
export class DoctorPresenceService {
  constructor(
    private readonly presenceRepository: DoctorPresenceRepository,
    private readonly doctorRepository: DoctorRepository,
    private readonly membershipRepository: MembershipRepository,
    private readonly auditService: AuditService,
  ) {}

  async getForDate(hospitalId: string, date: string) {
    const docs = await this.presenceRepository.getForDate(hospitalId, date);
    const overrides: Record<string, any> = {};
    for (const d of docs) {
      overrides[d.doctorId] = {
        kind: d.kind,
        expectedTime: d.expectedTime,
        returnTime: d.returnTime,
        reason: d.reason,
        toldBy: d.toldBy,
        note: d.note,
        setBy: d.setByName,
        setAt: d.setAt,
      };
    }
    return { overrides };
  }

  async setPresence(
    hospitalId: string,
    doctorId: string,
    userProfile: HospitalUserProfile,
    body: SetDoctorPresenceBody,
  ) {
    if (body.kind === 'runningLate' && !body.expectedTime) {
      throw ApiError.badRequest('An expected time is required for "running late"');
    }
    if (body.kind === 'onBreak' && !body.returnTime) {
      throw ApiError.badRequest('A return time is required for "on break"');
    }
    if (body.kind === 'notIn' && !body.reason) {
      throw ApiError.badRequest('A reason is required for "not coming in today"');
    }

    // DoctorProfile._id is the owning user's id (see doctor-profile.schema.ts),
    // so hospital membership — not a hospitalId field on the profile itself,
    // which isn't reliably populated — is the real "does this doctor belong
    // here" check, same as HospitalContextGuard uses for the caller.
    const membership = await this.membershipRepository.getHospitalMembershipData(
      doctorId,
      hospitalId,
    );
    if (!membership) {
      throw ApiError.notFound('Doctor not found in this hospital');
    }
    const doctor = await this.doctorRepository.getDoctorProfileById(doctorId);
    const doctorName = (doctor as any)?.name ?? doctorId;

    const setAt = new Date();
    const saved = await this.presenceRepository.upsert(
      hospitalId,
      doctorId,
      body.date,
      {
        hospitalId,
        doctorId,
        date: body.date,
        kind: body.kind,
        expectedTime: body.expectedTime,
        returnTime: body.returnTime,
        reason: body.reason,
        toldBy: body.toldBy,
        note: body.note,
        setByUserId: userProfile.userId,
        setByName: userProfile.name,
        setAt,
      } as any,
    );

    await this.auditService.log({
      hospitalId,
      actor: {
        userId: userProfile.userId,
        name: userProfile.name,
        role: userProfile.role,
      },
      action: 'doctor.presence_changed',
      area: 'doctors',
      summary: `Marked Dr. ${doctorName} as ${KIND_LABEL[body.kind]}`,
      detail: {
        doctorId,
        date: body.date,
        kind: body.kind,
        expectedTime: body.expectedTime,
        returnTime: body.returnTime,
        reason: body.reason,
        toldBy: body.toldBy,
        note: body.note,
      },
    });

    return {
      override: {
        kind: saved.kind,
        expectedTime: saved.expectedTime,
        returnTime: saved.returnTime,
        reason: saved.reason,
        toldBy: saved.toldBy,
        note: saved.note,
        setBy: saved.setByName,
        setAt: saved.setAt,
      },
    };
  }
}
