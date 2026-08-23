// components/appointments/AppointmentActionDialogs.tsx
'use client';

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { X, Search, Users2, CalendarClock, Ban, AlertTriangle, ArrowRight } from "lucide-react";
import { AppointmentWithDetails } from "@/types/appointment";
import { Doctor } from "@/types/doctorNew";
import { useDoctorSlots } from "@/hooks/useDoctorSlots";
import { paletteFor } from "@/lib/avatarPalette";
import { APPOINTMENT_STATUS } from "../../constants";

type UpdateStatusFn = (
  appointmentId: string,
  status: string,
  sessionNotes?: string,
  appointmentData?: Partial<AppointmentWithDetails>
) => Promise<void>;

function formatTime12h(time: string): string {
  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours, 10);
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${period}`;
}

function minutesSinceMidnight(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function hmLabel(mins: number): string {
  const wrapped = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function toISODate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function dateLabel(dateStr: string): string {
  return format(new Date(`${dateStr}T00:00:00`), "EEE, d MMM");
}

/* ---------------------------------------------------------------------- */
/*                              shared shell                              */
/* ---------------------------------------------------------------------- */

export function DialogShell({
  icon,
  iconTone,
  title,
  subtitle,
  onClose,
  wide,
  size,
  children,
  footer,
}: {
  icon: React.ReactNode;
  iconTone: string;
  title: string;
  subtitle?: string;
  onClose: () => void;
  wide?: boolean;
  size?: "lg";
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div
        className={`bg-surface-paper rounded-2xl shadow-2xl w-full ${size === "lg" ? "max-w-3xl" : wide ? "max-w-xl" : "max-w-md"} max-h-[calc(100vh-48px)] flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 p-5 pb-4">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconTone}`}>{icon}</div>
          <div className="flex-1 min-w-0">
            <h3 className="font-display tracking-tight text-base font-semibold text-ink-900">{title}</h3>
            {subtitle && <p className="text-sm text-ink-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-500 hover:bg-surface-canvas shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
        <div className="flex items-center gap-2.5 p-4 border-t border-border bg-surface-canvas/40 rounded-b-2xl">{footer}</div>
      </div>
    </div>
  );
}

export function ContextStrip({ appointment, doctor, patientCode }: { appointment: AppointmentWithDetails; doctor?: Doctor | null; patientCode?: string }) {
  return (
    <div className="mx-5 flex items-center gap-3 px-3.5 py-2.5 rounded-xl border border-border bg-surface-canvas/60">
      <div className="font-mono leading-tight">
        <div className="text-xs font-semibold text-ink-700">{dateLabel(appointment.date)}</div>
        <div className="text-sm font-semibold text-ink-900">{formatTime12h(appointment.time)}</div>
      </div>
      <span className="w-px h-8 bg-border shrink-0" />
      <div className="min-w-0">
        <div className="text-[13px] font-semibold text-ink-900 truncate">{appointment.patientName}</div>
        <div className="font-mono tabular text-xs text-ink-500">
          {[patientCode, appointment.patientAge != null ? `${appointment.patientAge}y` : null].filter(Boolean).join(" · ")}
        </div>
      </div>
      {doctor && (
        <>
          <span className="w-px h-8 bg-border shrink-0" />
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-ink-900 truncate">Dr. {doctor.name}</div>
            <div className="text-xs text-ink-500 truncate">
              {doctor.specialization} · {doctor.appointmentDuration || 30} min
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export const secondaryBtn = "h-10 px-4 rounded-lg border border-border text-sm font-medium text-ink-700 hover:bg-surface-canvas transition-colors";
export const primaryBtn = "ml-auto h-10 px-4 rounded-lg text-white text-sm font-semibold transition-colors disabled:cursor-not-allowed";

export function CheckboxOption({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="flex items-start gap-2.5 py-2 border-t border-border first:border-t-0 cursor-pointer">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 w-4 h-4 rounded border-border text-brand-violet focus:ring-2 focus:ring-brand-violet/30 shrink-0"
      />
      <span>
        <span className="text-[13px] font-medium text-ink-900 block">{label}</span>
        <span className="text-xs text-ink-500">{hint}</span>
      </span>
    </label>
  );
}

/* ---------------------------------------------------------------------- */
/*                          1. change doctor                              */
/* ---------------------------------------------------------------------- */

interface ChangeDoctorDialogProps {
  appointment: AppointmentWithDetails;
  doctors: Doctor[];
  allAppointments: AppointmentWithDetails[];
  patientCode?: string;
  onClose: () => void;
  updateAppointmentStatus: UpdateStatusFn;
  onSuccess: (message: string) => void;
}

export function ChangeDoctorDialog({ appointment, doctors, allAppointments, patientCode, onClose, updateAppointmentStatus, onSuccess }: ChangeDoctorDialogProps) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Doctor | null>(null);
  const [notify, setNotify] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const current = doctors.find((d) => d.id === appointment.doctorProfileId) || null;
  const dayName = format(new Date(`${appointment.date}T00:00:00`), "EEEE");

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return doctors
      .filter((d) => d.id !== appointment.doctorProfileId)
      .filter((d) => !q || `${d.name} ${d.specialization}`.toLowerCase().includes(q))
      .map((d) => {
        const worksThatDay = (d.availability || []).some((s) => s.day === dayName);
        const busy = allAppointments.some(
          (a) =>
            a.id !== appointment.id &&
            a.doctorProfileId === d.id &&
            a.date === appointment.date &&
            a.time === appointment.time &&
            a.status !== APPOINTMENT_STATUS.CANCELLED &&
            a.status !== APPOINTMENT_STATUS.NO_SHOW
        );
        const state: "off" | "busy" | "free" = !worksThatDay ? "off" : busy ? "busy" : "free";
        return { doctor: d, state, sameSpecialty: d.specialization === current?.specialization };
      })
      .sort((a, b) => Number(b.sameSpecialty) - Number(a.sameSpecialty));
  }, [doctors, allAppointments, appointment, dayName, query, current]);

  const sameGroup = candidates.filter((c) => c.sameSpecialty);
  const otherGroup = candidates.filter((c) => !c.sameSpecialty);

  const badgeFor = (state: "off" | "busy" | "free") =>
    state === "free"
      ? { text: `Free at ${formatTime12h(appointment.time)}`, cls: "bg-status-open-soft text-status-open" }
      : state === "busy"
      ? { text: `Busy at ${formatTime12h(appointment.time)}`, cls: "bg-status-warning-soft text-status-warning" }
      : { text: `Not consulting ${dayName}`, cls: "bg-surface-canvas text-ink-500" };

  const submit = async () => {
    if (!picked) return;
    setSubmitting(true);
    try {
      await updateAppointmentStatus(appointment.id, appointment.status, undefined, {
        doctorProfileId: picked.id,
        doctorName: picked.name,
      });
      onSuccess(`${appointment.patientName} moved to Dr. ${picked.name}`);
      onClose();
    } catch (err) {
      onSuccess(err instanceof Error ? err.message : "Failed to change doctor");
    } finally {
      setSubmitting(false);
    }
  };

  const Row = ({ c }: { c: (typeof candidates)[number] }) => {
    const [c1] = paletteFor(c.doctor.name);
    const badge = badgeFor(c.state);
    const isPicked = picked?.id === c.doctor.id;
    return (
      <button
        type="button"
        disabled={c.state === "off"}
        onClick={() => setPicked(c.doctor)}
        aria-pressed={isPicked}
        className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-colors ${
          isPicked ? "border-brand-violet bg-brand-violet-soft ring-1 ring-brand-violet" : "border-border hover:border-ink-500/40"
        } ${c.state === "off" ? "opacity-60 cursor-not-allowed" : ""}`}
      >
        <span
          className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
          style={{ background: c1 }}
        >
          {getInitials(c.doctor.name)}
        </span>
        <span className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-ink-900 truncate">Dr. {c.doctor.name}</div>
          <div className="text-xs text-ink-500 truncate">{c.doctor.specialization}</div>
        </span>
        <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0 whitespace-nowrap ${badge.cls}`}>{badge.text}</span>
      </button>
    );
  };

  return (
    <DialogShell
      icon={<Users2 className="w-4.5 h-4.5" />}
      iconTone="bg-surface-canvas text-ink-700"
      title="Move to a different doctor"
      subtitle={`Keeping ${dateLabel(appointment.date)} at ${formatTime12h(appointment.time)}`}
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className={secondaryBtn} onClick={onClose}>
            Keep Dr. {current?.name.split(" ")[0] || "current"}
          </button>
          <button
            type="button"
            className={`${primaryBtn} bg-brand-violet hover:bg-brand-violet-hover disabled:bg-border disabled:text-ink-500`}
            disabled={!picked || submitting}
            onClick={submit}
          >
            {picked ? `Move to Dr. ${picked.name.split(" ")[0]}` : "Choose a doctor"}
          </button>
        </>
      }
    >
      <ContextStrip appointment={appointment} doctor={current} patientCode={patientCode} />
      <div className="p-5 pt-4 overflow-y-auto flex-1">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or specialty"
            className="w-full h-10 pl-9 pr-3 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-brand-violet/20 focus:border-brand-violet"
          />
        </div>
        <div className="space-y-1.5">
          {sameGroup.length > 0 && (
            <div className="text-[10px] font-mono uppercase tracking-widest text-ink-500 pt-1 pb-1">Also in {current?.specialization}</div>
          )}
          {sameGroup.map((c) => (
            <Row key={c.doctor.id} c={c} />
          ))}
          {otherGroup.length > 0 && <div className="text-[10px] font-mono uppercase tracking-widest text-ink-500 pt-3 pb-1">Other specialties</div>}
          {otherGroup.map((c) => (
            <Row key={c.doctor.id} c={c} />
          ))}
          {candidates.length === 0 && <div className="text-sm text-ink-500 text-center py-8">No other doctors found</div>}
        </div>
        <div className="mt-1">
          <CheckboxOption
            id="changedoc-notify"
            label={`Tell ${appointment.patientName.split(" ")[0]} by SMS`}
            hint="Sends the new doctor's name, same date and time."
            checked={notify}
            onChange={setNotify}
          />
        </div>
      </div>
    </DialogShell>
  );
}

/* ---------------------------------------------------------------------- */
/*                             2. reschedule                              */
/* ---------------------------------------------------------------------- */

interface RescheduleDialogProps {
  appointment: AppointmentWithDetails;
  doctor: Doctor | null;
  hospitalId: string;
  patientCode?: string;
  onClose: () => void;
  updateAppointmentStatus: UpdateStatusFn;
  onSuccess: (message: string) => void;
}

export function RescheduleDialog({ appointment, doctor, hospitalId, patientCode, onClose, updateAppointmentStatus, onSuccess }: RescheduleDialogProps) {
  const [date, setDate] = useState(appointment.date);
  const [time, setTime] = useState<string | null>(null);
  const [notify, setNotify] = useState(true);
  const [releaseSlot, setReleaseSlot] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const { data: slotsData, isLoading } = useDoctorSlots(hospitalId, appointment.doctorProfileId, date);
  const available = slotsData?.availableSlots || [];
  const duration = doctor?.appointmentDuration || 30;
  const dayName = format(new Date(`${date}T00:00:00`), "EEEE");
  const windows = (doctor?.availability || []).filter((w) => w.day === dayName);

  const grid = useMemo(() => {
    const slots: { time: string; busy: boolean; isCurrent: boolean }[] = [];
    windows.forEach((w) => {
      let cur = minutesSinceMidnight(w.startTime);
      const end = minutesSinceMidnight(w.endTime);
      while (cur < end) {
        const t = hmLabel(cur);
        const isCurrent = date === appointment.date && t === appointment.time;
        slots.push({ time: t, busy: !available.some((s) => s.time === t) && !isCurrent, isCurrent });
        cur += duration;
      }
    });
    return slots;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windows, available, duration, date]);

  const morning = grid.filter((s) => minutesSinceMidnight(s.time) < 12 * 60);
  const afternoon = grid.filter((s) => minutesSinceMidnight(s.time) >= 12 * 60 && minutesSinceMidnight(s.time) < 17 * 60);
  const evening = grid.filter((s) => minutesSinceMidnight(s.time) >= 17 * 60);

  const submit = async () => {
    if (!time) return;
    setSubmitting(true);
    try {
      await updateAppointmentStatus(appointment.id, appointment.status, undefined, {
        rescheduleDate: date,
        rescheduleTime: time,
      });
      onSuccess(`${appointment.patientName} moved to ${dateLabel(date)} at ${formatTime12h(time)}`);
      onClose();
    } catch (err) {
      onSuccess(err instanceof Error ? err.message : "Failed to reschedule appointment");
    } finally {
      setSubmitting(false);
    }
  };

  const Group = ({ label, items }: { label: string; items: typeof grid }) =>
    items.length === 0 ? null : (
      <div className="mb-3">
        <div className="text-[10px] font-mono uppercase tracking-widest text-ink-500 mb-1.5">{label}</div>
        <div className="grid grid-cols-4 gap-1.5">
          {items.map((s) => (
            <button
              key={s.time}
              type="button"
              disabled={s.busy}
              onClick={() => setTime(s.time)}
              aria-pressed={time === s.time}
              title={s.isCurrent ? "Current time" : s.busy ? "Already booked" : "Free"}
              className={`h-9 rounded-lg border text-xs font-mono font-medium transition-colors ${
                s.isCurrent
                  ? "border-dashed border-border text-ink-500 bg-surface-canvas"
                  : time === s.time
                  ? "bg-brand-violet border-brand-violet text-white"
                  : s.busy
                  ? "bg-surface-canvas text-ink-500/60 line-through border-border cursor-not-allowed"
                  : "border-border hover:border-brand-violet hover:text-brand-violet"
              }`}
            >
              {formatTime12h(s.time)}
            </button>
          ))}
        </div>
      </div>
    );

  return (
    <DialogShell
      icon={<CalendarClock className="w-4.5 h-4.5" />}
      iconTone="bg-status-open-soft text-status-open"
      title="Reschedule this appointment"
      subtitle={doctor ? `Staying with Dr. ${doctor.name} · ${duration} minutes` : undefined}
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className={secondaryBtn} onClick={onClose}>
            Keep current time
          </button>
          <button
            type="button"
            className={`${primaryBtn} bg-brand-violet hover:bg-brand-violet-hover disabled:bg-border disabled:text-ink-500`}
            disabled={!time || submitting}
            onClick={submit}
          >
            {time ? `Reschedule to ${dateLabel(date)}, ${formatTime12h(time)}` : "Pick a new time"}
          </button>
        </>
      }
    >
      <ContextStrip appointment={appointment} doctor={doctor} patientCode={patientCode} />
      <div className="p-5 pt-4 overflow-y-auto flex-1">
        <div className="mb-4">
          <label className="text-xs font-semibold text-ink-700 mb-1.5 block">New date</label>
          <input
            type="date"
            value={date}
            min={toISODate(new Date())}
            onChange={(e) => {
              setDate(e.target.value);
              setTime(null);
            }}
            className="w-full h-10 px-3 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-brand-violet/20 focus:border-brand-violet"
          />
        </div>
        {isLoading ? (
          <div className="text-sm text-ink-500 py-6 text-center">Loading availability…</div>
        ) : windows.length === 0 ? (
          <div className="text-sm text-ink-500 py-6 text-center">Dr. {doctor?.name} doesn't work on {dayName}s.</div>
        ) : (
          <>
            <Group label="Morning" items={morning} />
            <Group label="Afternoon" items={afternoon} />
            <Group label="Evening" items={evening} />
          </>
        )}
        {time && (
          <div className="mt-2 flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-status-open-soft border border-status-open/20 text-sm text-status-open">
            <ArrowRight className="w-3.5 h-3.5 shrink-0" />
            <span>
              Moving <b className="font-mono">{formatTime12h(appointment.time)}, {dateLabel(appointment.date)}</b> to{" "}
              <b className="font-mono">{formatTime12h(time)}, {dateLabel(date)}</b>
            </span>
          </div>
        )}
        <div className="mt-3">
          <CheckboxOption
            id="reschedule-notify"
            label={`Tell ${appointment.patientName.split(" ")[0]} by SMS`}
            hint="Sends the new date and time with a confirm link."
            checked={notify}
            onChange={setNotify}
          />
          <CheckboxOption
            id="reschedule-release"
            label="Release the old slot"
            hint={`${formatTime12h(appointment.time)} on ${dateLabel(appointment.date)} becomes bookable again.`}
            checked={releaseSlot}
            onChange={setReleaseSlot}
          />
        </div>
      </div>
    </DialogShell>
  );
}

/* ---------------------------------------------------------------------- */
/*                               3. cancel                                */
/* ---------------------------------------------------------------------- */

const CANCEL_REASONS = ["Patient requested", "Patient unwell", "Doctor unavailable", "Clinic closed", "Duplicate booking", "Other"];

interface CancelDialogProps {
  appointment: AppointmentWithDetails;
  patientCode?: string;
  onClose: () => void;
  updateAppointmentStatus: UpdateStatusFn;
  onSuccess: (message: string) => void;
}

export function CancelDialog({ appointment, patientCode, onClose, updateAppointmentStatus, onSuccess }: CancelDialogProps) {
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [notify, setNotify] = useState(true);
  const [releaseSlot, setReleaseSlot] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!reason) return;
    setSubmitting(true);
    try {
      await updateAppointmentStatus(appointment.id, APPOINTMENT_STATUS.CANCELLED, undefined, {
        cancelReason: reason === "Other" ? note.trim() || "Other" : reason,
      });
      onSuccess(`${appointment.patientName}'s appointment cancelled`);
      onClose();
    } catch (err) {
      onSuccess(err instanceof Error ? err.message : "Failed to cancel appointment");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DialogShell
      icon={<Ban className="w-4.5 h-4.5" />}
      iconTone="bg-status-danger-soft text-status-danger"
      title="Cancel this appointment"
      subtitle={`${appointment.patientName} will be told, and the slot reopens for booking.`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={secondaryBtn} onClick={onClose}>
            Keep appointment
          </button>
          <button
            type="button"
            className={`${primaryBtn} bg-status-danger hover:bg-status-danger-hover disabled:bg-border disabled:text-ink-500`}
            disabled={!reason || submitting}
            onClick={submit}
          >
            Cancel appointment
          </button>
        </>
      }
    >
      <ContextStrip appointment={appointment} patientCode={patientCode} />
      <div className="p-5 pt-4 overflow-y-auto flex-1">
        <div className="text-xs font-semibold text-ink-700 mb-2 flex items-center gap-2">
          Why is it being cancelled?
          <span className="text-[9.5px] font-mono uppercase tracking-widest text-status-danger bg-status-danger-soft px-1.5 py-0.5 rounded-full">
            Required
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CANCEL_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(r)}
              aria-pressed={reason === r}
              className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                reason === r ? "bg-ink-900 border-ink-900 text-white font-medium" : "border-border text-ink-700 hover:border-ink-500/40"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        {reason === "Other" && (
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a short note for the record"
            rows={3}
            className="w-full mt-3 p-3 rounded-lg border border-border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-violet/20 focus:border-brand-violet"
          />
        )}
        <div className="mt-4">
          <CheckboxOption
            id="cancel-notify"
            label={`Tell ${appointment.patientName.split(" ")[0]} by SMS`}
            hint="Includes a link to rebook."
            checked={notify}
            onChange={setNotify}
          />
          <CheckboxOption
            id="cancel-release"
            label="Release the slot"
            hint={`${formatTime12h(appointment.time)} on ${dateLabel(appointment.date)} becomes bookable again.`}
            checked={releaseSlot}
            onChange={setReleaseSlot}
          />
        </div>
      </div>
    </DialogShell>
  );
}

/* ---------------------------------------------------------------------- */
/*                              4. no-show                                */
/* ---------------------------------------------------------------------- */

const NO_SHOW_REASONS = ["No contact", "Called, no answer", "Said they'd come", "Arrived too late", "Transport problem"];

interface NoShowDialogProps {
  appointment: AppointmentWithDetails;
  doctorName?: string;
  patientCode?: string;
  onClose: () => void;
  updateAppointmentStatus: UpdateStatusFn;
  onSuccess: (message: string) => void;
}

export function NoShowDialog({ appointment, doctorName, patientCode, onClose, updateAppointmentStatus, onSuccess }: NoShowDialogProps) {
  const [reason, setReason] = useState<string | null>(null);
  const [sendRebookLink, setSendRebookLink] = useState(true);
  const [releaseSlot, setReleaseSlot] = useState(true);
  const [applyFee, setApplyFee] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    try {
      await updateAppointmentStatus(appointment.id, APPOINTMENT_STATUS.NO_SHOW, undefined, reason ? { noShowReason: reason } : undefined);
      onSuccess(`${appointment.patientName} recorded as a no-show`);
      onClose();
    } catch (err) {
      onSuccess(err instanceof Error ? err.message : "Failed to update appointment");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DialogShell
      icon={<AlertTriangle className="w-4.5 h-4.5" />}
      iconTone="bg-status-warning-soft text-status-warning"
      title={`Record ${appointment.patientName.split(" ")[0]} as a no-show`}
      subtitle="Use this once it's clear they aren't coming."
      onClose={onClose}
      footer={
        <>
          <button type="button" className={secondaryBtn} onClick={onClose}>
            Still waiting
          </button>
          <button
            type="button"
            className={`${primaryBtn} bg-status-danger hover:bg-status-danger-hover disabled:opacity-60`}
            disabled={submitting}
            onClick={submit}
          >
            Record no-show
          </button>
        </>
      }
    >
      <ContextStrip appointment={appointment} patientCode={patientCode} />
      <div className="p-5 pt-4 overflow-y-auto flex-1">
        <div className="text-xs font-semibold text-ink-700 mb-2">
          Anything known? <span className="font-normal text-ink-500">Optional, but it helps the follow-up call</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {NO_SHOW_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReason((cur) => (cur === r ? null : r))}
              aria-pressed={reason === r}
              className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                reason === r ? "bg-ink-900 border-ink-900 text-white font-medium" : "border-border text-ink-700 hover:border-ink-500/40"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <div className="mt-4">
          <CheckboxOption
            id="noshow-rebook"
            label="Send a rebooking link"
            hint={`SMS with the next three open slots${doctorName ? ` for Dr. ${doctorName.split(" ")[0]}` : ""}.`}
            checked={sendRebookLink}
            onChange={setSendRebookLink}
          />
          <CheckboxOption
            id="noshow-release"
            label="Release the slot"
            hint={`Frees ${formatTime12h(appointment.time)} so walk-ins can take it.`}
            checked={releaseSlot}
            onChange={setReleaseSlot}
          />
          <CheckboxOption
            id="noshow-fee"
            label="Apply the missed-visit fee"
            hint="Added to the patient's account per clinic policy."
            checked={applyFee}
            onChange={setApplyFee}
          />
        </div>
      </div>
    </DialogShell>
  );
}
