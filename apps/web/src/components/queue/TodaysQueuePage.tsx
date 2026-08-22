// components/queue/TodaysQueuePage.tsx
"use client";

import { format } from "date-fns";
import { Clock, Phone, Plus, UserPlus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CancelDialog,
  ChangeDoctorDialog,
  NoShowDialog,
  RescheduleDialog,
} from "@/components/appointments/AppointmentActionDialogs";
import CompleteVisitDialog from "@/components/appointments/CompleteVisitDialog";
import { useAuth } from "@/hooks/useAuth";
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
  computePresence,
  type DoctorPresence,
  doctorAvailabilityNow,
  formatTime12h,
  getInitials,
  type LaneStatus,
  laneStatus,
  minutesBetween,
  normalizeStatus,
  OVERDUE_GRACE_MINUTES,
  type PresenceOverride,
  type QueueLane,
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

function presenceStorageKey(hospitalId: string, dateISO: string): string {
  return `queue-presence:${hospitalId}:${dateISO}`;
}

function readPresenceOverrides(
  hospitalId: string,
  dateISO: string,
): Record<string, PresenceOverride> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(
      presenceStorageKey(hospitalId, dateISO),
    );
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export default function TodaysQueuePage({
  hospitalId,
  userRole,
  canEdit,
  userId,
}: TodaysQueuePageProps) {
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
  // Presence has no backend field yet (see PresenceOverride in queueBoard.ts),
  // so it's kept in localStorage instead of plain component state — survives
  // a reload on this device, scoped per hospital+day so it can't leak into
  // tomorrow. It still won't sync to a different front-desk terminal; that
  // needs a real backend field.
  const [presenceOverrides, setPresenceOverrides] = useState<
    Record<string, PresenceOverride>
  >(() => readPresenceOverrides(hospitalId, toISODate(new Date())));
  const [absentModal, setAbsentModal] = useState<{
    doctor: Doctor;
    variant: "notComing" | "leftForDay";
  } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const openAddWalkIn = useCallback((presetDoctorId?: string) => {
    setWalkInPresetDoctorId(presetDoctorId ?? null);
    setShowAddWalkIn(true);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const today = toISODate(now);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        presenceStorageKey(hospitalId, today),
        JSON.stringify(presenceOverrides),
      );
    } catch {
      // Private browsing / quota exceeded — presence just won't survive a reload.
    }
  }, [presenceOverrides, hospitalId, today]);

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
  const lanesWithStatus = useMemo(
    () => lanes.map((lane) => ({ lane, status: laneStatus(lane, now) })),
    [lanes, now],
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

  const handleMarkHere = useCallback((doctorId: string) => {
    setPresenceOverrides((cur) => ({
      ...cur,
      [doctorId]: { kind: "here", setAt: new Date().toISOString() },
    }));
  }, []);

  const handleMarkRunningLate = useCallback(
    (doctorId: string, expectedTime: string) => {
      setPresenceOverrides((cur) => ({
        ...cur,
        [doctorId]: {
          kind: "runningLate",
          expectedTime,
          setBy: user?.name || "Front desk",
          setAt: new Date().toISOString(),
        },
      }));
    },
    [user?.name],
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
        setPresenceOverrides((cur) => ({
          ...cur,
          [lane.doctor.id]: {
            kind: "leftForDay",
            setBy: user?.name || "Front desk",
            setAt: new Date().toISOString(),
          },
        }));
        showToast(`Dr. ${lane.doctor.name} marked as left for the day`);
        return;
      }
      setAbsentModal({ doctor: lane.doctor, variant: "leftForDay" });
    },
    [user?.name, showToast],
  );

  const handleAbsentApplied = useCallback(
    async (override: PresenceOverride, message: string) => {
      if (!absentModal) return;
      setPresenceOverrides((cur) => ({
        ...cur,
        [absentModal.doctor.id]: override,
      }));
      showToast(message);
      await refetchAppointments();
    },
    [absentModal, showToast, refetchAppointments],
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
          (a) => minutesBetween(apptDateTime(a), now) > OVERDUE_GRACE_MINUTES,
        ),
    [appointments, now],
  );
  const waitTimes = waitingAll.map((a) =>
    minutesBetween(new Date(a.updatedAt), now),
  );
  const avgWait = waitTimes.length
    ? Math.round(waitTimes.reduce((s, m) => s + m, 0) / waitTimes.length)
    : 0;
  const longestWait = waitTimes.length ? Math.max(...waitTimes) : 0;

  const isLoadingInitial = isLoading && appointments.length === 0;

  return (
    <div className="pb-16">
      <div className="flex flex-wrap items-start gap-4 mb-4">
        <div>
          <h1 className="text-xl font-bold text-ink-900">Today&apos;s queue</h1>
          <p className="text-sm text-ink-500 mt-1">
            {format(now, "EEEE, d MMMM yyyy")} · updates every 30s
          </p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="font-mono text-lg font-semibold text-ink-900">
            {format(now, "h:mm a")}
          </span>
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
                  <h3 className="text-base font-semibold text-ink-900 mb-1">
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
                    onComplete={setCompleteAppt}
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
                <h2 className="text-sm font-bold text-ink-900">
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

            {canEdit && (
              <div className="bg-surface-paper border border-border rounded-xl p-4">
                <button
                  type="button"
                  onClick={() => openAddWalkIn()}
                  className="w-full h-10 rounded-lg bg-brand-violet hover:bg-brand-violet-hover text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Add walk-in
                </button>
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
          patientCode={getPatientCode(selectedAppt.patientId)}
          now={now}
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
  onComplete,
  onCheckIn,
  onSendIn,
  onAddWalkIn,
  onMarkHere,
  onMarkRunningLate,
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
  onComplete: (a: AppointmentWithDetails) => void;
  onCheckIn: (a: AppointmentWithDetails) => void;
  onSendIn: (a: AppointmentWithDetails) => void;
  onAddWalkIn: (presetDoctorId?: string) => void;
  onMarkHere: () => void;
  onMarkRunningLate: (expectedTime: string) => void;
  onOpenNotComing: () => void;
  onLeftForDay: () => void;
  getPatientCode: (patientId: string) => string | undefined;
}) {
  const windows = todaysWindows(lane.doctor, now);
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const minsPastStart = windows.length ? nowMins - windows[0].start : null;
  const showNudge =
    presence.tone === "expected" &&
    minsPastStart != null &&
    minsPastStart > 0 &&
    lane.waiting.length > 0;

  return (
    <div className="bg-surface-paper border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-start gap-3">
        <SpecAvatar name={lane.doctor.name} />
        <div className="min-w-0">
          <div className="text-sm font-semibold text-ink-900 truncate">
            Dr. {lane.doctor.name}
          </div>
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
            onOpenNotComing={onOpenNotComing}
            onLeftForDay={onLeftForDay}
          />
        </span>
      </div>

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
            <div className="px-3 pb-3">
              <button
                type="button"
                onClick={() => onComplete(lane.inConsultation[0])}
                className="w-full h-8 rounded-lg bg-status-open hover:bg-status-open-hover text-white text-xs font-semibold transition-colors"
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
          lane.waiting.map((appt) => (
            <QueueCard
              key={appt.id}
              appt={appt}
              now={now}
              tone="waiting"
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
  patientCode,
  onClick,
  action,
}: {
  appt: AppointmentWithDetails;
  now: Date;
  tone: "now" | "waiting" | "expected";
  patientCode?: string;
  onClick: () => void;
  action?: { label: string; onClick: () => void };
}) {
  const elapsed = minutesBetween(new Date(appt.updatedAt), now);
  const dueIn = minutesBetween(now, apptDateTime(appt));
  const overdue = tone === "expected" && dueIn < -OVERDUE_GRACE_MINUTES;

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
      <span className="w-9 h-9 rounded-lg bg-surface-canvas flex items-center justify-center font-mono text-xs font-semibold text-ink-700 shrink-0">
        {patientCode
          ? patientCode.slice(-3)
          : formatTime12h(appt.time).replace(" ", "")}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink-900 truncate">
          {appt.patientName}
        </span>
        <span className="block text-xs text-ink-500 truncate">
          {[
            appt.patientAge != null
              ? `${appt.patientAge}${appt.patientGender ? ` ${appt.patientGender[0]}` : ""}`
              : null,
            tone === "expected" ? `booked ${formatTime12h(appt.time)}` : null,
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
