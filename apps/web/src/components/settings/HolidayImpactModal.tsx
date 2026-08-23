// components/settings/HolidayImpactModal.tsx
"use client";

import { CalendarOff, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import {
  DialogShell,
  primaryBtn,
  secondaryBtn,
} from "@/components/appointments/AppointmentActionDialogs";
import type {
  HolidayImpactPreview,
  HolidayResolution,
  HolidayResolutionAction,
} from "@/types/hospitalHoliday";

interface HolidayImpactModalProps {
  preview: HolidayImpactPreview;
  holidayLabel: string;
  isSubmitting: boolean;
  onBack: () => void;
  onApply: (resolutions: HolidayResolution[]) => void;
}

function formatTime12h(time: string): string {
  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours, 10);
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${period}`;
}

function dateLabel(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export default function HolidayImpactModal({
  preview,
  holidayLabel,
  isSubmitting,
  onBack,
  onApply,
}: HolidayImpactModalProps) {
  const allAppointments = useMemo(
    () =>
      preview.doctors.flatMap((d) =>
        d.appointments.map((a) => ({
          ...a,
          doctorProfileId: d.doctorProfileId,
          worksThatDay: d.worksThatDay,
        })),
      ),
    [preview],
  );

  const [overrides, setOverrides] = useState<
    Record<string, HolidayResolutionAction>
  >({});

  const actionFor = (
    appointmentId: string,
    defaultAction: HolidayResolutionAction,
  ) => overrides[appointmentId] ?? defaultAction;

  const setAction = (appointmentId: string, action: HolidayResolutionAction) =>
    setOverrides((prev) => ({ ...prev, [appointmentId]: action }));

  const bulkSet = (action: "move" | "cancel") => {
    setOverrides((prev) => {
      const next = { ...prev };
      for (const appt of allAppointments) {
        if (appt.worksThatDay) continue;
        if (action === "move" && !appt.proposedSlot) continue;
        next[appt.appointmentId] = action;
      }
      return next;
    });
  };

  const counts = useMemo(() => {
    let moved = 0,
      cancelled = 0,
      kept = 0;
    for (const appt of allAppointments) {
      const action = actionFor(appt.appointmentId, appt.defaultAction);
      if (action === "move") moved++;
      else if (action === "cancel") cancelled++;
      else kept++;
    }
    return { moved, cancelled, kept };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allAppointments, overrides]);

  const sampleMessage = useMemo(() => {
    const moving = allAppointments.find(
      (a) =>
        actionFor(a.appointmentId, a.defaultAction) === "move" &&
        a.proposedSlot,
    );
    if (moving) {
      const firstName = moving.patientName?.split(" ")[0] || "there";
      return `Namaste ${firstName}, we'll be closed on ${holidayLabel}. Your appointment has moved to ${dateLabel(moving.proposedSlot!.date)}, ${formatTime12h(moving.proposedSlot!.time)}. Reply 1 to confirm or 2 to pick another time.`;
    }
    const cancelling = allAppointments.find(
      (a) => actionFor(a.appointmentId, a.defaultAction) === "cancel",
    );
    if (cancelling) {
      const firstName = cancelling.patientName?.split(" ")[0] || "there";
      return `Namaste ${firstName}, we'll be closed on ${holidayLabel}. Your appointment has been cancelled — reply to rebook at a time that works for you.`;
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allAppointments, overrides, holidayLabel]);

  const submit = () => {
    const resolutions: HolidayResolution[] = allAppointments.map((appt) => {
      const action = actionFor(appt.appointmentId, appt.defaultAction);
      return {
        appointmentId: appt.appointmentId,
        action,
        newDate: action === "move" ? appt.proposedSlot?.date : undefined,
        newTime: action === "move" ? appt.proposedSlot?.time : undefined,
      };
    });
    onApply(resolutions);
  };

  return (
    <DialogShell
      icon={<CalendarOff className="w-4.5 h-4.5" />}
      iconTone="bg-status-danger-soft text-status-danger"
      title={`${holidayLabel} is now a holiday`}
      subtitle={`${allAppointments.length} appointment${allAppointments.length === 1 ? "" : "s"} sit on that day. Decide each one before the holiday is saved.`}
      onClose={onBack}
      size="lg"
      footer={
        <>
          <span className="text-xs text-ink-500 mr-auto">
            Every change is logged against your name, with the holiday as the
            reason.
          </span>
          <button
            type="button"
            className={secondaryBtn}
            onClick={onBack}
            disabled={isSubmitting}
          >
            Back
          </button>
          <button
            type="button"
            className={`${primaryBtn} bg-brand-violet hover:bg-brand-violet-hover disabled:bg-border disabled:text-ink-500`}
            disabled={isSubmitting}
            onClick={submit}
          >
            {isSubmitting && (
              <Loader2 size={14} className="animate-spin mr-1.5 inline" />
            )}
            Apply &amp; notify {allAppointments.length} patient
            {allAppointments.length === 1 ? "" : "s"}
          </button>
        </>
      }
    >
      <div className="flex items-center gap-2.5 px-5 py-2.5 border-b border-border flex-wrap bg-surface-canvas/40">
        <span className="text-xs font-semibold text-ink-700">
          Do this for all:
        </span>
        <button
          type="button"
          onClick={() => bulkSet("move")}
          className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-ink-700 hover:bg-surface-canvas"
        >
          Move to next free slot
        </button>
        <button
          type="button"
          onClick={() => bulkSet("cancel")}
          className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-ink-700 hover:bg-surface-canvas"
        >
          Cancel &amp; notify
        </button>
        <span className="flex-1" />
        <span className="text-xs text-ink-500">
          {counts.moved} moved · {counts.cancelled} cancelled · {counts.kept}{" "}
          kept
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {preview.doctors.map((group) => (
          <div key={group.doctorProfileId}>
            <div className="px-5 py-1.5 text-[11px] uppercase tracking-wide text-ink-500 font-semibold bg-surface-canvas/60 border-y border-border">
              {group.doctorName ? `Dr. ${group.doctorName}` : "Doctor"} —{" "}
              {group.worksThatDay
                ? "on call, still working"
                : "closed that day"}
            </div>
            {group.appointments.map((appt) => {
              const action = actionFor(appt.appointmentId, appt.defaultAction);
              const isPackage = appt.type === "package";
              return (
                <div
                  key={appt.appointmentId}
                  className="grid grid-cols-[64px_1fr_180px_150px] gap-3 items-center px-5 py-2.5 border-b border-border text-sm"
                >
                  <span className="font-mono text-ink-700">
                    {formatTime12h(appt.time)}
                  </span>
                  <span>
                    <span className="font-semibold text-ink-900">
                      {appt.patientName}
                    </span>
                    {isPackage && (
                      <span className="ml-1.5 inline-block bg-brand-violet-soft text-brand-violet rounded-md px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide">
                        Package
                      </span>
                    )}
                    <span className="block text-xs text-ink-500 font-mono tabular">
                      {[
                        appt.patientPhone,
                        isPackage && appt.packageVisitNumber
                          ? `visit ${appt.packageVisitNumber}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  {group.worksThatDay ? (
                    <span className="text-xs font-mono rounded-md px-2 py-1 text-center bg-brand-violet-soft text-brand-violet">
                      Unchanged
                    </span>
                  ) : appt.proposedSlot ? (
                    <span className="text-xs font-mono rounded-md px-2 py-1 text-center bg-status-open-soft text-status-open border border-status-open/20">
                      {dateLabel(appt.proposedSlot.date)} ·{" "}
                      {formatTime12h(appt.proposedSlot.time)}
                    </span>
                  ) : (
                    <span className="text-xs rounded-md px-2 py-1 text-center bg-surface-canvas text-ink-500">
                      {appt.reason || "No free slot"}
                    </span>
                  )}
                  <select
                    value={action}
                    onChange={(e) =>
                      setAction(
                        appt.appointmentId,
                        e.target.value as HolidayResolutionAction,
                      )
                    }
                    className="px-2 py-1.5 rounded-lg border border-border text-xs bg-surface-paper"
                  >
                    {group.worksThatDay && (
                      <option value="keep">Keep — doctor is working</option>
                    )}
                    {appt.proposedSlot && (
                      <option value="move">Move to next free slot</option>
                    )}
                    <option value="cancel">
                      {isPackage ? "Cancel — return credit" : "Cancel & notify"}
                    </option>
                    {!group.worksThatDay && (
                      <option value="keep">Leave for now</option>
                    )}
                  </select>
                </div>
              );
            })}
          </div>
        ))}

        {sampleMessage && (
          <div className="m-5 bg-status-open-soft border border-status-open/20 rounded-xl p-3">
            <div className="text-[10.5px] uppercase tracking-wide font-semibold text-status-open mb-1">
              WhatsApp each patient
            </div>
            <p className="text-sm text-status-open leading-relaxed">
              {sampleMessage}
            </p>
          </div>
        )}
      </div>
    </DialogShell>
  );
}
