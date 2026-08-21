import { Injectable } from '@nestjs/common';
import { PackageRepository } from '../repositories/package.repository';
import { AppointmentRepository } from '../repositories/appointment.repository';
import { DoctorRepository } from '../repositories/doctor.repository';
import { PatientRepository } from '../repositories/patient.repository';
import { MembershipRepository } from '../repositories/membership.repository';
import { ApiError } from '../common/errors/api-error';
import {
  JwtUser,
  HospitalUserProfile,
} from '../auth/decorators/current-user.decorator';
import {
  PreviewPackageScheduleBody,
  SellPackageBody,
  PackageListQuery,
} from './packages.types';
import {
  ACTIVE_APPOINTMENT_STATUSES,
  APPOINTMENT_STATUS,
  APPOINTMENT_TYPE,
  PACKAGE_STATUS,
  PACKAGE_VALIDITY_MONTHS,
} from '../constants';

interface DoctorScheduleContext {
  doctorProfileId: string;
  availability: { day: string; startTime: string; endTime: string }[];
  duration: number;
  bufferMinutes: number;
  patientsPerSlot: number;
  dateCache: Map<string, Map<string, number>>;
}

interface PlacedVisit {
  date: string;
  time: string;
  moved: boolean;
  reason: string | null;
}

interface UnplacedVisit {
  unplaced: true;
  reason: string;
}

@Injectable()
export class PackagesService {
  constructor(
    private readonly packageRepository: PackageRepository,
    private readonly appointmentRepository: AppointmentRepository,
    private readonly doctorRepository: DoctorRepository,
    private readonly patientRepository: PatientRepository,
    private readonly membershipRepository: MembershipRepository,
  ) {}

  // -- date/time helpers, mirroring AppointmentsService's own plain-Date style --

  private addDays(d: Date, n: number): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  }

  // Formats the LOCAL calendar date directly — `.toISOString()` converts to
  // UTC first, which silently shifts the date by a day in any timezone ahead
  // of UTC (e.g. IST) and threw off every planned visit's date and weekday.
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

  private slotsForDate(d: Date, ctx: DoctorScheduleContext): string[] {
    const dayName = this.weekdayName(d);
    const windows = ctx.availability.filter((w) => w.day === dayName);
    const slots: string[] = [];
    const step = ctx.duration + ctx.bufferMinutes;
    for (const w of windows) {
      let cur = this.toMinutes(w.startTime);
      const end = this.toMinutes(w.endTime);
      while (cur + ctx.duration <= end) {
        slots.push(this.toHHMM(cur));
        cur += step;
      }
    }
    return slots;
  }

  private async bookedCountsForDate(
    dateIso: string,
    ctx: DoctorScheduleContext,
  ): Promise<Map<string, number>> {
    if (ctx.dateCache.has(dateIso)) return ctx.dateCache.get(dateIso)!;

    const existing =
      await this.appointmentRepository.getAppointmentsByDoctorAndDate(
        ctx.doctorProfileId,
        dateIso,
        [...ACTIVE_APPOINTMENT_STATUSES, 'scheduled'],
      );
    const counts = new Map<string, number>();
    for (const a of existing as any[]) {
      counts.set(a.time, (counts.get(a.time) || 0) + 1);
    }
    ctx.dateCache.set(dateIso, counts);
    return counts;
  }

  private isFree(
    dateIso: string,
    time: string,
    counts: Map<string, number>,
    ctx: DoctorScheduleContext,
    taken: Set<string>,
  ): boolean {
    if (taken.has(`${dateIso}|${time}`)) return false;
    return (counts.get(time) || 0) < ctx.patientsPerSlot;
  }

  // Walks forward from `plannedDate` (the "ideal" date for this visit, before
  // any adjustment) looking for the nearest bookable slot — same day at the
  // preferred time if free, otherwise the closest free time on the first day
  // that has one. Mirrors the mockup's place()/build() behavior, just backed
  // by real availability + real existing bookings instead of fixture data.
  private async place(
    plannedDate: Date,
    preferredTime: string,
    ctx: DoctorScheduleContext,
    taken: Set<string>,
    lookaheadDays = 28,
  ): Promise<PlacedVisit | UnplacedVisit> {
    for (let i = 0; i < lookaheadDays; i++) {
      const d = this.addDays(plannedDate, i);
      const dateIso = this.toISODate(d);
      const slots = this.slotsForDate(d, ctx);
      if (slots.length === 0) continue;

      const counts = await this.bookedCountsForDate(dateIso, ctx);
      const free = slots.filter((t) =>
        this.isFree(dateIso, t, counts, ctx, taken),
      );
      if (free.length === 0) continue;

      if (i === 0 && free.includes(preferredTime)) {
        return {
          date: dateIso,
          time: preferredTime,
          moved: false,
          reason: null,
        };
      }

      const nearest = this.nearestTime(free, preferredTime);
      let reason: string;
      if (i === 0) {
        if (!slots.includes(preferredTime)) {
          reason = "Outside the doctor's hours";
        } else if (taken.has(`${dateIso}|${preferredTime}`)) {
          reason = 'Already taken by an earlier visit in this plan';
        } else {
          reason = 'Already booked by another patient';
        }
      } else {
        const plannedSlots = this.slotsForDate(plannedDate, ctx);
        reason =
          plannedSlots.length === 0
            ? `Doesn't work ${this.weekdayName(plannedDate)}s`
            : 'No free slot that day';
      }
      return { date: dateIso, time: nearest, moved: true, reason };
    }
    return {
      unplaced: true,
      reason: `Nothing free within ${lookaheadDays} days`,
    };
  }

  // Up to `max` free alternative slots near `plannedDate`, for the "Change"
  // picker — excludes whatever this visit resolved to plus anything already
  // claimed by another visit in the same package.
  private async alternatesFor(
    plannedDate: Date,
    excludeKey: string,
    ctx: DoctorScheduleContext,
    taken: Set<string>,
    max = 4,
    lookaheadDays = 14,
  ): Promise<{ date: string; time: string }[]> {
    const results: { date: string; time: string }[] = [];
    for (let i = 0; i < lookaheadDays && results.length < max; i++) {
      const d = this.addDays(plannedDate, i);
      const dateIso = this.toISODate(d);
      const slots = this.slotsForDate(d, ctx);
      if (slots.length === 0) continue;

      const counts = await this.bookedCountsForDate(dateIso, ctx);
      let addedForDay = 0;
      for (const t of slots) {
        if (addedForDay >= 2 || results.length >= max) break;
        const key = `${dateIso}|${t}`;
        if (key === excludeKey || taken.has(key)) continue;
        if ((counts.get(t) || 0) >= ctx.patientsPerSlot) continue;
        results.push({ date: dateIso, time: t });
        addedForDay++;
      }
    }
    return results;
  }

  private async loadScheduleContext(
    hospitalId: string,
    doctorProfileId: string,
  ): Promise<{
    ctx: DoctorScheduleContext;
    doctor: any;
    consultationFee: number;
  }> {
    const doctor =
      await this.doctorRepository.getDoctorProfileById(doctorProfileId);
    if (!doctor) {
      throw ApiError.notFound('Doctor not found');
    }

    // DoctorProfile is one shared document per user (not per hospital), so
    // its own `hospitalId` isn't a reliable membership check — HospitalMember
    // is the actual source of truth for "does this doctor belong here".
    const membershipSnap =
      await this.membershipRepository.getHospitalMembership(
        hospitalId,
        doctorProfileId,
      );
    if (membershipSnap.empty) {
      throw ApiError.notFound('Doctor membership not found in this hospital');
    }
    const membership = membershipSnap.docs[0].data() as any;

    const ctx: DoctorScheduleContext = {
      doctorProfileId,
      availability: membership.availability || [],
      duration: membership.appointmentDuration || 30,
      bufferMinutes: Math.max(0, membership.bufferMinutes || 0),
      patientsPerSlot: Math.max(1, membership.patientsPerSlot || 1),
      dateCache: new Map(),
    };

    return { ctx, doctor, consultationFee: membership.consultationFee || 0 };
  }

  async previewSchedule(hospitalId: string, body: PreviewPackageScheduleBody) {
    const { ctx, doctor, consultationFee } = await this.loadScheduleContext(
      hospitalId,
      body.doctorProfileId,
    );

    if (body.frequency === 'weekly' && body.daysOfWeek.length === 0) {
      throw ApiError.badRequest('Pick at least one day of the week');
    }

    const taken = new Set<string>();
    let planned = new Date(`${body.startDate}T00:00:00`);
    const visits: any[] = [];

    for (let i = 0; i < body.count; i++) {
      if (i > 0) {
        if (body.frequency === 'every-3-days') {
          planned = this.addDays(planned, 3);
        } else {
          let guard = 0;
          do {
            planned = this.addDays(planned, 1);
            guard++;
          } while (!body.daysOfWeek.includes(planned.getDay()) && guard < 15);
        }
      }

      const result = await this.place(planned, body.preferredTime, ctx, taken);
      if (!('unplaced' in result)) {
        taken.add(`${result.date}|${result.time}`);
      }
      const alternates =
        'unplaced' in result
          ? []
          : await this.alternatesFor(
              planned,
              `${result.date}|${result.time}`,
              ctx,
              taken,
            );

      visits.push({
        visitNumber: i + 1,
        plannedDate: this.toISODate(planned),
        ...result,
        alternates,
      });
    }

    return {
      doctor: {
        id: (doctor as any).id,
        name: (doctor as any).name,
        specialization: (doctor as any).specialization,
        consultationFee,
        appointmentDuration: ctx.duration,
      },
      visits,
    };
  }

  async getPackages(hospitalId: string, query: PackageListQuery) {
    const packages = await this.packageRepository.getPackagesByHospital(
      hospitalId,
      query.patientId,
    );
    return { packages, total: packages.length };
  }

  async sellPackage(
    hospitalId: string,
    user: JwtUser,
    userProfile: HospitalUserProfile,
    body: SellPackageBody,
  ) {
    const userRole = userProfile?.role;
    if (userRole !== 'admin' && userProfile?.hospitalId !== hospitalId) {
      throw ApiError.forbidden('Unauthorized - Access denied to this hospital');
    }

    const patientOk = await this.patientRepository.verifyPatientInHospital(
      body.patientId,
      hospitalId,
    );
    if (!patientOk) {
      throw ApiError.notFound('Patient not found in this hospital');
    }

    const doctor = await this.doctorRepository.getDoctorProfileById(
      body.doctorProfileId,
    );
    if (!doctor) {
      throw ApiError.notFound('Doctor not found');
    }

    const membershipSnap =
      await this.membershipRepository.getHospitalMembership(
        hospitalId,
        body.doctorProfileId,
      );
    if (membershipSnap.empty) {
      throw ApiError.notFound('Doctor not found in this hospital');
    }

    if (body.visits.length > body.totalVisits) {
      throw ApiError.badRequest(
        'Cannot book more visits than the package includes',
      );
    }

    const patient = await this.patientRepository.getPatientById(body.patientId);

    const totalPrice = body.pricePerVisit * body.totalVisits;
    const validUntilDate = new Date();
    validUntilDate.setMonth(
      validUntilDate.getMonth() + PACKAGE_VALIDITY_MONTHS,
    );

    const createdPackage = await this.packageRepository.createPackage({
      hospitalId,
      patientId: body.patientId,
      patientName: (patient as any)?.name,
      patientPhone: (patient as any)?.phone,
      doctorProfileId: body.doctorProfileId,
      doctorName: (doctor as any).name,
      totalVisits: body.totalVisits,
      usedVisits: body.visits.length,
      pricePerVisit: body.pricePerVisit,
      totalPrice,
      status: PACKAGE_STATUS.ACTIVE,
      validUntil: this.toISODate(validUntilDate),
      paymentMethod: body.paymentMethod,
      amountPaid: totalPrice,
      collectedBy: userProfile?.name || user.name,
      createdBy: user.uid,
    });

    let appointmentIds: string[] = [];
    if (body.visits.length > 0) {
      const appointmentsData = body.visits.map((visit, index) => ({
        hospitalId,
        doctorProfileId: body.doctorProfileId,
        doctorName: (doctor as any).name,
        doctorSpecialization: (doctor as any).specialization,
        patientId: body.patientId,
        patientName: (patient as any)?.name,
        patientPhone: (patient as any)?.phone,
        date: visit.date,
        time: visit.time,
        status: APPOINTMENT_STATUS.CONFIRMED,
        confirmedAt: new Date().toISOString(),
        type: APPOINTMENT_TYPE.PACKAGE,
        packageId: createdPackage.id,
        packageVisitNumber: index + 1,
        notes: `Package visit ${index + 1} of ${body.totalVisits}`,
        createdBy: user.uid,
        userRole,
      }));
      appointmentIds =
        await this.appointmentRepository.createAppointmentsBatch(
          appointmentsData,
        );
    }

    return {
      success: true,
      message: body.visits.length
        ? `Package sold — ${body.visits.length} of ${body.totalVisits} visits booked`
        : 'Package sold and activated as credits',
      package: createdPackage,
      appointmentIds,
    };
  }
}
