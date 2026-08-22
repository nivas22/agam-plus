// components/queue/AddWalkInModal.tsx
"use client";

import { AlertCircle, Loader2, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { inputClass } from "@/components/common/EditFormControls";
import { useDoctorSlots } from "@/hooks/useDoctorSlots";
import { paletteFor } from "@/lib/avatarPalette";
import type {
  AppointmentFormData,
  AppointmentWithDetails,
} from "@/types/appointment";
import type { Patient } from "@/types/patientNew";
import {
  doctorAvailabilityNow,
  getInitials,
  type QueueLane,
  toISODate,
} from "./queueBoard";

interface AddWalkInModalProps {
  hospitalId: string;
  lanes: QueueLane[];
  patients: Patient[];
  now: Date;
  initialDoctorId?: string | null;
  onClose: () => void;
  addAppointment: (
    data: Partial<AppointmentFormData>,
  ) => Promise<AppointmentWithDetails>;
  updateAppointmentStatus: (
    appointmentId: string,
    status: string,
    sessionNotes?: string,
    appointmentData?: Partial<AppointmentWithDetails>,
  ) => Promise<void>;
  onSuccess: (message: string) => void;
}

export default function AddWalkInModal({
  hospitalId,
  lanes,
  patients,
  now,
  initialDoctorId,
  onClose,
  addAppointment,
  updateAppointmentStatus,
  onSuccess,
}: AddWalkInModalProps) {
  const today = toISODate(now);

  const doctorOptions = useMemo(
    () =>
      lanes.map((lane) => {
        const busy = lane.inConsultation.length + lane.waiting.length;
        const availability = doctorAvailabilityNow(lane.doctor, now);
        return { lane, doctor: lane.doctor, busy, availability };
      }),
    [lanes, now],
  );

  const [search, setSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [doctorId, setDoctorId] = useState<string | null>(
    (initialDoctorId &&
      doctorOptions.find((o) => o.doctor.id === initialDoctorId)?.doctor.id) ??
      doctorOptions.find((o) => o.availability.available)?.doctor.id ??
      doctorOptions[0]?.doctor.id ??
      null,
  );
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Real bookable slots for the chosen doctor today — the same endpoint the
  // regular booking flow uses, so a walk-in can't be offered a slot the
  // backend would reject (capacity already full, holiday, etc).
  const { data: slotData, isLoading: slotsLoading } = useDoctorSlots(
    hospitalId,
    doctorId || undefined,
    doctorId ? today : undefined,
  );
  const nextSlot = slotData?.availableSlots?.[0];

  useEffect(() => {
    setError(null);
  }, [doctorId]);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q || selectedPatient) return [];
    return patients
      .filter(
        (p) =>
          p.name?.toLowerCase().includes(q) ||
          p.phone?.toLowerCase().includes(q) ||
          p.patientId?.toLowerCase().includes(q),
      )
      .slice(0, 6);
  }, [patients, search, selectedPatient]);

  const chosen = doctorOptions.find((o) => o.doctor.id === doctorId);
  const queuePosition = chosen
    ? chosen.lane.inConsultation.length + chosen.lane.waiting.length + 1
    : 1;

  const canSubmit =
    !!selectedPatient && !!doctorId && !!nextSlot && !slotsLoading;

  const submit = async () => {
    if (!selectedPatient || !doctorId || !nextSlot) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await addAppointment({
        doctorProfileId: doctorId,
        patientId: selectedPatient.id,
        startDate: today,
        preferredTime: nextSlot.time,
        frequency: "once",
        numberOfOccurrences: 1,
        notes: reason || undefined,
      });
      // The create endpoint replies with a batch — { appointments: [...] } —
      // even for a single "once" booking, not a bare appointment object.
      const createdId =
        created.id ??
        (created as unknown as { appointments?: { id: string }[] })
          .appointments?.[0]?.id;
      if (!createdId) {
        throw new Error("Walk-in was created but its id was not returned");
      }
      await updateAppointmentStatus(createdId, "checked-in");
      onSuccess(`${selectedPatient.name} added to the queue and checked in`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add walk-in");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink-900/35 p-4">
      <div className="w-full max-w-[560px] bg-surface-paper rounded-2xl shadow-2xl overflow-hidden max-h-[calc(100vh-48px)] flex flex-col">
        <div className="px-6 pt-5 pb-4 border-b border-border flex items-start gap-3">
          <div>
            <h2 className="text-lg font-bold text-ink-900">Add a walk-in</h2>
            <p className="text-xs text-ink-500 mt-1">
              Checked in immediately — the wait timer starts now.
            </p>
          </div>
          <div className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-surface-canvas text-ink-500"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
          {error && <div className="text-sm text-status-danger">{error}</div>}

          <div>
            <label className="text-xs font-semibold text-ink-700 mb-1.5 block">
              Patient
            </label>
            {selectedPatient ? (
              <div className="flex items-center gap-3 px-3 py-3 rounded-lg border border-brand-violet bg-brand-violet-soft">
                <span
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                  style={{ background: paletteFor(selectedPatient.name)[0] }}
                >
                  {getInitials(selectedPatient.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink-900 truncate">
                    {selectedPatient.name}
                  </span>
                  <span className="block text-xs text-ink-500 truncate">
                    {[selectedPatient.phone, selectedPatient.patientId]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedPatient(null)}
                  className="text-xs font-medium text-brand-violet hover:underline shrink-0"
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-500" />
                <input
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or phone number"
                  className={`${inputClass} pl-9`}
                />
                {matches.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-surface-paper border border-border rounded-lg shadow-lg overflow-hidden max-h-56 overflow-y-auto">
                    {matches.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelectedPatient(p);
                          setSearch("");
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-surface-canvas transition-colors"
                      >
                        <span
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                          style={{ background: paletteFor(p.name)[0] }}
                        >
                          {getInitials(p.name)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-ink-900 truncate">
                            {p.name}
                          </span>
                          <span className="block text-xs text-ink-500 truncate">
                            {[p.phone, p.patientId].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {search.trim().length >= 2 && matches.length === 0 && (
                  <p className="text-xs text-ink-500 mt-1.5">
                    No match on file. Add them from Patients first, then come
                    back here.
                  </p>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-ink-700 mb-1.5 block">
              Which doctor
            </label>
            <div className="grid grid-cols-3 gap-2">
              {doctorOptions.map(({ doctor, busy, availability }) => {
                const active = doctorId === doctor.id;
                return (
                  <button
                    key={doctor.id}
                    type="button"
                    disabled={!availability.available}
                    onClick={() => setDoctorId(doctor.id)}
                    aria-pressed={active}
                    title={
                      availability.available ? undefined : availability.label
                    }
                    className={`border rounded-lg p-3 text-left transition-colors ${
                      !availability.available
                        ? "opacity-50 cursor-not-allowed border-border"
                        : active
                          ? "border-brand-violet bg-brand-violet-soft"
                          : "border-border hover:border-ink-500/40"
                    }`}
                  >
                    <span
                      className={`block text-sm font-semibold truncate ${active && availability.available ? "text-brand-violet" : "text-ink-900"}`}
                    >
                      Dr. {doctor.name}
                    </span>
                    <span
                      className={`block text-xs font-mono mt-1 ${
                        !availability.available
                          ? "text-ink-500"
                          : busy === 0
                            ? "text-status-open"
                            : "text-status-warning"
                      }`}
                    >
                      {availability.available
                        ? busy === 0
                          ? "Free now"
                          : `~${busy * (doctor.appointmentDuration || 30)} min wait`
                        : availability.label}
                    </span>
                  </button>
                );
              })}
              {doctorOptions.length === 0 && (
                <p className="text-sm text-ink-500 col-span-3">
                  No doctors with a session today.
                </p>
              )}
            </div>
            {doctorId && !slotsLoading && !nextSlot && (
              <div className="flex items-start gap-2 mt-2 px-3 py-2.5 rounded-lg bg-status-warning-soft border border-status-warning/20 text-xs text-status-warning">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                No open slot left for Dr. {chosen?.doctor.name} right now —
                fully booked or outside their hours today.
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-ink-700 mb-1.5 block">
              Reason for visit{" "}
              <span className="font-normal text-ink-500">optional</span>
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Fever and body ache, 2 days"
              className={inputClass}
            />
          </div>

          {chosen && nextSlot && (
            <div className="bg-surface-canvas/60 border border-border rounded-lg p-3 text-xs text-ink-700">
              Will be waiting-position{" "}
              <b className="text-ink-900">{queuePosition}</b> for Dr.{" "}
              {chosen.doctor.name}. Checked in as soon as you confirm.
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border flex items-center gap-3">
          <span className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 rounded-lg border border-border text-sm font-semibold text-ink-700"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit || submitting}
            onClick={submit}
            className="h-10 px-4 rounded-lg bg-brand-violet hover:bg-brand-violet-hover text-white text-sm font-semibold disabled:opacity-60 flex items-center gap-1.5"
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            Add &amp; check in
          </button>
        </div>
      </div>
    </div>
  );
}
