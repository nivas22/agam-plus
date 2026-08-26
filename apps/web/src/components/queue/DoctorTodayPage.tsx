// components/queue/DoctorTodayPage.tsx
"use client";

import { format } from "date-fns";
import { Phone } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CompleteVisitDialog from "@/components/appointments/CompleteVisitDialog";
import { useAuth } from "@/hooks/useAuth";
import { useChargeCatalogItems } from "@/hooks/useChargeCatalogApi";
import {
  useDoctorPresence,
  useSetDoctorPresence,
} from "@/hooks/useDoctorPresenceApi";
import {
  useHospitalAppointmentsApi,
  usePatientHospitalAppointments,
} from "@/hooks/useNewAppointmentsApi";
import { useHospitalDoctors } from "@/hooks/useNewDoctorApi";
import { useHospitalPatients } from "@/hooks/useNewPatientApi";
import {
  useHospitalPayments,
  usePaymentForAppointment,
} from "@/hooks/useNewPaymentApi";
import {
  usePrescription,
  useSetPrescriptionStatus,
} from "@/hooks/usePrescriptionApi";
import { paletteFor } from "@/lib/avatarPalette";
import type { AppointmentWithDetails, Vitals } from "@/types/appointment";
import type { Patient } from "@/types/patientNew";
import type { FollowUpOption, PaymentItem } from "@/types/payment";
import type { Prescription } from "@/types/prescription";
import { calculateAge } from "@/utils/dateUtils";
import {
  APPOINTMENT_STATUS,
  APPOINTMENT_TYPE,
  FOLLOW_UP_OPTIONS,
} from "../../constants";
import DoctorPresenceMenu from "./DoctorPresenceMenu";
import {
  apptDateTime,
  buildLanes,
  computePresence,
  formatTime12h,
  getInitials,
  laneStatus,
  minutesBetween,
  minutesToTimeStr,
  projectFinish,
  type QueueLane,
  sessionCapacity,
  stageStart,
  todaysWindows,
  toISODate,
} from "./queueBoard";

// Drops the AM/PM suffix left over from formatTime12h — used only where the
// surrounding label ("Evening · ") already makes the period obvious.
function stripMeridiem(label: string): string {
  return label.replace(/\s?[AP]M$/i, "");
}

function formatAgo(now: Date, then: Date): string {
  const seconds = Math.max(0, Math.floor((now.getTime() - then.getTime()) / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes} min ago`;
}

interface DoctorTodayPageProps {
  hospitalId: string;
  doctorId: string;
}

function hour12(mins: number): string {
  const wrapped = ((mins % 1440) + 1440) % 1440;
  const h24 = Math.floor(wrapped / 60);
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}`;
}

function formatMMSS(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// The appointment's denormalized `patientAge` is only ever populated from
// `patient.age` — a free-text field staff fill in by hand at walk-in
// registration. Most patients are registered with a date of birth instead,
// which leaves `patientAge` (and this field) empty even though the age is
// perfectly derivable — so fall back to computing it from `dateOfBirth`.
function resolveAge(
  appt: AppointmentWithDetails,
  patient: Patient | undefined,
): number | null {
  if (appt.patientAge != null) return appt.patientAge;
  if (patient?.age) {
    const n = Number(patient.age);
    if (!Number.isNaN(n)) return n;
  }
  if (patient?.dateOfBirth) return calculateAge(patient.dateOfBirth);
  return null;
}

function Avatar({
  name,
  size = "w-9 h-9 text-xs",
}: {
  name: string;
  size?: string;
}) {
  const [c1, c2] = paletteFor(name);
  return (
    <span
      className={`${size} rounded-lg flex items-center justify-center text-white font-bold shrink-0`}
      style={{ background: `linear-gradient(160deg, ${c1}, ${c2})` }}
    >
      {getInitials(name)}
    </span>
  );
}

function Chip({
  tone,
  children,
}: {
  tone: "alg" | "pk" | "due" | "new" | "walk" | "missing";
  children: React.ReactNode;
}) {
  const cls = {
    alg: "bg-status-danger-soft text-status-danger border-status-danger/20",
    pk: "bg-brand-violet-soft text-brand-violet border-brand-violet/20",
    due: "bg-status-warning-soft text-status-warning border-status-warning/20",
    new: "bg-brand-violet-soft text-brand-violet border-brand-violet/20",
    walk: "bg-brand-violet-soft text-brand-violet border-brand-violet/20",
    missing: "bg-status-warning-soft text-status-warning border-status-warning/20",
  }[tone];
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-1 text-[11px] font-bold border ${cls}`}
    >
      {children}
    </span>
  );
}

function patientChips(
  patient: Patient | undefined,
  isDue: boolean,
  isNew: boolean,
  isWalkIn: boolean,
) {
  const chips: React.ReactNode[] = [];
  if (patient?.allergies && patient.allergies.length > 0) {
    chips.push(
      <Chip key="alg" tone="alg">
        {patient.allergies[0].toUpperCase()}
        {patient.allergies.length > 1
          ? ` +${patient.allergies.length - 1}`
          : ""}
      </Chip>,
    );
  }
  if (isWalkIn) {
    chips.push(
      <Chip key="walk" tone="walk">
        WALK-IN
      </Chip>,
    );
  }
  if (isDue) {
    chips.push(
      <Chip key="due" tone="due">
        DUE
      </Chip>,
    );
  }
  if (isNew) {
    chips.push(
      <Chip key="new" tone="new">
        NEW
      </Chip>,
    );
  }
  return chips;
}

// `allergies` is undefined when nobody has ever asked the patient, and `[]`
// once someone has asked and confirmed there are none — worth telling apart
// so the doctor knows whether "no allergies" is a fact or just a gap.
function allergySummary(patient: Patient | undefined): {
  text: string;
  tone: "danger" | "warning" | "default";
} {
  if (!patient || patient.allergies == null) {
    return { text: "Never asked", tone: "warning" };
  }
  if (patient.allergies.length === 0) {
    return { text: "None recorded", tone: "default" };
  }
  return { text: `${patient.allergies.join(", ")} — confirmed`, tone: "danger" };
}

// Front-desk-recorded vitals, taken at walk-in time — every field optional,
// so only present ones render. BP folds systolic+diastolic into one row
// when both were taken; either alone still shows, labeled which it is.
function vitalsRows(
  vitals: Vitals | undefined,
): { label: string; value: string }[] {
  if (!vitals) return [];
  const rows: { label: string; value: string }[] = [];
  if (vitals.bpSystolic != null && vitals.bpDiastolic != null) {
    rows.push({
      label: "BP",
      value: `${vitals.bpSystolic}/${vitals.bpDiastolic} mmHg`,
    });
  } else if (vitals.bpSystolic != null) {
    rows.push({ label: "BP systolic", value: `${vitals.bpSystolic} mmHg` });
  } else if (vitals.bpDiastolic != null) {
    rows.push({ label: "BP diastolic", value: `${vitals.bpDiastolic} mmHg` });
  }
  if (vitals.spo2 != null) rows.push({ label: "SpO2", value: `${vitals.spo2}%` });
  if (vitals.pulse != null) rows.push({ label: "Pulse", value: `${vitals.pulse} bpm` });
  if (vitals.weight != null) rows.push({ label: "Weight", value: `${vitals.weight} kg` });
  if (vitals.temperature != null)
    rows.push({ label: "Temp", value: `${vitals.temperature}°F` });
  if (vitals.height != null) rows.push({ label: "Height", value: `${vitals.height} cm` });
  return rows;
}

export default function DoctorTodayPage({
  hospitalId,
  doctorId,
}: DoctorTodayPageProps) {
  const { user } = useAuth();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const today = toISODate(now);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    p.append("startDate", today);
    p.append("endDate", today);
    p.append("userRole", "doctor");
    p.append("doctorId", doctorId);
    return p;
  }, [today, doctorId]);

  const { appointments, isLoading, updateAppointmentStatus } =
    useHospitalAppointmentsApi(hospitalId, "doctor", true, params);

  const { data: doctorsData = { doctors: [] } } =
    useHospitalDoctors(hospitalId);
  const doctor = doctorsData.doctors.find((d) => d.id === doctorId);

  const { data: patientsData = { patients: [] } } = useHospitalPatients(
    hospitalId,
    undefined,
    true,
  );
  const patientsById = useMemo(() => {
    const map: Record<string, Patient> = {};
    for (const p of patientsData.patients) map[p.id] = p;
    return map;
  }, [patientsData.patients]);
  const getPatientCode = useCallback(
    (patientId: string) => patientsById[patientId]?.patientId,
    [patientsById],
  );

  const dueParams = useMemo(() => {
    const p = new URLSearchParams();
    p.append("status", "due");
    return p;
  }, []);
  const { data: duePaymentsData } = useHospitalPayments(hospitalId, dueParams);
  const duePatientIds = useMemo(
    () => new Set((duePaymentsData?.payments ?? []).map((p) => p.patientId)),
    [duePaymentsData],
  );
  const dueAmountByPatient = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of duePaymentsData?.payments ?? []) {
      map[p.patientId] = (map[p.patientId] || 0) + p.total;
    }
    return map;
  }, [duePaymentsData]);

  // Backed by the DB (see useDoctorPresenceApi) — same source TodaysQueuePage
  // reads/writes, so a doctor marking themself "here" here shows up
  // immediately on the front desk's board too, with the change recorded in
  // the audit trail (area "doctors").
  const { data: presenceOverrides = {} } = useDoctorPresence(
    hospitalId,
    today,
  );
  const setDoctorPresence = useSetDoctorPresence(hospitalId);

  const lane: QueueLane | null = useMemo(
    () => (doctor ? buildLanes([doctor], appointments, now)[0] : null),
    [doctor, appointments, now],
  );

  const [selectedApptId, setSelectedApptId] = useState<string | null>(null);
  const [showAllDone, setShowAllDone] = useState(false);
  const [completeAppt, setCompleteAppt] =
    useState<AppointmentWithDetails | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }, []);

  // "Write" on a completed visit with no session notes opens this modal
  // instead of changing the main selection/detail panel — the queue list
  // and the right-hand panel stay exactly as they were.
  const [notesModalAppt, setNotesModalAppt] =
    useState<AppointmentWithDetails | null>(null);
  const [notesModalDraft, setNotesModalDraft] = useState("");
  const [notesModalSaving, setNotesModalSaving] = useState(false);

  // Keep a selection alive: prefer whoever's in consultation, else the next
  // waiting patient, else whoever's up next — but never fight a doctor who
  // has deliberately clicked another row still present in today's list.
  useEffect(() => {
    if (!lane) return;
    if (selectedApptId && lane.all.some((a) => a.id === selectedApptId)) return;
    const next =
      lane.inConsultation[0] || lane.waiting[0] || lane.yetToArrive[0] || null;
    setSelectedApptId(next ? next.id : null);
  }, [lane, selectedApptId]);

  const selectedAppt = lane?.all.find((a) => a.id === selectedApptId) || null;
  const selectedPatient = selectedAppt
    ? patientsById[selectedAppt.patientId]
    : undefined;
  const isSelectedInConsultation =
    selectedAppt?.status === APPOINTMENT_STATUS.IN_CONSULTATION;

  // Session notes — local draft per appointment, debounce-saved through the
  // same status-preserving mutation CompleteVisitDialog's "Save notes only"
  // already relies on (same status = no re-stamp of consultationStartedAt).
  const [notesDraft, setNotesDraft] = useState("");
  const notesApptIdRef = useRef<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  useEffect(() => {
    if (selectedAppt && notesApptIdRef.current !== selectedAppt.id) {
      notesApptIdRef.current = selectedAppt.id;
      setNotesDraft(selectedAppt.sessionNotes || "");
      setLastSavedAt(null);
    }
    if (!selectedAppt) notesApptIdRef.current = null;
  }, [selectedAppt]);

  useEffect(() => {
    if (!selectedAppt) return;
    if (notesDraft === (selectedAppt.sessionNotes || "")) return;
    const t = setTimeout(() => {
      updateAppointmentStatus(selectedAppt.id, selectedAppt.status, notesDraft)
        .then(() => setLastSavedAt(new Date()))
        .catch(() => showToast("Couldn't save session notes"));
    }, 900);
    return () => clearTimeout(t);
  }, [notesDraft, selectedAppt, updateAppointmentStatus, showToast]);

  // "+10 min" is a display-only nudge the doctor uses when a visit is
  // legitimately running long — it stretches the on-screen timer budget per
  // appointment, nothing is persisted or billed differently.
  const [extendedMinutes, setExtendedMinutes] = useState<Record<string, number>>(
    {},
  );
  const [showEvening, setShowEvening] = useState(false);

  // Given during the visit — local until the visit is completed, then it
  // flows into CompleteVisitDialog's bill as pre-added items.
  const [extraItems, setExtraItems] = useState<PaymentItem[]>([]);
  const [followUp, setFollowUp] = useState<FollowUpOption>("none");
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  useEffect(() => {
    setExtraItems([]);
    setFollowUp("none");
    setShowAddItem(false);
  }, [selectedAppt?.id]);

  const { data: chargeCatalogData } = useChargeCatalogItems(hospitalId, {
    status: "active",
  });
  const { isDoctor } = useAuth();
  const quickAddItems = (chargeCatalogData?.items || []).filter(
    (item) => isDoctor || item.frontDeskCanAdd,
  );

  const addExtraItem = (
    name: string,
    price: number,
    chargeCatalogItemId?: string,
  ) => {
    setExtraItems((cur) => [
      ...cur,
      { name, quantity: 1, unitPrice: price, chargeCatalogItemId },
    ]);
  };

  const { data: prescriptionResult } = usePrescription(
    selectedAppt?.id || "",
    hospitalId,
  );
  const prescription = prescriptionResult?.prescription;
  const setPrescriptionStatus = useSetPrescriptionStatus(
    selectedAppt?.id || "",
    hospitalId,
  );

  const { data: selectedPayment } = usePaymentForAppointment(
    hospitalId,
    selectedAppt?.id,
  );
  const selectedGivenItems = (selectedPayment?.items || []).filter(
    (item) => !item.isAuto,
  );

  const { data: notesModalPrescriptionResult } = usePrescription(
    notesModalAppt?.id || "",
    hospitalId,
  );
  const notesModalPrescription = notesModalPrescriptionResult?.prescription;
  const { data: notesModalPayment } = usePaymentForAppointment(
    hospitalId,
    notesModalAppt?.id,
  );
  // The consultation fee is billed automatically on every visit — only the
  // extra items a doctor adds during the visit (injections, tests, etc.)
  // belong under "Given during the visit".
  const notesModalGivenItems = (notesModalPayment?.items || []).filter(
    (item) => !item.isAuto,
  );

  const { data: historyData } = usePatientHospitalAppointments(
    hospitalId,
    selectedAppt?.patientId || "",
  );
  const priorVisits = (historyData?.appointments || []).filter(
    (a) => a.id !== selectedAppt?.id && a.date <= (selectedAppt?.date || today),
  );
  const pastVisits = priorVisits.filter(
    (a) => a.date < (selectedAppt?.date || today),
  );
  const lastVisit = [...pastVisits].sort((a, b) =>
    b.date.localeCompare(a.date),
  )[0];
  const noShowCount = priorVisits.filter(
    (a) => a.status === APPOINTMENT_STATUS.NO_SHOW,
  ).length;
  const { data: lastPrescriptionResult } = usePrescription(
    lastVisit?.id || "",
    hospitalId,
  );
  const lastPrescription = lastPrescriptionResult?.prescription;

  const handleSaveNotes = useCallback(() => {
    if (!selectedAppt) return;
    updateAppointmentStatus(selectedAppt.id, selectedAppt.status, notesDraft)
      .then(() => {
        setLastSavedAt(new Date());
        showToast("Notes saved");
      })
      .catch(() => showToast("Couldn't save session notes"));
  }, [selectedAppt, notesDraft, updateAppointmentStatus, showToast]);

  const handleSaveNotesModal = useCallback(() => {
    if (!notesModalAppt) return;
    setNotesModalSaving(true);
    updateAppointmentStatus(
      notesModalAppt.id,
      notesModalAppt.status,
      notesModalDraft,
    )
      .then(() => {
        showToast("Notes saved");
        setNotesModalAppt(null);
      })
      .catch(() => showToast("Couldn't save session notes"))
      .finally(() => setNotesModalSaving(false));
  }, [notesModalAppt, notesModalDraft, updateAppointmentStatus, showToast]);

  const handleCallIn = useCallback(
    (appt: AppointmentWithDetails) => {
      updateAppointmentStatus(
        appt.id,
        APPOINTMENT_STATUS.IN_CONSULTATION,
      ).catch(() => showToast("Couldn't call the patient in"));
    },
    [updateAppointmentStatus, showToast],
  );

  const handleCompleteSuccess = useCallback(
    (message: string) => {
      showToast(message);
      const nextWaiting = lane?.waiting[0];
      setCompleteAppt(null);
      if (nextWaiting) {
        setSelectedApptId(nextWaiting.id);
      }
    },
    [showToast, lane],
  );

  // The doctor's overall order of the day — 1st, 2nd, 3rd... patient seen —
  // based on when each visit actually got going (or, before that, checked in
  // / was booked for), independent of the "most recent first" order the Done
  // list displays in.
  const queuePositionByApptId = useMemo(() => {
    const withTime = (lane?.all || []).map((a) => ({
      id: a.id,
      t: new Date(
        a.consultationStartedAt ||
          a.checkedInAt ||
          a.waitingAt ||
          `${a.date}T${a.time}`,
      ).getTime(),
    }));
    const map = new Map<string, number>();
    [...withTime]
      .sort((a, b) => a.t - b.t)
      .forEach((entry, i) => map.set(entry.id, i + 1));
    return map;
  }, [lane]);

  if (isLoading || !doctor || !lane) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-violet" />
      </div>
    );
  }

  const presence = computePresence(lane, presenceOverrides[doctorId], now);
  const schedule = laneStatus(lane, now);
  const windows = todaysWindows(doctor, now);
  const sessionLabel = windows.length
    ? `${hour12(windows[0].start)}–${hour12(windows[0].end)}`
    : "—";
  const sessionSub =
    windows.length > 1
      ? `${windows[1].start >= 16 * 60 ? "evening " : ""}${hour12(windows[1].start)}–${hour12(windows[1].end)}`
      : doctor.appointmentDuration
        ? `slots are ${doctor.appointmentDuration} min`
        : "";
  const morningCount = lane.yetToArrive.filter((a) => a.time < "13:00").length;
  const waitElapsed = lane.waiting.map((a) =>
    minutesBetween(stageStart(a, a.waitingAt || a.checkedInAt), now),
  );
  const longestWait = waitElapsed.length ? Math.max(...waitElapsed) : 0;
  const durations = lane.done
    .map((a) =>
      a.consultationStartedAt && a.completedAt
        ? minutesBetween(
            new Date(a.consultationStartedAt),
            new Date(a.completedAt),
          )
        : null,
    )
    .filter((n): n is number => n != null && n >= 0);
  const avgSoFar = durations.length
    ? Math.round(durations.reduce((s, n) => s + n, 0) / durations.length)
    : null;

  const isPatientDue = (patientId: string) => duePatientIds.has(patientId);
  const isPatientNew = (patientId: string) => {
    const p = patientsById[patientId];
    if (!p?.createdAt) return false;
    return toISODate(new Date(p.createdAt)) === today;
  };

  // A second window (e.g. an evening session) splits the upcoming list into
  // "later this morning" (always shown) and a folded "evening" group —
  // single-session doctors have nothing to fold, so everything just shows.
  const eveningWindow = windows.length > 1 ? windows[1] : null;
  const morningUpcoming = eveningWindow
    ? lane.yetToArrive.filter((a) => a.time < "13:00")
    : lane.yetToArrive;
  const eveningUpcoming = eveningWindow
    ? lane.yetToArrive.filter((a) => a.time >= "13:00")
    : [];
  const doneSorted = [...lane.done].sort((a, b) =>
    (b.completedAt || b.updatedAt).localeCompare(a.completedAt || a.updatedAt),
  );
  const doneShown = showAllDone ? doneSorted : doneSorted.slice(0, 1);

  return (
    <div className="pb-16">
      {/* top bar + session stats — one continuous strip, not two separate cards */}
      <div className="bg-surface-paper border border-border rounded-xl overflow-hidden mb-4">
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
          <Avatar name={doctor.name} size="w-9 h-9 text-xs" />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-ink-900 truncate">
              Dr. {doctor.name}
            </div>
            <div className="text-xs text-ink-500 truncate">
              {doctor.specialization} · {format(now, "EEEE, d MMMM")}
            </div>
          </div>
          <span className="ml-auto flex items-center gap-3">
            {schedule.tone === "late" && (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-status-warning/30 bg-status-warning-soft px-3 py-1.5 text-xs font-semibold text-status-warning">
                ⏱ {schedule.label}
              </span>
            )}
            <DoctorPresenceMenu
              label={presence.label}
              tone={presence.tone}
              canEdit={true}
              now={now}
              onMarkHere={() =>
                setDoctorPresence.mutate({ doctorId, date: today, kind: "here" })
              }
              onMarkRunningLate={(t) =>
                setDoctorPresence.mutate({
                  doctorId,
                  date: today,
                  kind: "runningLate",
                  expectedTime: t,
                })
              }
              onMarkOnBreak={(t) =>
                setDoctorPresence.mutate({
                  doctorId,
                  date: today,
                  kind: "onBreak",
                  returnTime: t,
                })
              }
              onOpenNotComing={() =>
                setDoctorPresence.mutate({
                  doctorId,
                  date: today,
                  kind: "notIn",
                  reason: "Not coming today",
                  toldBy: user?.name || "Doctor",
                })
              }
              onLeftForDay={() =>
                setDoctorPresence.mutate({
                  doctorId,
                  date: today,
                  kind: "leftForDay",
                })
              }
            />
            <span className="font-mono text-base font-semibold text-ink-900">
              {format(now, "h:mm a")}
            </span>
          </span>
        </div>

        {/* session stats — Room replaces Session once nobody's in
          consultation; every other cell (including the finish projection)
          stays put regardless */}
        {(() => {
          const roomFree = lane.inConsultation.length === 0;
          const cap = sessionCapacity(lane, now);
          const proj = projectFinish(lane, now);
          const finishTone =
            proj && proj.overMinutes > 20
              ? "text-status-danger"
              : proj && proj.overMinutes > 0
                ? "text-status-warning"
                : "text-ink-900";
          const finishSub = !proj
            ? ""
            : proj.overMinutes > 0
              ? `${proj.overMinutes} min past ${formatTime12h(minutesToTimeStr(proj.window.end))}${cap.walkInCount ? ` · ${cap.walkInCount} walk-in${cap.walkInCount > 1 ? "s" : ""} today` : ""}`
              : `${-proj.overMinutes} min to spare`;
          const statCells: {
            label: string;
            n: React.ReactNode;
            sub: string;
            tone?: string;
          }[] = [
            {
              label: "Seen",
              n: lane.done.length,
              sub: `of ${lane.all.length} today`,
            },
            {
              label: "Waiting",
              n: lane.waiting.length,
              sub: lane.waiting.length ? `longest ${longestWait} min` : "none",
            },
            {
              label: "Still to come",
              n: lane.yetToArrive.length,
              sub: morningCount ? `${morningCount} this morning` : "",
            },
            {
              label: "Likely to finish",
              n: proj
                ? formatTime12h(minutesToTimeStr(proj.finishMinutes))
                : "—",
              sub: finishSub,
              tone: finishTone,
            },
            {
              label: "Average so far",
              n: avgSoFar != null ? `${avgSoFar} min` : "—",
              sub: doctor.appointmentDuration
                ? `slots are ${doctor.appointmentDuration} min`
                : "",
            },
            roomFree
              ? { label: "Room", n: "Free", sub: "between patients" }
              : { label: "Session", n: sessionLabel, sub: sessionSub },
          ];
          return (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-border">
              {statCells.map((s) => (
                <div key={s.label} className="px-5 py-3">
                  <div className="text-[11.5px] uppercase tracking-wide text-ink-500 font-bold">
                    {s.label}
                  </div>
                  <div
                    className={`font-mono text-xl font-bold mt-1 ${s.tone || "text-ink-900"}`}
                  >
                    {s.n}
                  </div>
                  {s.sub && (
                    <div className="text-[12px] text-ink-500 mt-1">{s.sub}</div>
                  )}
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[346px_minmax(0,1fr)] gap-4 items-start">
        {/* left: patient list */}
        <div className="bg-surface-paper border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <h2 className="text-sm font-bold text-ink-900 font-display tracking-tight">Today</h2>
            <span className="ml-auto text-xs text-ink-500">
              {lane.all.length} patients
            </span>
          </div>

          {lane.inConsultation.length > 0 && (
            <>
              <SectionLabel>With me now</SectionLabel>
              {lane.inConsultation.map((appt) => (
                <PatientRow
                  key={appt.id}
                  appt={appt}
                  patient={patientsById[appt.patientId]}
                  tone="now"
                  now={now}
                  selected={appt.id === selectedApptId}
                  isDue={isPatientDue(appt.patientId)}
                  isNew={isPatientNew(appt.patientId)}
                  onClick={() => setSelectedApptId(appt.id)}
                />
              ))}
            </>
          )}

          <SectionLabel>Waiting · {lane.waiting.length}</SectionLabel>
          {lane.waiting.length === 0 ? (
            <div className="px-4 py-3 text-xs text-ink-500">Nobody waiting</div>
          ) : (
            lane.waiting.map((appt, index) => (
              <PatientRow
                key={appt.id}
                appt={appt}
                patient={patientsById[appt.patientId]}
                tone="waiting"
                now={now}
                selected={appt.id === selectedApptId}
                isDue={isPatientDue(appt.patientId)}
                isNew={isPatientNew(appt.patientId)}
                isNext={index === 0}
                reason={lane.waitingOrder[index]?.reason}
                onClick={() => setSelectedApptId(appt.id)}
              />
            ))
          )}

          {morningUpcoming.length > 0 && (
            <>
              <SectionLabel>
                Later this morning · {morningUpcoming.length}
              </SectionLabel>
              {morningUpcoming.map((appt) => (
                <PatientRow
                  key={appt.id}
                  appt={appt}
                  patient={patientsById[appt.patientId]}
                  tone="upcoming"
                  now={now}
                  selected={appt.id === selectedApptId}
                  isDue={isPatientDue(appt.patientId)}
                  isNew={isPatientNew(appt.patientId)}
                  onClick={() => setSelectedApptId(appt.id)}
                />
              ))}
            </>
          )}

          {eveningUpcoming.length > 0 && (
            <>
              <SectionLabel>
                Evening
                {eveningWindow
                  ? ` · ${stripMeridiem(formatTime12h(minutesToTimeStr(eveningWindow.start)))}–${formatTime12h(minutesToTimeStr(eveningWindow.end))}`
                  : ""}
                <span className="ml-auto font-mono normal-case">
                  {eveningUpcoming.length}
                </span>
              </SectionLabel>
              {showEvening ? (
                eveningUpcoming.map((appt) => (
                  <PatientRow
                    key={appt.id}
                    appt={appt}
                    patient={patientsById[appt.patientId]}
                    tone="upcoming"
                    now={now}
                    selected={appt.id === selectedApptId}
                    isDue={isPatientDue(appt.patientId)}
                    isNew={isPatientNew(appt.patientId)}
                    onClick={() => setSelectedApptId(appt.id)}
                  />
                ))
              ) : (
                <button
                  type="button"
                  onClick={() => setShowEvening(true)}
                  className="w-full text-center px-4 py-3 text-xs font-semibold text-brand-violet border-t border-lineSoft bg-surface-canvas/40"
                >
                  Show the evening list ▾
                </button>
              )}
            </>
          )}

          {lane.done.length > 0 && (
            <>
              <SectionLabel>Done · {lane.done.length}</SectionLabel>
              {doneShown.map((appt) => (
                <PatientRow
                  key={appt.id}
                  appt={appt}
                  patient={patientsById[appt.patientId]}
                  tone="done"
                  queuePosition={queuePositionByApptId.get(appt.id)}
                  now={now}
                  selected={appt.id === selectedApptId}
                  isDue={isPatientDue(appt.patientId)}
                  isNew={isPatientNew(appt.patientId)}
                  onClick={() => setSelectedApptId(appt.id)}
                  onWriteNotes={() => {
                    setNotesModalAppt(appt);
                    setNotesModalDraft(appt.sessionNotes || "");
                  }}
                />
              ))}
              {lane.done.length > doneShown.length && (
                <button
                  type="button"
                  onClick={() => setShowAllDone(true)}
                  className="w-full text-center px-4 py-3 text-xs font-semibold text-brand-violet border-t border-lineSoft bg-surface-canvas/40"
                >
                  {lane.done.length - doneShown.length} earlier
                </button>
              )}
            </>
          )}
        </div>

        {/* right: detail panel */}
        {!selectedAppt ? (
          <div className="bg-surface-paper border border-border rounded-xl py-16 px-6 text-center text-sm text-ink-500">
            Nothing to show — the queue is empty for today.
          </div>
        ) : isSelectedInConsultation ? (
          <ConsultationPanel
            appt={selectedAppt}
            patient={selectedPatient}
            patientCode={getPatientCode(selectedAppt.patientId)}
            hospitalId={hospitalId}
            now={now}
            doctorAppointmentDuration={doctor.appointmentDuration}
            notesDraft={notesDraft}
            setNotesDraft={setNotesDraft}
            extraItems={extraItems}
            setExtraItems={setExtraItems}
            showAddItem={showAddItem}
            setShowAddItem={setShowAddItem}
            newItemName={newItemName}
            setNewItemName={setNewItemName}
            newItemPrice={newItemPrice}
            setNewItemPrice={setNewItemPrice}
            addExtraItem={addExtraItem}
            quickAddItems={quickAddItems}
            prescription={prescription}
            onSignPrescription={() =>
              setPrescriptionStatus
                .mutateAsync("signed")
                .then(() => showToast("Prescription signed"))
                .catch(() =>
                  showToast(
                    "Couldn't sign the prescription — add medicines first",
                  ),
                )
            }
            lastVisit={lastVisit}
            lastPrescription={lastPrescription}
            noShowCount={noShowCount}
            pastVisitsCount={pastVisits.length}
            isDue={isPatientDue(selectedAppt.patientId)}
            dueAmount={dueAmountByPatient[selectedAppt.patientId] || 0}
            followUp={followUp}
            setFollowUp={setFollowUp}
            onSaveAndComeBack={handleSaveNotes}
            onCompleteAndCallNext={() => setCompleteAppt(selectedAppt)}
            lastSavedAt={lastSavedAt}
            extendedMinutes={extendedMinutes[selectedAppt.id] || 0}
            onExtend={() =>
              setExtendedMinutes((cur) => ({
                ...cur,
                [selectedAppt.id]: (cur[selectedAppt.id] || 0) + 10,
              }))
            }
          />
        ) : (
          <PreCallPanel
            appt={selectedAppt}
            patient={selectedPatient}
            patientCode={getPatientCode(selectedAppt.patientId)}
            hospitalId={hospitalId}
            now={now}
            lastVisit={lastVisit}
            lastPrescription={lastPrescription}
            prescription={prescription}
            givenItems={selectedGivenItems}
            noShowCount={noShowCount}
            pastVisitsCount={pastVisits.length}
            isDue={isPatientDue(selectedAppt.patientId)}
            dueAmount={dueAmountByPatient[selectedAppt.patientId] || 0}
            isYetToArrive={
              selectedAppt.status === APPOINTMENT_STATUS.CONFIRMED ||
              selectedAppt.status === APPOINTMENT_STATUS.PENDING ||
              selectedAppt.status === "scheduled"
            }
            onCallIn={() => handleCallIn(selectedAppt)}
          />
        )}
      </div>

      {completeAppt && (
        <CompleteVisitDialog
          appointment={completeAppt}
          hospitalId={hospitalId}
          consultationFee={doctor.consultationFee}
          doctorName={doctor.name}
          patientCode={getPatientCode(completeAppt.patientId)}
          collectedByName={user?.name}
          updateAppointmentStatus={updateAppointmentStatus}
          initialSessionNotes={notesDraft}
          initialFollowUp={followUp}
          initialExtraItems={extraItems}
          onClose={() => setCompleteAppt(null)}
          onSuccess={handleCompleteSuccess}
        />
      )}

      {notesModalAppt && (
        <NotesModal
          appt={notesModalAppt}
          patient={patientsById[notesModalAppt.patientId]}
          hospitalId={hospitalId}
          prescription={notesModalPrescription}
          givenItems={notesModalGivenItems}
          draft={notesModalDraft}
          setDraft={setNotesModalDraft}
          saving={notesModalSaving}
          onSave={handleSaveNotesModal}
          onClose={() => setNotesModalAppt(null)}
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center px-4 py-2 text-[11px] uppercase tracking-wide font-bold text-ink-500 bg-surface-canvas/40 border-t border-b border-lineSoft first:border-t-0">
      {children}
    </div>
  );
}

function PatientRow({
  appt,
  patient,
  tone,
  queuePosition,
  now,
  selected,
  isDue,
  isNew,
  isNext,
  reason,
  onClick,
  onWriteNotes,
}: {
  appt: AppointmentWithDetails;
  patient: Patient | undefined;
  tone: "now" | "waiting" | "upcoming" | "done";
  // This patient's position in today's overall queue (1st, 2nd, 3rd... seen)
  // — only meaningful for tone==="done".
  queuePosition?: number;
  now: Date;
  selected: boolean;
  isDue: boolean;
  isNew: boolean;
  isNext?: boolean;
  // orderQueue's reason for this rank — only meaningful for tone==="waiting".
  reason?: string;
  onClick: () => void;
  // Opens the notes modal instead of selecting the row — only used by the
  // "Write" action on a done row missing its session notes.
  onWriteNotes?: () => void;
}) {
  const age = resolveAge(appt, patient);
  const isWalkIn = appt.bookingSource === "walk-in";
  const noteMissing = tone === "done" && !appt.sessionNotes;
  const elapsed =
    tone === "now"
      ? minutesBetween(stageStart(appt, appt.consultationStartedAt), now)
      : tone === "waiting"
        ? minutesBetween(
            stageStart(appt, appt.waitingAt || appt.checkedInAt),
            now,
          )
        : null;

  const badgeCls =
    tone === "now"
      ? "bg-brand-violet text-white"
      : tone === "done"
        ? noteMissing
          ? "bg-status-warning-soft text-status-warning"
          : "bg-status-open-soft text-status-open"
        : tone === "waiting" && elapsed != null && elapsed > 25
          ? "bg-status-danger-soft text-status-danger"
          : tone === "waiting" && elapsed != null && elapsed > 15
            ? "bg-status-warning-soft text-status-warning"
            : "bg-surface-canvas text-ink-700";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full grid ${tone === "done" ? "grid-cols-[48px_1fr_auto]" : "grid-cols-[34px_1fr_auto]"} gap-3 items-center text-left px-4 py-3 border-t border-lineSoft first:border-t-0 ${
        selected
          ? "bg-brand-violet-soft shadow-[inset_3px_0_0_theme(colors.brand.violet)]"
          : ""
      }`}
    >
      <span
        className={
          tone === "done"
            ? `w-11 h-11 rounded-xl grid place-items-center font-mono text-lg font-bold ${badgeCls}`
            : `w-8.5 h-8.5 rounded-lg grid place-items-center font-mono text-[13px] font-semibold ${badgeCls}`
        }
      >
        {tone === "done"
          ? queuePosition != null
            ? String(queuePosition).padStart(2, "0")
            : "✓"
          : formatTime12h(appt.time).replace(" ", "").slice(0, -2)}
      </span>
      <span className="min-w-0">
        <span className="block text-[14px] font-semibold text-ink-900 truncate">
          {appt.patientName}
          {isNext && (
            <span className="ml-1.5 rounded bg-brand-violet px-1.5 py-0.5 text-[9px] font-extrabold tracking-wide text-white align-middle">
              NEXT
            </span>
          )}
        </span>
        <span className="block text-[12px] text-ink-500 truncate">
          {tone === "waiting" && reason
            ? reason
            : tone === "upcoming"
              ? `${formatTime12h(appt.time)} · not arrived`
              : tone === "done"
                ? `${formatTime12h(appt.time)} · ${noteMissing ? "notes missing" : "notes saved"}`
                : [
                    age != null ? `${age}` : null,
                    appt.patientGender ? appt.patientGender[0] : null,
                  ]
                    .filter(Boolean)
                    .join(" ")}
        </span>
        <span className="flex gap-1 flex-wrap mt-1">
          {patientChips(patient, isDue, isNew, isWalkIn)}
          {appt.type === APPOINTMENT_TYPE.PACKAGE &&
            appt.packageVisitNumber != null && <Chip tone="pk">PACKAGE</Chip>}
          {noteMissing && <Chip tone="missing">NOTE MISSING</Chip>}
        </span>
      </span>
      {noteMissing ? (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            onWriteNotes?.();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.stopPropagation();
              onWriteNotes?.();
            }
          }}
          className="h-7 px-3 rounded-md border border-border bg-surface-paper text-xs font-medium text-ink-700 hover:bg-surface-canvas shrink-0"
        >
          Write
        </span>
      ) : tone === "done" ? (
        <span
          className="w-6 h-6 rounded-full grid place-items-center text-xs font-bold bg-status-open-soft text-status-open shrink-0"
          aria-label="Completed"
        >
          ✓
        </span>
      ) : (
        elapsed != null && (
          <span className="text-right shrink-0">
            <span
              className={`block font-mono text-xs font-semibold ${
                tone === "waiting" && elapsed > 15
                  ? "text-status-warning"
                  : "text-ink-700"
              }`}
            >
              {Math.max(0, elapsed)}m
            </span>
            <span className="block text-[10px] text-ink-500 uppercase">
              {tone === "now" ? "elapsed" : "waiting"}
            </span>
          </span>
        )
      )}
    </button>
  );
}

// The quick picker only has room for the three most common choices — the
// full five-option list (including "3 days"/"1 week") stays reachable via
// the dropdown in CompleteVisitDialog when actually completing the visit.
const QUICK_FOLLOW_UP_LABELS: Partial<Record<FollowUpOption, string>> = {
  none: "None",
  "2-weeks": "2 weeks",
  "1-month": "1 month",
};
const QUICK_FOLLOW_UP_VALUES = Object.keys(
  QUICK_FOLLOW_UP_LABELS,
) as FollowUpOption[];

const TEMPLATES = [
  {
    label: "Continue medication",
    text: "Continuing current medication at the same dose. Review as scheduled.",
  },
  {
    label: "Advised rest",
    text: "Advised rest and adequate hydration. Review if symptoms persist beyond a few days.",
  },
];

function ConsultationPanel({
  appt,
  patient,
  patientCode,
  hospitalId,
  now,
  doctorAppointmentDuration,
  notesDraft,
  setNotesDraft,
  extraItems,
  setExtraItems,
  showAddItem,
  setShowAddItem,
  newItemName,
  setNewItemName,
  newItemPrice,
  setNewItemPrice,
  addExtraItem,
  quickAddItems,
  prescription,
  onSignPrescription,
  lastVisit,
  lastPrescription,
  noShowCount,
  pastVisitsCount,
  isDue,
  dueAmount,
  followUp,
  setFollowUp,
  onSaveAndComeBack,
  onCompleteAndCallNext,
  lastSavedAt,
  extendedMinutes,
  onExtend,
}: {
  appt: AppointmentWithDetails;
  patient: Patient | undefined;
  patientCode: string | undefined;
  hospitalId: string;
  now: Date;
  doctorAppointmentDuration?: number;
  notesDraft: string;
  setNotesDraft: (v: string) => void;
  extraItems: PaymentItem[];
  setExtraItems: (v: PaymentItem[]) => void;
  showAddItem: boolean;
  setShowAddItem: (v: boolean) => void;
  newItemName: string;
  setNewItemName: (v: string) => void;
  newItemPrice: string;
  setNewItemPrice: (v: string) => void;
  addExtraItem: (
    name: string,
    price: number,
    chargeCatalogItemId?: string,
  ) => void;
  quickAddItems: { id: string; name: string; currentPrice: number }[];
  prescription: { items: unknown[]; status: string } | null | undefined;
  onSignPrescription: () => void;
  lastVisit: AppointmentWithDetails | undefined;
  lastPrescription: { items: { medicineName: string }[] } | null | undefined;
  noShowCount: number;
  pastVisitsCount: number;
  isDue: boolean;
  dueAmount: number;
  followUp: FollowUpOption;
  setFollowUp: (v: FollowUpOption) => void;
  onSaveAndComeBack: () => void;
  onCompleteAndCallNext: () => void;
  lastSavedAt: Date | null;
  extendedMinutes: number;
  onExtend: () => void;
}) {
  const age = resolveAge(appt, patient);
  const durationMin = (doctorAppointmentDuration || 30) + extendedMinutes;
  const elapsedMs =
    now.getTime() - stageStart(appt, appt.consultationStartedAt).getTime();
  const isOver = elapsedMs > durationMin * 60000;
  const allergy = allergySummary(patient);
  const vRows = vitalsRows(appt.vitals);
  const prescriptionItemCount = prescription?.items.length ?? 0;
  const unsignedPrescription =
    prescriptionItemCount > 0 && prescription?.status !== "signed";

  return (
    <div className="bg-surface-paper border border-border rounded-xl overflow-hidden">
      <div className="flex items-start gap-3 px-5 py-4 border-b border-lineSoft">
        <Avatar name={appt.patientName} size="w-11 h-11 text-base" />
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-ink-900 truncate font-display tracking-tight">
            {appt.patientName}
          </h3>
          <div className="text-xs text-ink-500 mt-1">
            {[
              age != null ? `${age}` : null,
              appt.patientGender,
              patientCode,
              `booked ${formatTime12h(appt.time)}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
        </div>
        <span className="ml-auto flex items-center gap-2 shrink-0">
          <span
            className={`flex items-baseline gap-2 border rounded-xl px-4 py-2 ${
              isOver
                ? "bg-status-warning-soft border-status-warning/30"
                : "bg-brand-violet-soft border-brand-violet/25"
            }`}
          >
            <b
              className={`font-mono text-xl font-semibold ${isOver ? "text-status-warning" : "text-brand-violet"}`}
            >
              {formatMMSS(elapsedMs)}
            </b>
            <span
              className={`text-[12px] ${isOver ? "text-status-warning" : "text-brand-violet"}`}
            >
              of {durationMin} min
            </span>
          </span>
          <button
            type="button"
            onClick={onExtend}
            className="h-9 px-3 rounded-lg border border-border text-sm font-medium text-ink-700 hover:bg-surface-canvas"
          >
            +10 min
          </button>
        </span>
      </div>

      <div className="flex gap-2 px-5 py-3 border-b border-lineSoft bg-surface-canvas/30 flex-wrap">
        {patient?.allergies && patient.allergies.length > 0 && (
          <span className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold bg-status-danger-soft text-status-danger border border-status-danger/20">
            Allergic to {patient.allergies.join(", ")}
          </span>
        )}
        {appt.type === APPOINTMENT_TYPE.PACKAGE &&
          appt.packageVisitNumber != null && (
            <span className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold bg-brand-violet-soft text-brand-violet border border-brand-violet/20">
              Package · visit {appt.packageVisitNumber}
            </span>
          )}
        {isDue && (
          <span className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold bg-status-warning-soft text-status-warning border border-status-warning/20">
            {dueAmount > 0 ? `₹${dueAmount.toLocaleString()} unpaid` : "Has an unpaid balance"}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1.2fr_0.8fr]">
        <div className="p-5 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <div className="text-[12px] uppercase tracking-wide text-ink-500 font-bold">
              Session notes
            </div>
            <span className="flex-1" />
            {lastVisit?.sessionNotes && (
              <button
                type="button"
                onClick={() => setNotesDraft(lastVisit.sessionNotes || "")}
                className="text-[12.5px] font-semibold text-brand-violet underline"
              >
                Copy last visit
              </button>
            )}
          </div>
          <textarea
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            placeholder="Details about the session, treatment provided, observations, etc."
            rows={7}
            className="w-full p-3 border border-border rounded-lg text-[14px] leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-brand-violet/20 focus:border-brand-violet"
          />
          <div className="flex gap-2 flex-wrap mt-2">
            {TEMPLATES.map((t) => (
              <button
                key={t.label}
                type="button"
                onClick={() =>
                  setNotesDraft(
                    notesDraft ? `${notesDraft}\n${t.text}` : t.text,
                  )
                }
                className="rounded-full border border-border bg-surface-paper px-3 py-2 text-xs text-ink-700 hover:bg-surface-canvas"
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="text-[12px] uppercase tracking-wide text-ink-500 font-bold mb-2 mt-4">
            Given during the visit
          </div>
          <div className="border border-border rounded-xl bg-surface-paper overflow-hidden">
            {extraItems.length === 0 && (
              <div className="px-3 py-3 text-xs text-ink-500">
                Nothing added yet
              </div>
            )}
            {extraItems.map((item, i) => (
              <div
                key={`${item.name}-${i}`}
                className="flex items-center justify-between gap-2 px-3 py-2 text-[13px] border-t border-border first:border-t-0"
              >
                <span>{item.name}</span>
                <span className="flex items-center gap-2">
                  <span className="font-mono">₹{item.unitPrice}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setExtraItems(extraItems.filter((_, idx) => idx !== i))
                    }
                    className="text-ink-500 hover:text-status-danger"
                    aria-label={`Remove ${item.name}`}
                  >
                    ×
                  </button>
                </span>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setShowAddItem(!showAddItem)}
              className="w-full text-left px-3 py-2 text-xs font-semibold text-brand-violet border-t border-border"
            >
              + Add injection, dressing or test
            </button>
          </div>
          {showAddItem && (
            <div className="mt-2">
              <div className="grid grid-cols-[1fr_78px_auto] gap-2">
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="Name"
                  className="px-3 py-2 border border-border rounded-lg text-xs bg-surface-paper"
                />
                <input
                  type="number"
                  value={newItemPrice}
                  onChange={(e) => setNewItemPrice(e.target.value)}
                  placeholder="₹"
                  className="px-3 py-2 border border-border rounded-lg text-xs bg-surface-paper"
                />
                <button
                  type="button"
                  onClick={() => {
                    const name = newItemName.trim();
                    if (!name) return;
                    addExtraItem(name, Number(newItemPrice) || 0);
                    setNewItemName("");
                    setNewItemPrice("");
                    setShowAddItem(false);
                  }}
                  className="px-4 py-2 rounded-lg border border-status-open bg-status-open-soft text-status-open text-xs font-semibold"
                >
                  Add
                </button>
              </div>
              {quickAddItems.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {quickAddItems.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        addExtraItem(c.name, c.currentPrice, c.id);
                        setShowAddItem(false);
                      }}
                      className="border border-dashed border-border rounded-md px-2 py-1 text-[12px] text-ink-700 hover:border-status-open hover:text-status-open hover:bg-status-open-soft"
                    >
                      + {c.name}{" "}
                      <span className="font-mono text-ink-500">
                        ₹{c.currentPrice}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="text-[12px] uppercase tracking-wide text-ink-500 font-bold mb-2 mt-4">
            Prescription
          </div>
          <div className="flex gap-3 items-center border border-border rounded-xl bg-surface-paper px-3 py-3">
            <span className="w-7 h-7 rounded-lg bg-brand-violet-soft text-brand-violet grid place-items-center text-xs font-bold shrink-0">
              Rx
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-semibold text-ink-900">
                {!prescription || prescription.items.length === 0
                  ? "No medicines added yet"
                  : `${prescription.items.length} medicine${prescription.items.length > 1 ? "s" : ""} — ${prescription.status === "signed" ? "signed" : "not signed yet"}`}
              </span>
            </span>
            <a
              href={`/hospital/${hospitalId}/appointments/${appt.id}/prescription`}
              className="ml-auto h-7 px-3 rounded-lg border border-border text-xs font-medium text-ink-700 hover:bg-surface-canvas shrink-0 flex items-center"
            >
              Open
            </a>
          </div>
        </div>

        <div className="p-5 border-t md:border-t-0 md:border-l border-lineSoft bg-surface-canvas/30 min-w-0">
          <div className="text-[12px] uppercase tracking-wide text-ink-500 font-bold mb-2">
            Last visit{" "}
            {lastVisit
              ? `· ${format(new Date(`${lastVisit.date}T00:00:00`), "d MMMM")}`
              : ""}
          </div>
          <div className="bg-surface-paper border border-border rounded-xl px-3 py-3 text-[13px] text-ink-700 leading-relaxed">
            {lastVisit?.sessionNotes && (
              <div className="text-[11px] uppercase tracking-wide text-ink-500 font-bold mb-1">
                You wrote
              </div>
            )}
            {lastVisit?.sessionNotes || "No prior visit on record."}
          </div>

          {lastPrescription && lastPrescription.items.length > 0 && (
            <>
              <div className="text-[12px] uppercase tracking-wide text-ink-500 font-bold mb-2 mt-4">
                Recent prescriptions
              </div>
              <div className="border border-border rounded-xl bg-surface-paper overflow-hidden">
                {lastPrescription.items.map((item, i) => (
                  <div
                    key={`${item.medicineName}-${i}`}
                    className="flex items-center justify-between gap-2 px-3 py-2 text-[13px] border-t border-border first:border-t-0"
                  >
                    <span className="min-w-0 truncate">
                      {lastVisit
                        ? format(
                            new Date(`${lastVisit.date}T00:00:00`),
                            "d MMM",
                          )
                        : ""}
                      {"  "}
                      {item.medicineName}
                    </span>
                    <a
                      href={`/hospital/${hospitalId}/appointments/${appt.id}/prescription`}
                      className="h-7 px-3 rounded-lg border border-border text-xs font-medium text-ink-700 hover:bg-surface-canvas shrink-0 flex items-center"
                    >
                      Repeat
                    </a>
                  </div>
                ))}
              </div>
            </>
          )}

          {vRows.length > 0 && (
            <>
              <div className="text-[12px] uppercase tracking-wide text-ink-500 font-bold mb-2">
                Vitals
              </div>
              {vRows.map((r) => (
                <KeyValue key={r.label} label={r.label} value={r.value} />
              ))}
            </>
          )}

          <div
            className={`text-[12px] uppercase tracking-wide text-ink-500 font-bold mb-2 ${vRows.length > 0 ? "mt-4" : ""}`}
          >
            Background
          </div>
          <KeyValue
            label="Allergies"
            value={allergy.text}
            danger={allergy.tone === "danger"}
            warning={allergy.tone === "warning"}
          />
          <KeyValue label="Visits with you" value={`${pastVisitsCount}`} />
          <KeyValue
            label="No-shows"
            value={`${noShowCount}`}
            danger={noShowCount > 0}
          />
          <KeyValue
            label="Unpaid"
            value={
              isDue
                ? dueAmount > 0
                  ? `₹${dueAmount.toLocaleString()} due`
                  : "Has a due balance"
                : "None"
            }
            danger={isDue}
          />

          <div className="text-[12px] uppercase tracking-wide text-ink-500 font-bold mb-2 mt-4">
            Follow-up
          </div>
          <div className="flex bg-surface-canvas border border-border rounded-lg p-1 gap-1">
            {FOLLOW_UP_OPTIONS.filter((o) =>
              QUICK_FOLLOW_UP_VALUES.includes(o.value),
            ).map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setFollowUp(o.value)}
                className={`flex-1 rounded-md py-2 px-1 text-[12px] font-medium ${
                  followUp === o.value
                    ? "bg-surface-paper text-brand-violet font-semibold shadow-sm"
                    : "text-ink-700"
                }`}
              >
                {QUICK_FOLLOW_UP_LABELS[o.value]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {unsignedPrescription && (
        <div className="px-5 pb-3">
          <div className="flex items-center gap-3 rounded-lg border border-status-warning/30 bg-status-warning-soft px-4 py-3 text-sm text-status-warning">
            <span>
              <b>
                {prescriptionItemCount} medicine
                {prescriptionItemCount > 1 ? "s" : ""} aren't signed yet.
              </b>{" "}
              {appt.patientName.split(" ")[0]} can't collect them from the
              pharmacy until you sign.
            </span>
            <button
              type="button"
              onClick={onSignPrescription}
              className="ml-auto h-8 px-3 rounded-lg border border-status-warning/40 bg-surface-paper text-xs font-semibold text-status-warning shrink-0 hover:bg-status-warning-soft"
            >
              Sign now
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 px-5 py-4 border-t border-lineSoft">
        <button
          type="button"
          onClick={onSaveAndComeBack}
          className="h-9 px-4 rounded-lg border border-border text-sm font-medium text-ink-700 hover:bg-surface-canvas"
        >
          Save and come back
        </button>
        {lastSavedAt ? (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-status-open/30 bg-status-open-soft px-2.5 py-1 text-[11px] font-semibold text-status-open">
            <span className="w-1.5 h-1.5 rounded-full bg-status-open" />
            Saved · {formatAgo(now, lastSavedAt)}
          </span>
        ) : (
          <span className="text-[12px] text-ink-500">Notes save as you type</span>
        )}
        <span className="flex-1" />
        <button
          type="button"
          onClick={onCompleteAndCallNext}
          className="h-9 px-4 rounded-lg border border-border text-sm font-medium text-ink-700 hover:bg-surface-canvas"
        >
          Complete without signing
        </button>
        <button
          type="button"
          onClick={() => {
            if (unsignedPrescription) onSignPrescription();
            onCompleteAndCallNext();
          }}
          className="h-9 px-4 rounded-lg bg-status-open hover:bg-status-open-hover text-white text-sm font-semibold"
        >
          Sign &amp; complete
        </button>
      </div>
    </div>
  );
}

function PreCallPanel({
  appt,
  patient,
  patientCode,
  hospitalId,
  now,
  lastVisit,
  lastPrescription,
  prescription,
  givenItems,
  noShowCount,
  pastVisitsCount,
  isDue,
  dueAmount,
  isYetToArrive,
  onCallIn,
}: {
  appt: AppointmentWithDetails;
  patient: Patient | undefined;
  patientCode: string | undefined;
  hospitalId: string;
  now: Date;
  lastVisit: AppointmentWithDetails | undefined;
  lastPrescription: { items: { medicineName: string }[] } | null | undefined;
  prescription: Prescription | null | undefined;
  givenItems: PaymentItem[];
  noShowCount: number;
  pastVisitsCount: number;
  isDue: boolean;
  dueAmount: number;
  isYetToArrive: boolean;
  onCallIn: () => void;
}) {
  const age = resolveAge(appt, patient);
  const waitStart = stageStart(appt, appt.waitingAt || appt.checkedInAt);
  const waitMinutes = minutesBetween(waitStart, now);
  const dueIn = minutesBetween(now, apptDateTime(appt));
  const allergy = allergySummary(patient);
  const vRows = vitalsRows(appt.vitals);
 
  return (
    <div className="bg-surface-paper border border-border rounded-xl overflow-hidden">
      <div className="flex items-start gap-3 px-5 py-4 border-b border-lineSoft">
        <Avatar name={appt.patientName} size="w-11 h-11 text-base" />
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-ink-900 truncate font-display tracking-tight">
            {appt.patientName}
          </h3>
          <div className="text-xs text-ink-500 mt-1">
            {[
              age != null ? `${age}` : null,
              appt.patientGender,
              patientCode,
              `booked ${formatTime12h(appt.time)}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
        </div>
        <span className="ml-auto shrink-0">
        
          {appt.status === APPOINTMENT_STATUS.COMPLETED ? (
            <span className="flex items-baseline gap-2 rounded-xl px-4 py-2 border border-status-open/30 bg-status-open-soft text-status-open">
              <b className="font-mono text-lg">Completed</b>
            </span>
          ) : isYetToArrive ? (
            <span className="flex items-baseline gap-2 rounded-xl px-4 py-2 border border-border bg-surface-canvas text-ink-700">
              <b className="font-mono text-lg">
                {dueIn > 0
                  ? `due in ${dueIn}m`
                  : dueIn < 0
                    ? `${Math.abs(dueIn)}m late`
                    : "now due"}
              </b>
            </span>
          ) : (
            <span className="flex items-baseline gap-2 rounded-xl px-4 py-2 border border-status-danger/30 bg-status-danger-soft text-status-danger">
              <b className="font-mono text-2xl font-bold">
                {Math.max(0, waitMinutes)} min
              </b>
              <span className="text-xs">
                waiting since {format(waitStart, "h:mm a")}
              </span>
            </span>
          )}
        </span>
      </div>

      <div className="flex gap-2 px-5 py-3 border-b border-lineSoft bg-surface-canvas/30 flex-wrap">
        {patient?.allergies && patient.allergies.length > 0 && (
          <span className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold bg-status-danger-soft text-status-danger border border-status-danger/20">
            Allergic to {patient.allergies.join(", ")}
          </span>
        )}
        {isDue && (
          <span className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold bg-status-warning-soft text-status-warning border border-status-warning/20">
            {dueAmount > 0
              ? `₹${dueAmount.toLocaleString()} unpaid — the desk knows`
              : "Has an unpaid balance"}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1.2fr_0.8fr]">
        <div className="p-5 min-w-0">
          {appt.status === APPOINTMENT_STATUS.COMPLETED ? (
            <>
              <div className="text-[12px] uppercase tracking-wide text-ink-500 font-bold mb-2">
                Session notes
              </div>
              <div className="bg-surface-paper border border-border rounded-xl px-3 py-3 text-[13px] text-ink-700 leading-relaxed whitespace-pre-wrap">
                {appt.sessionNotes || "No session notes were recorded."}
              </div>

              <div className="text-[12px] uppercase tracking-wide text-ink-500 font-bold mb-2 mt-4">
                Given during the visit
              </div>
              <div className="border border-border rounded-xl bg-surface-paper overflow-hidden">
                {givenItems.length === 0 ? (
                  <div className="px-3 py-3 text-xs text-ink-500">
                    Nothing added during this visit
                  </div>
                ) : (
                  givenItems.map((item, i) => (
                    <div
                      key={`${item.name}-${i}`}
                      className="flex items-center justify-between gap-2 px-3 py-2 text-[13px] border-t border-border first:border-t-0"
                    >
                      <span>
                        {item.name}
                        {item.quantity > 1 ? ` × ${item.quantity}` : ""}
                      </span>
                      <span className="font-mono">
                        ₹{item.unitPrice * item.quantity}
                      </span>
                    </div>
                  ))
                )}
              </div>

              <div className="text-[12px] uppercase tracking-wide text-ink-500 font-bold mb-2 mt-4">
                Prescription
              </div>
              {!prescription || prescription.items.length === 0 ? (
                <div className="border border-border rounded-xl bg-surface-canvas/30 px-3 py-3 text-xs text-ink-500">
                  No medicines were prescribed for this visit.
                </div>
              ) : (
                <div className="border border-border rounded-xl bg-surface-paper overflow-hidden">
                  {prescription.items.map((item, i) => (
                    <div
                      key={`${item.medicineId}-${i}`}
                      className="px-3 py-2 text-[13px] border-t border-border first:border-t-0"
                    >
                      <div className="font-semibold text-ink-900">
                        {item.medicineName}
                        {item.strength ? ` ${item.strength}` : ""}
                        {item.form ? ` · ${item.form}` : ""}
                      </div>
                      <div className="text-ink-500 text-xs mt-0.5">
                        {[item.dose, item.frequency, item.duration]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="text-[12px] uppercase tracking-wide text-ink-500 font-bold mb-2">
                Why they're here today
              </div>
              <div className="bg-surface-paper border border-border rounded-xl px-3 py-3 text-[13px] text-ink-700">
                {appt.notes && (
                  <div className="text-[11px] uppercase tracking-wide text-ink-500 font-bold mb-1">
                    Told to the desk at booking
                  </div>
                )}
                {appt.notes || "No reason recorded at booking."}
              </div>
            </>
          )}

          <div className="text-[12px] uppercase tracking-wide text-ink-500 font-bold mb-2 mt-4">
            Last visit{" "}
            {lastVisit
              ? `· ${format(new Date(`${lastVisit.date}T00:00:00`), "d MMMM")}${lastVisit.doctorName ? ` · Dr. ${lastVisit.doctorName}` : ""}`
              : ""}
          </div>
          <div className="bg-surface-paper border border-border rounded-xl px-3 py-3 text-[13px] text-ink-700 leading-relaxed">
            {lastVisit?.sessionNotes && (
              <div className="text-[11px] uppercase tracking-wide text-ink-500 font-bold mb-1">
                {lastVisit.doctorName
                  ? `Dr. ${lastVisit.doctorName.split(" ")[0]} wrote`
                  : "You wrote"}
              </div>
            )}
            {lastVisit?.sessionNotes || "First visit — no prior record."}
          </div>

          {lastPrescription && lastPrescription.items.length > 0 && (
            <>
              <div className="text-[12px] uppercase tracking-wide text-ink-500 font-bold mb-2 mt-4">
                Prescriptions from last visit
              </div>
              <div className="border border-border rounded-xl bg-surface-paper overflow-hidden">
                {lastPrescription.items.map((item, i) => (
                  <div
                    key={`${item.medicineName}-${i}`}
                    className="px-3 py-2 text-[13px] border-t border-border first:border-t-0"
                  >
                    {item.medicineName}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="p-5 border-t md:border-t-0 md:border-l border-lineSoft bg-surface-canvas/30 min-w-0">
          {vRows.length > 0 && (
            <>
              <div className="text-[12px] uppercase tracking-wide text-ink-500 font-bold mb-2">
                Vitals
              </div>
              {vRows.map((r) => (
                <KeyValue key={r.label} label={r.label} value={r.value} />
              ))}
            </>
          )}

          <div
            className={`text-[12px] uppercase tracking-wide text-ink-500 font-bold mb-2 ${vRows.length > 0 ? "mt-4" : ""}`}
          >
            Background
          </div>
          <KeyValue
            label="Allergies"
            value={allergy.text}
            danger={allergy.tone === "danger"}
            warning={allergy.tone === "warning"}
          />
          <KeyValue label="Visits" value={`${pastVisitsCount}`} />
          <KeyValue
            label="No-shows"
            value={`${noShowCount}`}
            danger={noShowCount > 0}
          />
          <KeyValue
            label="Package"
            value={
              appt.type === APPOINTMENT_TYPE.PACKAGE &&
              appt.packageVisitNumber != null
                ? `Visit ${appt.packageVisitNumber}`
                : "None"
            }
          />
        </div>
      </div>

      <div className="flex items-center gap-3 px-5 py-4 border-t border-lineSoft">
        {appt.patientPhone && (
          <a
            href={`tel:${appt.patientPhone}`}
            className="h-9 px-4 rounded-lg border border-border text-sm font-medium text-ink-700 hover:bg-surface-canvas flex items-center gap-2"
          >
            <Phone size={14} /> Call
          </a>
        )}
        <a
          href={`/hospital/${hospitalId}/patients/${appt.patientId}`}
          className="h-9 px-4 rounded-lg border border-border text-sm font-medium text-ink-700 hover:bg-surface-canvas flex items-center"
        >
          Full history
        </a>
        <span className="flex-1" />
        <span className="text-[12px] text-ink-500 hidden md:inline">
          Calling them in starts the clock and updates the waiting room board
        </span>
        <button
          type="button"
          onClick={onCallIn}
          className="h-9 px-4 rounded-lg bg-brand-violet hover:bg-brand-violet-hover text-white text-sm font-semibold"
        >
          Call in {appt.patientName.split(" ")[0]}
        </button>
      </div>
    </div>
  );
}

// Opened by "Write" on a done row missing its session notes — a focused
// modal rather than swapping out the main detail panel, so the existing
// queue/detail layout is untouched for every other row the doctor selects.
function NotesModal({
  appt,
  patient,
  hospitalId,
  prescription,
  givenItems,
  draft,
  setDraft,
  saving,
  onSave,
  onClose,
}: {
  appt: AppointmentWithDetails;
  patient: Patient | undefined;
  hospitalId: string;
  prescription: Prescription | null | undefined;
  givenItems: PaymentItem[];
  draft: string;
  setDraft: (v: string) => void;
  saving: boolean;
  onSave: () => void;
  onClose: () => void;
}) {
  const age = resolveAge(appt, patient);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/35 px-4">
      <div className="w-full max-w-lg bg-surface-paper border border-border rounded-xl overflow-hidden shadow-xl">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-lineSoft">
          <Avatar name={appt.patientName} size="w-9 h-9 text-xs" />
          <div className="min-w-0">
            <div className="text-sm font-bold text-ink-900 truncate font-display tracking-tight">
              {appt.patientName}
            </div>
            <div className="text-xs text-ink-500 truncate">
              {[
                age != null ? `${age}` : null,
                appt.patientGender,
                `seen ${formatTime12h(appt.time)}`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto h-8 w-8 shrink-0 rounded-lg text-ink-500 hover:bg-surface-canvas grid place-items-center"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="p-5 max-h-[70vh] overflow-y-auto">
          <div className="text-[12px] uppercase tracking-wide text-ink-500 font-bold mb-2">
            Session notes
          </div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Details about the session, treatment provided, observations, etc."
            rows={7}
            className="w-full p-3 border border-border rounded-lg text-[14px] leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-brand-violet/20 focus:border-brand-violet"
          />

          <div className="text-[12px] uppercase tracking-wide text-ink-500 font-bold mb-2 mt-4">
            Given during the visit
          </div>
          <div className="border border-border rounded-xl bg-surface-paper overflow-hidden">
            {givenItems.length === 0 ? (
              <div className="px-3 py-3 text-xs text-ink-500">
                Nothing added during this visit
              </div>
            ) : (
              givenItems.map((item, i) => (
                <div
                  key={`${item.name}-${i}`}
                  className="flex items-center justify-between gap-2 px-3 py-2 text-[13px] border-t border-border first:border-t-0"
                >
                  <span>
                    {item.name}
                    {item.quantity > 1 ? ` × ${item.quantity}` : ""}
                  </span>
                  <span className="font-mono">
                    ₹{item.unitPrice * item.quantity}
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="flex items-center gap-2 mb-2 mt-4">
            <div className="text-[12px] uppercase tracking-wide text-ink-500 font-bold">
              Prescription
            </div>
            {prescription && prescription.items.length > 0 && (
              <span
                className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                  prescription.status === "signed"
                    ? "bg-status-open-soft text-status-open"
                    : "bg-status-warning-soft text-status-warning"
                }`}
              >
                {prescription.status === "signed" ? "Signed" : "Not signed"}
              </span>
            )}
          </div>
          {!prescription || prescription.items.length === 0 ? (
            <div className="border border-border rounded-xl bg-surface-canvas/30 px-3 py-3 text-xs text-ink-500">
              No medicines were prescribed for this visit.
            </div>
          ) : (
            <div className="border border-border rounded-xl bg-surface-paper overflow-hidden">
              {prescription.items.map((item, i) => (
                <div
                  key={`${item.medicineId}-${i}`}
                  className="px-3 py-2 text-[13px] border-t border-border first:border-t-0"
                >
                  <div className="font-semibold text-ink-900">
                    {item.medicineName}
                    {item.strength ? ` ${item.strength}` : ""}
                    {item.form ? ` · ${item.form}` : ""}
                  </div>
                  <div className="text-ink-500 text-xs mt-0.5">
                    {[item.dose, item.frequency, item.duration]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                  {item.note && (
                    <div className="text-ink-500 text-xs mt-0.5 italic">
                      {item.note}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {prescription?.advice && (
            <div className="mt-2 text-xs text-ink-500">
              <span className="font-semibold text-ink-700">Advice: </span>
              {prescription.advice}
            </div>
          )}
          <a
            href={`/hospital/${hospitalId}/appointments/${appt.id}/prescription`}
            className="inline-flex items-center mt-3 h-8 px-3 rounded-lg border border-border text-xs font-medium text-ink-700 hover:bg-surface-canvas"
          >
            Open prescription
          </a>
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-lineSoft">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-lg border border-border text-sm font-medium text-ink-700 hover:bg-surface-canvas"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="h-9 px-4 rounded-lg bg-brand-violet hover:bg-brand-violet-hover text-white text-sm font-semibold disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save notes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function KeyValue({
  label,
  value,
  danger,
  warning,
}: {
  label: string;
  value: string;
  danger?: boolean;
  warning?: boolean;
}) {
  return (
    <div className="flex justify-between py-2 border-t border-lineSoft first:border-t-0 text-[13px]">
      <span className="text-ink-500">{label}</span>
      <span
        className={`font-medium ${danger ? "text-status-danger" : warning ? "text-status-warning" : "text-ink-900"}`}
      >
        {value}
      </span>
    </div>
  );
}
