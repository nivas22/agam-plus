// components/AdminAppointmentsPage.tsx
"use client";

import { format } from "date-fns";
import {
  CalendarDays,
  ChevronDown,
  History,
  Info,
  Plus,
  Printer,
  Search,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useHospitalAppointmentsApi } from "@/hooks/useNewAppointmentsApi";
import { useHospitalDoctors } from "@/hooks/useNewDoctorApi";
import { useHospitalPatients } from "@/hooks/useNewPatientApi";
import { paletteFor } from "@/lib/avatarPalette";
import type { AppointmentWithDetails } from "@/types/appointment";
import type { Doctor } from "@/types/doctorNew";
import { APPOINTMENT_STATUS, ROLE } from "../constants";
import AppointmentDetails from "./AppointmentDetails";
import {
  CancelDialog,
  ChangeDoctorDialog,
  NoShowDialog,
  RescheduleDialog,
} from "./appointments/AppointmentActionDialogs";
import CompleteVisitDialog from "./appointments/CompleteVisitDialog";
import ConfirmationDialog from "./ConfirmationDialog";
import { apptDateTime } from "./queue/queueBoard";

interface AppointmentsPageProps {
  userRole: string | undefined;
  canEdit: boolean;
  hospitalId: string;
  userId?: string;
}

const RANGE_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "week", label: "Next 7 days" },
  { value: "month", label: "Next 30 days" },
  { value: "past", label: "Past appointments" },
];

// Legacy pre-migration appointments are all stored as 'scheduled' — treat as CONFIRMED everywhere.
function normalizeStatus(status: string): string {
  return status === "scheduled" ? APPOINTMENT_STATUS.CONFIRMED : status;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; badge: string; stripe: string }
> = {
  [APPOINTMENT_STATUS.PENDING]: {
    label: "Pending",
    badge: "bg-status-warning-soft text-status-warning",
    stripe: "bg-status-warning",
  },
  [APPOINTMENT_STATUS.CONFIRMED]: {
    label: "Confirmed",
    badge: "bg-status-open-soft text-status-open",
    stripe: "bg-status-open",
  },
  [APPOINTMENT_STATUS.CHECKED_IN]: {
    label: "Checked in",
    badge: "bg-brand-violet-soft text-brand-violet",
    stripe: "bg-brand-violet",
  },
  [APPOINTMENT_STATUS.WAITING]: {
    label: "Waiting",
    badge: "bg-brand-violet-soft text-brand-violet",
    stripe: "bg-brand-violet",
  },
  [APPOINTMENT_STATUS.IN_CONSULTATION]: {
    label: "In consultation",
    badge: "bg-brand-violet text-white",
    stripe: "bg-brand-violet",
  },
  [APPOINTMENT_STATUS.COMPLETED]: {
    label: "Completed",
    badge: "bg-surface-canvas text-ink-500",
    stripe: "bg-border",
  },
  [APPOINTMENT_STATUS.CANCELLED]: {
    label: "Cancelled",
    badge: "bg-surface-canvas text-ink-500",
    stripe: "bg-status-danger-soft",
  },
  [APPOINTMENT_STATUS.NO_SHOW]: {
    label: "No-show",
    badge: "bg-status-danger-soft text-status-danger",
    stripe: "bg-status-danger",
  },
  [APPOINTMENT_STATUS.RESCHEDULED]: {
    label: "Needs reschedule",
    badge: "bg-status-warning-soft text-status-warning",
    stripe: "bg-status-warning",
  },
};

function getStatusConfig(status: string) {
  return (
    STATUS_CONFIG[normalizeStatus(status)] ||
    STATUS_CONFIG[APPOINTMENT_STATUS.CONFIRMED]
  );
}

// One click advances an appointment exactly one step through the queue lifecycle.
const NEXT_STEP: Partial<Record<string, { label: string; status: string }>> = {
  [APPOINTMENT_STATUS.PENDING]: {
    label: "Confirm",
    status: APPOINTMENT_STATUS.CONFIRMED,
  },
  [APPOINTMENT_STATUS.CONFIRMED]: {
    label: "Check in",
    status: APPOINTMENT_STATUS.CHECKED_IN,
  },
  [APPOINTMENT_STATUS.CHECKED_IN]: {
    label: "Start waiting",
    status: APPOINTMENT_STATUS.WAITING,
  },
  [APPOINTMENT_STATUS.WAITING]: {
    label: "Start consultation",
    status: APPOINTMENT_STATUS.IN_CONSULTATION,
  },
  [APPOINTMENT_STATUS.IN_CONSULTATION]: {
    label: "Complete",
    status: APPOINTMENT_STATUS.COMPLETED,
  },
};

function getNextStep(status: string) {
  return NEXT_STEP[normalizeStatus(status)];
}

const ACTIVE_STATUSES = new Set<string>([
  "scheduled",
  APPOINTMENT_STATUS.PENDING,
  APPOINTMENT_STATUS.CONFIRMED,
  APPOINTMENT_STATUS.CHECKED_IN,
  APPOINTMENT_STATUS.WAITING,
  APPOINTMENT_STATUS.IN_CONSULTATION,
]);

function isActiveStatus(status: string): boolean {
  return ACTIVE_STATUSES.has(status);
}

const STATUS_TOAST: Partial<Record<string, string>> = {
  [APPOINTMENT_STATUS.CONFIRMED]: "Appointment confirmed",
  [APPOINTMENT_STATUS.CHECKED_IN]: "Patient checked in",
  [APPOINTMENT_STATUS.WAITING]: "Patient moved to the waiting queue",
  [APPOINTMENT_STATUS.IN_CONSULTATION]: "Consultation started",
  [APPOINTMENT_STATUS.COMPLETED]: "Appointment marked as completed",
  [APPOINTMENT_STATUS.CANCELLED]: "Appointment cancelled",
  [APPOINTMENT_STATUS.NO_SHOW]: "Appointment marked as no-show",
};

const DAY_LOAD_MINUTES = 480; // 8-hour reference day
const WEEK_H0 = 7;
const WEEK_H1 = 20;

function toISODate(d: Date): string {
  return d.toISOString().split("T")[0];
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

function formatTime12h(time: string): string {
  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours, 10);
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${period}`;
}

function getRangeDates(range: string): { start: string; end: string } {
  const today = new Date();
  if (range === "today")
    return { start: toISODate(today), end: toISODate(today) };
  if (range === "week") {
    const end = new Date(today);
    end.setDate(end.getDate() + 6);
    return { start: toISODate(today), end: toISODate(end) };
  }
  if (range === "month") {
    const end = new Date(today);
    end.setDate(end.getDate() + 29);
    return { start: toISODate(today), end: toISODate(end) };
  }
  const start = new Date(today);
  start.setDate(start.getDate() - 90);
  const end = new Date(today);
  end.setDate(end.getDate() - 1);
  return { start: toISODate(start), end: toISODate(end) };
}

function getCurrentWeekDates(): { start: string; end: string; days: Date[] } {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
  return { start: toISODate(monday), end: toISODate(days[6]), days };
}

function doctorWindowsForDay(
  doctor: Doctor,
  dayName: string,
): { start: number; end: number }[] {
  return (doctor.availability || [])
    .filter((s) => s.day === dayName)
    .map((s) => ({
      start: minutesSinceMidnight(s.startTime),
      end: minutesSinceMidnight(s.endTime),
    }))
    .sort((a, b) => a.start - b.start);
}

function computeGaps(
  doctor: Doctor,
  dateStr: string,
  busyTimes: string[],
): { from: number; to: number }[] {
  const duration = doctor.appointmentDuration || 30;
  const dayName = format(new Date(`${dateStr}T00:00:00`), "EEEE");
  const windows = doctorWindowsForDay(doctor, dayName);
  const busyMins = busyTimes.map(minutesSinceMidnight).sort((a, b) => a - b);
  const gaps: { from: number; to: number }[] = [];
  windows.forEach((w) => {
    let cur = w.start;
    busyMins
      .filter((t) => t >= w.start && t < w.end)
      .forEach((t) => {
        if (t - cur >= duration) gaps.push({ from: cur, to: t });
        cur = Math.max(cur, t + duration);
      });
    if (w.end - cur >= duration) gaps.push({ from: cur, to: w.end });
  });
  return gaps;
}

type DayLine =
  | { type: "now" }
  | { type: "gap"; from: number; to: number }
  | { type: "appt"; appt: AppointmentWithDetails };

function buildDayLines(
  items: AppointmentWithDetails[],
  gaps: { from: number; to: number }[] | null,
  isToday: boolean,
  nowMins: number,
): DayLine[] {
  const lines: DayLine[] = [];
  let placedNow = !isToday;
  items.forEach((appt) => {
    if (!placedNow && minutesSinceMidnight(appt.time) > nowMins) {
      lines.push({ type: "now" });
      placedNow = true;
    }
    if (gaps) {
      const fit = gaps.find((g) => g.to === minutesSinceMidnight(appt.time));
      if (fit) lines.push({ type: "gap", from: fit.from, to: fit.to });
    }
    lines.push({ type: "appt", appt });
  });
  if (!placedNow) lines.push({ type: "now" });
  if (gaps && items.length) {
    const tail = gaps[gaps.length - 1];
    const lastStart = minutesSinceMidnight(items[items.length - 1].time);
    if (tail && tail.from >= lastStart)
      lines.push({ type: "gap", from: tail.from, to: tail.to });
  }
  return lines;
}

function SpecDot({ specialization }: { specialization?: string }) {
  const [c1] = paletteFor(specialization || "General");
  return (
    <span
      className="w-1.5 h-1.5 rounded-sm shrink-0"
      style={{ background: c1 }}
    />
  );
}

export default function AppointmentsPage({
  userRole,
  canEdit,
  hospitalId,
  userId,
}: AppointmentsPageProps) {
  const router = useRouter();
  const { user } = useAuth();

  const ADD_APPOINTMENT_PATH = `/hospital/${hospitalId}/appointments/add`;

  const [view, setView] = useState<"agenda" | "week" | "past">("agenda");
  const [range, setRange] = useState("week");
  const [search, setSearch] = useState("");
  const [doctorFilter, setDoctorFilter] = useState("all");
  const [statFilter, setStatFilter] = useState<
    "today" | "scheduled" | "attention" | null
  >(null);
  const [now, setNow] = useState(() => new Date());

  const [selectedApp, setSelectedApp] = useState<AppointmentWithDetails | null>(
    null,
  );
  const [modalPatient, setModalPatient] = useState<any>(null);
  const [updateAppointmentsMode, setUpdateAppointmentsMode] = useState(false);
  const [actionDialog, setActionDialog] = useState<{
    kind: "changeDoctor" | "reschedule" | "cancel" | "noShow";
    appt: AppointmentWithDetails;
  } | null>(null);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [selectedDoctorForAppointments, setSelectedDoctorForAppointments] =
    useState<Doctor | null>(null);
  const [selectedAppointmentsToUpdate, setSelectedAppointmentsToUpdate] =
    useState<AppointmentWithDetails[]>([]);
  const [futureAppointments, setFutureAppointments] = useState<{
    [key: string]: AppointmentWithDetails[];
  }>({});

  // Keep "now" fresh so the agenda's now-line and header clock stay accurate
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const today = toISODate(now);
  const nowMins = now.getHours() * 60 + now.getMinutes();

  const currentWeek = useMemo(() => getCurrentWeekDates(), [today]);
  const rangeDates = useMemo(
    () =>
      view === "week"
        ? { start: currentWeek.start, end: currentWeek.end }
        : view === "past"
          ? getRangeDates("past")
          : getRangeDates(range),
    [view, range, currentWeek],
  );

  const params = useMemo(() => {
    const searchParams = new URLSearchParams();
    searchParams.append("startDate", rangeDates.start);
    searchParams.append("endDate", rangeDates.end);
    if (userRole) searchParams.append("userRole", userRole);
    if (userRole === ROLE.DOCTOR && userId)
      searchParams.append("doctorId", userId);
    return searchParams;
  }, [rangeDates, userRole, userId]);

  const {
    appointments,
    isLoading: appointmentsLoading,
    refetchAppointments,
    updateAppointmentStatus,
  } = useHospitalAppointmentsApi(hospitalId, userRole, false, params);

  // React Query treats a tab/dropdown switch as "just show me this cached
  // key" when that exact date range was already fetched recently (2 min
  // staleTime) — e.g. flipping Agenda -> Past -> Agenda -> Past. Force a
  // live refetch on every range change so the list is never silently stale.
  const isFirstRangeFetch = useRef(true);
  useEffect(() => {
    if (isFirstRangeFetch.current) {
      isFirstRangeFetch.current = false;
      return;
    }
    refetchAppointments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeDates.start, rangeDates.end]);

  const { data: patientsData = { patients: [] }, isLoading: patientsLoading } =
    useHospitalPatients(hospitalId, undefined, true);
  const { data: doctorsData = { doctors: [] }, isLoading: doctorsLoading } =
    useHospitalDoctors(hospitalId, undefined, true);

  useEffect(() => {
    const futureMap: { [key: string]: AppointmentWithDetails[] } = {};
    const nowDate = new Date();
    appointments.forEach((appt) => {
      if (new Date(appt.date) >= nowDate) {
        if (!futureMap[appt.patientId]) futureMap[appt.patientId] = [];
        futureMap[appt.patientId].push(appt);
      }
    });
    setFutureAppointments(futureMap);
  }, [appointments]);

  const selectedDoctor =
    doctorFilter === "all"
      ? null
      : doctorsData.doctors.find((d) => d.id === doctorFilter) || null;

  const getPatientCode = useCallback(
    (patientId: string) =>
      patientsData.patients.find((p) => p.id === patientId)?.patientId,
    [patientsData.patients],
  );

  // Stats board: date-range + doctor scoped, independent of search/stat filter — matches the toolbar's own scope
  const statsScope = useMemo(
    () =>
      appointments.filter(
        (a) => doctorFilter === "all" || a.doctorProfileId === doctorFilter,
      ),
    [appointments, doctorFilter],
  );
  const isAttentionStatus = useCallback(
    (status: string) =>
      status === APPOINTMENT_STATUS.CANCELLED ||
      status === APPOINTMENT_STATUS.NO_SHOW ||
      status === APPOINTMENT_STATUS.RESCHEDULED,
    [],
  );

  const stats = useMemo(
    () => ({
      total: statsScope.length,
      today: statsScope.filter(
        (a) => a.date === today && a.status !== APPOINTMENT_STATUS.CANCELLED,
      ).length,
      scheduled: statsScope.filter((a) => isActiveStatus(a.status)).length,
      attention: statsScope.filter((a) => isAttentionStatus(a.status)).length,
    }),
    [statsScope, today, isAttentionStatus],
  );

  const filteredAppointments = useMemo(() => {
    let results = statsScope;
    if (statFilter === "today")
      results = results.filter((a) => a.date === today);
    else if (statFilter === "scheduled")
      results = results.filter((a) => isActiveStatus(a.status));
    else if (statFilter === "attention")
      results = results.filter((a) => isAttentionStatus(a.status));

    const q = search.trim().toLowerCase();
    if (q) {
      results = results.filter((a) => {
        const code = getPatientCode(a.patientId) || "";
        return (
          a.patientName?.toLowerCase().includes(q) ||
          a.doctorName?.toLowerCase().includes(q) ||
          code.toLowerCase().includes(q)
        );
      });
    }
    return [...results].sort((a, b) =>
      view === "past"
        ? (b.date + b.time).localeCompare(a.date + a.time)
        : (a.date + a.time).localeCompare(b.date + b.time),
    );
  }, [
    statsScope,
    statFilter,
    today,
    search,
    getPatientCode,
    view,
    isAttentionStatus,
  ]);

  const byDay = useMemo(() => {
    const groups: Record<string, AppointmentWithDetails[]> = {};
    filteredAppointments.forEach((a) => {
      (groups[a.date] = groups[a.date] || []).push(a);
    });
    return groups;
  }, [filteredAppointments]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const openDetailsModal = useCallback(
    (appt: AppointmentWithDetails) => {
      const patient = patientsData.patients.find(
        (p) => p.id === appt.patientId,
      );
      setModalPatient(
        patient || { id: appt.patientId, name: appt.patientName },
      );
      setSelectedAppointmentsToUpdate([appt]);
      setSelectedDoctorForAppointments(null);
      setSelectedApp(appt);
      setUpdateAppointmentsMode(true);
    },
    [patientsData.patients],
  );

  const openCompleteFlow = useCallback((appt: AppointmentWithDetails) => {
    setSelectedApp(appt);
    setShowNotesModal(true);
  }, []);

  const [earlyCheckInAppt, setEarlyCheckInAppt] =
    useState<AppointmentWithDetails | null>(null);
  const [wrongDayCheckInAppt, setWrongDayCheckInAppt] =
    useState<AppointmentWithDetails | null>(null);

  const handleUpdateStatus = useCallback(
    async (appointmentId: string, status: string, notes = "") => {
      try {
        await updateAppointmentStatus(appointmentId, status, notes);
        showToast(STATUS_TOAST[status] || "Appointment updated");
        setShowNotesModal(false);
        setSelectedApp(null);
        await refetchAppointments();
      } catch (err) {
        console.error("Error updating appointment:", err);
        showToast(
          err instanceof Error ? err.message : "Failed to update appointment",
        );
      }
    },
    [updateAppointmentStatus, refetchAppointments, showToast],
  );

  // A row's primary action always moves it exactly one step forward — except
  // "Complete", which needs session notes first, so it opens that modal
  // instead, and "Check in": a different day is a hard stop (nothing to
  // confirm — that appointment isn't today's business), while same-day but
  // still-early just asks for confirmation, since the booking could be a
  // genuinely early arrival.
  const advanceAppointment = useCallback(
    (appt: AppointmentWithDetails) => {
      const step = getNextStep(appt.status);
      if (!step) return;
      if (step.status === APPOINTMENT_STATUS.COMPLETED) {
        openCompleteFlow(appt);
      } else if (
        step.status === APPOINTMENT_STATUS.CHECKED_IN &&
        appt.date !== toISODate(new Date())
      ) {
        setWrongDayCheckInAppt(appt);
      } else if (
        step.status === APPOINTMENT_STATUS.CHECKED_IN &&
        new Date() < apptDateTime(appt)
      ) {
        setEarlyCheckInAppt(appt);
      } else {
        handleUpdateStatus(appt.id, step.status);
      }
    },
    [handleUpdateStatus, openCompleteFlow],
  );

  // Shared success handler for the change-doctor / reschedule / cancel / no-show dialogs.
  const handleDialogSuccess = useCallback(
    async (message: string) => {
      showToast(message);
      await refetchAppointments();
    },
    [showToast, refetchAppointments],
  );

  const updateSelectedAppointments = useCallback(async () => {
    setUpdateAppointmentsMode(false);
    showToast("Appointment updated");
    await refetchAppointments();
  }, [refetchAppointments, showToast]);

  const updateAllFutureAppointments = useCallback(async () => {
    setUpdateAppointmentsMode(false);
    showToast("All future appointments updated");
    await refetchAppointments();
  }, [refetchAppointments, showToast]);

  const isDataLoading =
    appointmentsLoading || patientsLoading || doctorsLoading;

  function rebook(appt: AppointmentWithDetails) {
    router.push(`${ADD_APPOINTMENT_PATH}?doctorId=${appt.doctorProfileId}`);
  }

  function bookSlot(date: string, from: number) {
    if (!selectedDoctor) return;
    router.push(
      `${ADD_APPOINTMENT_PATH}?doctorId=${selectedDoctor.id}&date=${date}&time=${hmLabel(from)}`,
    );
  }

  function ApptRow({ appt }: { appt: AppointmentWithDetails }) {
    const cfg = getStatusConfig(appt.status);
    const norm = normalizeStatus(appt.status);
    const dim =
      appt.status === APPOINTMENT_STATUS.CANCELLED ||
      appt.status === APPOINTMENT_STATUS.NO_SHOW ||
      appt.status === APPOINTMENT_STATUS.COMPLETED;
    const code = getPatientCode(appt.patientId);
    const nextStep = getNextStep(appt.status);
    // These mirror the backend's transition rules exactly, so a button never offers a move the API would reject.
    const canChangeDoctor =
      norm === APPOINTMENT_STATUS.PENDING ||
      norm === APPOINTMENT_STATUS.CONFIRMED ||
      norm === APPOINTMENT_STATUS.CHECKED_IN ||
      norm === APPOINTMENT_STATUS.WAITING;
    const canReschedule =
      norm === APPOINTMENT_STATUS.PENDING ||
      norm === APPOINTMENT_STATUS.CONFIRMED;
    const canMarkNoShow = norm === APPOINTMENT_STATUS.CONFIRMED;
    const canCancel = isActiveStatus(appt.status);
    // Once every active-state action has its own explicit button, only terminal rows still need the details modal.
    const openableViaRow =
      appt.status === APPOINTMENT_STATUS.COMPLETED ||
      appt.status === APPOINTMENT_STATUS.CANCELLED ||
      appt.status === APPOINTMENT_STATUS.NO_SHOW;
    const doctor = doctorsData.doctors.find(
      (d) => d.id === appt.doctorProfileId,
    );
    const duration = doctor?.appointmentDuration || 30;

    return (
      <div
        className={`flex border-b border-border last:border-b-0 hover:bg-surface-canvas/60 transition-colors ${
          openableViaRow ? "cursor-pointer" : ""
        }`}
        onClick={() => {
          if (openableViaRow) openDetailsModal(appt);
        }}
      >
        <div className="w-20 shrink-0 py-3.5 pl-4 border-r border-border">
          <div className="font-mono text-sm font-semibold text-ink-900">
            {formatTime12h(appt.time)}
          </div>
          <div className="font-mono text-[10px] text-ink-500 mt-0.5">
            {duration} min
          </div>
        </div>
        <div className={`w-[3px] shrink-0 ${cfg.stripe}`} />
        <div className="flex-1 min-w-0 flex flex-wrap items-center gap-x-4 gap-y-1.5 py-3 px-4">
          <div className="min-w-[160px]">
            <div
              className={`text-sm font-semibold truncate ${dim ? "text-ink-500" : "text-ink-900"} ${appt.status === APPOINTMENT_STATUS.CANCELLED || appt.status === APPOINTMENT_STATUS.NO_SHOW ? "line-through" : ""}`}
            >
              {appt.patientName}
            </div>
            {(code || appt.patientAge != null) && (
              <div className="font-mono text-[11px] text-ink-500 mt-0.5">
                {[code, appt.patientAge != null ? `${appt.patientAge}y` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            )}
          </div>
          <div className="min-w-[160px]">
            <div
              className={`text-sm truncate ${dim ? "text-ink-500" : "text-ink-900"}`}
            >
              Dr. {appt.doctorName}
            </div>
            <div className="text-xs text-ink-500 flex items-center gap-1.5 mt-0.5">
              <SpecDot specialization={appt.doctorSpecialization} />
              {appt.doctorSpecialization}
            </div>
          </div>
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${cfg.badge}`}
          >
            {cfg.label}
          </span>
          <div
            className="ml-auto flex items-center gap-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            {canEdit && nextStep && (
              <button
                type="button"
                onClick={() => advanceAppointment(appt)}
                className="h-8 px-3 rounded-lg border border-status-open/30 bg-status-open-soft text-status-open text-xs font-medium hover:bg-status-open/10 transition-colors"
              >
                {nextStep.label}
              </button>
            )}
            {canEdit && appt.status === APPOINTMENT_STATUS.COMPLETED && (
              <button
                type="button"
                onClick={() => openDetailsModal(appt)}
                className="h-8 px-3 rounded-lg border border-border text-xs font-medium text-ink-700 hover:bg-surface-canvas transition-colors"
              >
                Visit notes
              </button>
            )}
            {canEdit &&
              (appt.status === APPOINTMENT_STATUS.CANCELLED ||
                appt.status === APPOINTMENT_STATUS.NO_SHOW) && (
                <button
                  type="button"
                  onClick={() => rebook(appt)}
                  className="h-8 px-3 rounded-lg border border-border text-xs font-medium text-ink-700 hover:bg-surface-canvas transition-colors"
                >
                  Rebook
                </button>
              )}
            {canEdit && appt.status === APPOINTMENT_STATUS.RESCHEDULED && (
              <button
                type="button"
                onClick={() => setActionDialog({ kind: "reschedule", appt })}
                className="h-8 px-3 rounded-lg border border-status-warning/30 bg-status-warning-soft text-status-warning text-xs font-medium hover:bg-status-warning/10 transition-colors"
              >
                Pick new time
              </button>
            )}
            {canEdit && canChangeDoctor && (
              <button
                type="button"
                onClick={() => setActionDialog({ kind: "changeDoctor", appt })}
                className="h-8 px-3 rounded-lg border border-border text-xs font-medium text-ink-700 hover:bg-surface-canvas transition-colors"
              >
                Change doctor
              </button>
            )}
            {canEdit && canReschedule && (
              <button
                type="button"
                onClick={() => setActionDialog({ kind: "reschedule", appt })}
                className="h-8 px-3 rounded-lg border border-border text-xs font-medium text-ink-700 hover:bg-surface-canvas transition-colors"
              >
                Reschedule
              </button>
            )}
            {canEdit && canMarkNoShow && (
              <button
                type="button"
                onClick={() => setActionDialog({ kind: "noShow", appt })}
                className="h-8 px-3 rounded-lg border border-border text-xs font-medium text-ink-700 hover:bg-surface-canvas transition-colors"
              >
                No-show
              </button>
            )}
            {canEdit && canCancel && (
              <button
                type="button"
                onClick={() => setActionDialog({ kind: "cancel", appt })}
                className="h-8 px-3 rounded-lg border border-status-danger/30 text-xs font-medium text-status-danger hover:bg-status-danger-soft transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  function GapRow({
    date,
    from,
    to,
  }: {
    date: string;
    from: number;
    to: number;
  }) {
    return (
      <div className="flex border-b border-border last:border-b-0 bg-[repeating-linear-gradient(135deg,var(--surface-canvas,#F4F6F9)_0,transparent_1px,transparent_10px,var(--surface-canvas,#F4F6F9)_11px)]">
        <div className="w-20 shrink-0 py-2 pl-4 border-r border-border">
          <div className="font-mono text-xs text-ink-500">{hmLabel(from)}</div>
        </div>
        <div className="flex-1 min-w-0 flex items-center gap-3 py-2 px-4 text-xs text-ink-500">
          <span className="font-mono font-semibold text-ink-700">
            {to - from} min
          </span>{" "}
          open
          {canEdit && (
            <button
              type="button"
              onClick={() => bookSlot(date, from)}
              className="ml-auto h-7 px-3 rounded-lg border border-dashed border-ink-500/40 text-brand-violet text-xs font-semibold hover:border-brand-violet hover:bg-brand-violet-soft transition-colors"
            >
              Book this slot
            </button>
          )}
        </div>
      </div>
    );
  }

  function DayCard({
    date,
    items,
  }: {
    date: string;
    items: AppointmentWithDetails[];
  }) {
    const d = new Date(`${date}T00:00:00`);
    const isToday = date === today;
    const live = items.filter((a) => a.status !== APPOINTMENT_STATUS.CANCELLED);
    const cancelledCount = items.length - live.length;
    const load = Math.min(
      100,
      Math.round(
        (live.reduce(
          (sum, a) =>
            sum +
            (doctorsData.doctors.find((doc) => doc.id === a.doctorProfileId)
              ?.appointmentDuration || 30),
          0,
        ) /
          DAY_LOAD_MINUTES) *
          100,
      ),
    );
    const gaps =
      selectedDoctor && view !== "past"
        ? computeGaps(
            selectedDoctor,
            date,
            live.map((a) => a.time),
          )
        : null;
    const lines = buildDayLines(items, gaps, isToday, nowMins);

    return (
      <section
        className={`bg-surface-paper rounded-xl border shadow-sm overflow-hidden ${isToday ? "border-status-open/40 ring-1 ring-status-open/20" : "border-border"}`}
      >
        <div
          className={`flex items-center gap-3 px-5 py-3.5 border-b ${isToday ? "bg-status-open-soft border-status-open/20" : "bg-surface-canvas/40 border-border"}`}
        >
          <span className="font-mono text-xl font-bold text-ink-900 leading-none">
            {String(d.getDate()).padStart(2, "0")}
          </span>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-ink-900">
              {format(d, "EEE")}
            </div>
            <div className="text-xs text-ink-500">{format(d, "MMMM yyyy")}</div>
          </div>
          {isToday && (
            <span className="font-mono text-[10px] uppercase tracking-widest bg-status-open text-white px-2 py-0.5 rounded-full">
              Today
            </span>
          )}
          <span className="ml-auto font-mono text-xs text-ink-500">
            {live.length} booked
            {cancelledCount ? ` · ${cancelledCount} cancelled` : ""}
          </span>
          <div
            className="w-20 h-1.5 rounded-full bg-border overflow-hidden"
            title={`${load}% of an 8-hour day`}
          >
            <div
              className="h-full bg-status-open rounded-full"
              style={{ width: `${load}%` }}
            />
          </div>
        </div>
        <div>
          {lines.map((line, i) => {
            if (line.type === "now")
              return (
                <div key={`now-${i}`} className="relative h-5">
                  <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px bg-status-danger z-10" />
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-[9px] uppercase tracking-widest bg-status-danger text-white px-1.5 py-0.5 rounded-full z-10">
                    Now {hmLabel(nowMins)}
                  </span>
                </div>
              );
            if (line.type === "gap")
              return (
                <GapRow
                  key={`gap-${i}`}
                  date={date}
                  from={line.from}
                  to={line.to}
                />
              );
            return <ApptRow key={line.appt.id} appt={line.appt} />;
          })}
        </div>
      </section>
    );
  }

  function WeekView() {
    const hours = Array.from(
      { length: WEEK_H1 - WEEK_H0 },
      (_, i) => WEEK_H0 + i,
    );
    const q = search.trim().toLowerCase();
    const scoped = appointments
      .filter(
        (a) => doctorFilter === "all" || a.doctorProfileId === doctorFilter,
      )
      .filter(
        (a) => !q || (a.patientName + a.doctorName).toLowerCase().includes(q),
      );
    const nowTop = ((nowMins - WEEK_H0 * 60) / 60) * 56;

    return (
      <div className="bg-surface-paper rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-border">
          <div />
          {currentWeek.days.map((d) => {
            const isT = toISODate(d) === today;
            return (
              <div
                key={d.toISOString()}
                className={`text-center py-2 border-l border-border ${isT ? "bg-status-open-soft" : ""}`}
              >
                <div className="font-mono text-[9px] uppercase tracking-widest text-ink-500">
                  {format(d, "EEE")}
                </div>
                <div
                  className={`text-sm font-semibold mt-0.5 ${isT ? "text-status-open" : "text-ink-900"}`}
                >
                  {format(d, "d")}
                </div>
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-[56px_repeat(7,1fr)] relative">
          <div className="border-r border-border">
            {hours.map((h) => (
              <div
                key={h}
                className="h-14 text-right pr-2 font-mono text-[10px] text-ink-500 border-b border-border"
              >
                {String(h).padStart(2, "0")}:00
              </div>
            ))}
          </div>
          {currentWeek.days.map((d) => {
            const key = toISODate(d);
            const isT = key === today;
            const dayItems = scoped.filter((a) => a.date === key);
            return (
              <div
                key={key}
                className={`relative border-l border-border ${isT ? "bg-status-open-soft/20" : ""}`}
              >
                {hours.map((h) => (
                  <div key={h} className="h-14 border-b border-border" />
                ))}
                {dayItems.map((a) => {
                  const cfg = getStatusConfig(a.status);
                  const doctor = doctorsData.doctors.find(
                    (doc) => doc.id === a.doctorProfileId,
                  );
                  const dur = doctor?.appointmentDuration || 30;
                  const top =
                    ((minutesSinceMidnight(a.time) - WEEK_H0 * 60) / 60) * 56;
                  const height = Math.max((dur / 60) * 56 - 3, 24);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => openDetailsModal(a)}
                      title={`${a.time} · ${a.patientName} · Dr. ${a.doctorName} · ${cfg.label}`}
                      className={`absolute left-0.5 right-0.5 rounded-md px-1.5 py-1 text-left overflow-hidden border-l-2 ${cfg.badge}`}
                      style={{ top, height, borderLeftColor: "currentColor" }}
                    >
                      <div className="font-mono text-[9px] opacity-75">
                        {a.time}
                      </div>
                      <div className="text-[11px] font-semibold truncate">
                        {a.patientName}
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}
          <div
            className="absolute left-14 right-0 h-0.5 bg-status-danger z-10"
            style={{ top: nowTop }}
          />
        </div>
        <div className="flex flex-wrap gap-4 px-4 py-3 border-t border-border bg-surface-canvas/40">
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <span
              key={key}
              className="flex items-center gap-1.5 text-xs text-ink-500"
            >
              <span className={`w-2 h-2 rounded-sm ${cfg.stripe}`} />
              {cfg.label}
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (isDataLoading && appointments.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-violet"></div>
      </div>
    );
  }

  const statCards: {
    key: "today" | "scheduled" | "attention" | null;
    label: string;
    n: number;
  }[] = [
    { key: null, label: "in this range", n: stats.total },
    { key: "today", label: "today", n: stats.today },
    { key: "scheduled", label: "active", n: stats.scheduled },
    { key: "attention", label: "needs attention", n: stats.attention },
  ];

  return (
    <div className="pb-16">
      <div className="flex flex-wrap items-start gap-4 mb-4">
        <div>
          <h1 className="font-display tracking-tight text-xl font-bold text-ink-900">Appointments</h1>
          <p className="font-mono tabular text-sm text-ink-500 mt-0.5">
            {format(now, "EEEE, d MMMM yyyy")} · {format(now, "HH:mm")}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          {statCards.map((c) => (
            <button
              key={c.label}
              type="button"
              onClick={() =>
                setStatFilter((cur) =>
                  c.key === null ? null : cur === c.key ? null : c.key,
                )
              }
              className={`text-left px-3.5 py-2 rounded-lg border bg-surface-paper shadow-sm min-w-[104px] transition-colors ${
                statFilter === c.key && c.key !== null
                  ? "border-ink-900 ring-1 ring-ink-900"
                  : "border-border hover:border-ink-500"
              }`}
            >
              <div className="font-mono text-lg font-semibold text-ink-900 leading-none">
                {c.n}
              </div>
              <div className="text-[11px] text-ink-500 mt-1 whitespace-nowrap">
                {c.label}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3.5">
        <div className="relative flex-1 min-w-[220px] max-w-[300px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Patient, doctor or UHID"
            className="w-full h-9 pl-8 pr-3 rounded-lg border border-border bg-surface-paper text-sm focus:outline-none focus:ring-2 focus:ring-brand-violet/20 focus:border-brand-violet"
          />
        </div>
        <select
          value={range}
          onChange={(e) => setRange(e.target.value)}
          disabled={view === "week" || view === "past"}
          className="h-9 pl-3 pr-8 rounded-lg border border-border bg-surface-paper text-sm disabled:opacity-50"
        >
          {RANGE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          value={doctorFilter}
          onChange={(e) => setDoctorFilter(e.target.value)}
          className="h-9 pl-3 pr-8 rounded-lg border border-border bg-surface-paper text-sm max-w-[220px]"
        >
          <option value="all">All doctors</option>
          {doctorsData.doctors.map((d) => (
            <option key={d.id} value={d.id}>
              Dr. {d.name} · {d.specialization}
            </option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center bg-surface-canvas border border-border rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setView("agenda")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${view === "agenda" ? "bg-surface-paper text-ink-900 shadow-sm" : "text-ink-500"}`}
            >
              <CalendarDays className="w-3.5 h-3.5" /> Agenda
            </button>
            <button
              type="button"
              onClick={() => setView("week")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${view === "week" ? "bg-surface-paper text-ink-900 shadow-sm" : "text-ink-500"}`}
            >
              <ChevronDown className="w-3.5 h-3.5 -rotate-90" /> Week
            </button>
            <button
              type="button"
              onClick={() => setView("past")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${view === "past" ? "bg-surface-paper text-ink-900 shadow-sm" : "text-ink-500"}`}
            >
              <History className="w-3.5 h-3.5" /> Past
            </button>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="h-9 px-3.5 rounded-lg border border-border bg-surface-paper text-sm font-medium text-ink-700 hover:bg-surface-canvas transition-colors flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" /> Day sheet
          </button>
          {canEdit && (
            <button
              type="button"
              onClick={() => router.push(ADD_APPOINTMENT_PATH)}
              className="h-9 px-4 rounded-lg bg-brand-violet hover:bg-brand-violet-hover text-white text-sm font-medium flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-4 h-4" /> New appointment
            </button>
          )}
        </div>
      </div>

      {view === "agenda" && doctorFilter === "all" && (
        <div className="flex items-start gap-2.5 px-4 py-2.5 rounded-lg border border-border bg-surface-paper text-xs text-ink-500 mb-4">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          Pick a single doctor to see the open gaps in their day — you can book
          straight into one.
        </div>
      )}

      {view === "week" ? (
        <WeekView />
      ) : Object.keys(byDay).length === 0 ? (
        <div className="bg-surface-paper border border-border rounded-xl py-14 px-6 text-center shadow-sm">
          <CalendarDays className="w-8 h-8 text-border mx-auto mb-3" />
          <h3 className="font-display tracking-tight text-base font-semibold text-ink-900 mb-1">
            Nothing booked in this range
          </h3>
          <p className="text-sm text-ink-500 mb-5">
            Widen the date range, or book the first appointment.
          </p>
          {canEdit && (
            <button
              type="button"
              onClick={() => router.push(ADD_APPOINTMENT_PATH)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand-violet hover:bg-brand-violet-hover text-white text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" /> New appointment
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3.5">
          {Object.entries(byDay).map(([date, items]) => (
            <DayCard key={date} date={date} items={items} />
          ))}
        </div>
      )}

      {/* Appointment Details Modal — same component and actions for every role */}
      {updateAppointmentsMode && selectedApp && (
        <AppointmentDetails
          hospitalId={hospitalId}
          userRole={userRole}
          updateAppointmentsMode={updateAppointmentsMode}
          setUpdateAppointmentsMode={setUpdateAppointmentsMode}
          selectedPatient={modalPatient}
          doctors={doctorsData.doctors || []}
          futureAppointments={futureAppointments}
          selectedAppointmentsToUpdate={selectedAppointmentsToUpdate}
          setSelectedAppointmentsToUpdate={setSelectedAppointmentsToUpdate}
          selectedDoctorForAppointments={selectedDoctorForAppointments}
          setSelectedDoctorForAppointments={setSelectedDoctorForAppointments}
          updateSelectedAppointments={updateSelectedAppointments}
          updateAllFutureAppointments={updateAllFutureAppointments}
          selectedApp={selectedApp}
        />
      )}

      {/* Complete visit — session notes, bill and payment collection */}
      {showNotesModal && selectedApp && (
        <CompleteVisitDialog
          appointment={selectedApp}
          hospitalId={hospitalId}
          consultationFee={
            doctorsData.doctors.find(
              (d) => d.id === selectedApp.doctorProfileId,
            )?.consultationFee
          }
          doctorName={selectedApp.doctorName}
          patientCode={getPatientCode(selectedApp.patientId)}
          collectedByName={user?.name}
          updateAppointmentStatus={updateAppointmentStatus}
          onClose={() => {
            setShowNotesModal(false);
            setSelectedApp(null);
          }}
          onSuccess={handleDialogSuccess}
        />
      )}

      {/* Appointment action dialogs (change doctor / reschedule / cancel / no-show) */}
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

      {/* Confirm early check-in — scheduled time hasn't arrived yet */}
      <ConfirmationDialog
        isOpen={!!earlyCheckInAppt}
        onClose={() => setEarlyCheckInAppt(null)}
        onConfirm={() => {
          if (earlyCheckInAppt) {
            handleUpdateStatus(
              earlyCheckInAppt.id,
              APPOINTMENT_STATUS.CHECKED_IN,
            );
          }
          setEarlyCheckInAppt(null);
        }}
        title="Check in early?"
        message={
          earlyCheckInAppt
            ? `This appointment is booked for ${format(new Date(`${earlyCheckInAppt.date}T00:00:00`), "d MMM")}, ${formatTime12h(earlyCheckInAppt.time)}, which hasn't started yet. Check in anyway?`
            : ""
        }
        confirmText="Check in anyway"
      />

      {/* Block check-in — appointment isn't scheduled for today */}
      <ConfirmationDialog
        isOpen={!!wrongDayCheckInAppt}
        onClose={() => setWrongDayCheckInAppt(null)}
        onConfirm={() => setWrongDayCheckInAppt(null)}
        hideCancel
        confirmColor="red"
        confirmText="OK"
        title="Can't check in"
        message={
          wrongDayCheckInAppt
            ? wrongDayCheckInAppt.date < toISODate(new Date())
              ? `This appointment was booked for ${format(new Date(`${wrongDayCheckInAppt.date}T00:00:00`), "d MMM")}, ${formatTime12h(wrongDayCheckInAppt.time)} and is now overdue. Reschedule it before checking the patient in.`
              : `This appointment is booked for ${format(new Date(`${wrongDayCheckInAppt.date}T00:00:00`), "d MMM")}, ${formatTime12h(wrongDayCheckInAppt.time)} — check-in only opens on that day.`
            : ""
        }
      />

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 bg-ink-900 text-white px-4 py-3 rounded-lg shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
