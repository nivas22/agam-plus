// components/queue/DoctorAbsentModal.tsx
"use client";

import { AlertCircle, Loader2, UserX } from "lucide-react";
import { useMemo, useState } from "react";
import {
  DialogShell,
  primaryBtn,
  secondaryBtn,
} from "@/components/appointments/AppointmentActionDialogs";
import type { AppointmentWithDetails } from "@/types/appointment";
import type { Doctor } from "@/types/doctorNew";
import { APPOINTMENT_STATUS } from "../../constants";
import {
  formatTime12h,
  nextWorkingDate,
  type PresenceOverride,
} from "./queueBoard";

const ABSENCE_REASONS = [
  "Unwell",
  "Personal emergency",
  "Called to another hospital",
  "Travel / stuck in traffic",
  "Other",
];
const TOLD_BY_OPTIONS = [
  "Doctor phoned the desk",
  "Doctor messaged",
  "Told by another doctor",
  "No contact — couldn't reach them",
];

type RowAction =
  | { kind: "moveNextDay" }
  | { kind: "offerDoctor"; doctorId: string }
  | { kind: "cancel" };

interface DoctorAbsentModalProps {
  doctor: Doctor;
  variant: "notComing" | "leftForDay";
  appointments: AppointmentWithDetails[];
  doctors: Doctor[];
  now: Date;
  userName: string;
  getPatientCode: (patientId: string) => string | undefined;
  updateAppointmentStatus: (
    appointmentId: string,
    status: string,
    sessionNotes?: string,
    appointmentData?: Partial<AppointmentWithDetails>,
  ) => Promise<void>;
  onClose: () => void;
  onApplied: (override: PresenceOverride, message: string) => void;
}

function dateLabel(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

export default function DoctorAbsentModal({
  doctor,
  variant,
  appointments,
  doctors,
  now,
  userName,
  getPatientCode,
  updateAppointmentStatus,
  onClose,
  onApplied,
}: DoctorAbsentModalProps) {
  const nextDate = useMemo(() => nextWorkingDate(doctor, now), [doctor, now]);
  const sameSpecDoctors = useMemo(
    () =>
      doctors.filter(
        (d) => d.id !== doctor.id && d.specialization === doctor.specialization,
      ),
    [doctors, doctor],
  );

  const [reason, setReason] = useState(ABSENCE_REASONS[0]);
  const [toldBy, setToldBy] = useState(TOLD_BY_OPTIONS[0]);
  const [note, setNote] = useState("");
  const [actions, setActions] = useState<Record<string, RowAction>>(() => {
    const initial: Record<string, RowAction> = {};
    for (const appt of appointments) {
      initial[appt.id] = nextDate
        ? { kind: "moveNextDay" }
        : { kind: "cancel" };
    }
    return initial;
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setAllActions = (action: RowAction) => {
    setActions((cur) => {
      const next = { ...cur };
      for (const appt of appointments) next[appt.id] = action;
      return next;
    });
  };

  const counts = useMemo(() => {
    let moved = 0;
    let cancelled = 0;
    let reassigned = 0;
    for (const appt of appointments) {
      const a = actions[appt.id];
      if (a?.kind === "moveNextDay") moved++;
      else if (a?.kind === "cancel") cancelled++;
      else if (a?.kind === "offerDoctor") reassigned++;
    }
    return { moved, cancelled, reassigned };
  }, [actions, appointments]);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      for (const appt of appointments) {
        const action = actions[appt.id];
        if (!action || action.kind === "moveNextDay") {
          if (!nextDate) {
            await updateAppointmentStatus(
              appt.id,
              APPOINTMENT_STATUS.CANCELLED,
              undefined,
              {
                cancelReason: `Dr. ${doctor.name} unavailable — ${reason} — no future slot found`,
              },
            );
          } else {
            await updateAppointmentStatus(appt.id, appt.status, undefined, {
              rescheduleDate: nextDate,
              rescheduleTime: appt.time,
            });
          }
        } else if (action.kind === "offerDoctor") {
          const target = doctors.find((d) => d.id === action.doctorId);
          await updateAppointmentStatus(appt.id, appt.status, undefined, {
            doctorProfileId: action.doctorId,
            doctorName: target?.name,
          });
        } else {
          await updateAppointmentStatus(
            appt.id,
            APPOINTMENT_STATUS.CANCELLED,
            undefined,
            { cancelReason: `Dr. ${doctor.name} unavailable — ${reason}` },
          );
        }
      }

      const override: PresenceOverride =
        variant === "leftForDay"
          ? { kind: "leftForDay", setBy: userName, setAt: now.toISOString() }
          : {
              kind: "notIn",
              reason,
              toldBy,
              note: note || undefined,
              setBy: userName,
              setAt: now.toISOString(),
            };
      onApplied(
        override,
        appointments.length
          ? `Dr. ${doctor.name} marked ${variant === "leftForDay" ? "left for the day" : "not coming"} — ${appointments.length} appointment${appointments.length === 1 ? "" : "s"} updated`
          : `Dr. ${doctor.name} marked ${variant === "leftForDay" ? "left for the day" : "not coming today"}`,
      );
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update appointments",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DialogShell
      icon={<UserX className="w-4.5 h-4.5" />}
      iconTone="bg-status-danger-soft text-status-danger"
      title={
        variant === "leftForDay"
          ? `Dr. ${doctor.name} has left for the day`
          : `Dr. ${doctor.name} isn't coming today`
      }
      subtitle={
        appointments.length
          ? `${appointments.length} appointment${appointments.length === 1 ? "" : "s"} booked with them. Nothing changes until you apply this.`
          : "No remaining bookings today to reassign."
      }
      onClose={onClose}
      size="lg"
      footer={
        <>
          <button type="button" className={secondaryBtn} onClick={onClose}>
            Back
          </button>
          <button
            type="button"
            className={`${primaryBtn} bg-status-danger hover:bg-status-danger-hover disabled:opacity-60`}
            disabled={submitting}
            onClick={submit}
          >
            {submitting && (
              <Loader2 size={14} className="animate-spin inline mr-1.5" />
            )}
            {appointments.length
              ? `Mark ${variant === "leftForDay" ? "gone" : "absent"} & update ${appointments.length}`
              : `Mark ${variant === "leftForDay" ? "gone for the day" : "absent"}`}
          </button>
        </>
      }
    >
      <div className="px-5 pt-4 overflow-y-auto flex-1">
        {error && (
          <div className="mb-3 flex items-start gap-2 px-3.5 py-2.5 rounded-lg bg-status-danger-soft border border-status-danger/20 text-sm text-status-danger">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {variant === "notComing" && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-xs font-semibold text-ink-700 mb-1.5 block">
                Reason
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full h-9 px-2.5 rounded-lg border border-border text-sm bg-surface-paper"
              >
                {ABSENCE_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-700 mb-1.5 block">
                Who told you
              </label>
              <select
                value={toldBy}
                onChange={(e) => setToldBy(e.target.value)}
                className="w-full h-9 px-2.5 rounded-lg border border-border text-sm bg-surface-paper"
              >
                {TOLD_BY_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-xs font-semibold text-ink-700 mb-1.5 block">
                Note{" "}
                <span className="font-normal text-ink-500">
                  saved on this device for today — not attached to the
                  doctor&apos;s or patient&apos;s record
                </span>
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Called at 8:40, fever since last night. Back tomorrow evening."
                className="w-full h-9 px-2.5 rounded-lg border border-border text-sm bg-surface-paper"
              />
            </div>
          </div>
        )}

        {appointments.length > 0 && (
          <>
            <div className="flex items-center gap-2 flex-wrap mb-3 px-3.5 py-2.5 rounded-lg bg-surface-canvas/60 border border-border">
              <span className="text-xs font-semibold text-ink-700 mr-1">
                Do this for all {appointments.length}:
              </span>
              <button
                type="button"
                disabled={!nextDate}
                onClick={() => setAllActions({ kind: "moveNextDay" })}
                className="h-7 px-3 rounded-md border border-border text-xs font-medium text-ink-700 hover:bg-surface-canvas disabled:opacity-40"
              >
                Move to next working day
              </button>
              <button
                type="button"
                onClick={() => setAllActions({ kind: "cancel" })}
                className="h-7 px-3 rounded-md border border-border text-xs font-medium text-ink-700 hover:bg-surface-canvas"
              >
                Cancel &amp; notify
              </button>
              <span className="flex-1" />
              <span className="text-xs text-ink-500 font-mono">
                {counts.moved} moved · {counts.cancelled} cancelled
                {counts.reassigned ? ` · ${counts.reassigned} reassigned` : ""}
              </span>
            </div>

            <div className="border border-border rounded-xl overflow-hidden mb-3">
              {appointments.map((appt, i) => {
                const action = actions[appt.id] ?? { kind: "cancel" as const };
                const code = getPatientCode(appt.patientId);
                return (
                  <div
                    key={appt.id}
                    className={`grid grid-cols-[64px_1fr_180px] gap-3 items-center px-3.5 py-2.5 text-sm ${i > 0 ? "border-t border-border" : ""}`}
                  >
                    <span className="font-mono text-xs text-ink-500">
                      {formatTime12h(appt.time)}
                    </span>
                    <span className="min-w-0">
                      <b className="font-semibold text-ink-900">
                        {appt.patientName}
                      </b>
                      <span className="block text-xs text-ink-500 truncate font-mono tabular">
                        {[
                          code,
                          appt.patientAge != null
                            ? `${appt.patientAge}y`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    <select
                      value={
                        action.kind === "offerDoctor"
                          ? `offer:${action.doctorId}`
                          : action.kind
                      }
                      onChange={(e) => {
                        const v = e.target.value;
                        setActions((cur) => ({
                          ...cur,
                          [appt.id]: v.startsWith("offer:")
                            ? { kind: "offerDoctor", doctorId: v.slice(6) }
                            : (v as "moveNextDay" | "cancel") === "moveNextDay"
                              ? { kind: "moveNextDay" }
                              : { kind: "cancel" },
                        }));
                      }}
                      className="h-8 px-2 rounded-md border border-border text-xs bg-surface-paper"
                    >
                      {nextDate && (
                        <option value="moveNextDay">
                          Move to {dateLabel(nextDate)}
                        </option>
                      )}
                      {sameSpecDoctors.map((d) => (
                        <option key={d.id} value={`offer:${d.id}`}>
                          Offer Dr. {d.name} today
                        </option>
                      ))}
                      <option value="cancel">Cancel &amp; notify</option>
                    </select>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <p className="text-[11px] text-ink-500 mb-3">
          Reassigning keeps the same time slot on the new doctor — check it
          isn&apos;t already booked. Moving to the next working day marks it for
          reschedule; the patient still needs to confirm. Cancelling records the
          reason on the appointment itself.
        </p>
      </div>
    </DialogShell>
  );
}
