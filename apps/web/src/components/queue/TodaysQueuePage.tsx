// components/queue/TodaysQueuePage.tsx
"use client";

import { format } from "date-fns";
import { Clock, Maximize2, Minimize2, Phone, Plus, UserPlus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CancelDialog,
  ChangeDoctorDialog,
  NoShowDialog,
  RescheduleDialog,
} from "@/components/appointments/AppointmentActionDialogs";
import CompleteVisitDialog from "@/components/appointments/CompleteVisitDialog";
import DoctorDetailSidebar from "@/components/doctors/DoctorDetailSidebar";
import { useAuth } from "@/hooks/useAuth";
import {
  useDoctorPresence,
  useSetDoctorPresence,
} from "@/hooks/useDoctorPresenceApi";
import { useHospitalAppointmentsApi } from "@/hooks/useNewAppointmentsApi";
import { useHospitalDoctors } from "@/hooks/useNewDoctorApi";
import { useHospitalPatients } from "@/hooks/useNewPatientApi";
import { paletteFor } from "@/lib/avatarPalette";
import type { AppointmentWithDetails } from "@/types/appointment";
import type { Doctor } from "@/types/doctorNew";
import { APPOINTMENT_STATUS } from "../../constants";
import AddWalkInModal from "./AddWalkInModal";
import DoctorAbsentModal from "./DoctorAbsentModal";
import DoctorPresenceMenu from "./DoctorPresenceMenu";
import PatientQueueDrawer from "./PatientQueueDrawer";
import {
  activePatientCount,
  apptDateTime,
  buildLanes,
  capacityMessage,
  computePresence,
  type DoctorPresence,
  doctorAvailabilityNow,
  formatTime12h,
  getInitials,
  type LaneStatus,
  laneStatus,
  minutesBetween,
  minutesElapsed,
  minutesToTimeStr,
  normalizeStatus,
  OVERDUE_GRACE_MINUTES,
  type PresenceOverride,
  primaryWindowToday,
  projectFinish,
  type QueueLane,
  sessionCapacity,
  stageStart,
  todaysWindows,
  toISODate,
} from "./queueBoard";

interface TodaysQueuePageProps {
  hospitalId: string;
  userRole: string | undefined;
  canEdit: boolean;
  userId?: string;
}

type ActionDialog = {
  kind: "changeDoctor" | "reschedule" | "cancel" | "noShow";
  appt: AppointmentWithDetails;
};

export default function TodaysQueuePage({
  hospitalId,
  userRole,
  canEdit,
  userId,
}: TodaysQueuePageProps) {
  const { user, navigateToHospitalRoute } = useAuth();
  const [now, setNow] = useState(() => new Date());
  const [selectedAppt, setSelectedAppt] =
    useState<AppointmentWithDetails | null>(null);
  const [completeAppt, setCompleteAppt] =
    useState<AppointmentWithDetails | null>(null);
  const [actionDialog, setActionDialog] = useState<ActionDialog | null>(null);
  const [showAddWalkIn, setShowAddWalkIn] = useState(false);
  const [walkInPresetDoctorId, setWalkInPresetDoctorId] = useState<
    string | null
  >(null);
  const [absentModal, setAbsentModal] = useState<{
    doctor: Doctor;
    variant: "notComing" | "leftForDay";
  } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [activeDoctor, setActiveDoctor] = useState<Doctor | null>(null);

  const openAddWalkIn = useCallback((presetDoctorId?: string) => {
    setWalkInPresetDoctorId(presetDoctorId ?? null);
    setShowAddWalkIn(true);
  }, []);

  const boardRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const onChange = () =>
      setIsFullscreen(document.fullscreenElement === boardRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      boardRef.current?.requestFullscreen();
    }
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const today = toISODate(now);

  // Backed by the DB (see useDoctorPresenceApi) — shared across every
  // front-desk terminal and the doctor's own device, with every change
  // recorded in the audit trail (area "doctors"). Replaces the old
  // localStorage-only version of this, which also had a bug where a tab
  // left open across midnight would carry yesterday's overrides into today.
  const { data: presenceOverrides = {} } = useDoctorPresence(
    hospitalId,
    today,
  );
  const setDoctorPresence = useSetDoctorPresence(hospitalId);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    p.append("startDate", today);
    p.append("endDate", today);
    if (userRole) p.append("userRole", userRole);
    if (userRole === "doctor" && userId) p.append("doctorId", userId);
    return p;
  }, [today, userRole, userId]);

  const {
    appointments,
    isLoading,
    updateAppointmentStatus,
    addAppointment,
    refetchAppointments,
  } = useHospitalAppointmentsApi(hospitalId, userRole, canEdit, params);

  const { data: patientsData = { patients: [] } } = useHospitalPatients(
    hospitalId,
    undefined,
    true,
  );
  const { data: doctorsData = { doctors: [] } } = useHospitalDoctors(
    hospitalId,
    undefined,
    true,
  );

  const getPatientCode = useCallback(
    (patientId: string) =>
      patientsData.patients.find((p) => p.id === patientId)?.patientId,
    [patientsData.patients],
  );

  // Every doctor gets a lane here, whether or not they have a booking today —
  // the walk-in picker needs doctors with nothing booked yet too. The board
  // itself only renders a doctor who either has something going on today or
  // is available right now — not purely based on having appointments.
  const allLanes = useMemo(
    () => buildLanes(doctorsData.doctors, appointments, now),
    [doctorsData.doctors, appointments, now],
  );
  // Busiest doctor first — ranked by patients still needing attention today
  // (in consultation, waiting, or yet to arrive), not by how many they've
  // already finished — a doctor who's done for the day shouldn't outrank
  // one currently mid-consultation just because they saw more patients earlier.
  const lanes = useMemo(
    () =>
      allLanes
        .filter(
          (lane) =>
            lane.all.length > 0 ||
            doctorAvailabilityNow(lane.doctor, now).available,
        )
        .sort((a, b) => activePatientCount(b) - activePatientCount(a)),
    [allLanes, now],
  );

  const [boardTab, setBoardTab] = useState<"active" | "sessionOver">("active");
  // A doctor marked "left for the day" always reads as session-over —
  // handleLeftForDay only lets that override land once the queue's already
  // empty (or resolved via the absent modal), so laneStatus's own read of
  // the doctor's nominal hours (which knows nothing about this override)
  // would otherwise still show them as "on time"/"available" for a window
  // later today.
  const lanesWithStatus = useMemo(
    () =>
      lanes.map((lane) => ({
        lane,
        status:
          presenceOverrides[lane.doctor.id]?.kind === "leftForDay"
            ? ({ label: "Session over", tone: "off" } as const)
            : laneStatus(lane, now),
      })),
    [lanes, now, presenceOverrides],
  );
  const activeLanes = lanesWithStatus.filter(
    (l) => l.status.label !== "Session over",
  );
  const sessionOverLanes = lanesWithStatus.filter(
    (l) => l.status.label === "Session over",
  );
  const visibleLanes = boardTab === "active" ? activeLanes : sessionOverLanes;

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const handleDialogSuccess = useCallback(
    async (message: string) => {
      showToast(message);
      await refetchAppointments();
    },
    [showToast, refetchAppointments],
  );

  const quickUpdate = useCallback(
    async (appt: AppointmentWithDetails, status: string) => {
      try {
        await updateAppointmentStatus(appt.id, status);
        setSelectedAppt(null);
        await refetchAppointments();
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : "Failed to update appointment",
        );
      }
    },
    [updateAppointmentStatus, refetchAppointments, showToast],
  );

  const handleMarkHere = useCallback(
    (doctorId: string) => {
      setDoctorPresence.mutate({ doctorId, date: today, kind: "here" });
    },
    [setDoctorPresence, today],
  );

  const handleMarkRunningLate = useCallback(
    (doctorId: string, expectedTime: string) => {
      setDoctorPresence.mutate({
        doctorId,
        date: today,
        kind: "runningLate",
        expectedTime,
      });
    },
    [setDoctorPresence, today],
  );

  const handleMarkOnBreak = useCallback(
    (doctorId: string, returnTime: string) => {
      setDoctorPresence.mutate({
        doctorId,
        date: today,
        kind: "onBreak",
        returnTime,
      });
    },
    [setDoctorPresence, today],
  );

  // "Not coming today" always opens the bulk modal, even with nothing
  // booked, so the desk can still record why and stop the day being blank.
  // "Left for the day" skips the modal when nothing's left to reassign.
  const handleOpenNotComing = useCallback((lane: QueueLane) => {
    setAbsentModal({ doctor: lane.doctor, variant: "notComing" });
  }, []);

  const handleLeftForDay = useCallback(
    (lane: QueueLane) => {
      if (lane.waiting.length === 0 && lane.yetToArrive.length === 0) {
        setDoctorPresence.mutate({
          doctorId: lane.doctor.id,
          date: today,
          kind: "leftForDay",
        });
        showToast(`Dr. ${lane.doctor.name} marked as left for the day`);
        return;
      }
      setAbsentModal({ doctor: lane.doctor, variant: "leftForDay" });
    },
    [setDoctorPresence, today, showToast],
  );

  const handleAbsentApplied = useCallback(
    async (override: PresenceOverride, message: string) => {
      if (!absentModal) return;
      setDoctorPresence.mutate({
        doctorId: absentModal.doctor.id,
        date: today,
        kind: override.kind,
        reason: "reason" in override ? override.reason : undefined,
        toldBy: "toldBy" in override ? override.toldBy : undefined,
        note: "note" in override ? override.note : undefined,
      });
      showToast(message);
      await refetchAppointments();
    },
    [absentModal, setDoctorPresence, today, showToast, refetchAppointments],
  );

  const waitingAll = lanes.flatMap((l) => l.waiting);
  const inConsultationAll = lanes.flatMap((l) => l.inConsultation);
  const doneAll = lanes.flatMap((l) => l.done);
  const yetToArriveAll = lanes.flatMap((l) => l.yetToArrive);
  // Computed straight from `appointments`, not from the per-doctor lanes —
  // an overdue patient must never depend on their doctor having a rendered
  // lane (e.g. filtered out of the doctors list for any reason).
  const overdueAll = useMemo(
    () =>
      appointments
        .filter((a) =>
          [APPOINTMENT_STATUS.CONFIRMED, APPOINTMENT_STATUS.PENDING].includes(
            normalizeStatus(a.status) as APPOINTMENT_STATUS,
          ),
        )
        .filter(
          (a) => minutesElapsed(apptDateTime(a), now) >= OVERDUE_GRACE_MINUTES,
        ),
    [appointments, now],
  );
  const waitTimes = waitingAll.map((a) =>
    minutesBetween(stageStart(a, a.waitingAt || a.checkedInAt), now),
  );
  const avgWait = waitTimes.length
    ? Math.round(waitTimes.reduce((s, m) => s + m, 0) / waitTimes.length)
    : 0;

  // A doctor's later-today session that isn't the one already summarized in
  // their lane's capacity strip — either a second shift for someone already
  // on the board, or the only session today for a doctor who hasn't started
  // yet and so has no lane at all (nothing booked, nowhere active to show it).
  const eveningSessions = useMemo(() => {
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const toMins = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    };
    return doctorsData.doctors
      .map((doctor) => {
        const windows = todaysWindows(doctor, now);
        const primary = primaryWindowToday(doctor, now);
        const later = windows.find(
          (w) =>
            w.start > nowMins + 90 && (!primary || w.start !== primary.start),
        );
        if (!later) return null;
        const bookedCount = appointments.filter(
          (a) =>
            a.doctorProfileId === doctor.id &&
            [
              APPOINTMENT_STATUS.CONFIRMED,
              APPOINTMENT_STATUS.PENDING,
              APPOINTMENT_STATUS.CHECKED_IN,
              APPOINTMENT_STATUS.WAITING,
              APPOINTMENT_STATUS.IN_CONSULTATION,
              APPOINTMENT_STATUS.COMPLETED,
            ].includes(normalizeStatus(a.status) as APPOINTMENT_STATUS) &&
            toMins(a.time) >= later.start &&
            toMins(a.time) < later.end,
        ).length;
        return { doctor, window: later, bookedCount };
      })
      .filter((v): v is { doctor: Doctor; window: { start: number; end: number }; bookedCount: number } => v != null)
      .sort((a, b) => a.window.start - b.window.start)
      .slice(0, 2);
  }, [doctorsData.doctors, appointments, now]);
  const longestWait = waitTimes.length ? Math.max(...waitTimes) : 0;

  const isLoadingInitial = isLoading && appointments.length === 0;

  return (
    <div ref={boardRef} className={`pb-16 ${isFullscreen ? "bg-surface-canvas p-4 overflow-y-auto h-screen" : ""}`}>
      <div className="flex flex-wrap items-start gap-4 mb-4">
        <div>
          <h1 className="text-xl font-bold text-ink-900 font-display tracking-tight">Today&apos;s queue</h1>
          <p className="text-sm text-ink-500 mt-1">
            {format(now, "EEEE, d MMMM yyyy")}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs font-medium text-status-open bg-status-open-soft border border-status-open/20 rounded-full px-3 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-status-open" />
            Live · refreshes every 30s
          </span>
          <span className="font-mono text-lg font-semibold text-ink-900">
            {format(now, "h:mm a")}
          </span>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="h-9 px-3 rounded-lg border border-border text-ink-700 hover:bg-surface-canvas text-sm font-medium flex items-center gap-2 transition-colors"
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
            {isFullscreen ? "Exit full screen" : "Full screen"}
          </button>
          {canEdit && (
            <button
              type="button"
              onClick={() => openAddWalkIn()}
              className="h-9 px-4 rounded-lg bg-brand-violet hover:bg-brand-violet-hover text-white text-sm font-medium flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" /> Walk-in
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-px bg-border rounded-xl overflow-hidden border border-border mb-4">
        {[
          {
            label: "Waiting",
            n: waitingAll.length,
            cls: "text-status-warning",
          },
          {
            label: "In consultation",
            n: inConsultationAll.length,
            cls: "text-brand-violet",
          },
          { label: "Done", n: doneAll.length, cls: "text-status-open" },
          {
            label: "Yet to arrive",
            n: yetToArriveAll.length,
            cls: "text-ink-900",
          },
          { label: "Overdue", n: overdueAll.length, cls: "text-status-danger" },
          { label: "Average wait", n: `${avgWait}m`, cls: "text-ink-900" },
          {
            label: "Longest wait",
            n: `${longestWait}m`,
            cls: "text-status-danger",
          },
        ].map((s) => (
          <div key={s.label} className="bg-surface-paper px-4 py-3">
            <div className="text-[11px] uppercase tracking-wide text-ink-500 font-semibold">
              {s.label}
            </div>
            <div className={`font-mono text-xl font-bold mt-1 ${s.cls}`}>
              {s.n}
            </div>
          </div>
        ))}
      </div>

      {isLoadingInitial ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-violet" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_292px] gap-4">
          <div>
            {lanes.length > 0 && (
              <div className="flex items-center gap-1 mb-3 bg-surface-canvas border border-border rounded-lg p-1 w-fit">
                <button
                  type="button"
                  onClick={() => setBoardTab("active")}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                    boardTab === "active"
                      ? "bg-surface-paper text-ink-900 shadow-sm"
                      : "text-ink-500"
                  }`}
                >
                  Active · {activeLanes.length}
                </button>
                <button
                  type="button"
                  onClick={() => setBoardTab("sessionOver")}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                    boardTab === "sessionOver"
                      ? "bg-surface-paper text-ink-900 shadow-sm"
                      : "text-ink-500"
                  }`}
                >
                  Session over · {sessionOverLanes.length}
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
              {lanes.length === 0 ? (
                <div className="md:col-span-2 xl:col-span-3 bg-surface-paper border border-border rounded-xl py-14 px-6 text-center shadow-sm">
                  <UserPlus className="w-8 h-8 text-border mx-auto mb-3" />
                  <h3 className="text-base font-semibold text-ink-900 mb-1 font-display tracking-tight">
                    Nothing booked today
                  </h3>
                  <p className="text-sm text-ink-500">
                    Add a walk-in, or check back once appointments come in.
                  </p>
                </div>
              ) : visibleLanes.length === 0 ? (
                <div className="md:col-span-2 xl:col-span-3 bg-surface-paper border border-border rounded-xl py-14 px-6 text-center shadow-sm">
                  <p className="text-sm text-ink-500">
                    {boardTab === "active"
                      ? "Every doctor's session is over for today."
                      : "No doctor's session has ended yet."}
                  </p>
                </div>
              ) : (
                visibleLanes.map(({ lane, status }) => (
                  <DoctorLane
                    key={lane.doctor.id}
                    lane={lane}
                    status={status}
                    presence={computePresence(
                      lane,
                      presenceOverrides[lane.doctor.id],
                      now,
                    )}
                    now={now}
                    canEdit={canEdit}
                    onSelect={setSelectedAppt}
                    onSelectDoctor={setActiveDoctor}
                    onComplete={setCompleteAppt}
                    onWritePrescription={(a) =>
                      navigateToHospitalRoute(
                        `appointments/${a.id}/prescription`,
                        hospitalId,
                      )
                    }
                    onCheckIn={(a) =>
                      quickUpdate(a, APPOINTMENT_STATUS.CHECKED_IN)
                    }
                    onSendIn={(a) =>
                      quickUpdate(a, APPOINTMENT_STATUS.IN_CONSULTATION)
                    }
                    onAddWalkIn={openAddWalkIn}
                    onMarkHere={() => handleMarkHere(lane.doctor.id)}
                    onMarkRunningLate={(t) =>
                      handleMarkRunningLate(lane.doctor.id, t)
                    }
                    onMarkOnBreak={(t) => handleMarkOnBreak(lane.doctor.id, t)}
                    onOpenNotComing={() => handleOpenNotComing(lane)}
                    onLeftForDay={() => handleLeftForDay(lane)}
                    getPatientCode={getPatientCode}
                  />
                ))
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-surface-paper border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <h2 className="text-sm font-bold text-ink-900 font-display tracking-tight">
                  Needs a decision
                </h2>
                <span className="ml-auto font-mono text-xs text-ink-500">
                  {overdueAll.length}
                </span>
              </div>
              {overdueAll.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-ink-500">
                  Nothing overdue right now.
                </div>
              ) : (
                overdueAll.map((appt) => {
                  const lateMins = minutesBetween(apptDateTime(appt), now);
                  return (
                    <div
                      key={appt.id}
                      className="px-4 py-3 border-t border-border first:border-t-0 bg-status-danger-soft/40"
                    >
                      <div className="flex items-baseline gap-2">
                        <b className="text-sm text-status-danger">
                          {appt.patientName}
                        </b>
                        {appt.bookingSource === "walk-in" && (
                          <span className="shrink-0 rounded-md bg-status-warning-soft text-status-warning border border-status-warning/20 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide">
                            Walk-in
                          </span>
                        )}
                        <span className="ml-auto font-mono text-xs text-ink-500">
                          {lateMins}m late
                        </span>
                      </div>
                      <div className="text-xs text-ink-500 mt-1">
                        Dr. {appt.doctorName} · booked{" "}
                        {formatTime12h(appt.time)}
                      </div>
                      <div className="flex gap-2 mt-2">
                        {appt.patientPhone && (
                          <a
                            href={`tel:${appt.patientPhone}`}
                            className="h-7 px-3 rounded-lg border border-border text-xs font-medium text-ink-700 hover:bg-surface-canvas flex items-center gap-1"
                          >
                            <Phone size={12} /> Call
                          </a>
                        )}
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() =>
                              setActionDialog({ kind: "noShow", appt })
                            }
                            className="h-7 px-3 rounded-lg border border-status-danger/30 text-xs font-medium text-status-danger hover:bg-status-danger-soft"
                          >
                            Mark no-show
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div className="px-4 py-3 text-[11px] text-ink-500 border-t border-border bg-surface-canvas/40">
                Nothing here happens automatically — it&apos;s a reminder to
                call or record a no-show once a patient is more than{" "}
                {OVERDUE_GRACE_MINUTES} minutes late.
              </div>
            </div>

            {eveningSessions.length > 0 && (
              <div className="bg-surface-paper border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-border">
                  <h2 className="text-sm font-bold text-ink-900 font-display tracking-tight">
                    {eveningSessions.length > 1
                      ? "Later today"
                      : "Evening session"}
                  </h2>
                </div>
                {eveningSessions.map(({ doctor, window, bookedCount }) => {
                  const startsInMins = Math.max(
                    0,
                    window.start - (now.getHours() * 60 + now.getMinutes()),
                  );
                  const startsInLabel =
                    startsInMins >= 60
                      ? `${Math.floor(startsInMins / 60)}h ${startsInMins % 60}m`
                      : `${startsInMins}m`;
                  return (
                    <div
                      key={doctor.id}
                      className="px-4 py-3 border-t border-border first:border-t-0"
                    >
                      <div className="flex items-baseline gap-2">
                        <b className="text-sm text-ink-900">
                          Dr. {doctor.name}
                        </b>
                        <span className="ml-auto font-mono text-xs text-ink-500">
                          {formatTime12h(minutesToTimeStr(window.start))}
                        </span>
                      </div>
                      <div className="text-xs text-ink-500 mt-1">
                        {doctor.specialization || "General"} ·{" "}
                        {bookedCount > 0
                          ? `${bookedCount} booked, `
                          : "nothing booked yet, "}
                        starts in {startsInLabel}
                      </div>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => openAddWalkIn(doctor.id)}
                          className="mt-2 w-full h-8 rounded-lg bg-brand-violet hover:bg-brand-violet-hover text-white text-xs font-semibold transition-colors"
                        >
                          + Add walk-in
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {selectedAppt && (
        <PatientQueueDrawer
          appointment={selectedAppt}
          hospitalId={hospitalId}
          doctor={doctorsData.doctors.find(
            (d) => d.id === selectedAppt.doctorProfileId,
          )}
          patient={patientsData.patients.find(
            (p) => p.id === selectedAppt.patientId,
          )}
          queuePosition={(() => {
            const lane = allLanes.find(
              (l) => l.doctor.id === selectedAppt.doctorProfileId,
            );
            const index = lane?.waiting.findIndex(
              (a) => a.id === selectedAppt.id,
            );
            return index != null && index >= 0 ? index + 1 : undefined;
          })()}
          patientCode={getPatientCode(selectedAppt.patientId)}
          now={now}
          collectedByName={user?.name}
          onToast={showToast}
          onClose={() => setSelectedAppt(null)}
          onCheckIn={() =>
            quickUpdate(selectedAppt, APPOINTMENT_STATUS.CHECKED_IN)
          }
          onSendIn={() =>
            quickUpdate(selectedAppt, APPOINTMENT_STATUS.IN_CONSULTATION)
          }
          onComplete={() => {
            setCompleteAppt(selectedAppt);
            setSelectedAppt(null);
          }}
          onChangeDoctor={() => {
            setActionDialog({ kind: "changeDoctor", appt: selectedAppt });
            setSelectedAppt(null);
          }}
          onReschedule={() => {
            setActionDialog({ kind: "reschedule", appt: selectedAppt });
            setSelectedAppt(null);
          }}
          onCancel={() => {
            setActionDialog({ kind: "cancel", appt: selectedAppt });
            setSelectedAppt(null);
          }}
          onNoShow={() => {
            setActionDialog({ kind: "noShow", appt: selectedAppt });
            setSelectedAppt(null);
          }}
          onUpdateReason={async (notes) => {
            try {
              await updateAppointmentStatus(
                selectedAppt.id,
                selectedAppt.status,
                undefined,
                { notes },
              );
              await refetchAppointments();
            } catch (err) {
              showToast(
                err instanceof Error ? err.message : "Failed to update reason",
              );
            }
          }}
        />
      )}

      {completeAppt && (
        <CompleteVisitDialog
          appointment={completeAppt}
          hospitalId={hospitalId}
          consultationFee={
            doctorsData.doctors.find(
              (d) => d.id === completeAppt.doctorProfileId,
            )?.consultationFee
          }
          doctorName={completeAppt.doctorName}
          patientCode={getPatientCode(completeAppt.patientId)}
          collectedByName={user?.name}
          updateAppointmentStatus={updateAppointmentStatus}
          onClose={() => setCompleteAppt(null)}
          onSuccess={handleDialogSuccess}
        />
      )}

      {actionDialog?.kind === "changeDoctor" && (
        <ChangeDoctorDialog
          appointment={actionDialog.appt}
          doctors={doctorsData.doctors}
          allAppointments={appointments}
          patientCode={getPatientCode(actionDialog.appt.patientId)}
          now={now}
          onClose={() => setActionDialog(null)}
          updateAppointmentStatus={updateAppointmentStatus}
          onSuccess={handleDialogSuccess}
        />
      )}
      {actionDialog?.kind === "reschedule" && (
        <RescheduleDialog
          appointment={actionDialog.appt}
          doctor={
            doctorsData.doctors.find(
              (d) => d.id === actionDialog.appt.doctorProfileId,
            ) || null
          }
          hospitalId={hospitalId}
          patientCode={getPatientCode(actionDialog.appt.patientId)}
          onClose={() => setActionDialog(null)}
          updateAppointmentStatus={updateAppointmentStatus}
          onSuccess={handleDialogSuccess}
        />
      )}
      {actionDialog?.kind === "cancel" && (
        <CancelDialog
          appointment={actionDialog.appt}
          patientCode={getPatientCode(actionDialog.appt.patientId)}
          onClose={() => setActionDialog(null)}
          updateAppointmentStatus={updateAppointmentStatus}
          onSuccess={handleDialogSuccess}
        />
      )}
      {actionDialog?.kind === "noShow" && (
        <NoShowDialog
          appointment={actionDialog.appt}
          doctorName={
            doctorsData.doctors.find(
              (d) => d.id === actionDialog.appt.doctorProfileId,
            )?.name
          }
          patientCode={getPatientCode(actionDialog.appt.patientId)}
          onClose={() => setActionDialog(null)}
          updateAppointmentStatus={updateAppointmentStatus}
          onSuccess={handleDialogSuccess}
        />
      )}

      {showAddWalkIn && (
        <AddWalkInModal
          hospitalId={hospitalId}
          lanes={allLanes}
          patients={patientsData.patients}
          presenceOverrides={presenceOverrides}
          now={now}
          initialDoctorId={walkInPresetDoctorId}
          onClose={() => {
            setShowAddWalkIn(false);
            setWalkInPresetDoctorId(null);
          }}
          addAppointment={addAppointment}
          updateAppointmentStatus={updateAppointmentStatus}
          onSuccess={handleDialogSuccess}
        />
      )}

      {absentModal &&
        (() => {
          const lane = allLanes.find(
            (l) => l.doctor.id === absentModal.doctor.id,
          );
          const affected = lane ? [...lane.waiting, ...lane.yetToArrive] : [];
          return (
            <DoctorAbsentModal
              doctor={absentModal.doctor}
              variant={absentModal.variant}
              appointments={affected}
              doctors={doctorsData.doctors}
              now={now}
              userName={user?.name || "Front desk"}
              getPatientCode={getPatientCode}
              updateAppointmentStatus={updateAppointmentStatus}
              onClose={() => setAbsentModal(null)}
              onApplied={handleAbsentApplied}
            />
          );
        })()}

      {activeDoctor && (
        <DoctorDetailSidebar
          doctor={activeDoctor}
          onClose={() => setActiveDoctor(null)}
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

function SpecAvatar({ name }: { name: string }) {
  const [c1, c2] = paletteFor(name);
  return (
    <span
      className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0"
      style={{ background: `linear-gradient(160deg, ${c1}, ${c2})` }}
    >
      {getInitials(name)}
    </span>
  );
}

function DoctorLane({
  lane,
  status,
  presence,
  now,
  canEdit,
  onSelect,
  onSelectDoctor,
  onComplete,
  onWritePrescription,
  onCheckIn,
  onSendIn,
  onAddWalkIn,
  onMarkHere,
  onMarkRunningLate,
  onMarkOnBreak,
  onOpenNotComing,
  onLeftForDay,
  getPatientCode,
}: {
  lane: QueueLane;
  status: LaneStatus;
  presence: DoctorPresence;
  now: Date;
  canEdit: boolean;
  onSelect: (a: AppointmentWithDetails) => void;
  onSelectDoctor: (d: Doctor) => void;
  onComplete: (a: AppointmentWithDetails) => void;
  onWritePrescription: (a: AppointmentWithDetails) => void;
  onCheckIn: (a: AppointmentWithDetails) => void;
  onSendIn: (a: AppointmentWithDetails) => void;
  onAddWalkIn: (presetDoctorId?: string) => void;
  onMarkHere: () => void;
  onMarkRunningLate: (expectedTime: string) => void;
  onMarkOnBreak: (returnTime: string) => void;
  onOpenNotComing: () => void;
  onLeftForDay: () => void;
  getPatientCode: (patientId: string) => string | undefined;
}) {
  const windows = todaysWindows(lane.doctor, now);
  const nowMins = now.getHours() * 60 + now.getMinutes();
  // The window actually in progress right now — a doctor with more than one
  // session today (e.g. morning + evening) would otherwise always measure
  // against the day's first window, however many hours ago that was.
  const currentWindow = windows.find(
    (w) => nowMins >= w.start && nowMins < w.end,
  );
  const minsPastStart = currentWindow ? nowMins - currentWindow.start : null;
  const showNudge =
    presence.tone === "expected" &&
    presence.label !== "ON BREAK" &&
    minsPastStart != null &&
    minsPastStart > 0 &&
    lane.waiting.length > 0;

  return (
    <div className="bg-surface-paper border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-start gap-3">
        <SpecAvatar name={lane.doctor.name} />
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => onSelectDoctor(lane.doctor)}
            className="text-sm font-semibold text-ink-900 truncate hover:underline hover:text-brand-violet transition-colors text-left"
          >
            Dr. {lane.doctor.name}
          </button>
          <div className="text-xs text-ink-500 truncate">{presence.detail}</div>
        </div>
        <span className="ml-auto shrink-0">
          <DoctorPresenceMenu
            label={presence.label}
            tone={presence.tone}
            canEdit={canEdit}
            now={now}
            onMarkHere={onMarkHere}
            onMarkRunningLate={onMarkRunningLate}
            onMarkOnBreak={onMarkOnBreak}
            onOpenNotComing={onOpenNotComing}
            onLeftForDay={onLeftForDay}
          />
        </span>
      </div>

      {windows.length > 0 &&
        (() => {
          const cap = sessionCapacity(lane, now);
          const proj = projectFinish(lane, now);
          const msg = capacityMessage(cap, proj, windows);
          if (!cap.window) return null;
          const pct = (n: number) =>
            cap.totalCapacity ? (n / cap.totalCapacity) * 100 : 0;
          const toneCls: Record<string, string> = {
            ok: "text-status-open",
            warn: "text-status-warning font-semibold",
            danger: "text-status-danger font-semibold",
          };
          return (
            <div className="px-4 py-2.5 border-b border-border bg-surface-canvas/30">
              <div className="flex items-center justify-between text-[11px] text-ink-500 mb-1.5">
                <span>
                  Session capacity ·{" "}
                  {formatTime12h(minutesToTimeStr(cap.window.start))}–
                  {formatTime12h(minutesToTimeStr(cap.window.end))}
                </span>
                <span className="font-mono">
                  <b className="text-ink-900">{cap.bookedCount}</b> of{" "}
                  {cap.totalCapacity}
                </span>
              </div>
              {cap.totalCapacity > 0 && (
                <div className="h-[7px] rounded-full bg-surface-canvas overflow-hidden flex">
                  <div
                    className="h-full bg-brand-violet"
                    style={{ width: `${pct(cap.scheduledCount)}%` }}
                  />
                  <div
                    className="h-full bg-status-warning"
                    style={{ width: `${pct(cap.walkInCount)}%` }}
                  />
                  <div
                    className="h-full bg-status-open/30"
                    style={{ width: `${pct(cap.freeCount)}%` }}
                  />
                </div>
              )}
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {msg && (
                  <span className={`text-[11px] ${toneCls[msg.tone]}`}>
                    {msg.text}
                  </span>
                )}
                {cap.heldTotal > 0 && (
                  <span className="font-mono text-[10px] text-ink-500 border border-dashed border-border rounded px-1.5 py-0.5">
                    {cap.heldFree > 0
                      ? `${cap.heldFree} held slot${cap.heldFree === 1 ? "" : "s"} free`
                      : "0 held slots left"}
                  </span>
                )}
              </div>
            </div>
          );
        })()}

      {showNudge && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-status-warning-soft border-b border-status-warning/20 text-xs text-status-warning">
          <Clock size={13} className="shrink-0" />
          <span>
            {minsPastStart} minutes past start. {lane.waiting.length} people are
            waiting.
          </span>
        </div>
      )}

      {lane.inConsultation.length > 0 && (
        <>
          <div className="px-4 py-2 text-[10px] uppercase tracking-wide font-bold text-ink-500 bg-surface-canvas/40 border-b border-border">
            In consultation
          </div>
          <div className="p-3 space-y-2">
            {lane.inConsultation.map((appt) => (
              <QueueCard
                key={appt.id}
                appt={appt}
                now={now}
                tone="now"
                patientCode={getPatientCode(appt.patientId)}
                onClick={() => onSelect(appt)}
              />
            ))}
          </div>
          {canEdit && (
            <div className="px-3 pb-3 flex gap-2">
              <button
                type="button"
                onClick={() => onWritePrescription(lane.inConsultation[0])}
                className="flex-1 h-8 rounded-lg border border-border text-ink-700 hover:bg-surface-canvas text-xs font-semibold transition-colors"
              >
                Write prescription
              </button>
              <button
                type="button"
                onClick={() => onComplete(lane.inConsultation[0])}
                className="flex-1 h-8 rounded-lg bg-status-open hover:bg-status-open-hover text-white text-xs font-semibold transition-colors"
              >
                Complete visit
              </button>
            </div>
          )}
        </>
      )}

      <div className="px-4 py-2 text-[10px] uppercase tracking-wide font-bold text-ink-500 bg-surface-canvas/40 border-b border-border">
        Waiting · {lane.waiting.length}
      </div>
      <div className="p-3 space-y-2">
        {lane.waiting.length === 0 ? (
          <div className="border border-dashed border-border rounded-lg px-3 py-3 flex items-center justify-between gap-2">
            <span className="text-xs text-ink-500">
              {status.tone === "idle" && lane.inConsultation.length === 0
                ? "Room is free right now"
                : "Nobody waiting"}
            </span>
            {canEdit &&
              status.tone === "idle" &&
              lane.inConsultation.length === 0 && (
                <button
                  type="button"
                  onClick={() => onAddWalkIn(lane.doctor.id)}
                  className="h-7 px-3 rounded-md border border-border bg-surface-paper text-xs font-medium text-ink-700 hover:bg-surface-canvas shrink-0"
                >
                  Add walk-in
                </button>
              )}
          </div>
        ) : (
          lane.waiting.map((appt, index) => (
            <QueueCard
              key={appt.id}
              appt={appt}
              now={now}
              tone="waiting"
              queuePosition={index + 1}
              reason={lane.waitingOrder[index]?.reason}
              patientCode={getPatientCode(appt.patientId)}
              onClick={() => onSelect(appt)}
              action={
                canEdit
                  ? { label: "Send in", onClick: () => onSendIn(appt) }
                  : undefined
              }
            />
          ))
        )}
      </div>

      {lane.yetToArrive.length > 0 && (
        <>
          <div className="px-4 py-2 text-[10px] uppercase tracking-wide font-bold text-ink-500 bg-surface-canvas/40 border-b border-border">
            Yet to arrive
          </div>
          <div className="p-3 space-y-2">
            {lane.yetToArrive.map((appt) => (
              <QueueCard
                key={appt.id}
                appt={appt}
                now={now}
                tone="expected"
                patientCode={getPatientCode(appt.patientId)}
                onClick={() => onSelect(appt)}
                action={
                  canEdit
                    ? { label: "Check in", onClick: () => onCheckIn(appt) }
                    : undefined
                }
              />
            ))}
          </div>
        </>
      )}

      <div className="px-4 py-2 text-[11px] text-ink-500 border-t border-border bg-surface-canvas/40">
        {lane.done.length} completed today
      </div>
    </div>
  );
}

function QueueCard({
  appt,
  now,
  tone,
  queuePosition,
  reason,
  patientCode,
  onClick,
  action,
}: {
  appt: AppointmentWithDetails;
  now: Date;
  tone: "now" | "waiting" | "expected";
  queuePosition?: number;
  // orderQueue's reason for this rank — e.g. "booked 10:45 AM",
  // "walked in 9:50 AM", "waited 47 min — next regardless". Only meaningful
  // for tone === "waiting"; the queue board, "call next", and this card must
  // all read the same orderQueue result rather than each computing their own.
  reason?: string;
  patientCode?: string;
  onClick: () => void;
  action?: { label: string; onClick: () => void };
}) {
  const elapsed = minutesBetween(
    tone === "now"
      ? stageStart(appt, appt.consultationStartedAt)
      : stageStart(appt, appt.waitingAt || appt.checkedInAt),
    now,
  );
  const dueIn = minutesBetween(now, apptDateTime(appt));
  const overdue =
    tone === "expected" &&
    minutesElapsed(apptDateTime(appt), now) >= OVERDUE_GRACE_MINUTES;

  const wrapCls =
    tone === "now"
      ? "border-brand-violet/40 bg-brand-violet-soft"
      : overdue
        ? "border-status-danger/30 bg-status-danger-soft/40"
        : tone === "waiting" && elapsed > 15
          ? "border-status-warning/30 bg-status-warning-soft/40"
          : "border-border bg-surface-paper";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left border rounded-lg px-3 py-2 flex items-center gap-3 transition-colors hover:shadow-sm ${wrapCls}`}
    >
      <span className="w-9 h-9 rounded-lg bg-surface-canvas flex items-center justify-center font-mono text-sm font-bold text-ink-700 shrink-0">
        {queuePosition != null
          ? queuePosition
          : patientCode
            ? patientCode.slice(-3)
            : formatTime12h(appt.time).replace(" ", "")}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="block text-sm font-semibold text-ink-900 truncate">
            {appt.patientName}
          </span>
          {appt.bookingSource === "walk-in" && (
            <span className="shrink-0 rounded-md bg-status-warning-soft text-status-warning border border-status-warning/20 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide">
              Walk-in
            </span>
          )}
        </span>
        <span className="block text-xs text-ink-500 truncate">
          {[
            appt.patientAge != null
              ? `${appt.patientAge}${appt.patientGender ? ` ${appt.patientGender[0]}` : ""}`
              : null,
            tone === "expected" ? `booked ${formatTime12h(appt.time)}` : null,
            tone === "waiting" ? reason : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </span>
      <span className="text-right shrink-0">
        {tone === "expected" ? (
          overdue ? (
            <span className="font-mono text-xs font-semibold text-status-danger">
              {Math.abs(dueIn)}m late
            </span>
          ) : dueIn > 0 ? (
            <span className="font-mono text-xs text-ink-500">
              due in {dueIn}m
            </span>
          ) : (
            <span className="font-mono text-xs text-ink-500">now due</span>
          )
        ) : (
          <span
            className={`font-mono text-xs font-semibold ${tone === "waiting" && elapsed > 15 ? "text-status-warning" : "text-ink-700"}`}
          >
            {Math.max(0, elapsed)}m
          </span>
        )}
      </span>
      {action && (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            action.onClick();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.stopPropagation();
              action.onClick();
            }
          }}
          className="h-7 px-3 rounded-md border border-border bg-surface-paper text-xs font-medium text-ink-700 hover:bg-surface-canvas shrink-0"
        >
          {action.label}
        </span>
      )}
    </button>
  );
}
