// components/doctors/DoctorProfilePage.tsx
"use client";

import { format } from "date-fns";
import { ArrowLeft, Package as PackageIcon, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useHospitalAppointments } from "@/hooks/useNewAppointmentsApi";
import { useHospitalDoctor } from "@/hooks/useNewDoctorApi";
import { usePackagesList } from "@/hooks/useNewPackageApi";
import { useHospitalPayments } from "@/hooks/useNewPaymentApi";
import type { AppointmentWithDetails } from "@/types/appointment";
import type { Payment } from "@/types/payment";
import { APPOINTMENT_STATUS, PACKAGE_DISPLAY_STATUS } from "../../constants";
import DoctorAvatar from "./DoctorAvatar";

interface DoctorProfilePageProps {
  hospitalId: string;
  doctorId: string;
}

const DAY_LABELS_SHORT: Record<string, string> = {
  Monday: "Mon",
  Tuesday: "Tue",
  Wednesday: "Wed",
  Thursday: "Thu",
  Friday: "Fri",
  Saturday: "Sat",
  Sunday: "Sun",
};
const WEEK_ORDER = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

function money(v: number): string {
  return `₹${Math.round(v).toLocaleString("en-IN")}`;
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function toHHMM(mins: number): string {
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
}

function formatTime12h(time: string): string {
  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours, 10);
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${period}`;
}

function formatHours(h: number): string {
  return `${Number(h.toFixed(1))}h`;
}

interface TimeSlotLike {
  day: string;
  startTime: string;
  endTime: string;
}

function windowsForWeekday(availability: TimeSlotLike[], weekday: string) {
  return availability.filter((w) => w.day === weekday);
}

function slotsForWindow(
  startTime: string,
  endTime: string,
  duration: number,
): string[] {
  const slots: string[] = [];
  let cur = toMinutes(startTime);
  const end = toMinutes(endTime);
  while (cur + duration <= end) {
    slots.push(toHHMM(cur));
    cur += duration;
  }
  return slots;
}

function slotCountForWeekday(
  availability: TimeSlotLike[],
  weekday: string,
  duration: number,
): number {
  return windowsForWeekday(availability, weekday).reduce(
    (sum, w) => sum + slotsForWindow(w.startTime, w.endTime, duration).length,
    0,
  );
}

function hoursForWeekday(
  availability: TimeSlotLike[],
  weekday: string,
): number {
  return windowsForWeekday(availability, weekday).reduce(
    (sum, w) => sum + (toMinutes(w.endTime) - toMinutes(w.startTime)) / 60,
    0,
  );
}

export default function DoctorProfilePage({
  hospitalId,
  doctorId,
}: DoctorProfilePageProps) {
  const router = useRouter();
  const { currentHospital, getCurrentHospitalRole } = useAuth();
  const userRole = getCurrentHospitalRole() || "admin";

  const { data: doctorData, isLoading: doctorLoading } = useHospitalDoctor(
    doctorId,
    hospitalId,
  );
  const doctor = doctorData?.doctor;

  const today = useMemo(() => new Date(), []);
  const todayIso = useMemo(() => toISODate(today), [today]);
  const monthStart = useMemo(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
    [today],
  );
  const monthEnd = useMemo(
    () => new Date(today.getFullYear(), today.getMonth() + 1, 0),
    [today],
  );
  const monthStartIso = useMemo(() => toISODate(monthStart), [monthStart]);
  const monthEndIso = useMemo(() => toISODate(monthEnd), [monthEnd]);
  const weekStart = useMemo(() => {
    const dow = today.getDay();
    const diffToMonday = dow === 0 ? -6 : 1 - dow;
    return addDays(today, diffToMonday);
  }, [today]);

  const rangeStartIso = useMemo(
    () => (weekStart < monthStart ? toISODate(weekStart) : monthStartIso),
    [weekStart, monthStart, monthStartIso],
  );
  const rangeEndIso = useMemo(() => {
    const weekEnd = addDays(weekStart, 6);
    return weekEnd > monthEnd ? toISODate(weekEnd) : monthEndIso;
  }, [weekStart, monthEnd, monthEndIso]);

  const apptParams = useMemo(() => {
    const p = new URLSearchParams();
    p.append("doctorId", doctorId);
    p.append("startDate", rangeStartIso);
    p.append("endDate", rangeEndIso);
    return p;
  }, [doctorId, rangeStartIso, rangeEndIso]);
  const { data: apptData, isLoading: apptLoading } = useHospitalAppointments(
    hospitalId,
    apptParams,
    userRole,
  );
  const rangeAppointments = apptData?.appointments || [];
  const monthAppointments = useMemo(
    () =>
      rangeAppointments.filter(
        (a) => a.date >= monthStartIso && a.date <= monthEndIso,
      ),
    [rangeAppointments, monthStartIso, monthEndIso],
  );

  const paymentParams = useMemo(() => {
    const p = new URLSearchParams();
    p.append("doctorProfileId", doctorId);
    p.append("startDate", `${monthStartIso}T00:00:00.000Z`);
    p.append("endDate", `${monthEndIso}T23:59:59.999Z`);
    return p;
  }, [doctorId, monthStartIso, monthEndIso]);
  const { data: paymentsData } = useHospitalPayments(hospitalId, paymentParams);
  const monthPayments = paymentsData?.payments || [];

  const { data: packagesData } = usePackagesList(
    hospitalId,
    undefined,
    doctorId,
  );
  const doctorPackages = packagesData?.packages || [];

  const paymentByAppointmentId = useMemo(() => {
    const map = new Map<string, Payment>();
    monthPayments.forEach((p) => {
      map.set(p.appointmentId, p);
    });
    return map;
  }, [monthPayments]);

  const availability: TimeSlotLike[] = doctor?.availability || [];
  const duration = doctor?.appointmentDuration || 30;

  const monthStats = useMemo(() => {
    const completed = monthAppointments.filter(
      (a) => a.status === APPOINTMENT_STATUS.COMPLETED,
    ).length;
    const noShowsAndCancels = monthAppointments.filter(
      (a) =>
        a.status === APPOINTMENT_STATUS.NO_SHOW ||
        a.status === APPOINTMENT_STATUS.CANCELLED,
    ).length;
    const totalBooked = monthAppointments.length;
    const billed = monthPayments.reduce((sum, p) => sum + p.total, 0);
    const packagesSoldAmount = doctorPackages
      .filter(
        (pkg) =>
          toISODate(new Date(pkg.createdAt)) >= monthStartIso &&
          toISODate(new Date(pkg.createdAt)) <= monthEndIso,
      )
      .reduce((sum, pkg) => sum + pkg.totalPrice, 0);

    let totalOpenSlots = 0;
    const cursor = new Date(monthStart);
    while (cursor <= monthEnd) {
      const weekday = cursor.toLocaleDateString("en-US", { weekday: "long" });
      totalOpenSlots += slotCountForWeekday(availability, weekday, duration);
      cursor.setDate(cursor.getDate() + 1);
    }
    const utilization =
      totalOpenSlots > 0 ? (totalBooked / totalOpenSlots) * 100 : 0;

    return {
      completed,
      noShowsAndCancels,
      totalBooked,
      billed,
      packagesSoldAmount,
      totalOpenSlots,
      utilization,
    };
  }, [
    monthAppointments,
    monthPayments,
    doctorPackages,
    monthStartIso,
    monthEndIso,
    monthStart,
    monthEnd,
    availability,
    duration,
  ]);

  const packageStats = useMemo(() => {
    const relevant = doctorPackages.filter(
      (pkg) =>
        pkg.displayStatus === PACKAGE_DISPLAY_STATUS.ACTIVE ||
        pkg.displayStatus === PACKAGE_DISPLAY_STATUS.LAPSING,
    );
    const holders = new Set(relevant.map((pkg) => pkg.patientId));
    const visitsOutstanding = relevant.reduce(
      (sum, pkg) => sum + pkg.remainingVisits,
      0,
    );
    const valueOwed = relevant.reduce((sum, pkg) => sum + pkg.valueLeft, 0);
    return { holders: holders.size, visitsOutstanding, valueOwed };
  }, [doctorPackages]);

  const todayWeekday = today.toLocaleDateString("en-US", { weekday: "long" });
  const todaySlots = useMemo(() => {
    const windows = windowsForWeekday(availability, todayWeekday);
    const appointmentsToday = monthAppointments.filter(
      (a) => a.date === todayIso && a.status !== APPOINTMENT_STATUS.CANCELLED,
    );
    const byTime = new Map<string, AppointmentWithDetails>();
    appointmentsToday.forEach((a) => {
      byTime.set(a.time, a);
    });

    const slots: {
      time: string;
      appointment?: AppointmentWithDetails;
    }[] = [];
    windows.forEach((w) => {
      slotsForWindow(w.startTime, w.endTime, duration).forEach((t) => {
        slots.push({ time: t, appointment: byTime.get(t) });
      });
    });
    return slots.sort((a, b) => a.time.localeCompare(b.time));
  }, [availability, todayWeekday, monthAppointments, todayIso, duration]);
  const bookedTodayCount = todaySlots.filter((s) => s.appointment).length;

  const weekBars = useMemo(
    () =>
      WEEK_ORDER.map((weekday, i) => {
        const dateIso = toISODate(addDays(weekStart, i));
        const totalSlots = slotCountForWeekday(availability, weekday, duration);
        const hours = hoursForWeekday(availability, weekday);
        const bookedCount = rangeAppointments.filter(
          (a) =>
            a.date === dateIso && a.status !== APPOINTMENT_STATUS.CANCELLED,
        ).length;
        return {
          weekday,
          hours,
          pct:
            totalSlots > 0
              ? Math.min(100, (bookedCount / totalSlots) * 100)
              : 0,
          off: totalSlots === 0,
        };
      }),
    [availability, duration, weekStart, rangeAppointments],
  );

  const recentVisits = useMemo(
    () =>
      monthAppointments
        .filter((a) => a.date <= todayIso)
        .filter(
          (a) =>
            a.status === APPOINTMENT_STATUS.COMPLETED ||
            a.status === APPOINTMENT_STATUS.NO_SHOW ||
            a.status === APPOINTMENT_STATUS.CANCELLED,
        )
        .sort((a, b) =>
          `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`),
        )
        .slice(0, 5),
    [monthAppointments, todayIso],
  );

  const workingDaySet = useMemo(() => {
    const set = new Set<string>();
    availability.forEach((a) => {
      set.add(a.day);
    });
    return set;
  }, [availability]);

  if (doctorLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-violet" />
      </div>
    );
  }

  if (!doctor) {
    return (
      <div className="py-16 text-center text-sm text-ink-500">
        Doctor not found.
        <button
          type="button"
          onClick={() => router.push(`/hospital/${hospitalId}/doctors`)}
          className="ml-1.5 text-brand-violet hover:underline"
        >
          Back to doctors
        </button>
      </div>
    );
  }

  return (
    <div className="pb-16">
      <div className="flex items-center gap-3 mb-4">
        <button
          type="button"
          onClick={() => router.push(`/hospital/${hospitalId}/doctors`)}
          className="w-8 h-8 rounded-lg border border-border bg-surface-paper flex items-center justify-center text-ink-700 hover:bg-surface-canvas transition-colors"
          aria-label="Back to doctors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <span className="text-sm text-ink-500">
          Doctors /{" "}
          <b className="text-ink-900 font-semibold">Dr. {doctor.name}</b>
        </span>
      </div>

      <div className="bg-surface-paper border border-border rounded-2xl shadow-sm p-5 flex flex-wrap items-start gap-4">
        <DoctorAvatar name={doctor.name} size="lg" />
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-ink-900 font-display tracking-tight">Dr. {doctor.name}</h1>
          <div className="flex items-center gap-2 flex-wrap text-[12.5px] text-ink-500 mt-0.5">
            <span>{doctor.specialization || "General Practitioner"}</span>
            {doctor.experience && (
              <>
                <span className="text-border">·</span>
                <span>{doctor.experience} years</span>
              </>
            )}
            {doctor.consultationFee != null && (
              <>
                <span className="text-border">·</span>
                <span className="font-mono">
                  {money(doctor.consultationFee)}
                </span>{" "}
                per consultation
              </>
            )}
            {currentHospital?.name && (
              <>
                <span className="text-border">·</span>
                <span>{currentHospital.name}</span>
              </>
            )}
          </div>
          <div className="flex gap-1.5 flex-wrap mt-2">
            {doctor.isAcceptingBookings !== false && (
              <span className="rounded-md px-2.5 py-1 text-[11.5px] font-semibold bg-status-open-soft text-status-open">
                ● Accepting bookings
              </span>
            )}
            {WEEK_ORDER.some((d) => workingDaySet.has(d)) && (
              <span className="rounded-md px-2.5 py-1 text-[11.5px] font-semibold bg-surface-canvas text-ink-700">
                {WEEK_ORDER.filter((d) => workingDaySet.has(d))
                  .map((d) => DAY_LABELS_SHORT[d])
                  .join(" · ")}
              </span>
            )}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap justify-end">
          <button
            type="button"
            onClick={() =>
              router.push(
                `/hospital/${hospitalId}/appointments/add?doctorId=${doctorId}`,
              )
            }
            className="h-9 px-3.5 rounded-lg bg-brand-violet hover:bg-brand-violet-hover text-white text-sm font-semibold"
          >
            Book appointment
          </button>
          <button
            type="button"
            onClick={() =>
              router.push(`/hospital/${hospitalId}/doctors/${doctorId}/edit`)
            }
            className="h-9 px-3.5 rounded-lg border border-border bg-surface-paper text-sm font-medium text-ink-700 hover:bg-surface-canvas"
          >
            Manage availability
          </button>
          <button
            type="button"
            onClick={() =>
              router.push(`/hospital/${hospitalId}/doctors/${doctorId}/edit`)
            }
            className="h-9 px-3.5 rounded-lg border border-border bg-surface-paper text-sm font-medium text-ink-700 hover:bg-surface-canvas flex items-center gap-1.5"
          >
            <Pencil className="w-3.5 h-3.5" /> Edit profile
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mt-3.5">
        <div className="rounded-xl p-4 bg-surface-paper border border-border shadow-sm">
          <div className="text-[11px] uppercase tracking-wide font-semibold text-ink-500">
            Completed · {format(today, "MMMM")}
          </div>
          <div className="font-mono text-2xl font-bold text-ink-900 mt-1">
            {monthStats.completed}
          </div>
          <div className="text-[11px] text-ink-500 mt-0.5">
            of {monthStats.totalBooked} booked
          </div>
        </div>
        <div className="rounded-xl p-4 bg-surface-paper border border-border shadow-sm">
          <div className="text-[11px] uppercase tracking-wide font-semibold text-ink-500">
            No-shows &amp; cancels
          </div>
          <div
            className={`font-mono text-2xl font-bold mt-1 ${monthStats.noShowsAndCancels > 0 ? "text-status-danger" : "text-ink-900"}`}
          >
            {monthStats.noShowsAndCancels}
          </div>
          <div className="text-[11px] text-ink-500 mt-0.5">
            {monthStats.totalBooked > 0
              ? `${Math.round((monthStats.noShowsAndCancels / monthStats.totalBooked) * 100)}% of bookings`
              : "—"}
          </div>
        </div>
        <div className="rounded-xl p-4 bg-surface-paper border border-border shadow-sm">
          <div className="text-[11px] uppercase tracking-wide font-semibold text-ink-500">
            Billed · {format(today, "MMMM")}
          </div>
          <div className="font-mono text-2xl font-bold text-ink-900 mt-1">
            {money(monthStats.billed)}
          </div>
          <div className="text-[11px] text-ink-500 mt-0.5">
            {monthStats.packagesSoldAmount > 0
              ? `${money(monthStats.packagesSoldAmount)} prepaid packages`
              : "no prepaid packages sold"}
          </div>
        </div>
        <div className="rounded-xl p-4 bg-surface-paper border border-border shadow-sm">
          <div className="text-[11px] uppercase tracking-wide font-semibold text-ink-500">
            Slot utilisation
          </div>
          <div className="font-mono text-2xl font-bold text-ink-900 mt-1">
            {Math.round(monthStats.utilization)}%
          </div>
          <div className="text-[11px] text-ink-500 mt-0.5">
            {monthStats.totalBooked} booked of {monthStats.totalOpenSlots} open
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4 mt-4 items-start">
        <div className="space-y-3.5">
          <div className="bg-surface-paper border border-border rounded-xl shadow-sm overflow-hidden">
            <h2 className="text-sm font-semibold text-ink-900 px-4 py-3 border-b border-border font-display tracking-tight">
              Details
            </h2>
            <div className="px-4 py-1">
              <DetailRow label="Email" value={doctor.email} />
              <DetailRow label="Phone" value={doctor.phone} mono />
              <DetailRow
                label="Experience"
                value={
                  doctor.experience ? `${doctor.experience} years` : undefined
                }
              />
              <DetailRow
                label="Consultation"
                value={
                  doctor.consultationFee != null
                    ? `${money(doctor.consultationFee)} · ${duration} min`
                    : undefined
                }
                mono
              />
              <DetailRow
                label="Joined"
                value={
                  doctor.joinedAt
                    ? format(new Date(doctor.joinedAt), "d MMM yyyy")
                    : undefined
                }
                mono
              />
            </div>
          </div>

          <div className="bg-surface-paper border border-border rounded-xl shadow-sm overflow-hidden">
            <h2 className="text-sm font-semibold text-ink-900 px-4 py-3 border-b border-border flex items-center gap-2 font-display tracking-tight">
              <PackageIcon className="w-3.5 h-3.5 text-brand-violet" /> Prepaid
              packages
            </h2>
            <div className="px-4 py-1">
              <DetailRow
                label="Active holders"
                value={`${packageStats.holders} patients`}
              />
              <DetailRow
                label="Visits outstanding"
                value={`${packageStats.visitsOutstanding}`}
              />
              <DetailRow
                label="Value owed"
                value={money(packageStats.valueOwed)}
                mono
              />
            </div>
          </div>
        </div>

        <div className="space-y-3.5">
          <div className="bg-surface-paper border border-border rounded-xl shadow-sm overflow-hidden">
            <h2 className="text-sm font-semibold text-ink-900 px-4 py-3 border-b border-border font-display tracking-tight">
              Today · {format(today, "EEEE d MMMM")}
            </h2>
            <div className="p-4">
              {apptLoading ? (
                <div className="text-sm text-ink-500 py-4 text-center">
                  Loading…
                </div>
              ) : todaySlots.length === 0 ? (
                <div className="text-sm text-ink-500 py-4 text-center">
                  Not working today.
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {todaySlots.map((s) => {
                    const done =
                      s.appointment?.status === APPOINTMENT_STATUS.COMPLETED;
                    const booked = !!s.appointment;
                    return (
                      <div
                        key={s.time}
                        className={`rounded-lg px-2.5 py-1.5 border text-[12px] min-w-[92px] ${
                          done
                            ? "bg-status-open-soft border-status-open/30 text-status-open"
                            : booked
                              ? "bg-brand-violet-soft border-brand-violet/30 text-brand-violet"
                              : "bg-surface-paper border-border text-ink-500"
                        }`}
                      >
                        <div className="font-mono text-[11.5px]">
                          {formatTime12h(s.time)}
                        </div>
                        <div className="font-medium mt-0.5">
                          {s.appointment?.patientName || "Free"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {todaySlots.length > 0 && (
                <div className="flex items-center gap-2.5 mt-3">
                  <span className="text-xs text-ink-500">Booked today</span>
                  <div className="flex-1 h-2 rounded-full bg-surface-canvas overflow-hidden">
                    <div
                      className="h-full rounded-full bg-brand-violet"
                      style={{
                        width: `${(bookedTodayCount / todaySlots.length) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="font-mono text-xs text-ink-700">
                    {bookedTodayCount} of {todaySlots.length}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-surface-paper border border-border rounded-xl shadow-sm overflow-hidden">
            <h2 className="text-sm font-semibold text-ink-900 px-4 py-3 border-b border-border font-display tracking-tight">
              This week
            </h2>
            <div className="p-4">
              <div className="grid grid-cols-7 gap-1.5">
                {weekBars.map((w) => (
                  <div
                    key={w.weekday}
                    className={`text-center border rounded-lg py-2 px-1 ${w.off ? "bg-surface-canvas/40 border-border" : "border-border"}`}
                  >
                    <div className="text-[10px] uppercase tracking-wide text-ink-500">
                      {DAY_LABELS_SHORT[w.weekday]}
                    </div>
                    <div className="font-mono text-[11px] text-ink-700 mt-0.5">
                      {w.off ? "—" : formatHours(w.hours)}
                    </div>
                    <div className="h-1 rounded-full bg-surface-canvas mt-1.5 overflow-hidden">
                      {!w.off && (
                        <div
                          className="h-full bg-status-open"
                          style={{ width: `${w.pct}%` }}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-surface-paper border border-border rounded-xl shadow-sm overflow-hidden">
            <h2 className="text-sm font-semibold text-ink-900 px-4 py-3 border-b border-border font-display tracking-tight">
              Recent visits
            </h2>
            {recentVisits.length === 0 ? (
              <div className="py-10 text-center text-sm text-ink-500">
                No visits recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-ink-500 bg-surface-canvas/40">
                      <th className="px-4 py-2 font-semibold">Date</th>
                      <th className="px-3 py-2 font-semibold">Patient</th>
                      <th className="px-3 py-2 font-semibold">Outcome</th>
                      <th className="px-3 py-2 font-semibold text-right">
                        Billed
                      </th>
                      <th className="px-3 py-2 font-semibold">Payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentVisits.map((a) => {
                      const payment = paymentByAppointmentId.get(a.id);
                      return (
                        <tr key={a.id} className="border-t border-border">
                          <td className="px-4 py-2 font-mono whitespace-nowrap">
                            {format(new Date(`${a.date}T00:00:00`), "d MMM")}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {a.patientName}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap capitalize">
                            {a.status === APPOINTMENT_STATUS.NO_SHOW
                              ? "No-show"
                              : a.status}
                          </td>
                          <td className="px-3 py-2 text-right font-mono whitespace-nowrap">
                            {payment ? money(payment.total) : "—"}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {payment ? (
                              <span
                                className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                                  payment.status === "due"
                                    ? "bg-status-danger-soft text-status-danger"
                                    : payment.packageId
                                      ? "bg-brand-violet-soft text-brand-violet"
                                      : "bg-status-open-soft text-status-open"
                                }`}
                              >
                                {payment.status === "due"
                                  ? "Unpaid"
                                  : payment.packageId
                                    ? "Package"
                                    : payment.method === "upi"
                                      ? "UPI"
                                      : payment.method === "cash"
                                        ? "Cash"
                                        : "Paid"}
                              </span>
                            ) : (
                              <span className="rounded-md px-2 py-0.5 text-[11px] font-semibold bg-surface-canvas text-ink-500">
                                —
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-3 py-2 border-t border-border first:border-t-0 text-[12.5px]">
      <span className="text-ink-500 shrink-0">{label}</span>
      <span className={`text-right text-ink-900 ${mono ? "font-mono" : ""}`}>
        {value}
      </span>
    </div>
  );
}
