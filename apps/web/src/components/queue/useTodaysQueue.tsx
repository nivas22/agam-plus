// components/queue/useTodaysQueue.tsx
"use client";

// Everything Today's queue needs apart from its layout — data, derived
// lanes and counts, desk actions, and the drawer/dialogs those actions open
// — shared by the classic board (TodaysQueuePage) and the redesigned one
// (TodaysQueueV2Page, Settings > Features > New queue layout), so the two
// can never disagree on who's waiting or what a button does.

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
import { useModuleEnabled } from "@/hooks/useHospitalModulesApi";
import { findLeaveOn, useOnLeave } from "@/hooks/useLeaveRequestsApi";
import {
  useFinishSession,
  useHospitalAppointmentsApi,
} from "@/hooks/useNewAppointmentsApi";
import { useHospitalDoctors } from "@/hooks/useNewDoctorApi";
import { useHospitalPatients } from "@/hooks/useNewPatientApi";
import type { AppointmentWithDetails } from "@/types/appointment";
import type { Doctor } from "@/types/doctorNew";
import { APPOINTMENT_STATUS } from "../../constants";
import AddWalkInModal from "./AddWalkInModal";
import DoctorAbsentModal from "./DoctorAbsentModal";
import PatientQueueDrawer from "./PatientQueueDrawer";
import {
  activePatientCount,
  apptDateTime,
  buildLanes,
  doctorAvailabilityNow,
  laneStatus,
  minutesBetween,
  minutesElapsed,
  normalizeStatus,
  OVERDUE_GRACE_MINUTES,
  type PresenceOverride,
  primaryWindowToday,
  type QueueLane,
  stageStart,
  todaysWindows,
  toISODate,
} from "./queueBoard";

export type ActionDialog = {
  kind: "changeDoctor" | "reschedule" | "cancel" | "noShow";
  appt: AppointmentWithDetails;
};

export interface UseTodaysQueueArgs {
  hospitalId: string;
  userRole: string | undefined;
  canEdit: boolean;
  userId?: string;
}

export function useTodaysQueue({
  hospitalId,
  userRole,
  canEdit,
  userId,
}: UseTodaysQueueArgs) {
  const { user } = useAuth();
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
  const { isEnabled: isModuleEnabled } = useModuleEnabled(hospitalId);
  const { data: onLeaveToday } = useOnLeave(
    today,
    today,
    hospitalId,
    isModuleEnabled("leaveRequests"),
  );

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
    appointmentsUpdatedAt,
  } = useHospitalAppointmentsApi(
    hospitalId,
    userRole,
    canEdit,
    params,
    30_000,
  );

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

  // A doctor on approved leave doesn't get a queue lane — there's no room
  // to run. They move to the "On leave today" card instead, which still
  // lists any booking left under them so it gets moved. The one exception
  // is a doctor with a patient already waiting / in the room / awaiting
  // payment, whose lane stays so that visit can be finished.
  const leaveLanes = useMemo(
    () =>
      allLanes.flatMap((lane) => {
        const leave = findLeaveOn(onLeaveToday, lane.doctor.id, today);
        if (
          !leave ||
          lane.inConsultation.length > 0 ||
          lane.waiting.length > 0 ||
          lane.awaitingPayment.length > 0
        )
          return [];
        return [{ lane, leave }];
      }),
    [allLanes, onLeaveToday, today],
  );
  const boardLanes = useMemo(() => {
    const away = new Set(leaveLanes.map((l) => l.lane.doctor.id));
    return lanes.filter((lane) => !away.has(lane.doctor.id));
  }, [lanes, leaveLanes]);

  // A doctor marked "left for the day" always reads as session-over —
  // handleLeftForDay only lets that override land once the queue's already
  // empty (or resolved via the absent modal), so laneStatus's own read of
  // the doctor's nominal hours (which knows nothing about this override)
  // would otherwise still show them as "on time"/"available" for a window
  // later today.
  const statusFor = useCallback(
    (lane: QueueLane) =>
      presenceOverrides[lane.doctor.id]?.kind === "leftForDay"
        ? ({ label: "Session over", tone: "off" } as const)
        : // Only reached when a patient is still mid-visit (see leaveLanes).
          findLeaveOn(onLeaveToday, lane.doctor.id, today)
          ? ({ label: "On leave", tone: "off" } as const)
          : laneStatus(lane, now),
    [presenceOverrides, onLeaveToday, today, now],
  );
  const lanesWithStatus = useMemo(
    () => boardLanes.map((lane) => ({ lane, status: statusFor(lane) })),
    [boardLanes, statusFor],
  );

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
        return true;
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : "Failed to update appointment",
        );
        return false;
      }
    },
    [updateAppointmentStatus, refetchAppointments, showToast],
  );

  // Finishes the clinical part of a visit without billing — no dialog here
  // (front desk has no live session-notes draft to carry over; whatever the
  // doctor already saved via "Save and come back" stays intact). Collecting
  // payment is a separate, later action on the Awaiting-payment lane.
  // Resolves to whether it worked, for callers chaining a next step.
  const finishSession = useFinishSession(hospitalId);
  const handleFinishSession = useCallback(
    async (appt: AppointmentWithDetails, { quiet = false } = {}) => {
      try {
        await finishSession.mutateAsync({ appointmentId: appt.id });
        setSelectedAppt(null);
        if (!quiet) showToast("Session finished — ready for payment");
        return true;
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : "Couldn't finish the session",
        );
        return false;
      }
    },
    [finishSession, showToast],
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
  const awaitingPaymentAll = lanes.flatMap((l) => l.awaitingPayment);
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
  const longestWait = waitTimes.length ? Math.max(...waitTimes) : 0;

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
      .filter((doctor) => !findLeaveOn(onLeaveToday, doctor.id, today))
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
              APPOINTMENT_STATUS.AWAITING_PAYMENT,
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
  }, [doctorsData.doctors, appointments, now, onLeaveToday, today]);

  const isLoadingInitial = isLoading && appointments.length === 0;

  return {
    hospitalId,
    canEdit,
    user,
    now,
    today,
    presenceOverrides,
    onLeaveToday,
    isModuleEnabled,
    appointments,
    appointmentsUpdatedAt,
    isLoadingInitial,
    updateAppointmentStatus,
    addAppointment,
    refetchAppointments,
    patients: patientsData.patients,
    doctors: doctorsData.doctors,
    getPatientCode,
    allLanes,
    lanes,
    leaveLanes,
    boardLanes,
    statusFor,
    lanesWithStatus,
    waitingAll,
    inConsultationAll,
    awaitingPaymentAll,
    doneAll,
    yetToArriveAll,
    overdueAll,
    avgWait,
    longestWait,
    eveningSessions,
    boardRef,
    isFullscreen,
    toggleFullscreen,
    showToast,
    handleDialogSuccess,
    quickUpdate,
    handleFinishSession,
    handleMarkHere,
    handleMarkRunningLate,
    handleMarkOnBreak,
    handleOpenNotComing,
    handleLeftForDay,
    handleAbsentApplied,
    openAddWalkIn,
    setSelectedAppt,
    setCompleteAppt,
    setActionDialog,
    setActiveDoctor,
    // Read only by TodaysQueueOverlays.
    overlayState: {
      selectedAppt,
      completeAppt,
      actionDialog,
      showAddWalkIn,
      walkInPresetDoctorId,
      absentModal,
      toast,
      activeDoctor,
      setShowAddWalkIn,
      setWalkInPresetDoctorId,
      setAbsentModal,
    },
  };
}

export type TodaysQueue = ReturnType<typeof useTodaysQueue>;

// The patient drawer, every action dialog, the walk-in and absent-doctor
// modals, the doctor sidebar and the toast — rendered by both layouts.
export function TodaysQueueOverlays({ queue: q }: { queue: TodaysQueue }) {
  const {
    selectedAppt,
    completeAppt,
    actionDialog,
    showAddWalkIn,
    walkInPresetDoctorId,
    absentModal,
    toast,
    activeDoctor,
    setShowAddWalkIn,
    setWalkInPresetDoctorId,
    setAbsentModal,
  } = q.overlayState;
  const {
    hospitalId,
    user,
    now,
    doctors,
    patients,
    appointments,
    allLanes,
    getPatientCode,
    updateAppointmentStatus,
    refetchAppointments,
    setSelectedAppt,
    setCompleteAppt,
    setActionDialog,
    setActiveDoctor,
    quickUpdate,
    handleFinishSession,
    handleDialogSuccess,
    showToast,
  } = q;

  return (
    <>
      {selectedAppt && (
        <PatientQueueDrawer
          appointment={selectedAppt}
          hospitalId={hospitalId}
          doctor={doctors.find((d) => d.id === selectedAppt.doctorProfileId)}
          patient={patients.find((p) => p.id === selectedAppt.patientId)}
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
          onFinishSession={() => handleFinishSession(selectedAppt)}
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
            doctors.find((d) => d.id === completeAppt.doctorProfileId)
              ?.consultationFee
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
          doctors={doctors}
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
            doctors.find((d) => d.id === actionDialog.appt.doctorProfileId) ||
            null
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
            doctors.find((d) => d.id === actionDialog.appt.doctorProfileId)
              ?.name
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
          patients={patients}
          presenceOverrides={q.presenceOverrides}
          onLeaveToday={q.onLeaveToday}
          now={now}
          initialDoctorId={walkInPresetDoctorId}
          onClose={() => {
            setShowAddWalkIn(false);
            setWalkInPresetDoctorId(null);
          }}
          addAppointment={q.addAppointment}
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
              doctors={doctors}
              now={now}
              userName={user?.name || "Front desk"}
              getPatientCode={getPatientCode}
              updateAppointmentStatus={updateAppointmentStatus}
              onClose={() => setAbsentModal(null)}
              onApplied={q.handleAbsentApplied}
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
    </>
  );
}
