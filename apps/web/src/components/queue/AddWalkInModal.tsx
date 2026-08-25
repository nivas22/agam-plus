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
  computePresence,
  doctorAvailabilityNow,
  formatTime12h,
  getInitials,
  minutesToTimeStr,
  type PresenceOverride,
  projectFinish,
  type QueueLane,
  sessionCapacity,
  toISODate,
} from "./queueBoard";

const TILE_TONE_CLS: Record<"ok" | "mid" | "bad" | "muted", string> = {
  ok: "text-status-open",
  mid: "text-status-warning",
  bad: "text-status-danger",
  muted: "text-ink-500",
};

type FitMode = "direct" | "scheduled";

interface AddWalkInModalProps {
  hospitalId: string;
  lanes: QueueLane[];
  patients: Patient[];
  presenceOverrides: Record<string, PresenceOverride>;
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
  presenceOverrides,
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
        const availability = doctorAvailabilityNow(lane.doctor, now);
        const presence = computePresence(
          lane,
          presenceOverrides[lane.doctor.id],
          now,
        );
        const cap = sessionCapacity(lane, now);
        // Projected with +1 patient — "if we add this walk-in, how does the
        // session end up" is what the overrun warning needs.
        const proj = projectFinish(lane, now, 1);
        return { lane, doctor: lane.doctor, availability, presence, cap, proj };
      }),
    [lanes, now, presenceOverrides],
  );

  function tileInfo(o: (typeof doctorOptions)[number]) {
    const heldCaption =
      o.cap.heldTotal > 0
        ? o.cap.heldFree > 0
          ? `${o.cap.heldFree} held slot${o.cap.heldFree === 1 ? "" : "s"} free`
          : "0 held slots left"
        : "";
    if (!o.availability.available) {
      return {
        label: o.availability.label,
        tone: "muted" as const,
        caption:
          o.cap.totalCapacity > 0 && o.cap.freeCount === 0
            ? "full this session"
            : heldCaption,
      };
    }
    if (o.cap.totalCapacity > 0 && o.cap.freeCount === 0) {
      return { label: "Full", tone: "bad" as const, caption: heldCaption };
    }
    const queueLen = o.lane.inConsultation.length + o.lane.waiting.length;
    const pace =
      (o.doctor.appointmentDuration || 30) +
      Math.max(0, o.doctor.bufferMinutes || 0);
    const waitMins = queueLen * pace;
    const tone: "ok" | "mid" | "bad" =
      waitMins <= 10 ? "ok" : waitMins <= 25 ? "mid" : "bad";
    return {
      label: queueLen === 0 ? "Free now" : `${waitMins} min wait`,
      tone,
      caption: heldCaption,
    };
  }

  const [search, setSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [doctorId, setDoctorId] = useState<string | null>(
    (initialDoctorId &&
      doctorOptions.find((o) => o.doctor.id === initialDoctorId)?.doctor.id) ??
      doctorOptions.find((o) => o.availability.available)?.doctor.id ??
      doctorOptions[0]?.doctor.id ??
      null,
  );
  const [fitMode, setFitMode] = useState<FitMode>("direct");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Real bookable slots for the chosen doctor today — the same endpoint the
  // regular booking flow uses, so "next free slot" can't offer a time the
  // backend would reject.
  const { data: slotData, isLoading: slotsLoading } = useDoctorSlots(
    hospitalId,
    doctorId || undefined,
    doctorId ? today : undefined,
  );
  const nextSlot = slotData?.availableSlots?.[0];

  const target = doctorOptions.find((o) => o.doctor.id === doctorId);
  const hardBlocked =
    !!target &&
    target.cap.totalCapacity > 0 &&
    target.cap.bookedCount >= target.cap.totalCapacity &&
    target.doctor.overCapacityPolicy === "block";
  const canDirect = !!target?.availability.available && !hardBlocked;

  // Only worth suggesting a reroute when the chosen doctor isn't already the
  // easy choice — someone free right now with room needs no alternative.
  const bestAlternate = useMemo(() => {
    if (!target || tileInfo(target).tone === "ok") return null;
    const candidates = doctorOptions.filter(
      (o) =>
        o.doctor.id !== target.doctor.id &&
        o.availability.available &&
        o.cap.freeCount > 0,
    );
    if (!candidates.length) return null;
    return candidates.sort(
      (a, b) => b.cap.heldFree - a.cap.heldFree || b.cap.freeCount - a.cap.freeCount,
    )[0];
  }, [doctorOptions, target]);

  // Re-pick a sensible default strategy whenever the chosen doctor changes.
  useEffect(() => {
    setError(null);
    setFitMode(canDirect ? "direct" : "scheduled");
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const queuePosition = target
    ? target.lane.inConsultation.length + target.lane.waiting.length + 1
    : 1;

  const overCapacityPolicy = target?.doctor.overCapacityPolicy || "warn";
  const showOverrun =
    fitMode === "direct" &&
    !!target?.proj &&
    target.proj.overMinutes > 0 &&
    overCapacityPolicy !== "allow";

  const canSubmit =
    !!selectedPatient &&
    !!doctorId &&
    (fitMode === "direct"
      ? canDirect
      : !!nextSlot && !slotsLoading);

  const submit = async () => {
    if (!selectedPatient || !doctorId || !target) return;
    setSubmitting(true);
    setError(null);
    try {
      let preferredTime: string;
      let forceSlot = false;
      let checkInAfter = false;

      if (fitMode === "direct") {
        preferredTime = `${String(now.getHours()).padStart(2, "0")}:${String(
          now.getMinutes(),
        ).padStart(2, "0")}`;
        forceSlot = true;
        checkInAfter = true;
      } else {
        if (!nextSlot) {
          throw new Error("No open slot left for this doctor today");
        }
        preferredTime = nextSlot.time;
        checkInAfter = false;
      }

      const created = await addAppointment({
        doctorProfileId: doctorId,
        patientId: selectedPatient.id,
        startDate: today,
        preferredTime,
        frequency: "once",
        numberOfOccurrences: 1,
        notes: reason || undefined,
        bookingSource: "walk-in",
        forceSlot,
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
      if (checkInAfter) {
        await updateAppointmentStatus(createdId, "checked-in");
        onSuccess(`${selectedPatient.name} added to the queue and checked in`);
      } else {
        onSuccess(
          `${selectedPatient.name} booked for ${formatTime12h(preferredTime)} with Dr. ${target.doctor.name}`,
        );
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add walk-in");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink-900/35 p-4">
      <div className="w-full max-w-[600px] bg-surface-paper rounded-2xl shadow-2xl overflow-hidden max-h-[calc(100vh-48px)] flex flex-col">
        <div className="px-6 pt-5 pb-4 border-b border-border flex items-start gap-3">
          <div>
            <h2 className="text-lg font-bold text-ink-900 font-display tracking-tight">Add a walk-in</h2>
            <p className="text-xs text-ink-500 mt-1">
              Creates a real appointment, so the visit shows up in reports
              like any other.
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
                  <span className="block text-xs text-ink-500 truncate font-mono tabular">
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
                  Not him
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-500" />
                <input
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Phone number or name"
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
                          <span className="block text-xs text-ink-500 truncate font-mono tabular">
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
              {doctorOptions.map((o) => {
                const active = doctorId === o.doctor.id;
                const info = tileInfo(o);
                return (
                  <button
                    key={o.doctor.id}
                    type="button"
                    onClick={() => setDoctorId(o.doctor.id)}
                    aria-pressed={active}
                    title={o.presence.detail}
                    className={`border rounded-lg p-3 text-left transition-colors ${
                      active
                        ? "border-brand-violet bg-brand-violet-soft"
                        : "border-border hover:border-ink-500/40"
                    }`}
                  >
                    <span
                      className={`block text-sm font-semibold truncate ${active ? "text-brand-violet" : "text-ink-900"}`}
                    >
                      Dr. {o.doctor.name}
                    </span>
                    <span
                      className={`block text-xs font-mono mt-1 ${TILE_TONE_CLS[info.tone]}`}
                    >
                      {info.label}
                    </span>
                    {info.caption && (
                      <span className="block text-[11px] text-ink-500 mt-0.5 truncate">
                        {info.caption}
                      </span>
                    )}
                  </button>
                );
              })}
              {doctorOptions.length === 0 && (
                <p className="text-sm text-ink-500 col-span-3">
                  No doctors on the roster yet.
                </p>
              )}
            </div>
          </div>

          {target && (
            <div>
              <label className="text-xs font-semibold text-ink-700 mb-1.5 block">
                How to fit them in
              </label>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setFitMode("direct")}
                  aria-pressed={fitMode === "direct"}
                  disabled={!canDirect}
                  className={`border rounded-lg p-3 text-left flex items-start gap-2.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    fitMode === "direct"
                      ? "border-brand-violet bg-brand-violet-soft"
                      : "border-border hover:border-ink-500/40"
                  }`}
                >
                  <span
                    className={`w-3.5 h-3.5 rounded-full border shrink-0 mt-0.5 ${
                      fitMode === "direct"
                        ? "border-[5px] border-brand-violet bg-white"
                        : "border-border"
                    }`}
                  />
                  <span className="min-w-0">
                    <span
                      className={`block text-sm font-semibold ${fitMode === "direct" ? "text-brand-violet" : "text-ink-900"}`}
                    >
                      Straight into the queue — no slot
                    </span>
                    <span className="block text-xs text-ink-500 mt-0.5">
                      {canDirect
                        ? `Seen after the ${target.lane.inConsultation.length + target.lane.waiting.length} already waiting.`
                        : hardBlocked
                          ? `Dr. ${target.doctor.name} is fully booked and this hospital blocks adding more walk-ins.`
                          : `Dr. ${target.doctor.name} isn't in session right now.`}
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setFitMode("scheduled")}
                  aria-pressed={fitMode === "scheduled"}
                  disabled={!nextSlot || slotsLoading}
                  className={`border rounded-lg p-3 text-left flex items-start gap-2.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    fitMode === "scheduled"
                      ? "border-brand-violet bg-brand-violet-soft"
                      : "border-border hover:border-ink-500/40"
                  }`}
                >
                  <span
                    className={`w-3.5 h-3.5 rounded-full border shrink-0 mt-0.5 ${
                      fitMode === "scheduled"
                        ? "border-[5px] border-brand-violet bg-white"
                        : "border-border"
                    }`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span
                        className={`block text-sm font-semibold ${fitMode === "scheduled" ? "text-brand-violet" : "text-ink-900"}`}
                      >
                        {nextSlot
                          ? `Next free slot — ${formatTime12h(nextSlot.time)} today`
                          : "No free slot left today"}
                      </span>
                      {nextSlot && (
                        <span className="ml-auto shrink-0 bg-status-open-soft text-status-open rounded-md px-1.5 py-0.5 text-[10px] font-bold">
                          KEEPS SCHEDULE
                        </span>
                      )}
                    </span>
                    <span className="block text-xs text-ink-500 mt-0.5">
                      Reserves the time instead of checking in now — the
                      schedule stays honest.
                    </span>
                  </span>
                </button>

                {bestAlternate && (
                  <button
                    type="button"
                    onClick={() => {
                      setDoctorId(bestAlternate.doctor.id);
                      setFitMode("direct");
                    }}
                    className="border border-border rounded-lg p-3 text-left flex items-start gap-2.5 hover:border-ink-500/40 transition-colors"
                  >
                    <span className="w-3.5 h-3.5 rounded-full border border-border shrink-0 mt-0.5" />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-ink-900">
                        Send to Dr. {bestAlternate.doctor.name} —{" "}
                        {tileInfo(bestAlternate).label}
                      </span>
                      <span className="block text-xs text-ink-500 mt-0.5">
                        {tileInfo(bestAlternate).caption ||
                          "Only if the complaint suits them."}
                      </span>
                    </span>
                  </button>
                )}
              </div>
            </div>
          )}

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

          {showOverrun && target?.proj && (
            <div className="flex gap-3 bg-status-warning-soft border border-status-warning/25 rounded-xl p-3.5 text-status-warning">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-ink-900">
                  This takes Dr. {target.doctor.name} past the end of their
                  session
                </div>
                <div className="text-xs mt-1 leading-relaxed">
                  Adding {selectedPatient?.name || "this patient"} means{" "}
                  {target.lane.inConsultation.length +
                    target.lane.waiting.length +
                    target.lane.yetToArrive.length +
                    1}{" "}
                  {target.lane.inConsultation.length +
                    target.lane.waiting.length +
                    target.lane.yetToArrive.length +
                    1 ===
                  1
                    ? "patient"
                    : "patients"}{" "}
                  left to see today.
                </div>
                <div className="flex gap-5 mt-2.5 pt-2.5 border-t border-status-warning/25 text-xs">
                  <div>
                    <span className="block font-mono font-semibold text-ink-900">
                      {formatTime12h(minutesToTimeStr(target.proj.window.end))}
                    </span>
                    session ends
                  </div>
                  <div>
                    <span className="block font-mono font-semibold text-status-danger">
                      {formatTime12h(
                        minutesToTimeStr(target.proj.finishMinutes),
                      )}
                    </span>
                    likely finish
                  </div>
                  <div>
                    <span className="block font-mono font-semibold text-ink-900">
                      +{target.proj.overMinutes} min
                    </span>
                    over
                  </div>
                </div>
              </div>
            </div>
          )}

          {target && selectedPatient && canSubmit && (
            <div className="flex items-center gap-3 bg-surface-canvas/60 border border-border rounded-lg p-3">
              <span className="w-11 h-11 rounded-lg bg-brand-violet text-white flex items-center justify-center font-mono text-base font-semibold shrink-0">
                {String(fitMode === "direct" ? queuePosition : "—").padStart(
                  fitMode === "direct" ? 2 : 1,
                  "0",
                )}
              </span>
              <span className="text-xs text-ink-700 leading-relaxed">
                {fitMode === "direct" ? (
                  <>
                    <b className="text-ink-900">
                      Token {String(queuePosition).padStart(2, "0")}
                    </b>{" "}
                    for {selectedPatient.name}. They&apos;ll be seen after the{" "}
                    {queuePosition - 1} people already ahead — checked in as
                    soon as you confirm.
                  </>
                ) : (
                  <>
                    Booked for{" "}
                    <b className="text-ink-900">
                      {nextSlot ? formatTime12h(nextSlot.time) : ""}
                    </b>{" "}
                    with Dr. {target.doctor.name}. Not checked in yet — do
                    that when {selectedPatient.name} actually arrives.
                  </>
                )}
              </span>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border flex items-center gap-3">
          {target && (
            <span className="text-[11px] text-ink-500 flex-1">
              {fitMode === "direct"
                ? `Dr. ${target.doctor.name} will see this on their Today screen.`
                : null}
            </span>
          )}
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
            className={`h-10 px-4 rounded-lg text-white text-sm font-semibold disabled:opacity-60 flex items-center gap-1.5 ${
              showOverrun
                ? "bg-status-warning hover:bg-status-warning/90"
                : "bg-brand-violet hover:bg-brand-violet-hover"
            }`}
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            {fitMode === "scheduled"
              ? "Book slot"
              : showOverrun
                ? `Add anyway — ${target?.proj?.overMinutes ?? 0} min over`
                : "Add & check in"}
          </button>
        </div>
      </div>
    </div>
  );
}
