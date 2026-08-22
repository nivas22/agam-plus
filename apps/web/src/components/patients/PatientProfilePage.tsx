// components/patients/PatientProfilePage.tsx
"use client";

import { format } from "date-fns";
import { ArrowLeft, Clock, Package as PackageIcon, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import SellPackageDialog from "@/components/appointments/SellPackageDialog";
import {
  CollectDueDialog,
  ReceiptDialog,
} from "@/components/payments/PaymentActionDialogs";
import { useAuth } from "@/hooks/useAuth";
import { useHospitalAppointments } from "@/hooks/useNewAppointmentsApi";
import { useHospitalDoctors } from "@/hooks/useNewDoctorApi";
import { usePackagesList } from "@/hooks/useNewPackageApi";
import { useHospitalPatient } from "@/hooks/useNewPatientApi";
import { useHospitalPayments } from "@/hooks/useNewPaymentApi";
import { paletteFor } from "@/lib/avatarPalette";
import type { AppointmentWithDetails } from "@/types/appointment";
import type { PackageRecord } from "@/types/package";
import type { Payment } from "@/types/payment";
import { calculateAge } from "@/utils/dateUtils";
import {
  ACTIVE_APPOINTMENT_STATUSES,
  APPOINTMENT_STATUS,
  PACKAGE_DISPLAY_STATUS,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
} from "../../constants";

interface PatientProfilePageProps {
  hospitalId: string;
  patientId: string;
}

type Tab = "visits" | "payments" | "packages" | "upcoming";
type DialogState =
  | { kind: "collectDue"; payment: Payment }
  | { kind: "receipt"; payment: Payment }
  | { kind: "sellPackage" }
  | null;

function money(v: number): string {
  return `₹${Math.round(v).toLocaleString("en-IN")}`;
}

function getInitials(name?: string): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "P";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dateBoxParts(dateStr: string): { d: string; m: string; y: string } {
  const date = new Date(`${dateStr}T00:00:00`);
  return {
    d: format(date, "d"),
    m: format(date, "MMM").toUpperCase(),
    y: format(date, "yyyy"),
  };
}

function formatTime12h(time: string): string {
  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours, 10);
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${period}`;
}

function daysAgo(iso: string): number {
  return Math.max(
    0,
    Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000),
  );
}

function collectedAmount(p: Payment): number {
  if (p.status !== PAYMENT_STATUS.PAID) return 0;
  if (p.method === PAYMENT_METHOD.SPLIT) {
    return (p.splitCashAmount || 0) + (p.splitUpiAmount || 0);
  }
  return p.total;
}

export default function PatientProfilePage({
  hospitalId,
  patientId,
}: PatientProfilePageProps) {
  const router = useRouter();
  const { user, getCurrentHospitalRole } = useAuth();
  const userRole = getCurrentHospitalRole() || "admin";

  const { data: patientData, isLoading: patientLoading } = useHospitalPatient(
    patientId,
    hospitalId,
  );
  const patient = patientData?.patient;

  const apptParams = useMemo(() => {
    const p = new URLSearchParams();
    p.append("patientId", patientId);
    return p;
  }, [patientId]);
  const { data: apptData, isLoading: apptLoading } = useHospitalAppointments(
    hospitalId,
    apptParams,
    userRole,
  );
  const appointments = apptData?.appointments || [];

  const paymentParams = useMemo(() => {
    const p = new URLSearchParams();
    p.append("patientId", patientId);
    return p;
  }, [patientId]);
  const { data: paymentsData } = useHospitalPayments(hospitalId, paymentParams);
  const payments = paymentsData?.payments || [];

  const { data: packagesData } = usePackagesList(hospitalId, patientId);
  const packages = packagesData?.packages || [];

  const { data: doctorsData } = useHospitalDoctors(hospitalId, undefined, true);
  const doctors = doctorsData?.doctors || [];

  const [activeTab, setActiveTab] = useState<Tab>("visits");
  const [dialog, setDialog] = useState<DialogState>(null);
  const [toast, setToast] = useState<string | null>(null);

  const today = useMemo(() => toISODate(new Date()), []);

  const paymentByAppointmentId = useMemo(() => {
    const map = new Map<string, Payment>();
    payments.forEach((p) => {
      map.set(p.appointmentId, p);
    });
    return map;
  }, [payments]);

  const pastAppointments = useMemo(
    () =>
      appointments
        .filter((a) =>
          [
            APPOINTMENT_STATUS.COMPLETED,
            APPOINTMENT_STATUS.NO_SHOW,
            APPOINTMENT_STATUS.CANCELLED,
          ].includes(a.status as APPOINTMENT_STATUS),
        )
        .sort((a, b) =>
          `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`),
        ),
    [appointments],
  );

  const upcomingAppointments = useMemo(
    () =>
      appointments
        .filter(
          (a) =>
            ACTIVE_APPOINTMENT_STATUSES.includes(
              a.status as APPOINTMENT_STATUS,
            ) && a.date >= today,
        )
        .sort((a, b) =>
          `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`),
        ),
    [appointments, today],
  );

  const duePayments = useMemo(
    () =>
      payments
        .filter((p) => p.status === PAYMENT_STATUS.DUE)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [payments],
  );
  const totalDue = duePayments.reduce((sum, p) => sum + p.total, 0);
  const oldestDue = duePayments[0] || null;

  const activePackage = useMemo(
    () =>
      packages.find(
        (p) =>
          p.displayStatus === PACKAGE_DISPLAY_STATUS.ACTIVE ||
          p.displayStatus === PACKAGE_DISPLAY_STATUS.LAPSING,
      ) || null,
    [packages],
  );

  const nextAppointment = upcomingAppointments[0] || null;

  const stats = useMemo(() => {
    const visitsCount = appointments.filter(
      (a) => a.status !== APPOINTMENT_STATUS.CANCELLED,
    ).length;
    const lastCompleted = pastAppointments.find(
      (a) => a.status === APPOINTMENT_STATUS.COMPLETED,
    );
    const lifetimeBilled = payments.reduce((sum, p) => sum + p.total, 0);
    const collected = payments.reduce((sum, p) => sum + collectedAmount(p), 0);
    const noShows = appointments.filter(
      (a) => a.status === APPOINTMENT_STATUS.NO_SHOW,
    );
    const lastNoShow = noShows
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    return {
      visitsCount,
      lastCompleted,
      lifetimeBilled,
      collected,
      noShowCount: noShows.length,
      lastNoShowDate: lastNoShow?.date,
    };
  }, [appointments, pastAppointments, payments]);

  const usualDoctors = useMemo(() => {
    const counts = new Map<string, { name: string; count: number }>();
    appointments
      .filter((a) => a.status !== APPOINTMENT_STATUS.CANCELLED)
      .forEach((a) => {
        const key = a.doctorProfileId;
        if (!key) return;
        const existing = counts.get(key);
        if (existing) existing.count++;
        else counts.set(key, { name: a.doctorName, count: 1 });
      });
    return Array.from(counts.values()).sort((a, b) => b.count - a.count);
  }, [appointments]);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const handleDialogSuccess = (message: string) => {
    showToast(message);
    setDialog(null);
  };

  if (patientLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-violet" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="py-16 text-center text-sm text-ink-500">
        Patient not found.
        <button
          type="button"
          onClick={() => router.push(`/hospital/${hospitalId}/patients`)}
          className="ml-1.5 text-brand-violet hover:underline"
        >
          Back to patients
        </button>
      </div>
    );
  }

  const [c1, c2] = paletteFor(patient.name || "Patient");
  const age = patient.dateOfBirth ? calculateAge(patient.dateOfBirth) : null;

  return (
    <div className="pb-16">
      <div className="flex items-center gap-3 mb-4">
        <button
          type="button"
          onClick={() => router.push(`/hospital/${hospitalId}/patients`)}
          className="w-8 h-8 rounded-lg border border-border bg-surface-paper flex items-center justify-center text-ink-700 hover:bg-surface-canvas transition-colors"
          aria-label="Back to patients"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <span className="text-sm text-ink-500">
          Patients /{" "}
          <b className="text-ink-900 font-semibold">{patient.name}</b>
        </span>
      </div>

      <div className="bg-surface-paper border border-border rounded-2xl shadow-sm p-5 flex flex-wrap items-start gap-4">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-xl shrink-0"
          style={{ background: `linear-gradient(160deg, ${c1}, ${c2})` }}
        >
          {getInitials(patient.name)}
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-ink-900">{patient.name}</h1>
          <div className="flex items-center gap-2 flex-wrap text-[12.5px] text-ink-500 mt-0.5">
            {patient.patientId && (
              <span className="font-mono">P-{patient.patientId}</span>
            )}
            {age !== null && (
              <>
                <span className="text-border">·</span>
                <span>
                  {age} · {patient.gender || "—"}
                </span>
              </>
            )}
            {patient.phone && (
              <>
                <span className="text-border">·</span>
                <span className="font-mono">{patient.phone}</span>
              </>
            )}
            {patient.createdAt && (
              <>
                <span className="text-border">·</span>
                <span>
                  Registered {format(new Date(patient.createdAt), "d MMM yyyy")}
                </span>
              </>
            )}
          </div>
          {patient.notes && (
            <div className="flex gap-1.5 flex-wrap mt-2">
              <span className="rounded-md px-2.5 py-1 text-[11.5px] font-semibold bg-surface-canvas text-ink-700">
                {patient.notes}
              </span>
            </div>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap justify-end">
          {totalDue > 0 && (
            <button
              type="button"
              onClick={() =>
                oldestDue &&
                setDialog({ kind: "collectDue", payment: oldestDue })
              }
              className="h-9 px-3.5 rounded-lg bg-status-warning hover:bg-status-warning-hover text-white text-sm font-semibold"
            >
              Collect {money(totalDue)} due
            </button>
          )}
          <button
            type="button"
            onClick={() =>
              router.push(
                `/hospital/${hospitalId}/appointments/add?patientId=${patientId}`,
              )
            }
            className="h-9 px-3.5 rounded-lg bg-brand-violet hover:bg-brand-violet-hover text-white text-sm font-semibold"
          >
            Book appointment
          </button>
          <button
            type="button"
            onClick={() => setDialog({ kind: "sellPackage" })}
            className="h-9 px-3.5 rounded-lg border border-border bg-surface-paper text-sm font-medium text-ink-700 hover:bg-surface-canvas"
          >
            Sell package
          </button>
          <button
            type="button"
            onClick={() =>
              router.push(`/hospital/${hospitalId}/patients/${patientId}/edit`)
            }
            className="h-9 px-3.5 rounded-lg border border-border bg-surface-paper text-sm font-medium text-ink-700 hover:bg-surface-canvas flex items-center gap-1.5"
          >
            <Pencil className="w-3.5 h-3.5" /> Edit
          </button>
        </div>
      </div>

      {(totalDue > 0 || activePackage || nextAppointment) && (
        <div className="flex flex-wrap gap-2.5 mt-3.5">
          {totalDue > 0 && oldestDue && (
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-status-danger-soft border border-status-danger/20 text-[12.5px] text-status-danger">
              <b>{money(totalDue)} unpaid</b> from the visit on{" "}
              {format(new Date(oldestDue.createdAt), "d MMM")}
              <button
                type="button"
                onClick={() =>
                  setDialog({ kind: "collectDue", payment: oldestDue })
                }
                className="underline font-semibold"
              >
                Collect
              </button>
            </div>
          )}
          {activePackage && (
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-brand-violet-soft border border-brand-violet/20 text-[12.5px] text-brand-violet">
              <PackageIcon className="w-3.5 h-3.5" />
              <b>{activePackage.totalVisits}-visit plan</b> with Dr.{" "}
              {activePackage.doctorName} · {activePackage.remainingVisits} left
              · expires{" "}
              {format(
                new Date(`${activePackage.validUntil}T00:00:00`),
                "d MMM yyyy",
              )}
            </div>
          )}
          {nextAppointment && (
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-status-open-soft border border-status-open/20 text-[12.5px] text-status-open">
              <Clock className="w-3.5 h-3.5" />
              <b>Next visit</b>{" "}
              {format(
                new Date(`${nextAppointment.date}T00:00:00`),
                "EEE d MMM",
              )}
              , {formatTime12h(nextAppointment.time)} · Dr.{" "}
              {nextAppointment.doctorName}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mt-3.5">
        <div className="rounded-xl p-4 bg-surface-paper border border-border shadow-sm">
          <div className="text-[11px] uppercase tracking-wide font-semibold text-ink-500">
            Visits
          </div>
          <div className="font-mono text-2xl font-bold text-ink-900 mt-1">
            {stats.visitsCount}
          </div>
          {patient.createdAt && (
            <div className="text-[11px] text-ink-500 mt-0.5">
              since {format(new Date(patient.createdAt), "MMM yyyy")}
            </div>
          )}
        </div>
        <div className="rounded-xl p-4 bg-surface-paper border border-border shadow-sm">
          <div className="text-[11px] uppercase tracking-wide font-semibold text-ink-500">
            Last seen
          </div>
          <div className="font-mono text-2xl font-bold text-ink-900 mt-1">
            {stats.lastCompleted
              ? format(
                  new Date(`${stats.lastCompleted.date}T00:00:00`),
                  "d MMM",
                )
              : "—"}
          </div>
          <div className="text-[11px] text-ink-500 mt-0.5">
            {stats.lastCompleted
              ? `${daysAgo(stats.lastCompleted.date)} days ago · Dr. ${stats.lastCompleted.doctorName?.split(" ")[0]}`
              : "No visits yet"}
          </div>
        </div>
        <div className="rounded-xl p-4 bg-surface-paper border border-border shadow-sm">
          <div className="text-[11px] uppercase tracking-wide font-semibold text-ink-500">
            Lifetime billed
          </div>
          <div className="font-mono text-2xl font-bold text-ink-900 mt-1">
            {money(stats.lifetimeBilled)}
          </div>
          <div className="text-[11px] text-ink-500 mt-0.5">
            {money(stats.collected)} collected
          </div>
        </div>
        <div className="rounded-xl p-4 bg-surface-paper border border-border shadow-sm">
          <div className="text-[11px] uppercase tracking-wide font-semibold text-ink-500">
            No-shows
          </div>
          <div
            className={`font-mono text-2xl font-bold mt-1 ${stats.noShowCount > 0 ? "text-status-danger" : "text-ink-900"}`}
          >
            {stats.noShowCount}
          </div>
          <div className="text-[11px] text-ink-500 mt-0.5">
            {stats.lastNoShowDate
              ? `last on ${format(new Date(`${stats.lastNoShowDate}T00:00:00`), "d MMM")}`
              : "none"}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4 mt-4 items-start">
        <div className="space-y-3.5">
          <div className="bg-surface-paper border border-border rounded-xl shadow-sm overflow-hidden">
            <h2 className="text-sm font-semibold text-ink-900 px-4 py-3 border-b border-border">
              Details
            </h2>
            <div className="px-4 py-1">
              <DetailRow label="Phone" value={patient.phone} mono />
              <DetailRow label="Email" value={patient.email} />
              <DetailRow
                label="Date of birth"
                value={
                  patient.dateOfBirth
                    ? format(new Date(patient.dateOfBirth), "d MMM yyyy")
                    : undefined
                }
                mono
              />
              <DetailRow label="Blood group" value={patient.bloodGroup} />
              <DetailRow label="Address" value={patient.address} />
              <DetailRow
                label="Alternate contact"
                value={patient.secondaryPhone}
                mono
              />
            </div>
          </div>

          {usualDoctors.length > 0 && (
            <div className="bg-surface-paper border border-border rounded-xl shadow-sm overflow-hidden">
              <h2 className="text-sm font-semibold text-ink-900 px-4 py-3 border-b border-border">
                Usual doctors
              </h2>
              <div className="px-4 py-1">
                {usualDoctors.map((d) => (
                  <div
                    key={d.name}
                    className="flex justify-between items-center py-2 border-t border-border first:border-t-0 text-[12.5px]"
                  >
                    <span className="text-ink-700">Dr. {d.name}</span>
                    <span className="font-medium text-ink-900">
                      {d.count} visit{d.count === 1 ? "" : "s"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-surface-paper border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="flex gap-1 px-3 pt-1 border-b border-border overflow-x-auto">
            {(
              [
                {
                  key: "visits" as Tab,
                  label: "Visits",
                  count: pastAppointments.length,
                },
                {
                  key: "payments" as Tab,
                  label: "Payments",
                  count: payments.length,
                },
                {
                  key: "packages" as Tab,
                  label: "Packages",
                  count: packages.length,
                },
                {
                  key: "upcoming" as Tab,
                  label: "Upcoming",
                  count: upcomingAppointments.length,
                },
              ] as const
            ).map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setActiveTab(t.key)}
                className={`px-3 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
                  activeTab === t.key
                    ? "text-brand-violet border-brand-violet font-semibold"
                    : "text-ink-700 border-transparent hover:text-ink-900"
                }`}
              >
                {t.label}{" "}
                <span className="font-mono text-xs text-ink-500">
                  {t.count}
                </span>
              </button>
            ))}
          </div>

          {apptLoading ? (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-violet" />
            </div>
          ) : activeTab === "visits" ? (
            pastAppointments.length === 0 ? (
              <EmptyState text="No visits yet." />
            ) : (
              pastAppointments.map((a) => (
                <VisitRow
                  key={a.id}
                  appointment={a}
                  payment={paymentByAppointmentId.get(a.id)}
                />
              ))
            )
          ) : activeTab === "payments" ? (
            payments.length === 0 ? (
              <EmptyState text="No payments recorded." />
            ) : (
              payments
                .slice()
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                .map((p) => (
                  <PaymentRow
                    key={p.id}
                    payment={p}
                    onView={() => setDialog({ kind: "receipt", payment: p })}
                  />
                ))
            )
          ) : activeTab === "packages" ? (
            packages.length === 0 ? (
              <EmptyState text="No packages sold to this patient." />
            ) : (
              packages.map((pkg) => <PackageRow key={pkg.id} pkg={pkg} />)
            )
          ) : upcomingAppointments.length === 0 ? (
            <EmptyState text="No upcoming appointments." />
          ) : (
            upcomingAppointments.map((a) => (
              <UpcomingRow key={a.id} appointment={a} />
            ))
          )}
        </div>
      </div>

      {dialog?.kind === "collectDue" && (
        <CollectDueDialog
          hospitalId={hospitalId}
          payment={dialog.payment}
          collectedByName={user?.name}
          onClose={() => setDialog(null)}
          onSuccess={handleDialogSuccess}
        />
      )}
      {dialog?.kind === "receipt" && (
        <ReceiptDialog
          payment={dialog.payment}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "sellPackage" && (
        <SellPackageDialog
          hospitalId={hospitalId}
          patient={patient}
          doctors={doctors}
          onClose={() => setDialog(null)}
          onSuccess={handleDialogSuccess}
        />
      )}

      {toast && (
        <div className="fixed bottom-5 right-5 bg-ink-900 text-white px-4 py-3 rounded-lg shadow-lg z-50">
          {toast}
        </div>
      )}
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

function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-14 px-6 text-center text-sm text-ink-500">{text}</div>
  );
}

function VisitRow({
  appointment,
  payment,
}: {
  appointment: AppointmentWithDetails;
  payment?: Payment;
}) {
  const box = dateBoxParts(appointment.date);
  const isNoShow = appointment.status === APPOINTMENT_STATUS.NO_SHOW;
  const isCancelled = appointment.status === APPOINTMENT_STATUS.CANCELLED;

  return (
    <div className="grid grid-cols-[62px_1fr_auto] gap-3.5 px-4 py-3.5 border-t border-border first:border-t-0">
      <div className="text-center border border-border rounded-lg py-1.5 bg-surface-canvas/40 h-fit">
        <div className="font-bold text-ink-900 text-base leading-tight">
          {box.d}
        </div>
        <div className="text-[10px] text-ink-500 uppercase tracking-wide">
          {box.m}
        </div>
        <div className="text-[9.5px] text-ink-500">{box.y}</div>
      </div>
      <div className="min-w-0">
        <div
          className={`text-[13.5px] font-semibold ${isNoShow || isCancelled ? "text-ink-500" : "text-ink-900"}`}
        >
          Dr. {appointment.doctorName}
          {appointment.doctorSpecialization && (
            <span className="text-ink-500 font-normal">
              {" "}
              · {appointment.doctorSpecialization}
            </span>
          )}
        </div>
        <div className="text-[11.5px] text-ink-500 mt-0.5">
          {formatTime12h(appointment.time)} ·{" "}
          {isNoShow
            ? "did not arrive · no charge raised"
            : isCancelled
              ? "cancelled"
              : payment
                ? `completed · ${payment.invoiceNumber}`
                : "completed"}
        </div>
        {appointment.sessionNotes && (
          <div className="text-[12.5px] text-ink-700 bg-surface-canvas/40 border border-border rounded-lg px-2.5 py-2 mt-2 leading-relaxed">
            {appointment.sessionNotes}
          </div>
        )}
        {payment && payment.items.length > 0 && (
          <div className="text-[11.5px] text-ink-500 mt-1.5">
            {payment.items.map((i) => i.name).join(" · ")}
          </div>
        )}
        {isNoShow && appointment.noShowReason && (
          <div className="text-[11.5px] text-ink-500 mt-1.5">
            {appointment.noShowReason}
          </div>
        )}
      </div>
      <div className="text-right shrink-0">
        <div className="font-mono text-sm text-ink-900">
          {payment ? money(payment.total) : "—"}
        </div>
        {payment ? (
          <span
            className={`inline-block mt-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${
              payment.status === PAYMENT_STATUS.DUE
                ? "bg-status-danger-soft text-status-danger"
                : payment.packageId
                  ? "bg-brand-violet-soft text-brand-violet"
                  : "bg-status-open-soft text-status-open"
            }`}
          >
            {payment.status === PAYMENT_STATUS.DUE
              ? `Unpaid · ${daysAgo(payment.createdAt)} days`
              : payment.packageId
                ? payment.total > 0
                  ? `Package + ${money(payment.total)}`
                  : "Package"
                : `Paid · ${payment.method === PAYMENT_METHOD.SPLIT ? "Split" : payment.method.toUpperCase()}`}
          </span>
        ) : (
          <span className="inline-block mt-1 rounded-md px-2 py-0.5 text-[11px] font-semibold bg-surface-canvas text-ink-500">
            {isNoShow ? "No-show" : isCancelled ? "Cancelled" : "—"}
          </span>
        )}
      </div>
    </div>
  );
}

function PaymentRow({
  payment,
  onView,
}: {
  payment: Payment;
  onView: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onView}
      className="w-full flex items-center gap-3.5 px-4 py-3 border-t border-border first:border-t-0 text-left hover:bg-surface-canvas/40 transition-colors"
    >
      <div className="min-w-0 flex-1">
        <div className="font-mono text-xs font-semibold text-ink-900">
          {payment.invoiceNumber}
        </div>
        <div className="text-[11.5px] text-ink-500 mt-0.5">
          {format(new Date(payment.createdAt), "d MMM yyyy")} ·{" "}
          {payment.items.map((i) => i.name).join(", ")}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="font-mono text-sm text-ink-900">
          {money(payment.total)}
        </div>
        <span
          className={`inline-block mt-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${
            payment.status === PAYMENT_STATUS.DUE
              ? "bg-status-danger-soft text-status-danger"
              : payment.status === PAYMENT_STATUS.REFUNDED
                ? "bg-surface-canvas text-ink-500"
                : "bg-status-open-soft text-status-open"
          }`}
        >
          {payment.status === PAYMENT_STATUS.DUE
            ? "Due"
            : payment.status === PAYMENT_STATUS.REFUNDED
              ? "Refunded"
              : "Paid"}
        </span>
      </div>
    </button>
  );
}

function PackageRow({ pkg }: { pkg: PackageRecord }) {
  return (
    <div className="flex items-center gap-3.5 px-4 py-3.5 border-t border-border first:border-t-0">
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-semibold text-ink-900">
          {pkg.totalVisits} visits · Dr. {pkg.doctorName}
        </div>
        <div className="text-[11.5px] text-ink-500 mt-0.5">
          {pkg.usedVisits} / {pkg.totalVisits} used · {money(pkg.valueLeft)}{" "}
          value left · expires{" "}
          {format(new Date(`${pkg.validUntil}T00:00:00`), "d MMM yyyy")}
        </div>
      </div>
      <span
        className={`shrink-0 rounded-md px-2.5 py-1 text-[11.5px] font-semibold capitalize ${
          pkg.displayStatus === PACKAGE_DISPLAY_STATUS.ACTIVE
            ? "bg-status-open-soft text-status-open"
            : pkg.displayStatus === PACKAGE_DISPLAY_STATUS.LAPSING
              ? "bg-status-warning-soft text-status-warning"
              : pkg.displayStatus === PACKAGE_DISPLAY_STATUS.LAPSED
                ? "bg-status-danger-soft text-status-danger"
                : "bg-surface-canvas text-ink-500"
        }`}
      >
        {pkg.displayStatus.replace("_", " ")}
      </span>
    </div>
  );
}

function UpcomingRow({ appointment }: { appointment: AppointmentWithDetails }) {
  const box = dateBoxParts(appointment.date);
  return (
    <div className="flex items-center gap-3.5 px-4 py-3.5 border-t border-border first:border-t-0">
      <div className="text-center border border-border rounded-lg py-1.5 px-2.5 bg-surface-canvas/40">
        <div className="font-bold text-ink-900 text-base leading-tight">
          {box.d}
        </div>
        <div className="text-[10px] text-ink-500 uppercase tracking-wide">
          {box.m}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-semibold text-ink-900">
          Dr. {appointment.doctorName}
        </div>
        <div className="text-[11.5px] text-ink-500 flex items-center gap-1 mt-0.5">
          <Clock className="w-3 h-3" /> {formatTime12h(appointment.time)}
        </div>
      </div>
      <span className="shrink-0 rounded-md px-2.5 py-1 text-[11px] font-semibold bg-brand-violet-soft text-brand-violet capitalize">
        {appointment.status.replace("-", " ")}
      </span>
    </div>
  );
}
