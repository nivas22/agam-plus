import { Injectable } from '@nestjs/common';
import { PaymentRepository } from '../repositories/payment.repository';
import { PaymentDayCloseRepository } from '../repositories/payment-day-close.repository';
import { PackageRepository } from '../repositories/package.repository';
import { AppointmentRepository } from '../repositories/appointment.repository';
import { MembershipRepository } from '../repositories/membership.repository';
import { DoctorRepository } from '../repositories/doctor.repository';
import { APPOINTMENT_STATUS, MEMBERSHIP_STATUS, ROLE } from '../constants';
import { DateRangeQuery } from './reports.types';
import {
  AGE_BUCKETS,
  LEAD_TIME_BUCKETS,
  ageDaysBetween,
  bucketForAge,
  bucketForLeadDays,
  capacityForRange,
  dayBoundsUTC,
  eachDateIso,
  timeSlotIndexFor,
  toISODateLocal,
  TIME_SLOTS,
} from './reports.util';

const HEATMAP_DAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

@Injectable()
export class ReportsService {
  constructor(
    private readonly paymentRepository: PaymentRepository,
    private readonly paymentDayCloseRepository: PaymentDayCloseRepository,
    private readonly packageRepository: PackageRepository,
    private readonly appointmentRepository: AppointmentRepository,
    private readonly membershipRepository: MembershipRepository,
    private readonly doctorRepository: DoctorRepository,
  ) {}

  private resolveMonthRange(query: DateRangeQuery): { startDate: string; endDate: string } {
    if (query.startDate && query.endDate) return { startDate: query.startDate, endDate: query.endDate };
    const now = new Date();
    const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    return { startDate, endDate: toISODateLocal(now) };
  }

  private resolveLast3MonthsRange(query: DateRangeQuery): { startDate: string; endDate: string } {
    if (query.startDate && query.endDate) return { startDate: query.startDate, endDate: query.endDate };
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate() + 1);
    return { startDate: toISODateLocal(start), endDate: toISODateLocal(now) };
  }

  async getDailyCollection(hospitalId: string, query: DateRangeQuery) {
    const { startDate, endDate } = this.resolveMonthRange(query);
    const { start, end } = dayBoundsUTC(startDate, endDate);

    const [byDay, byUser, activeDatesByUser, activeDates, packagesByDay, closedDates, varianceByUser, dueTotal, refunds, earned] =
      await Promise.all([
        this.paymentRepository.aggregateCollectionByDay(hospitalId, start, end),
        this.paymentRepository.aggregateCollectionByUser(hospitalId, start, end),
        this.paymentRepository.listActiveDatesByUser(hospitalId, start, end),
        this.paymentRepository.listActiveDates(hospitalId, start, end),
        this.packageRepository.aggregateSalesByDay(hospitalId, start, end),
        this.paymentDayCloseRepository.listClosedDatesInRange(hospitalId, startDate, endDate),
        this.paymentDayCloseRepository.aggregateVarianceByUserInRange(hospitalId, startDate, endDate),
        this.paymentRepository.sumDueTotal(hospitalId),
        this.paymentRepository.sumRefundsInRange(hospitalId, start, end),
        this.paymentRepository.sumEarnedInRange(hospitalId, start, end),
      ]);

    const packageByDate = new Map(packagesByDay.map((p) => [p.date, p.amount]));
    const closedSet = new Set(closedDates);
    const days = eachDateIso(startDate, endDate).map((date) => {
      const row = byDay.find((r) => r.date === date);
      return {
        date,
        cash: row?.cash ?? 0,
        upi: row?.upi ?? 0,
        packageSales: packageByDate.get(date) ?? 0,
        closed: closedSet.has(date),
      };
    });

    const totalCash = byDay.reduce((s, r) => s + r.cash, 0);
    const totalUpi = byDay.reduce((s, r) => s + r.upi, 0);
    const totalPackageSales = packagesByDay.reduce((s, r) => s + r.amount, 0);
    const collected = totalCash + totalUpi + totalPackageSales;

    const varianceMap = new Map(varianceByUser.map((v) => [v.userId, v]));
    const byUserRows = byUser
      .map((u) => {
        const activeDays = activeDatesByUser[u.userId] ?? [];
        const closedActiveDays = activeDays.filter((d) => closedSet.has(d)).length;
        const variance = varianceMap.get(u.userId);
        return {
          userId: u.userId,
          name: u.name || 'Unknown',
          cash: u.cash,
          upi: u.upi,
          total: u.cash + u.upi,
          paymentCount: u.paymentCount,
          drawerVariance: variance?.total ?? 0,
          activeDays: activeDays.length,
          closedDays: closedActiveDays,
        };
      })
      .sort((a, b) => b.total - a.total);

    const unclosedDates = activeDates.filter((d) => !closedSet.has(d)).sort();
    const totalVariance = varianceByUser.reduce((s, v) => s + v.total, 0);

    const insight =
      unclosedDates.length > 0
        ? `${unclosedDates.length} day${unclosedDates.length === 1 ? '' : 's'} in this range ${unclosedDates.length === 1 ? 'was' : 'were'} never closed. Until a day is closed the drawer isn't counted, so a shortfall would go unnoticed.`
        : activeDates.length > 0
          ? `Every active day in this range has been closed — the drawer is fully reconciled.`
          : `No payments were collected in this range yet.`;

    return {
      range: { startDate, endDate },
      tiles: {
        collected: { amount: collected, activeDays: activeDates.length },
        earned: { amount: earned },
        raisedButUnpaid: { amount: dueTotal.total, billCount: dueTotal.billCount, patientCount: dueTotal.patientCount },
        refunded: { amount: refunds.total, count: refunds.count },
      },
      chart: { days },
      byUser: byUserRows,
      totals: { cash: totalCash, upi: totalUpi, packageSales: totalPackageSales, drawerVariance: totalVariance },
      unclosedDates,
      insight,
    };
  }

  async getDoctorRevenue(hospitalId: string, query: DateRangeQuery, scopeDoctorProfileId?: string) {
    const { startDate, endDate } = this.resolveMonthRange(query);
    const { start, end } = dayBoundsUTC(startDate, endDate);

    const [revenueByDoctorAll, appointmentsAll, doctorMembersAll] = await Promise.all([
      this.paymentRepository.aggregateRevenueByDoctor(hospitalId, start, end),
      this.appointmentRepository.getAppointmentsWithFilters({ hospitalId, startDate, endDate }),
      this.membershipRepository.getHospitalMembers(hospitalId, { role: ROLE.DOCTOR, status: MEMBERSHIP_STATUS.APPROVED }),
    ]);

    // A doctor caller only ever gets their own row — filter every input
    // before it feeds the aggregation below, so nothing else can leak through.
    const revenueByDoctor = scopeDoctorProfileId
      ? revenueByDoctorAll.filter((r) => r.doctorProfileId === scopeDoctorProfileId)
      : revenueByDoctorAll;
    const appointments = scopeDoctorProfileId
      ? (appointmentsAll as any[]).filter((a) => a.doctorProfileId === scopeDoctorProfileId)
      : appointmentsAll;
    const doctorMembers = scopeDoctorProfileId
      ? doctorMembersAll.filter((m: any) => m.userId === scopeDoctorProfileId)
      : doctorMembersAll;

    const doctorProfiles = await this.doctorRepository.getDoctorProfilesByUserIds(
      doctorMembers.map((m: any) => m.userId).filter(Boolean),
    );
    const profileByUserId = new Map(doctorProfiles.map((p: any) => [p.userId, p]));
    const memberByUserId = new Map(doctorMembers.map((m: any) => [m.userId, m]));

    // Anything that still held a slot counts as "booked" for diary-fill
    // purposes — cancelled appointments freed the slot back up.
    const bookingsByDoctor = new Map<string, { total: number; noShows: number }>();
    for (const appt of appointments as any[]) {
      if (!appt.doctorProfileId || appt.status === 'cancelled') continue;
      const entry = bookingsByDoctor.get(appt.doctorProfileId) || { total: 0, noShows: 0 };
      entry.total += 1;
      if (appt.status === APPOINTMENT_STATUS.NO_SHOW) entry.noShows += 1;
      bookingsByDoctor.set(appt.doctorProfileId, entry);
    }

    const revenueByDoctorId = new Map(revenueByDoctor.map((r) => [r.doctorProfileId, r]));
    const doctorIds = new Set<string>(
      [...revenueByDoctorId.keys(), ...bookingsByDoctor.keys(), ...memberByUserId.keys()].filter(Boolean) as string[],
    );

    const rows = Array.from(doctorIds).map((doctorProfileId) => {
      const revenue = revenueByDoctorId.get(doctorProfileId);
      const bookings = bookingsByDoctor.get(doctorProfileId);
      const member: any = memberByUserId.get(doctorProfileId);
      const profile: any = profileByUserId.get(doctorProfileId);

      const capacity = member ? capacityForRange(member, startDate, endDate) : 0;
      const booked = bookings?.total ?? 0;
      const noShows = bookings?.noShows ?? 0;
      const visits = revenue?.visits ?? 0;
      const billed = revenue?.billed ?? 0;

      return {
        doctorProfileId,
        name: revenue?.doctorName || profile?.name || 'Unknown doctor',
        specialization: member?.specialization || profile?.specialization || null,
        consultationFee: member?.consultationFee ?? null,
        visits,
        billed,
        collected: revenue?.collected ?? 0,
        outstanding: revenue?.outstanding ?? 0,
        fromPackages: revenue?.fromPackages ?? 0,
        avgPerVisit: visits > 0 ? Math.round(billed / visits) : 0,
        diaryFullPct: capacity > 0 ? Math.round((booked / capacity) * 100) : null,
        noShowPct: booked > 0 ? Math.round((noShows / booked) * 100) : null,
      };
    });

    rows.sort((a, b) => b.billed - a.billed);

    const totals = rows.reduce(
      (acc, r) => ({
        visits: acc.visits + r.visits,
        billed: acc.billed + r.billed,
        collected: acc.collected + r.collected,
        outstanding: acc.outstanding + r.outstanding,
        fromPackages: acc.fromPackages + r.fromPackages,
      }),
      { visits: 0, billed: 0, collected: 0, outstanding: 0, fromPackages: 0 },
    );

    // Top 4 individually, everyone else grouped — matches how the chart
    // reads once a hospital has more than a handful of doctors.
    const chartDoctors = rows.slice(0, 4).map((r) => ({ name: r.name, billed: r.billed }));
    if (rows.length > 4) {
      const rest = rows.slice(4);
      chartDoctors.push({
        name: `${rest.length} other doctor${rest.length === 1 ? '' : 's'}`,
        billed: rest.reduce((s, r) => s + r.billed, 0),
      });
    }

    const withDiary = rows.filter((r) => r.diaryFullPct !== null && r.visits > 0);
    const busiest = withDiary.slice().sort((a, b) => (b.diaryFullPct as number) - (a.diaryFullPct as number))[0];
    const quietest = withDiary.slice().sort((a, b) => (a.diaryFullPct as number) - (b.diaryFullPct as number))[0];
    const insight =
      busiest && quietest && busiest.doctorProfileId !== quietest.doctorProfileId
        ? `${busiest.name} has the fullest diary at ${busiest.diaryFullPct}% — capacity, not demand, is the constraint there. ${quietest.name} has the most open capacity at ${quietest.diaryFullPct}% booked.`
        : 'Not enough scheduling data yet to compare diary utilization across doctors.';

    return {
      range: { startDate, endDate },
      chart: { doctors: chartDoctors },
      table: rows,
      totals,
      insight,
    };
  }

  async getDuesAging(hospitalId: string) {
    const now = new Date();
    const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const endDate = toISODateLocal(now);
    const { start, end } = dayBoundsUTC(startDate, endDate);

    const [duePayments, recovered] = await Promise.all([
      this.paymentRepository.listDuePayments(hospitalId),
      this.paymentRepository.sumRecoveredInRange(hospitalId, start, end),
    ]);

    const rows = duePayments
      .map((p: any) => {
        const ageDays = ageDaysBetween(new Date(p.createdAt), now);
        return {
          paymentId: p.id,
          patientId: p.patientId,
          patientName: p.patientName,
          patientPhone: p.patientPhone,
          doctorName: p.doctorName,
          invoiceNumber: p.invoiceNumber,
          amount: p.total,
          ageDays,
          bucket: bucketForAge(ageDays),
          createdAt: p.createdAt,
        };
      })
      .sort((a, b) => b.ageDays - a.ageDays);

    const buckets = AGE_BUCKETS.map((label) => {
      const inBucket = rows.filter((r) => r.bucket === label);
      return { label, amount: inBucket.reduce((s, r) => s + r.amount, 0), count: inBucket.length };
    });

    const totalOutstanding = rows.reduce((s, r) => s + r.amount, 0);
    const under15 = rows.filter((r) => r.ageDays <= 15).reduce((s, r) => s + r.amount, 0);
    const over30Rows = rows.filter((r) => r.ageDays > 30);
    const over30Total = over30Rows.reduce((s, r) => s + r.amount, 0);
    const patientCount = new Set(rows.map((r) => r.patientId)).size;

    const byPatient = new Map<string, typeof over30Rows>();
    for (const r of over30Rows) {
      const key = r.patientId || r.patientName || 'unknown';
      byPatient.set(key, [...(byPatient.get(key) || []), r]);
    }
    const repeatPatients = [...byPatient.values()].filter((arr) => arr.length > 1);

    const insight =
      over30Rows.length === 0
        ? 'No bills are over 30 days past due right now.'
        : repeatPatients.length > 0
          ? `${repeatPatients.length} patient${repeatPatients.length === 1 ? '' : 's'} account for ₹${repeatPatients
              .flat()
              .reduce((s, r) => s + r.amount, 0)
              .toLocaleString('en-IN')} of the over-30-day pile with more than one unpaid bill each — worth asking them to settle before the next booking.`
          : `₹${over30Total.toLocaleString('en-IN')} is over 30 days past due across ${over30Rows.length} bill${over30Rows.length === 1 ? '' : 's'}.`;

    return {
      asOf: endDate,
      tiles: {
        totalOutstanding: { amount: totalOutstanding, billCount: rows.length, patientCount },
        under15: { amount: under15 },
        over30: { amount: over30Total, billCount: over30Rows.length },
        recovered: { amount: recovered.total, count: recovered.count, month: startDate.slice(0, 7) },
      },
      buckets,
      table: rows,
      insight,
    };
  }

  async getNoShows(hospitalId: string, query: DateRangeQuery, scopeDoctorProfileId?: string) {
    const { startDate, endDate } = this.resolveLast3MonthsRange(query);
    const periodDays = eachDateIso(startDate, endDate).length;

    const prevEnd = new Date(`${startDate}T00:00:00.000Z`);
    prevEnd.setUTCDate(prevEnd.getUTCDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setUTCDate(prevStart.getUTCDate() - periodDays + 1);
    const prevStartIso = prevStart.toISOString().slice(0, 10);
    const prevEndIso = prevEnd.toISOString().slice(0, 10);

    const [appointmentsAll, prevAppointmentsAll, doctorMembersAll] = await Promise.all([
      this.appointmentRepository.getAppointmentsWithFilters({ hospitalId, startDate, endDate }),
      this.appointmentRepository.getAppointmentsWithFilters({ hospitalId, startDate: prevStartIso, endDate: prevEndIso }),
      this.membershipRepository.getHospitalMembers(hospitalId, { role: ROLE.DOCTOR }),
    ]);

    // A doctor caller only ever gets their own row — filter every input
    // before it feeds the aggregation below, so nothing else can leak through.
    const appointments = scopeDoctorProfileId
      ? (appointmentsAll as any[]).filter((a) => a.doctorProfileId === scopeDoctorProfileId)
      : appointmentsAll;
    const prevAppointments = scopeDoctorProfileId
      ? (prevAppointmentsAll as any[]).filter((a) => a.doctorProfileId === scopeDoctorProfileId)
      : prevAppointmentsAll;
    const doctorMembers = scopeDoctorProfileId
      ? doctorMembersAll.filter((m: any) => m.userId === scopeDoctorProfileId)
      : doctorMembersAll;

    const memberByUserId = new Map(doctorMembers.map((m: any) => [m.userId, m]));

    const booked = (appointments as any[]).filter((a) => a.status !== 'cancelled');
    const noShowAppts = booked.filter((a) => a.status === APPOINTMENT_STATUS.NO_SHOW);
    const totalCount = booked.length;
    const noShowCount = noShowAppts.length;
    const noShowRate = totalCount > 0 ? noShowCount / totalCount : 0;

    const prevBooked = (prevAppointments as any[]).filter((a) => a.status !== 'cancelled');
    const prevNoShows = prevBooked.filter((a) => a.status === APPOINTMENT_STATUS.NO_SHOW).length;
    const prevRate = prevBooked.length > 0 ? prevNoShows / prevBooked.length : 0;

    let slotsLostMinutes = 0;
    let slotsLostValue = 0;
    for (const appt of noShowAppts) {
      const member: any = memberByUserId.get(appt.doctorProfileId);
      slotsLostMinutes += member?.appointmentDuration || 30;
      slotsLostValue += member?.consultationFee || 0;
    }

    const byDoctorMap = new Map<string, { name: string; total: number; noShows: number }>();
    for (const appt of booked) {
      if (!appt.doctorProfileId) continue;
      const entry = byDoctorMap.get(appt.doctorProfileId) || { name: appt.doctorName || 'Unknown doctor', total: 0, noShows: 0 };
      entry.total += 1;
      if (appt.status === APPOINTMENT_STATUS.NO_SHOW) entry.noShows += 1;
      byDoctorMap.set(appt.doctorProfileId, entry);
    }
    const byDoctor = [...byDoctorMap.entries()]
      .map(([doctorProfileId, v]) => ({
        doctorProfileId,
        name: v.name,
        totalCount: v.total,
        noShowCount: v.noShows,
        rate: v.total > 0 ? Math.round((v.noShows / v.total) * 100) : 0,
      }))
      .sort((a, b) => b.rate - a.rate);

    const leadTimeTotals = new Map<string, { total: number; noShows: number }>();
    for (const bucket of LEAD_TIME_BUCKETS) leadTimeTotals.set(bucket, { total: 0, noShows: 0 });
    for (const appt of booked) {
      if (!appt.date || !appt.createdAt) continue;
      const leadDays = ageDaysBetween(new Date(appt.createdAt), new Date(`${appt.date}T00:00:00.000Z`));
      const bucket = bucketForLeadDays(leadDays);
      const entry = leadTimeTotals.get(bucket)!;
      entry.total += 1;
      if (appt.status === APPOINTMENT_STATUS.NO_SHOW) entry.noShows += 1;
    }
    const byLeadTime = LEAD_TIME_BUCKETS.map((bucket) => {
      const entry = leadTimeTotals.get(bucket)!;
      return { bucket, totalCount: entry.total, noShowCount: entry.noShows, rate: entry.total > 0 ? Math.round((entry.noShows / entry.total) * 100) : 0 };
    });

    // 6-row (time-slot) x 6-column (Mon-Sat) grid — Sunday is excluded, same
    // as the clinic's closed day.
    const heatTotals: number[][] = TIME_SLOTS.map(() => HEATMAP_DAY_ORDER.map(() => 0));
    const heatNoShows: number[][] = TIME_SLOTS.map(() => HEATMAP_DAY_ORDER.map(() => 0));
    for (const appt of booked) {
      if (!appt.date) continue;
      const dow = new Date(`${appt.date}T00:00:00.000Z`).getUTCDay(); // 0=Sun..6=Sat
      if (dow === 0) continue;
      const dayIdx = dow - 1; // Mon=0..Sat=5
      const slotIdx = timeSlotIndexFor(appt.time);
      if (slotIdx < 0) continue;
      heatTotals[slotIdx][dayIdx] += 1;
      if (appt.status === APPOINTMENT_STATUS.NO_SHOW) heatNoShows[slotIdx][dayIdx] += 1;
    }
    const heatmap = {
      days: [...HEATMAP_DAY_ORDER],
      slots: TIME_SLOTS.map((s) => s.label),
      cells: TIME_SLOTS.map((_, slotIdx) =>
        HEATMAP_DAY_ORDER.map((_, dayIdx) => {
          const total = heatTotals[slotIdx][dayIdx];
          const noShows = heatNoShows[slotIdx][dayIdx];
          return { total, noShows, rate: total > 0 ? Math.round((noShows / total) * 100) : 0 };
        }),
      ),
    };

    const repeatOffenderCounts = new Map<string, number>();
    for (const appt of noShowAppts) {
      if (!appt.patientId) continue;
      repeatOffenderCounts.set(appt.patientId, (repeatOffenderCounts.get(appt.patientId) || 0) + 1);
    }
    const repeatOffenders = [...repeatOffenderCounts.values()].filter((c) => c >= 3).length;

    const worstLeadBucket = byLeadTime
      .filter((b) => b.totalCount >= 5)
      .sort((a, b) => b.rate - a.rate)[0];
    const insight = worstLeadBucket
      ? `No-shows are highest for visits booked "${worstLeadBucket.bucket.toLowerCase()}" (${worstLeadBucket.rate}%). Reminders matter most for that group — same-day bookings rarely miss.`
      : 'Not enough bookings yet to spot a lead-time pattern.';

    return {
      range: { startDate, endDate },
      tiles: {
        noShowRate: { rate: Math.round(noShowRate * 1000) / 10, noShowCount, totalCount },
        trend: { deltaPoints: Math.round((noShowRate - prevRate) * 1000) / 10, previousRate: Math.round(prevRate * 1000) / 10 },
        slotsLost: { hours: Math.round((slotsLostMinutes / 60) * 10) / 10, valueEstimate: slotsLostValue },
        repeatOffenders: { count: repeatOffenders },
      },
      byDoctor,
      byLeadTime,
      heatmap,
      insight,
    };
  }
}
