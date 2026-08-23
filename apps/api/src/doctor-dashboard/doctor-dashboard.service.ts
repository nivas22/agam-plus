import { Injectable } from '@nestjs/common';
import { AppointmentRepository } from '../repositories/appointment.repository';
import { PrescriptionRepository } from '../repositories/prescription.repository';
import { MembershipRepository } from '../repositories/membership.repository';
import { HospitalHolidayRepository } from '../repositories/hospital-holiday.repository';
import { LeaveRequestRepository } from '../repositories/leave-request.repository';
import { ReportsService } from '../reports/reports.service';
import { eachDateIso, slotsPerDay, toISODateLocal, weekdayName } from '../reports/reports.util';
import { APPOINTMENT_STATUS, APPOINTMENT_TYPE, HOLIDAY_CLOSURE_TYPE, LEAVE_REQUEST_STATUS } from '../constants';

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

function minutesBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 60000);
}

@Injectable()
export class DoctorDashboardService {
  constructor(
    private readonly appointmentRepository: AppointmentRepository,
    private readonly prescriptionRepository: PrescriptionRepository,
    private readonly membershipRepository: MembershipRepository,
    private readonly hospitalHolidayRepository: HospitalHolidayRepository,
    private readonly leaveRequestRepository: LeaveRequestRepository,
    private readonly reportsService: ReportsService,
  ) {}

  /* ------------------------------------------------------------------ */
  /*                          waiting on you                             */
  /* ------------------------------------------------------------------ */

  async getPending(hospitalId: string, doctorProfileId: string) {
    const today = toISODateLocal(new Date());
    const sinceDate = toISODateLocal(addDays(new Date(), -3));
    const yesterday = toISODateLocal(addDays(new Date(), -1));
    const followUpLookback = toISODateLocal(addDays(new Date(), -60));

    const [unwrittenNotesRaw, unsignedPrescriptionsRaw, overdueFollowUpsRaw, pendingLeaveRequests] =
      await Promise.all([
        this.appointmentRepository.getCompletedWithoutNotes(hospitalId, doctorProfileId, sinceDate),
        this.prescriptionRepository.listByHospitalAndDoctor(hospitalId, doctorProfileId, {
          status: 'draft',
        }),
        this.appointmentRepository.getFollowUps(hospitalId, doctorProfileId, {
          fromDate: followUpLookback,
          toDate: yesterday,
        }),
        this.leaveRequestRepository.listByHospital(hospitalId, {
          doctorProfileId,
          status: LEAVE_REQUEST_STATUS.PENDING,
        }),
      ]);

    const unwrittenNotes = (unwrittenNotesRaw as any[]).map((a) => ({
      appointmentId: a.id,
      patientName: a.patientName,
      completedAt: a.completedAt,
    }));

    const unsignedPrescriptions = (unsignedPrescriptionsRaw as any[])
      .filter((p) => (p.items?.length || 0) > 0)
      .map((p) => ({
        appointmentId: p.appointmentId,
        patientId: p.patientId,
        patientName: p.patientName,
        medicineCount: p.items.length,
        updatedAt: p.updatedAt,
      }));

    const missedFollowUps = (overdueFollowUpsRaw as any[])
      .filter((a) => a.status === APPOINTMENT_STATUS.PENDING)
      .map((a) => ({
        appointmentId: a.id,
        patientName: a.patientName,
        dueDate: a.date,
        daysOverdue: eachDateIso(a.date, today).length - 1,
      }));

    return {
      unwrittenNotes,
      unsignedPrescriptions,
      missedFollowUps,
      pendingLeaveRequest: (pendingLeaveRequests as any[])[0] || null,
    };
  }

  /* ------------------------------------------------------------------ */
  /*                            follow-ups due                          */
  /* ------------------------------------------------------------------ */

  async getFollowUpsDue(hospitalId: string, doctorProfileId: string, days: number) {
    const today = toISODateLocal(new Date());
    const fromDate = toISODateLocal(addDays(new Date(), -30));
    const toDate = toISODateLocal(addDays(new Date(), days));

    const followUps = await this.appointmentRepository.getFollowUps(hospitalId, doctorProfileId, {
      fromDate,
      toDate,
    });

    return (followUps as any[])
      .filter((a) => a.status !== APPOINTMENT_STATUS.CANCELLED)
      .map((a) => {
        if (a.status === APPOINTMENT_STATUS.PENDING) {
          const dayDelta = eachDateIso(a.date < today ? a.date : today, a.date < today ? today : a.date).length - 1;
          return {
            appointmentId: a.id,
            patientName: a.patientName,
            dueDate: a.date,
            state: a.date < today ? ('late' as const) : ('dueIn' as const),
            dayDelta,
          };
        }
        return {
          appointmentId: a.id,
          patientName: a.patientName,
          dueDate: a.date,
          state: 'booked' as const,
          bookedDate: a.date,
          bookedTime: a.time,
        };
      });
  }

  /* ------------------------------------------------------------------ */
  /*                              your week                              */
  /* ------------------------------------------------------------------ */

  async getWeekOverview(hospitalId: string, doctorProfileId: string, startDate: string) {
    const dates = eachDateIso(startDate, toISODateLocal(addDays(new Date(`${startDate}T00:00:00`), 6)));

    const [membership, holidays, leaveRequests] = await Promise.all([
      this.membershipRepository.getHospitalMembershipData(doctorProfileId, hospitalId),
      this.hospitalHolidayRepository.getActiveInRange(hospitalId, dates[0], dates[dates.length - 1]),
      this.leaveRequestRepository.getOverlappingForDoctor(
        hospitalId,
        doctorProfileId,
        dates[0],
        dates[dates.length - 1],
      ),
    ]);

    const availability: { day: string; startTime: string; endTime: string }[] =
      (membership as any)?.availability || [];
    const duration = (membership as any)?.appointmentDuration || 30;
    const bufferMinutes = Math.max(0, (membership as any)?.bufferMinutes || 0);
    const patientsPerSlot = Math.max(1, (membership as any)?.patientsPerSlot || 1);

    const days = await Promise.all(
      dates.map(async (date) => {
        const dayName = weekdayName(date);
        const windows = availability.filter((w) => w.day === dayName);

        const holiday = (holidays as any[]).find((h) => h.startsOn <= date && h.endsOn >= date);
        const leave = (leaveRequests as any[]).find((l) => l.startDate <= date && l.endDate >= date);

        const fullyClosed =
          !!holiday &&
          (holiday.closureType === HOLIDAY_CLOSURE_TYPE.FULL ||
            holiday.closureType === HOLIDAY_CLOSURE_TYPE.OPD_CLOSED) &&
          !holiday.exceptionDoctorIds?.includes(doctorProfileId);

        const effectiveWindows = fullyClosed
          ? []
          : holiday?.closureType === HOLIDAY_CLOSURE_TYPE.HALF_DAY && holiday.halfDayUntil
            ? windows
                .map((w) => ({ ...w, endTime: w.endTime < holiday.halfDayUntil ? w.endTime : holiday.halfDayUntil }))
                .filter((w) => w.startTime < w.endTime)
            : windows;

        const totalSlots = slotsPerDay(effectiveWindows, dayName, duration, bufferMinutes) * patientsPerSlot;
        const bookedCount = await this.appointmentRepository.getAppointmentCountInRange(
          hospitalId,
          doctorProfileId,
          date,
          date,
          { excludeStatuses: ['cancelled', 'no-show'] },
        );

        return {
          date,
          dayName,
          windows: effectiveWindows.map((w) => ({ startTime: w.startTime, endTime: w.endTime })),
          isWorkingDay: effectiveWindows.length > 0,
          totalSlots,
          bookedCount,
          holiday: holiday ? { name: holiday.name, closureType: holiday.closureType } : null,
          leave: leave ? { status: leave.status, startDate: leave.startDate, endDate: leave.endDate } : null,
        };
      }),
    );

    return { days };
  }

  /* ------------------------------------------------------------------ */
  /*                            practice stats                          */
  /* ------------------------------------------------------------------ */

  async getPracticeStats(hospitalId: string, doctorProfileId: string, month: string) {
    const [year, monthNum] = month.split('-').map(Number);
    const startDate = `${month}-01`;
    const endDate = toISODateLocal(new Date(year, monthNum, 0));
    const prevMonthDate = new Date(year, monthNum - 2, 1);
    const prevStartDate = toISODateLocal(prevMonthDate);
    const prevEndDate = toISODateLocal(new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth() + 1, 0));

    const [revenue, prevRevenue, noShows, completedAppointments] = await Promise.all([
      this.reportsService.getDoctorRevenue(hospitalId, { startDate, endDate }, doctorProfileId),
      this.reportsService.getDoctorRevenue(hospitalId, { startDate: prevStartDate, endDate: prevEndDate }, doctorProfileId),
      this.reportsService.getNoShows(hospitalId, { startDate, endDate }, doctorProfileId),
      this.appointmentRepository.getAppointmentsWithFilters({
        hospitalId,
        doctorProfileId,
        status: APPOINTMENT_STATUS.COMPLETED,
        startDate,
        endDate,
      }),
    ]);

    const current = revenue.table[0] || null;
    const previous = prevRevenue.table[0] || null;

    const durations = (completedAppointments as any[])
      .map((a) => (a.consultationStartedAt && a.completedAt ? minutesBetween(new Date(a.consultationStartedAt), new Date(a.completedAt)) : null))
      .filter((n): n is number => n != null && n >= 0);
    const avgConsultationMinutes = durations.length
      ? Math.round(durations.reduce((s, n) => s + n, 0) / durations.length)
      : null;

    // Approximation: there's no dedicated "notes saved at" timestamp, so a
    // note counts as "same day" when the appointment's last update landed on
    // the same calendar day it was completed.
    const withNotes = (completedAppointments as any[]).filter((a) => a.sessionNotes);
    const sameDayNotes = withNotes.filter(
      (a) => a.completedAt && a.updatedAt && toISODateLocal(new Date(a.completedAt)) === toISODateLocal(new Date(a.updatedAt)),
    );
    const notesSameDayPct = withNotes.length ? Math.round((sameDayNotes.length / withNotes.length) * 100) : null;

    const clinicDaysCount = new Set((completedAppointments as any[]).map((a) => a.date)).size;

    return {
      range: { startDate, endDate },
      patientsSeen: { value: current?.visits ?? 0, delta: current && previous ? current.visits - previous.visits : null, clinicDaysCount },
      avgConsultationMinutes,
      diaryFilledPct: {
        value: current?.diaryFullPct ?? null,
        delta: current?.diaryFullPct != null && previous?.diaryFullPct != null ? current.diaryFullPct - previous.diaryFullPct : null,
      },
      billed: { value: current?.billed ?? 0, delta: current && previous ? current.billed - previous.billed : null, avgPerVisit: current?.avgPerVisit ?? 0 },
      noShowPct: {
        value: current?.noShowPct ?? null,
        delta: current?.noShowPct != null && previous?.noShowPct != null ? current.noShowPct - previous.noShowPct : null,
      },
      notesSameDayPct,
      insight: noShows.insight || null,
    };
  }

  /* ------------------------------------------------------------------ */
  /*                         yesterday summary                          */
  /* ------------------------------------------------------------------ */

  async getYesterdaySummary(hospitalId: string, doctorProfileId: string) {
    const yesterday = toISODateLocal(addDays(new Date(), -1));

    const [completed, noShows, signedPrescriptions] = await Promise.all([
      this.appointmentRepository.getAppointmentsWithFilters({
        hospitalId,
        doctorProfileId,
        status: APPOINTMENT_STATUS.COMPLETED,
        startDate: yesterday,
        endDate: yesterday,
      }),
      this.appointmentRepository.getAppointmentsWithFilters({
        hospitalId,
        doctorProfileId,
        status: APPOINTMENT_STATUS.NO_SHOW,
        startDate: yesterday,
        endDate: yesterday,
      }),
      this.prescriptionRepository.listByHospitalAndDoctor(hospitalId, doctorProfileId, {
        status: 'signed',
        fromDate: yesterday,
        toDate: yesterday,
      }),
    ]);

    const durations = (completed as any[])
      .map((a) => (a.consultationStartedAt && a.completedAt ? minutesBetween(new Date(a.consultationStartedAt), new Date(a.completedAt)) : null))
      .filter((n): n is number => n != null && n >= 0);

    return {
      date: yesterday,
      patientsSeenCount: completed.length,
      consultationMinutes: durations.reduce((s, n) => s + n, 0),
      prescriptionsSignedCount: signedPrescriptions.length,
      notesUnwrittenCount: (completed as any[]).filter((a) => !a.sessionNotes).length,
      noShows: {
        count: noShows.length,
        times: (noShows as any[]).map((a) => a.time).filter(Boolean),
      },
    };
  }
}
