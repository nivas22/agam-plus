import { Injectable } from '@nestjs/common';
import { LeaveRequestRepository } from '../repositories/leave-request.repository';
import { AppointmentRepository } from '../repositories/appointment.repository';
import { AuditService } from '../audit/audit.service';
import { ApiError } from '../common/errors/api-error';
import { HospitalUserProfile } from '../auth/decorators/current-user.decorator';
import { MembershipRepository } from '../repositories/membership.repository';
import { AppointmentsService } from '../appointments/appointments.service';
import { HospitalRepository } from '../repositories/hospital.repository';
import { todayIso } from '../common/hospital-time.util';
import { ACTIVE_APPOINTMENT_STATUSES, LEAVE_REQUEST_STATUS } from '../constants';

interface LeaveRequestDraft {
  startDate: string;
  endDate: string;
  reason?: string;
}

// How the admin clears one of the doctor's booked appointments before the
// leave can be approved: hand it to another doctor at the same date+time,
// or move it to a new date+time with the same doctor.
export type LeaveAppointmentResolution =
  | { appointmentId: string; action: 'reassign'; newDoctorProfileId: string }
  | { appointmentId: string; action: 'reschedule'; newDate: string; newTime: string };

// How far past the leave to look for a suggested reschedule slot.
const SUGGESTION_LOOKAHEAD_DAYS = 28;

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDaysIso(dateIso: string, n: number): string {
  const [y, m, d] = dateIso.split('-').map(Number);
  return toISODate(new Date(y, m - 1, d + n));
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

// Older rows predate requestedBy.isDoctor (and the oldest predate requestedBy
// entirely, when only doctors could file leave), so fall back to the role.
export function leaveIsFromDoctor(leave: any): boolean {
  const by = leave?.requestedBy;
  if (!by?.role) return true;
  return by.isDoctor ?? by.role === 'doctor';
}

@Injectable()
export class LeaveRequestsService {
  constructor(
    private readonly leaveRequestRepository: LeaveRequestRepository,
    private readonly appointmentRepository: AppointmentRepository,
    private readonly auditService: AuditService,
    private readonly membershipRepository: MembershipRepository,
    private readonly hospitalRepository: HospitalRepository,
    private readonly appointmentsService: AppointmentsService,
  ) {}

  async list(hospitalId: string, options?: { doctorProfileId?: string; status?: string }) {
    return this.leaveRequestRepository.listByHospital(hospitalId, options);
  }

  // Who is away on approved leave in a date range. Deliberately minimal —
  // every role (front desk included) reads this to flag absent doctors on
  // the queue and calendar, so reasons and notes stay out of it.
  async listOnLeave(hospitalId: string, startDate: string, endDate: string) {
    if (!startDate || !endDate || endDate < startDate) {
      throw ApiError.badRequest('A valid start and end date are required');
    }
    const rows = await this.leaveRequestRepository.listApprovedInRange(hospitalId, startDate, endDate);
    return rows.map((r: any) => ({
      id: r.id,
      userId: r.doctorProfileId,
      name: r.requestedBy?.name ?? r.doctorName,
      role: r.requestedBy?.role ?? 'doctor',
      isDoctor: leaveIsFromDoctor(r),
      startDate: r.startDate,
      endDate: r.endDate,
    }));
  }

  // Preview-only — no appointment is moved or cancelled here (see the
  // schema's affectedAppointmentCount comment). The caller shows this count
  // before the doctor confirms the request. Staff (front desk, nurse,
  // accountant) don't own appointments, so their impact is always 0.
  async previewImpact(hospitalId: string, actor: HospitalUserProfile, draft: LeaveRequestDraft) {
    if (!draft.startDate || !draft.endDate || draft.endDate < draft.startDate) {
      throw ApiError.badRequest('A valid start and end date are required');
    }

    const affectedAppointmentCount =
      actor.isDoctor
        ? await this.appointmentRepository.getAppointmentCountInRange(
            hospitalId,
            actor.userId,
            draft.startDate,
            draft.endDate,
            { excludeStatuses: ['cancelled', 'no-show'] },
          )
        : 0;

    return { startDate: draft.startDate, endDate: draft.endDate, affectedAppointmentCount };
  }

  async create(hospitalId: string, actor: HospitalUserProfile, draft: LeaveRequestDraft) {
    const { affectedAppointmentCount } = await this.previewImpact(hospitalId, actor, draft);

    const leaveRequest = await this.leaveRequestRepository.create({
      hospitalId,
      doctorProfileId: actor.userId,
      doctorName: actor.name,
      startDate: draft.startDate,
      endDate: draft.endDate,
      reason: draft.reason,
      affectedAppointmentCount,
      status: LEAVE_REQUEST_STATUS.PENDING,
      requestedBy: { userId: actor.userId, name: actor.name, role: actor.role, isDoctor: !!actor.isDoctor },
      requestedAt: new Date(),
    });

    await this.auditService.log({
      hospitalId,
      actor: { userId: actor.userId, name: actor.name, role: actor.role },
      action: 'leave_request.created',
      area: 'appointments',
      summary: `${actor.name} applied for leave ${draft.startDate}${draft.endDate !== draft.startDate ? ` – ${draft.endDate}` : ''}${actor.isDoctor ? ` — ${affectedAppointmentCount} appointment(s) would need moving` : ''}`,
    });

    return leaveRequest;
  }

  async nudge(hospitalId: string, leaveRequestId: string, actor: HospitalUserProfile) {
    const existing = await this.leaveRequestRepository.getById(hospitalId, leaveRequestId);
    if (!existing) throw ApiError.notFound('Leave request not found');
    if ((existing as any).doctorProfileId !== actor.userId) {
      throw ApiError.forbidden('You can only nudge your own leave request');
    }
    if ((existing as any).status !== LEAVE_REQUEST_STATUS.PENDING) {
      throw ApiError.badRequest('This leave request has already been resolved');
    }

    return this.leaveRequestRepository.updateFields(hospitalId, leaveRequestId, {
      lastNudgedAt: new Date(),
    });
  }

  // Live list of the requester's still-active appointments inside the leave
  // range (from today on), each with the options the admin has for clearing
  // it: other doctors free at that exact slot, and the requester's next open
  // slot after the leave. Approval is blocked until every one is resolved.
  async getAffectedAppointments(hospitalId: string, leaveRequestId: string) {
    const existing = (await this.leaveRequestRepository.getById(hospitalId, leaveRequestId)) as any;
    if (!existing) throw ApiError.notFound('Leave request not found');

    const appointments = await this.loadAffectedAppointments(hospitalId, existing);
    const doctors = (await this.otherDoctors(hospitalId, existing.doctorProfileId)).map((m: any) => ({
      doctorProfileId: m.userId as string,
      name: m.name as string,
    }));
    if (appointments.length === 0) return { appointments: [], doctors };

    const slotCache = new Map<string, Map<string, number>>();
    const openSlots = async (doctorId: string, date: string) => {
      const key = `${doctorId}|${date}`;
      if (!slotCache.has(key)) {
        const slots = await this.appointmentsService.getOpenSlotsForDoctor(hospitalId, doctorId, date);
        slotCache.set(key, new Map(slots.map((sl) => [sl.time, sl.remaining])));
      }
      return slotCache.get(key)!;
    };
    const leaveCache = new Map<string, boolean>();
    const onLeave = async (doctorId: string, date: string) => {
      const key = `${doctorId}|${date}`;
      if (!leaveCache.has(key)) leaveCache.set(key, await this.isOnApprovedLeave(hospitalId, doctorId, date));
      return leaveCache.get(key)!;
    };

    // Suggested reschedule slots share one capacity budget, so two
    // appointments aren't both pointed at the last place in the same slot.
    const claimed = new Map<string, number>();
    const roomLeft = (slots: Map<string, number>, key: string, time: string) =>
      (slots.get(time) || 0) - (claimed.get(`${key}|${time}`) || 0);

    const rows: any[] = [];
    for (const appt of appointments) {
      const alternativeDoctors: { doctorProfileId: string; name: string }[] = [];
      for (const d of doctors) {
        if (await onLeave(d.doctorProfileId, appt.date)) continue;
        const slots = await openSlots(d.doctorProfileId, appt.date);
        if (roomLeft(slots, `${d.doctorProfileId}|${appt.date}`, appt.time) > 0) alternativeDoctors.push(d);
      }

      let suggestedSlot: { date: string; time: string } | null = null;
      for (let i = 1; i <= SUGGESTION_LOOKAHEAD_DAYS && !suggestedSlot; i++) {
        const date = addDaysIso(existing.endDate, i);
        if (await onLeave(existing.doctorProfileId, date)) continue;
        const key = `${existing.doctorProfileId}|${date}`;
        const slots = await openSlots(existing.doctorProfileId, date);
        const free = [...slots.keys()].filter((t) => roomLeft(slots, key, t) > 0);
        if (free.length === 0) continue;
        const pref = toMinutes(appt.time || '00:00');
        const time = free.includes(appt.time)
          ? appt.time
          : free.reduce((best, t) =>
              Math.abs(toMinutes(t) - pref) < Math.abs(toMinutes(best) - pref) ? t : best,
            );
        suggestedSlot = { date, time };
        claimed.set(`${key}|${time}`, (claimed.get(`${key}|${time}`) || 0) + 1);
      }

      rows.push({
        appointmentId: appt.id,
        patientName: appt.patientName,
        patientPhone: appt.patientPhone,
        date: appt.date,
        time: appt.time,
        type: appt.type,
        status: appt.status,
        alternativeDoctors,
        suggestedSlot,
      });
    }

    return { appointments: rows, doctors };
  }

  async approve(
    hospitalId: string,
    leaveRequestId: string,
    actor: HospitalUserProfile,
    body: { note?: string; resolutions?: LeaveAppointmentResolution[] },
  ) {
    const existing = (await this.leaveRequestRepository.getById(hospitalId, leaveRequestId)) as any;
    if (!existing) throw ApiError.notFound('Leave request not found');
    if (existing.status !== LEAVE_REQUEST_STATUS.PENDING) {
      throw ApiError.badRequest('This leave request has already been resolved');
    }

    const affected = await this.loadAffectedAppointments(hospitalId, existing);
    const plan = await this.validateResolutions(hospitalId, existing, affected, body.resolutions || []);

    const appointmentResolutions: any[] = [];
    for (const step of plan) {
      const moved = await this.appointmentsService.relocateAppointment(
        hospitalId,
        actor,
        step.appointment.id,
        step.target,
      );
      appointmentResolutions.push({
        appointmentId: step.appointment.id,
        patientName: step.appointment.patientName,
        action: step.action,
        from: { date: step.appointment.date, time: step.appointment.time },
        to: {
          doctorProfileId: step.target.doctorProfileId,
          doctorName: moved.doctorName,
          date: moved.date,
          time: moved.time,
        },
      });
      const patient = step.appointment.patientName ?? step.appointment.id;
      await this.auditService.log({
        hospitalId,
        actor: { userId: actor.userId, name: actor.name, role: actor.role },
        action: step.action === 'reassign' ? 'appointment.reassigned' : 'appointment.rescheduled',
        area: 'appointments',
        summary:
          step.action === 'reassign'
            ? `Moved ${patient} (${step.appointment.date} ${step.appointment.time}) from ${existing.doctorName ?? 'doctor'} to ${moved.doctorName} · leave approval`
            : `Rescheduled ${patient} → ${moved.date} ${moved.time} · ${existing.doctorName ?? 'doctor'}'s leave`,
      });
    }

    return this.resolve(
      hospitalId,
      leaveRequestId,
      actor,
      LEAVE_REQUEST_STATUS.APPROVED,
      body.note,
      appointmentResolutions.length ? { appointmentResolutions } : undefined,
    );
  }

  async decline(
    hospitalId: string,
    leaveRequestId: string,
    actor: HospitalUserProfile,
    body: { note?: string },
  ) {
    return this.resolve(hospitalId, leaveRequestId, actor, LEAVE_REQUEST_STATUS.DECLINED, body.note);
  }

  private async resolve(
    hospitalId: string,
    leaveRequestId: string,
    actor: HospitalUserProfile,
    status: LEAVE_REQUEST_STATUS,
    note?: string,
    extraFields?: { appointmentResolutions: any[] },
  ) {
    const existing = await this.leaveRequestRepository.getById(hospitalId, leaveRequestId);
    if (!existing) throw ApiError.notFound('Leave request not found');
    if ((existing as any).status !== LEAVE_REQUEST_STATUS.PENDING) {
      throw ApiError.badRequest('This leave request has already been resolved');
    }

    const updated = await this.leaveRequestRepository.updateFields(hospitalId, leaveRequestId, {
      status,
      resolvedBy: { userId: actor.userId, name: actor.name, role: actor.role },
      resolvedAt: new Date(),
      resolutionNote: note,
      ...extraFields,
    });

    await this.auditService.log({
      hospitalId,
      actor: { userId: actor.userId, name: actor.name, role: actor.role },
      action: status === LEAVE_REQUEST_STATUS.APPROVED ? 'leave_request.approved' : 'leave_request.declined',
      area: 'appointments',
      summary: `${status === LEAVE_REQUEST_STATUS.APPROVED ? 'Approved' : 'Declined'} ${(existing as any).doctorName ?? 'a'}'s leave request for ${(existing as any).startDate}${(existing as any).endDate !== (existing as any).startDate ? ` – ${(existing as any).endDate}` : ''}${extraFields ? ` — ${extraFields.appointmentResolutions.length} appointment(s) moved` : ''}`,
    });

    return updated;
  }

  // Leave filed by staff never has appointments attached. Past days inside
  // the range are skipped — there's nothing left to move for them.
  private async loadAffectedAppointments(hospitalId: string, leave: any): Promise<any[]> {
    if (!leaveIsFromDoctor(leave)) return [];
    const today = todayIso(await this.hospitalRepository.getTimezone(hospitalId));
    const from = leave.startDate > today ? leave.startDate : today;
    if (from > leave.endDate) return [];
    return (await this.appointmentRepository.getAppointmentsWithFilters({
      hospitalId,
      doctorProfileId: leave.doctorProfileId,
      statuses: ACTIVE_APPOINTMENT_STATUSES,
      startDate: from,
      endDate: leave.endDate,
    })) as any[];
  }

  private async otherDoctors(hospitalId: string, excludeDoctorId: string) {
    const members = await this.membershipRepository.getPractisingDoctorMembers(hospitalId, { status: 'approved' });
    return members.filter((m: any) => m.userId !== excludeDoctorId);
  }

  private async isOnApprovedLeave(hospitalId: string, doctorId: string, date: string) {
    const overlapping = await this.leaveRequestRepository.getOverlappingForDoctor(hospitalId, doctorId, date, date);
    return overlapping.some((l: any) => l.status === LEAVE_REQUEST_STATUS.APPROVED);
  }

  // Every affected appointment needs exactly one valid resolution, and every
  // target slot needs room — checked for the whole batch before anything is
  // written, so a bad pick can't leave the calendar half-moved.
  private async validateResolutions(
    hospitalId: string,
    leave: any,
    affected: any[],
    resolutions: LeaveAppointmentResolution[],
  ) {
    const byId = new Map(resolutions.map((r) => [r.appointmentId, r]));
    const missing = affected.filter((a) => !byId.has(a.id));
    if (missing.length > 0) {
      throw ApiError.badRequest(
        `${missing.length} appointment(s) during this leave still need another doctor or a new date before it can be approved`,
        { unresolvedAppointmentIds: missing.map((a) => a.id) },
      );
    }

    const today = todayIso(await this.hospitalRepository.getTimezone(hospitalId));
    const doctorIds = new Set(
      (await this.otherDoctors(hospitalId, leave.doctorProfileId)).map((m: any) => m.userId),
    );
    const slotCache = new Map<string, Map<string, number>>();
    const used = new Map<string, number>();

    const plan: {
      appointment: any;
      action: 'reassign' | 'reschedule';
      target: { doctorProfileId: string; date: string; time: string };
    }[] = [];

    for (const appt of affected) {
      const r = byId.get(appt.id)!;
      const patient = appt.patientName ?? appt.id;
      let target: { doctorProfileId: string; date: string; time: string };

      if (r.action === 'reassign') {
        if (!doctorIds.has(r.newDoctorProfileId)) {
          throw ApiError.badRequest(`Pick another doctor in this hospital for ${patient}`);
        }
        if (await this.isOnApprovedLeave(hospitalId, r.newDoctorProfileId, appt.date)) {
          throw ApiError.badRequest(`The doctor picked for ${patient} is on leave that day`);
        }
        target = { doctorProfileId: r.newDoctorProfileId, date: appt.date, time: appt.time };
      } else if (r.action === 'reschedule') {
        if (!r.newDate || !r.newTime) {
          throw ApiError.badRequest(`Pick a new date and time for ${patient}`);
        }
        if (r.newDate < today) {
          throw ApiError.badRequest(`The new date for ${patient} is in the past`);
        }
        if (r.newDate >= leave.startDate && r.newDate <= leave.endDate) {
          throw ApiError.badRequest(`The new date for ${patient} falls inside the leave`);
        }
        if (await this.isOnApprovedLeave(hospitalId, leave.doctorProfileId, r.newDate)) {
          throw ApiError.badRequest(`The doctor is already on leave on ${r.newDate}`);
        }
        target = { doctorProfileId: leave.doctorProfileId, date: r.newDate, time: r.newTime };
      } else {
        throw ApiError.badRequest('Each appointment must be given another doctor or rescheduled');
      }

      const dayKey = `${target.doctorProfileId}|${target.date}`;
      if (!slotCache.has(dayKey)) {
        const slots = await this.appointmentsService.getOpenSlotsForDoctor(
          hospitalId,
          target.doctorProfileId,
          target.date,
        );
        slotCache.set(dayKey, new Map(slots.map((sl) => [sl.time, sl.remaining])));
      }
      const slotKey = `${dayKey}|${target.time}`;
      const room = (slotCache.get(dayKey)!.get(target.time) || 0) - (used.get(slotKey) || 0);
      if (room <= 0) {
        throw ApiError.conflict(`No free slot at ${target.date} ${target.time} for ${patient} — pick another option`);
      }
      used.set(slotKey, (used.get(slotKey) || 0) + 1);
      plan.push({ appointment: appt, action: r.action, target });
    }

    return plan;
  }
}
