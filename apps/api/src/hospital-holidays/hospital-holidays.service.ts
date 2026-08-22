import { Injectable } from '@nestjs/common';
import { HospitalHolidayRepository } from '../repositories/hospital-holiday.repository';
import { AppointmentRepository } from '../repositories/appointment.repository';
import { MembershipRepository } from '../repositories/membership.repository';
import { AuditService } from '../audit/audit.service';
import { ApiError } from '../common/errors/api-error';
import { HospitalUserProfile } from '../auth/decorators/current-user.decorator';
import {
  ACTIVE_APPOINTMENT_STATUSES,
  APPOINTMENT_STATUS,
  APPOINTMENT_TYPE,
  HOLIDAY_CLOSURE_TYPE,
  TN_HOLIDAY_SEED_LIST,
} from '../constants';
import { findHolidayForDate, HolidayLike } from './holiday-availability.util';

const RESCHEDULE_LOOKAHEAD_DAYS = 28;

interface HolidayDraft {
  startsOn: string;
  endsOn?: string;
  closureType: string;
  halfDayUntil?: string;
  exceptionDoctorIds: string[];
}

interface HolidayResolution {
  appointmentId: string;
  action: 'move' | 'cancel' | 'keep';
  newDate?: string;
  newTime?: string;
}

@Injectable()
export class HospitalHolidaysService {
  constructor(
    private readonly holidayRepository: HospitalHolidayRepository,
    private readonly appointmentRepository: AppointmentRepository,
    private readonly membershipRepository: MembershipRepository,
    private readonly auditService: AuditService,
  ) {}

  // -- date helpers, mirroring PackagesService's own plain-Date style --

  private addDays(d: Date, n: number): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  }

  private toISODate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private weekdayName(d: Date): string {
    return d.toLocaleDateString('en-US', { weekday: 'long' });
  }

  private toMinutes(hhmm: string): number {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  }

  private toHHMM(mins: number): string {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  private nearestTime(free: string[], preferred: string): string {
    const prefMin = this.toMinutes(preferred);
    return free.reduce((best, t) => {
      const dBest = Math.abs(this.toMinutes(best) - prefMin);
      const dT = Math.abs(this.toMinutes(t) - prefMin);
      return dT < dBest || (dT === dBest && t > best) ? t : best;
    });
  }

  private shiftYear(dateIso: string, deltaYears: number): string {
    const [y, m, d] = dateIso.split('-').map(Number);
    const shifted = new Date(y + deltaYears, m - 1, d);
    return this.toISODate(shifted);
  }

  private pad2(n: number): string {
    return String(n).padStart(2, '0');
  }

  private todayIso(): string {
    return this.toISODate(new Date());
  }

  /* ---------------------------------------------------------------------- */
  /*                              listing / year view                       */
  /* ---------------------------------------------------------------------- */

  async listByYear(hospitalId: string, year: number) {
    const [holidays, prevYearHolidays] = await Promise.all([
      this.holidayRepository.listByHospitalAndYear(hospitalId, year),
      this.holidayRepository.listByHospitalAndYear(hospitalId, year - 1),
    ]);

    const todayIso = this.todayIso();
    const enriched = await Promise.all(
      holidays.map(async (h: any) => {
        const bookedCount = (
          await this.appointmentRepository.getAppointmentsWithFilters({
            hospitalId,
            statuses: ACTIVE_APPOINTMENT_STATUSES,
            startDate: h.startsOn,
            endDate: h.endsOn,
          })
        ).length;
        return { ...h, bookedCount, isPast: h.endsOn < todayIso };
      }),
    );

    const namesThisYear = new Set(holidays.map((h: any) => h.name));
    const pendingRepeats = prevYearHolidays
      .filter((h: any) => h.repeatsAnnually && !namesThisYear.has(h.name))
      .map((h: any) => ({ name: h.name, fromYear: year - 1 }));

    return { holidays: enriched, pendingRepeats };
  }

  /* ---------------------------------------------------------------------- */
  /*                          next-free-slot search                         */
  /* ---------------------------------------------------------------------- */

  private async findNextFreeSlot(
    hospitalId: string,
    doctorProfileId: string,
    fromDate: Date,
    preferredTime: string,
    excludeAppointmentId: string,
    holidays: HolidayLike[],
    taken: Set<string>,
    dateCache: Map<string, Map<string, number>>,
  ): Promise<{ date: string; time: string } | null> {
    const membership = await this.membershipRepository.getHospitalMembershipData(
      doctorProfileId,
      hospitalId,
    );
    const availability: { day: string; startTime: string; endTime: string }[] =
      (membership as any)?.availability || [];
    const duration = (membership as any)?.appointmentDuration || 30;
    const bufferMinutes = Math.max(0, (membership as any)?.bufferMinutes || 0);
    const patientsPerSlot = Math.max(1, (membership as any)?.patientsPerSlot || 1);
    const step = duration + bufferMinutes;

    for (let i = 0; i < RESCHEDULE_LOOKAHEAD_DAYS; i++) {
      const d = this.addDays(fromDate, i);
      const dateIso = this.toISODate(d);

      if (findHolidayForDate(holidays, dateIso)) continue;

      const dayName = this.weekdayName(d);
      const windows = availability.filter((w) => w.day === dayName);
      if (windows.length === 0) continue;

      const slots: string[] = [];
      for (const w of windows) {
        let cur = this.toMinutes(w.startTime);
        const end = this.toMinutes(w.endTime);
        while (cur + duration <= end) {
          slots.push(this.toHHMM(cur));
          cur += step;
        }
      }
      if (slots.length === 0) continue;

      if (!dateCache.has(dateIso)) {
        const existing = await this.appointmentRepository.getAppointmentsByDoctorAndDate(
          doctorProfileId,
          dateIso,
          [...ACTIVE_APPOINTMENT_STATUSES, 'scheduled'],
        );
        const counts = new Map<string, number>();
        for (const a of existing as any[]) {
          if (a.id === excludeAppointmentId) continue;
          counts.set(a.time, (counts.get(a.time) || 0) + 1);
        }
        dateCache.set(dateIso, counts);
      }
      const counts = dateCache.get(dateIso)!;

      const free = slots.filter((t) => {
        if (taken.has(`${dateIso}|${t}`)) return false;
        return (counts.get(t) || 0) < patientsPerSlot;
      });
      if (free.length === 0) continue;

      const time = free.includes(preferredTime) ? preferredTime : this.nearestTime(free, preferredTime);
      taken.add(`${dateIso}|${time}`);
      return { date: dateIso, time };
    }

    return null;
  }

  /* ---------------------------------------------------------------------- */
  /*                              impact preview                            */
  /* ---------------------------------------------------------------------- */

  async previewImpact(hospitalId: string, draft: HolidayDraft) {
    const startsOn = draft.startsOn;
    const endsOn = draft.endsOn || draft.startsOn;
    if (draft.closureType === HOLIDAY_CLOSURE_TYPE.HALF_DAY && !draft.halfDayUntil) {
      throw ApiError.badRequest('A cut-off time is required for a half day');
    }

    const appointments = await this.appointmentRepository.getAppointmentsWithFilters({
      hospitalId,
      statuses: ACTIVE_APPOINTMENT_STATUSES,
      startDate: startsOn,
      endDate: endsOn,
    });

    const byDoctor = new Map<string, any[]>();
    for (const appt of appointments as any[]) {
      const key = appt.doctorProfileId || 'unknown';
      if (!byDoctor.has(key)) byDoctor.set(key, []);
      byDoctor.get(key)!.push(appt);
    }

    const searchFrom = this.addDays(new Date(`${endsOn}T00:00:00`), 1);
    const lookaheadHolidays = await this.holidayRepository.getActiveInRange(
      hospitalId,
      this.toISODate(searchFrom),
      this.toISODate(this.addDays(searchFrom, RESCHEDULE_LOOKAHEAD_DAYS)),
    );

    let moved = 0;
    let cancelled = 0;
    let kept = 0;

    const doctors = await Promise.all(
      Array.from(byDoctor.entries()).map(async ([doctorProfileId, appts]) => {
        const exempt = draft.exceptionDoctorIds.includes(doctorProfileId);
        const sorted = [...appts].sort((a, b) => (a.time || '').localeCompare(b.time || ''));
        const taken = new Set<string>();
        const dateCache = new Map<string, Map<string, number>>();

        const rows = await Promise.all(
          sorted.map(async (appt) => {
            if (exempt) {
              kept++;
              return {
                appointmentId: appt.id,
                patientName: appt.patientName,
                patientPhone: appt.patientPhone,
                time: appt.time,
                type: appt.type,
                packageId: appt.packageId,
                packageVisitNumber: appt.packageVisitNumber,
                defaultAction: 'keep' as const,
                proposedSlot: null,
                reason: 'Doctor still sees patients',
              };
            }

            const slot = await this.findNextFreeSlot(
              hospitalId,
              doctorProfileId,
              searchFrom,
              appt.time,
              appt.id,
              lookaheadHolidays,
              taken,
              dateCache,
            );

            if (slot) {
              moved++;
              return {
                appointmentId: appt.id,
                patientName: appt.patientName,
                patientPhone: appt.patientPhone,
                time: appt.time,
                type: appt.type,
                packageId: appt.packageId,
                packageVisitNumber: appt.packageVisitNumber,
                defaultAction: 'move' as const,
                proposedSlot: slot,
                reason: null,
              };
            }

            cancelled++;
            return {
              appointmentId: appt.id,
              patientName: appt.patientName,
              patientPhone: appt.patientPhone,
              time: appt.time,
              type: appt.type,
              packageId: appt.packageId,
              packageVisitNumber: appt.packageVisitNumber,
              defaultAction: 'cancel' as const,
              proposedSlot: null,
              reason: `No free slot for ${RESCHEDULE_LOOKAHEAD_DAYS} days`,
            };
          }),
        );

        return {
          doctorProfileId,
          doctorName: sorted[0]?.doctorName,
          worksThatDay: exempt,
          appointments: rows,
        };
      }),
    );

    return {
      startsOn,
      endsOn,
      counts: { moved, cancelled, kept },
      doctors,
    };
  }

  /* ---------------------------------------------------------------------- */
  /*                              create holiday                            */
  /* ---------------------------------------------------------------------- */

  async createHoliday(
    hospitalId: string,
    actor: HospitalUserProfile,
    body: HolidayDraft & {
      name: string;
      repeatsAnnually: boolean;
      resolutions: HolidayResolution[];
    },
  ) {
    const endsOn = body.endsOn || body.startsOn;
    if (body.closureType === HOLIDAY_CLOSURE_TYPE.HALF_DAY && !body.halfDayUntil) {
      throw ApiError.badRequest('A cut-off time is required for a half day');
    }

    const holiday = await this.holidayRepository.createHoliday({
      hospitalId,
      name: body.name,
      startsOn: body.startsOn,
      endsOn,
      closureType: body.closureType,
      halfDayUntil: body.halfDayUntil,
      repeatsAnnually: body.repeatsAnnually,
      exceptionDoctorIds: body.exceptionDoctorIds || [],
      status: 'active',
      createdBy: actor.userId,
      createdByName: actor.name,
    });

    const resolutionSummary = await this.applyResolutions(
      hospitalId,
      actor,
      holiday.name,
      body.resolutions || [],
    );

    await this.auditService.log({
      hospitalId,
      actor: { userId: actor.userId, name: actor.name, role: actor.role },
      action: 'holiday.created',
      area: 'settings',
      summary: `Added "${holiday.name}" (${holiday.startsOn}${holiday.endsOn !== holiday.startsOn ? ` – ${holiday.endsOn}` : ''}) — ${resolutionSummary.moved} moved, ${resolutionSummary.cancelled} cancelled, ${resolutionSummary.kept} kept`,
      detail: resolutionSummary,
    });

    return { holiday, resolutionSummary };
  }

  // Shared by `createHoliday` (new holiday) and `reconcileExistingHoliday`
  // (a previously-created holiday that's since picked up new bookings —
  // e.g. an exception doctor was removed, or a repeat/import row was never
  // checked against the calendar).
  private async applyResolutions(
    hospitalId: string,
    actor: HospitalUserProfile,
    holidayName: string,
    resolutions: HolidayResolution[],
  ) {
    let moved = 0;
    let cancelled = 0;
    let kept = 0;

    for (const resolution of resolutions) {
      const appointment = await this.appointmentRepository.getAppointmentById(
        resolution.appointmentId,
      );
      if (!appointment || (appointment as any).hospitalId !== hospitalId) continue;
      const existingData = appointment as any;

      if (resolution.action === 'move') {
        if (!resolution.newDate || !resolution.newTime) {
          throw ApiError.badRequest(
            `Missing a new date/time for appointment ${resolution.appointmentId}`,
          );
        }
        await this.appointmentRepository.updateAppointment(resolution.appointmentId, {
          date: resolution.newDate,
          time: resolution.newTime,
          status: APPOINTMENT_STATUS.CONFIRMED,
          confirmedAt: new Date().toISOString(),
          rescheduledAt: new Date().toISOString(),
          rescheduledBy: actor.userId,
        });
        moved++;
        await this.auditService.log({
          hospitalId,
          actor: { userId: actor.userId, name: actor.name, role: actor.role },
          action: 'appointment.rescheduled',
          area: 'appointments',
          summary: `Rescheduled ${existingData.patientName ?? resolution.appointmentId} → ${resolution.newDate} ${resolution.newTime} · ${holidayName}`,
        });
      } else if (resolution.action === 'cancel') {
        await this.appointmentRepository.updateAppointment(resolution.appointmentId, {
          status: APPOINTMENT_STATUS.CANCELLED,
          cancelReason: `Holiday: ${holidayName}`,
        });
        cancelled++;
        await this.auditService.log({
          hospitalId,
          actor: { userId: actor.userId, name: actor.name, role: actor.role },
          action: 'appointment.cancelled',
          area: 'appointments',
          summary: `Cancelled ${existingData.patientName ?? resolution.appointmentId} · ${holidayName}${
            existingData.type === APPOINTMENT_TYPE.PACKAGE ? ' (package visit unaffected — not yet redeemed)' : ''
          }`,
        });
      } else {
        kept++;
      }
    }

    return { moved, cancelled, kept };
  }

  // For a holiday that's already saved but has since picked up bookings —
  // the year-view banner's "Review them" flow. Re-uses the same preview
  // shape (the caller re-runs previewImpact against the holiday's own
  // fields) and the same resolution-application path as creation.
  async reconcileExistingHoliday(
    hospitalId: string,
    holidayId: string,
    actor: HospitalUserProfile,
    resolutions: HolidayResolution[],
  ) {
    const holiday = await this.holidayRepository.getById(hospitalId, holidayId);
    if (!holiday) throw ApiError.notFound('Holiday not found');

    const resolutionSummary = await this.applyResolutions(
      hospitalId,
      actor,
      (holiday as any).name,
      resolutions,
    );

    await this.auditService.log({
      hospitalId,
      actor: { userId: actor.userId, name: actor.name, role: actor.role },
      action: 'holiday.reconciled',
      area: 'settings',
      summary: `Cleared bookings against "${(holiday as any).name}" — ${resolutionSummary.moved} moved, ${resolutionSummary.cancelled} cancelled, ${resolutionSummary.kept} kept`,
      detail: resolutionSummary,
    });

    return { holiday, resolutionSummary };
  }

  /* ---------------------------------------------------------------------- */
  /*                          edit / status / repeats                       */
  /* ---------------------------------------------------------------------- */

  async updateHoliday(
    hospitalId: string,
    holidayId: string,
    actor: HospitalUserProfile,
    updates: {
      name?: string;
      closureType?: string;
      halfDayUntil?: string;
      repeatsAnnually?: boolean;
      exceptionDoctorIds?: string[];
    },
  ) {
    const existing = await this.holidayRepository.getById(hospitalId, holidayId);
    if (!existing) throw ApiError.notFound('Holiday not found');

    const nextClosureType = updates.closureType ?? (existing as any).closureType;
    const nextHalfDayUntil = updates.halfDayUntil ?? (existing as any).halfDayUntil;
    if (nextClosureType === HOLIDAY_CLOSURE_TYPE.HALF_DAY && !nextHalfDayUntil) {
      throw ApiError.badRequest('A cut-off time is required for a half day');
    }

    const updated = await this.holidayRepository.updateFields(hospitalId, holidayId, updates);

    await this.auditService.log({
      hospitalId,
      actor: { userId: actor.userId, name: actor.name, role: actor.role },
      action: 'holiday.updated',
      area: 'settings',
      summary: `Updated "${(existing as any).name}" in Hospital holidays`,
    });

    return updated;
  }

  async setStatus(
    hospitalId: string,
    holidayId: string,
    actor: HospitalUserProfile,
    status: 'active' | 'removed',
  ) {
    const existing = await this.holidayRepository.getById(hospitalId, holidayId);
    if (!existing) throw ApiError.notFound('Holiday not found');

    const updated = await this.holidayRepository.setStatus(hospitalId, holidayId, status);

    await this.auditService.log({
      hospitalId,
      actor: { userId: actor.userId, name: actor.name, role: actor.role },
      action: status === 'removed' ? 'holiday.removed' : 'holiday.restored',
      area: 'settings',
      summary: `${status === 'removed' ? 'Removed' : 'Restored'} "${(existing as any).name}" from Hospital holidays`,
    });

    return updated;
  }

  async generateRepeats(hospitalId: string, actor: HospitalUserProfile, year: number) {
    const [prevYearHolidays, currentYearHolidays] = await Promise.all([
      this.holidayRepository.listByHospitalAndYear(hospitalId, year - 1),
      this.holidayRepository.listByHospitalAndYear(hospitalId, year),
    ]);

    const existingNames = new Set(currentYearHolidays.map((h: any) => h.name));
    const created: any[] = [];

    for (const prev of prevYearHolidays as any[]) {
      if (!prev.repeatsAnnually || existingNames.has(prev.name)) continue;

      const holiday = await this.holidayRepository.createHoliday({
        hospitalId,
        name: prev.name,
        startsOn: this.shiftYear(prev.startsOn, 1),
        endsOn: this.shiftYear(prev.endsOn, 1),
        closureType: prev.closureType,
        halfDayUntil: prev.halfDayUntil,
        repeatsAnnually: true,
        exceptionDoctorIds: prev.exceptionDoctorIds || [],
        status: 'active',
        sourceHolidayId: prev.id,
        createdBy: actor.userId,
        createdByName: actor.name,
      });
      created.push(holiday);
    }

    if (created.length > 0) {
      await this.auditService.log({
        hospitalId,
        actor: { userId: actor.userId, name: actor.name, role: actor.role },
        action: 'holiday.repeats_generated',
        area: 'settings',
        summary: `Carried ${created.length} repeating holiday(s) forward to ${year}`,
      });
    }

    return { created };
  }

  async importTnList(hospitalId: string, actor: HospitalUserProfile, year: number) {
    const existing = await this.holidayRepository.listByHospitalAndYear(hospitalId, year);
    const existingNames = new Set(existing.map((h: any) => h.name));
    const created: any[] = [];

    for (const entry of TN_HOLIDAY_SEED_LIST) {
      if (existingNames.has(entry.name)) continue;

      const holiday = await this.holidayRepository.createHoliday({
        hospitalId,
        name: entry.name,
        startsOn: `${year}-${this.pad2(entry.startMonth)}-${this.pad2(entry.startDay)}`,
        endsOn: `${year}-${this.pad2(entry.endMonth)}-${this.pad2(entry.endDay)}`,
        closureType: entry.closureType,
        repeatsAnnually: entry.repeatsAnnually,
        exceptionDoctorIds: [],
        status: 'active',
        createdBy: actor.userId,
        createdByName: actor.name,
      });
      created.push(holiday);
    }

    if (created.length > 0) {
      await this.auditService.log({
        hospitalId,
        actor: { userId: actor.userId, name: actor.name, role: actor.role },
        action: 'holiday.tn_list_imported',
        area: 'settings',
        summary: `Imported ${created.length} Tamil Nadu holiday(s) for ${year}`,
      });
    }

    return { created };
  }
}
