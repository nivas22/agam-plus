// components/queue/PatientQueueDrawer.tsx
"use client";

import { format } from "date-fns";
import { AlertTriangle, Check, Pencil, Phone, ReceiptText, X } from "lucide-react";
import { useMemo, useState } from "react";
import { usePatientHospitalAppointments } from "@/hooks/useNewAppointmentsApi";
import { useHospitalPayments } from "@/hooks/useNewPaymentApi";
import { CollectDueDialog } from "@/components/payments/PaymentActionDialogs";
import type { AppointmentWithDetails } from "@/types/appointment";
import type { Doctor } from "@/types/doctorNew";
import type { Patient } from "@/types/patientNew";
import { APPOINTMENT_STATUS, APPOINTMENT_TYPE } from "../../constants";
import {
  apptDateTime,
  formatTime12h,
  minutesBetween,
  normalizeStatus,
  stageStart,
} from "./queueBoard";

function money(v: number): string {
  return `₹${Math.round(v).toLocaleString("en-IN")}`;
}

function ageDays(iso: string): number {
  return Math.max(
    0,
    Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000),
  );
}

interface PatientQueueDrawerProps {
  appointment: AppointmentWithDetails;
  hospitalId: string;
  doctor?: Doctor | null;
  patient?: Patient | null;
  queuePosition?: number;
  patientCode?: string;
  now: Date;
  collectedByName?: string;
  onClose: () => void;
  onCheckIn: () => void;
  onSendIn: () => void;
  onComplete: () => void;
  onChangeDoctor: () => void;
  onReschedule: () => void;
  onCancel: () => void;
  onNoShow: () => void;
  onUpdateReason: (notes: string) => void;
  onToast: (message: string) => void;
}

export default function PatientQueueDrawer({
  appointment,
  hospitalId,
  doctor,
  patient,
  queuePosition,
  patientCode,
  now,
  collectedByName,
  onClose,
  onCheckIn,
  onSendIn,
  onComplete,
  onChangeDoctor,
  onReschedule,
  onCancel,
  onNoShow,
  onUpdateReason,
  onToast,
}: PatientQueueDrawerProps) {
  const [editingReason, setEditingReason] = useState(false);
  const [reasonDraft, setReasonDraft] = useState(appointment.notes || "");
  const [collecting, setCollecting] = useState(false);

  const dueParams = useMemo(
    () =>
      new URLSearchParams({ status: "due", patientId: appointment.patientId }),
    [appointment.patientId],
  );
  const { data: dueData } = useHospitalPayments(hospitalId, dueParams);
  const duePayments = (dueData?.payments || []).sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );
  const totalDue = duePayments.reduce((s, p) => s + p.total, 0);
  const oldestDue = duePayments[0];
  const norm = normalizeStatus(appointment.status);
  const isWaiting =
    norm === APPOINTMENT_STATUS.WAITING ||
    norm === APPOINTMENT_STATUS.CHECKED_IN;
  const isYetToArrive =
    norm === APPOINTMENT_STATUS.CONFIRMED ||
    norm === APPOINTMENT_STATUS.PENDING;
  const isInConsultation = norm === APPOINTMENT_STATUS.IN_CONSULTATION;

  const canChangeDoctor = isYetToArrive || isWaiting;
  const canReschedule = isYetToArrive;
  const canMarkNoShow = norm === APPOINTMENT_STATUS.CONFIRMED;
  const canCancel = !isInConsultation && norm !== APPOINTMENT_STATUS.COMPLETED;

  // History comes from every appointment this patient has ever had, not just
  // today's — visits before today, most recent one, and no-show count.
  const { data: patientHistory } = usePatientHospitalAppointments(
    hospitalId,
    appointment.patientId,
  );
  const priorVisits = (patientHistory?.appointments || []).filter(
    (a) => a.id !== appointment.id,
  );
  const pastVisits = priorVisits.filter((a) => a.date < appointment.date);
  const lastVisit = [...pastVisits].sort((a, b) =>
    b.date.localeCompare(a.date),
  )[0];
  const noShowCount = priorVisits.filter(
    (a) => normalizeStatus(a.status) === APPOINTMENT_STATUS.NO_SHOW,
  ).length;

  const scheduled = apptDateTime(appointment);
  const waitLabel = isInConsultation
    ? "in consultation for"
    : isWaiting
      ? "waiting since"
      : "booked for";
  const waitMinutes = isInConsultation
    ? minutesBetween(
        stageStart(appointment, appointment.consultationStartedAt),
        now,
      )
    : isWaiting
      ? minutesBetween(
          stageStart(appointment, appointment.waitingAt || appointment.checkedInAt),
          now,
        )
      : minutesBetween(now, scheduled);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-ink-900/35" onClick={onClose} />
      <div className="relative w-full max-w-[432px] h-full bg-surface-paper shadow-2xl flex flex-col">
        <div className="px-5 pt-5 pb-4 border-b border-border flex items-start gap-3">
          <span className="w-11 h-11 rounded-xl bg-status-warning-soft text-status-warning flex items-center justify-center font-mono text-base font-semibold shrink-0">
            {patientCode ? patientCode.slice(-2) : "—"}
          </span>
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-lg font-bold text-ink-900 truncate font-display tracking-tight">
              {queuePosition != null && (
                <span className="w-6 h-6 rounded-full bg-brand-violet text-white text-xs font-bold flex items-center justify-center shrink-0">
                  {queuePosition}
                </span>
              )}
              <span className="truncate">{appointment.patientName}</span>
              {appointment.bookingSource === "walk-in" && (
                <span className="shrink-0 rounded-md bg-status-warning-soft text-status-warning border border-status-warning/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                  Walk-in
                </span>
              )}
            </h2>
            <div className="text-xs text-ink-500 mt-0.5">
              {[
                appointment.patientAge != null
                  ? `${appointment.patientAge}`
                  : null,
                appointment.patientGender,
                appointment.patientPhone,
                patientCode,
              ]
                .filter(Boolean)
                .join(" · ")}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-surface-canvas text-ink-500 ml-auto"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div
            className={`rounded-xl border p-3 flex items-baseline gap-2.5 ${
              isInConsultation || isWaiting
                ? "bg-status-warning-soft border-status-warning/30 text-status-warning"
                : "bg-surface-canvas border-border text-ink-700"
            }`}
          >
            <b className="text-2xl font-bold">{Math.max(0, waitMinutes)}m</b>
            <span className="text-sm">{waitLabel}</span>
            <span className="flex-1" />
            <span className="text-xs">
              booked for {formatTime12h(appointment.time)}
            </span>
          </div>

          {appointment.type === APPOINTMENT_TYPE.PACKAGE &&
            appointment.packageVisitNumber != null && (
              <div className="mt-2.5 rounded-lg bg-brand-violet-soft border border-brand-violet/20 px-3 py-2 text-xs text-brand-violet font-medium">
                Package visit #{appointment.packageVisitNumber}
              </div>
            )}

          {totalDue > 0 && oldestDue && (
            <div className="mt-2.5 flex items-center gap-2.5 rounded-lg bg-status-danger-soft border border-status-danger/25 px-3 py-2.5 text-status-danger">
              <ReceiptText className="w-4 h-4 shrink-0" />
              <span className="text-xs flex-1">
                <b>{money(totalDue)} unpaid</b> from{" "}
                {format(new Date(oldestDue.createdAt), "d MMM")} ·{" "}
                {ageDays(oldestDue.createdAt)} days
              </span>
              <button
                type="button"
                onClick={() => setCollecting(true)}
                className="shrink-0 h-7 px-3 rounded-md bg-status-danger text-white text-xs font-semibold hover:opacity-90"
              >
                Collect
              </button>
            </div>
          )}
          {patient?.allergies && patient.allergies.length > 0 && (
            <div className="mt-2.5 flex items-center gap-2.5 rounded-lg bg-status-warning-soft border border-status-warning/25 px-3 py-2.5 text-status-warning">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span className="text-xs">
                Allergic to {patient.allergies.join(", ")} — flagged on the
                record
              </span>
            </div>
          )}

          <div className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
            This appointment
          </div>
          <div className="mt-1.5 divide-y divide-border text-sm">
            <div className="flex justify-between py-2">
              <span className="text-ink-500">Doctor</span>
              <span className="font-medium text-ink-900">
                Dr. {appointment.doctorName}
                {doctor?.specialization ? ` · ${doctor.specialization}` : ""}
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-ink-500">Booked for</span>
              <span className="font-mono font-medium text-ink-900">
                {formatTime12h(appointment.time)} ·{" "}
                {doctor?.appointmentDuration || 30} min
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-ink-500">Booked via</span>
              <span className="font-medium text-ink-900">
                {appointment.bookingSource === "walk-in"
                  ? "Walk-in at the desk"
                  : "Scheduled"}
              </span>
            </div>
            <div className="py-2">
              <div className="flex items-center gap-2">
                <span className="text-ink-500 shrink-0">Reason</span>
                {!editingReason && (
                  <>
                    <span className="font-medium text-ink-900 text-right flex-1 truncate">
                      {appointment.notes || "—"}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setReasonDraft(appointment.notes || "");
                        setEditingReason(true);
                      }}
                      className="p-1 rounded-md hover:bg-surface-canvas text-ink-500 shrink-0"
                    >
                      <Pencil size={13} />
                    </button>
                  </>
                )}
              </div>
              {editingReason && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <input
                    autoFocus
                    value={reasonDraft}
                    onChange={(e) => setReasonDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        onUpdateReason(reasonDraft.trim());
                        setEditingReason(false);
                      } else if (e.key === "Escape") {
                        setEditingReason(false);
                      }
                    }}
                    placeholder="Fever and body ache, 2 days"
                    className="flex-1 h-8 px-2.5 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-brand-violet/20 focus:border-brand-violet"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateReason(reasonDraft.trim());
                      setEditingReason(false);
                    }}
                    className="h-8 w-8 shrink-0 flex items-center justify-center rounded-lg bg-brand-violet hover:bg-brand-violet-hover text-white"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingReason(false)}
                    className="h-8 w-8 shrink-0 flex items-center justify-center rounded-lg border border-border text-ink-500 hover:bg-surface-canvas"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
            History
          </div>
          <div className="mt-1.5 divide-y divide-border text-sm">
            <div className="flex justify-between py-2">
              <span className="text-ink-500">Last visit</span>
              <span className="font-medium text-ink-900">
                {lastVisit
                  ? `${format(new Date(`${lastVisit.date}T00:00:00`), "d MMM")} · Dr. ${lastVisit.doctorName}`
                  : "First visit"}
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-ink-500">Visits</span>
              <span className="font-medium text-ink-900">
                {pastVisits.length}
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-ink-500">No-shows</span>
              <span
                className={`font-medium ${noShowCount ? "text-status-danger" : "text-ink-900"}`}
              >
                {noShowCount}
              </span>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-border flex flex-col gap-2">
          {isInConsultation && (
            <button
              type="button"
              onClick={onComplete}
              className="w-full h-10 rounded-lg bg-brand-violet hover:bg-brand-violet-hover text-white text-sm font-semibold transition-colors"
            >
              Complete visit
            </button>
          )}
          {isWaiting && (
            <button
              type="button"
              onClick={onSendIn}
              className="w-full h-10 rounded-lg bg-brand-violet hover:bg-brand-violet-hover text-white text-sm font-semibold transition-colors"
            >
              Send in to Dr. {appointment.doctorName?.split(" ")[0]}
            </button>
          )}
          {isYetToArrive && (
            <button
              type="button"
              onClick={onCheckIn}
              className="w-full h-10 rounded-lg bg-brand-violet hover:bg-brand-violet-hover text-white text-sm font-semibold transition-colors"
            >
              Check in
            </button>
          )}

          <div className="grid grid-cols-2 gap-2">
            {canChangeDoctor && (
              <button
                type="button"
                onClick={onChangeDoctor}
                className="h-9 rounded-lg border border-border text-sm font-medium text-ink-700 hover:bg-surface-canvas transition-colors"
              >
                Change doctor
              </button>
            )}
            {canReschedule && (
              <button
                type="button"
                onClick={onReschedule}
                className="h-9 rounded-lg border border-border text-sm font-medium text-ink-700 hover:bg-surface-canvas transition-colors"
              >
                Reschedule
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {appointment.patientPhone ? (
              <a
                href={`tel:${appointment.patientPhone}`}
                className="h-9 rounded-lg border border-border text-sm font-medium text-ink-700 hover:bg-surface-canvas transition-colors flex items-center justify-center gap-1.5"
              >
                <Phone size={14} /> Call patient
              </a>
            ) : (
              <span />
            )}
            {canMarkNoShow ? (
              <button
                type="button"
                onClick={onNoShow}
                className="h-9 rounded-lg border border-status-danger/30 text-sm font-medium text-status-danger hover:bg-status-danger-soft transition-colors"
              >
                Mark no-show
              </button>
            ) : canCancel ? (
              <button
                type="button"
                onClick={onCancel}
                className="h-9 rounded-lg border border-status-danger/30 text-sm font-medium text-status-danger hover:bg-status-danger-soft transition-colors"
              >
                Cancel
              </button>
            ) : (
              <span />
            )}
          </div>
        </div>
      </div>

      {collecting && oldestDue && (
        <CollectDueDialog
          hospitalId={hospitalId}
          payment={oldestDue}
          collectedByName={collectedByName}
          onClose={() => setCollecting(false)}
          onSuccess={(message) => {
            setCollecting(false);
            onToast(message);
          }}
        />
      )}
    </div>
  );
}
