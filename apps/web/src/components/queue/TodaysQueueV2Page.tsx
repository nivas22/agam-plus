// components/queue/TodaysQueueV2Page.tsx
"use client";

// The redesigned Today's queue (v2), switched on per hospital under
// Settings > Features > New queue layout. Two views over the same data:
//   - All doctors: one card per doctor — who's in the room, the next three
//     up — plus anything that needs a decision.
//   - One doctor: Now / Next up / Later columns for running that room.
// State, desk actions and dialogs come from useTodaysQueue, shared with the
// classic board (TodaysQueuePage), so both layouts behave identically.

import { format } from "date-fns";
import {
  ArrowRight,
  CalendarOff,
  Maximize2,
  Minimize2,
  Phone,
  Plus,
  Search,
  UserPlus,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { findLeaveOn } from "@/hooks/useLeaveRequestsApi";
import type { AppointmentWithDetails } from "@/types/appointment";
import { APPOINTMENT_STATUS } from "../../constants";
import DoctorPresenceMenu from "./DoctorPresenceMenu";
import {
  apptDateTime,
  averageConsultMinutes,
  capacityMessage,
  computePresence,
  type DoctorPresence,
  doctorAvailabilityNow,
  formatTime12h,
  getInitials,
  type LaneStatus,
  minutesBetween,
  minutesToTimeStr,
  type QueueLane,
  queueTokens,
  sessionCapacity,
  stageStart,
  todaysWindows,
} from "./queueBoard";
import {
  type TodaysQueue,
  TodaysQueueOverlays,
  type UseTodaysQueueArgs,
  useTodaysQueue,
} from "./useTodaysQueue";

// Waits at or past this many minutes are shown in red.
const LONG_WAIT_MINUTES = 10;
// Rows in a doctor card's "Next up" list, and cards in the Next up column.
const NEXT_UP_COUNT = 3;
// Bookings due within this many minutes are listed under "Due in next N min".
const DUE_SOON_MINUTES = 30;

type LaneView = {
  lane: QueueLane;
  status: LaneStatus;
  presence: DoctorPresence;
  tokens: Map<string, string>;
};

function waitMinutes(appt: AppointmentWithDetails, now: Date): number {
  return Math.max(
    0,
    minutesBetween(stageStart(appt, appt.waitingAt || appt.checkedInAt), now),
  );
}

function isWalkIn(appt: AppointmentWithDetails): boolean {
  return appt.bookingSource === "walk-in";
}

function arrivedEarly(appt: AppointmentWithDetails): boolean {
  const arrived = appt.checkedInAt || appt.waitingAt;
  return (
    !isWalkIn(appt) &&
    !!arrived &&
    new Date(arrived).getTime() < apptDateTime(appt).getTime()
  );
}

// "Walk-in · 8:01 PM" / "Booked 8:30 PM · arrived early".
function arrivalLine(appt: AppointmentWithDetails): string {
  const arrived = appt.checkedInAt || appt.waitingAt;
  if (isWalkIn(appt)) {
    return `Walk-in · ${arrived ? format(new Date(arrived), "h:mm a") : formatTime12h(appt.time)}`;
  }
  return [
    `Booked ${formatTime12h(appt.time)}`,
    arrivedEarly(appt) ? "arrived early" : null,
    appt.type === "follow-up" ? "Follow-up" : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function windowLabel(w: { start: number; end: number }): string {
  return `${formatTime12h(minutesToTimeStr(w.start))}–${formatTime12h(minutesToTimeStr(w.end))}`;
}

function shortBehind(status: LaneStatus): string {
  return status.label.replace(" min behind", "m behind");
}

// The status chip on a doctor card — mirrors laneStatus, with "Starts at …"
// shortened to "Not started" since the card already shows the session time.
function statusBadge(status: LaneStatus): { label: string; cls: string } {
  if (status.tone === "late")
    return {
      label: shortBehind(status),
      cls: "bg-status-warning-soft text-status-warning border-status-warning/20",
    };
  if (status.tone === "ok" || status.tone === "idle")
    return {
      label: status.tone === "idle" ? "Room free" : status.label,
      cls: "bg-status-open-soft text-status-open border-status-open/20",
    };
  return {
    label: status.label.startsWith("Starts at") ? "Not started" : status.label,
    cls: "bg-surface-canvas text-ink-500 border-border",
  };
}

function statusDotCls(status: LaneStatus): string {
  if (status.tone === "late") return "bg-status-warning";
  if (status.tone === "off") return "bg-ink-500/50";
  return "bg-status-open";
}

// Second line of a doctor tab: "5 waiting · 9m behind", "Starts 9:00 PM · 1 early".
function chipDetail(lane: QueueLane, status: LaneStatus): string {
  const waiting = lane.waiting.length;
  if (status.tone === "off") {
    const label = status.label.replace("Starts at", "Starts");
    return waiting > 0 ? `${label} · ${waiting} early` : label;
  }
  const state =
    status.tone === "late"
      ? shortBehind(status)
      : status.tone === "idle"
        ? "room free"
        : status.label.toLowerCase();
  return `${waiting} waiting · ${state}`;
}

export default function TodaysQueueV2Page(props: UseTodaysQueueArgs) {
  const queue = useTodaysQueue(props);
  const {
    canEdit,
    now,
    today,
    allLanes,
    boardLanes,
    leaveLanes,
    presenceOverrides,
    onLeaveToday,
    statusFor,
    isLoadingInitial,
    boardRef,
    isFullscreen,
    toggleFullscreen,
    openAddWalkIn,
  } = queue;
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(
    null,
  );
  const [showSessionOver, setShowSessionOver] = useState(false);

  // The classic board's lanes, plus any doctor whose session today hasn't
  // started yet and has nothing booked — v2 gives every doctor still due in
  // today a card, instead of a separate "Later today" list.
  const views = useMemo<LaneView[]>(() => {
    const shown = new Set(boardLanes.map((l) => l.doctor.id));
    const away = new Set(leaveLanes.map((l) => l.lane.doctor.id));
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const upcoming = allLanes.filter(
      (lane) =>
        !shown.has(lane.doctor.id) &&
        !away.has(lane.doctor.id) &&
        todaysWindows(lane.doctor, now).some((w) => w.start > nowMins),
    );
    return [...boardLanes, ...upcoming].map((lane) => ({
      lane,
      status: statusFor(lane),
      presence: computePresence(
        lane,
        presenceOverrides[lane.doctor.id],
        now,
        findLeaveOn(onLeaveToday, lane.doctor.id, today),
      ),
      tokens: queueTokens(lane),
    }));
  }, [
    allLanes,
    boardLanes,
    leaveLanes,
    statusFor,
    presenceOverrides,
    onLeaveToday,
    today,
    now,
  ]);
  const activeViews = views.filter((v) => v.status.label !== "Session over");
  const sessionOverViews = views.filter(
    (v) => v.status.label === "Session over",
  );
  const selected = selectedDoctorId
    ? views.find((v) => v.lane.doctor.id === selectedDoctorId)
    : undefined;

  const stats = selected
    ? laneStats([selected.lane], selected.lane.overdue.length, now)
    : laneStats(queue.lanes, queue.overdueAll.length, now);

  return (
    <div
      ref={boardRef}
      className={`pb-16 ${isFullscreen ? "bg-surface-canvas p-4 overflow-y-auto h-screen" : ""}`}
    >
      <div className="flex flex-wrap items-start gap-4 mb-4">
        <div>
          <h1 className="text-xl font-bold text-ink-900 font-display tracking-tight">
            Today&apos;s queue
          </h1>
          <p className="text-sm text-ink-500 mt-1">
            {format(now, "EEEE, d MMMM yyyy")}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <span
            className="flex items-center gap-1.5 text-xs font-medium text-status-open bg-status-open-soft border border-status-open/20 rounded-full px-3 py-1"
            title={
              queue.appointmentsUpdatedAt > 0
                ? `Last refreshed ${format(new Date(queue.appointmentsUpdatedAt), "h:mm:ss a")}`
                : undefined
            }
          >
            <span className="w-1.5 h-1.5 rounded-full bg-status-open" />
            Live · refreshes every 30s
          </span>
          <span className="font-mono text-lg font-semibold text-ink-900">
            {format(now, "h:mm a")}
          </span>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="h-9 px-3 rounded-lg border border-border bg-surface-paper text-ink-700 hover:bg-surface-canvas text-sm font-medium flex items-center gap-2 transition-colors"
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
              onClick={() => openAddWalkIn(selected?.lane.doctor.id)}
              className="h-9 px-4 rounded-lg bg-brand-violet hover:bg-brand-violet-hover text-white text-sm font-medium flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" /> Walk-in
            </button>
          )}
        </div>
      </div>

      {views.length > 0 && (
        <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
          <DoctorTab
            title="All doctors"
            detail={`${activeViews.length} in session · ${queue.waitingAll.length} waiting`}
            selected={!selected}
            onClick={() => setSelectedDoctorId(null)}
          />
          {[...activeViews, ...sessionOverViews].map((v) => (
            <DoctorTab
              key={v.lane.doctor.id}
              title={`Dr. ${v.lane.doctor.name}`}
              detail={chipDetail(v.lane, v.status)}
              dotCls={statusDotCls(v.status)}
              selected={selected?.lane.doctor.id === v.lane.doctor.id}
              onClick={() => setSelectedDoctorId(v.lane.doctor.id)}
            />
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-5">
        {stats.map((s) => (
          <div
            key={s.label}
            className="flex items-baseline gap-2 bg-surface-paper border border-border rounded-lg px-3 py-2"
          >
            <span className="text-xs text-ink-500">{s.label}</span>
            <span className={`font-mono text-base font-bold ${s.cls}`}>
              {s.value}
            </span>
          </div>
        ))}
      </div>

      {isLoadingInitial ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-violet" />
        </div>
      ) : selected ? (
        <DoctorView
          key={selected.lane.doctor.id}
          view={selected}
          queue={queue}
        />
      ) : (
        <AllDoctorsView
          queue={queue}
          activeViews={activeViews}
          sessionOverViews={sessionOverViews}
          showSessionOver={showSessionOver}
          onToggleSessionOver={() => setShowSessionOver((s) => !s)}
          onOpenDoctor={setSelectedDoctorId}
        />
      )}

      <TodaysQueueOverlays queue={queue} />
    </div>
  );
}

function laneStats(lanes: QueueLane[], overdue: number, now: Date) {
  const waiting = lanes.flatMap((l) => l.waiting);
  const waits = waiting.map((a) => waitMinutes(a, now));
  const avg = waits.length
    ? Math.round(waits.reduce((s, m) => s + m, 0) / waits.length)
    : 0;
  const longest = waits.length ? Math.max(...waits) : 0;
  const count = (pick: (l: QueueLane) => unknown[]) =>
    lanes.reduce((n, l) => n + pick(l).length, 0);
  return [
    { label: "Waiting", value: waiting.length, cls: "text-status-warning" },
    {
      label: "In consultation",
      value: count((l) => l.inConsultation),
      cls: "text-brand-violet",
    },
    {
      label: "Awaiting payment",
      value: count((l) => l.awaitingPayment),
      cls: "text-status-warning",
    },
    { label: "Done", value: count((l) => l.done), cls: "text-status-open" },
    {
      label: "Yet to arrive",
      value: count((l) => l.yetToArrive),
      cls: "text-ink-900",
    },
    {
      label: "Overdue",
      value: overdue,
      cls: overdue > 0 ? "text-status-danger" : "text-ink-900",
    },
    { label: "Avg wait", value: `${avg}m`, cls: "text-ink-900" },
    {
      label: "Longest",
      value: `${longest}m`,
      cls: longest >= LONG_WAIT_MINUTES ? "text-status-danger" : "text-ink-900",
    },
  ];
}

function DoctorTab({
  title,
  detail,
  dotCls,
  selected,
  onClick,
}: {
  title: string;
  detail: string;
  dotCls?: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 text-left rounded-xl border px-4 py-2.5 transition-colors ${
        selected
          ? "bg-indigo-950 border-indigo-950 text-white"
          : "bg-surface-paper border-border text-ink-900 hover:bg-surface-canvas"
      }`}
    >
      <span className="flex items-center gap-2 text-sm font-semibold">
        {dotCls && <span className={`w-2 h-2 rounded-full ${dotCls}`} />}
        {title}
      </span>
      <span
        className={`block text-xs mt-0.5 ${selected ? "text-white/70" : "text-ink-500"}`}
      >
        {detail}
      </span>
    </button>
  );
}

// Elapsed time since `since`, ticking every second — mm:ss, or h:mm:ss past
// an hour. The board itself only re-renders every 30s.
function LiveTimer({ since }: { since: Date }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const total = Math.max(
    0,
    Math.floor((now.getTime() - since.getTime()) / 1000),
  );
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return <>{h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`}</>;
}

function SourceBadge({ appt }: { appt: AppointmentWithDetails }) {
  return isWalkIn(appt) ? (
    <span className="shrink-0 rounded bg-status-warning-soft text-status-warning border border-status-warning/30 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide">
      Walk-in
    </span>
  ) : (
    <span className="shrink-0 rounded bg-brand-violet-soft text-brand-violet border border-brand-violet/20 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide">
      Booked
    </span>
  );
}

function ActionButton({
  label,
  onClick,
  primary,
  disabled,
  className = "",
}: {
  label: ReactNode;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`h-8 px-3 rounded-lg text-xs font-semibold shrink-0 transition-colors disabled:opacity-50 ${
        primary
          ? "bg-brand-violet hover:bg-brand-violet-hover text-white"
          : "border border-border bg-surface-paper text-ink-900 hover:bg-surface-canvas"
      } ${className}`}
    >
      {label}
    </button>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-[11px] font-bold uppercase tracking-wider text-ink-500 mb-2">
      {children}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*                            All doctors view                            */
/* ---------------------------------------------------------------------- */

function AllDoctorsView({
  queue,
  activeViews,
  sessionOverViews,
  showSessionOver,
  onToggleSessionOver,
  onOpenDoctor,
}: {
  queue: TodaysQueue;
  activeViews: LaneView[];
  sessionOverViews: LaneView[];
  showSessionOver: boolean;
  onToggleSessionOver: () => void;
  onOpenDoctor: (doctorId: string) => void;
}) {
  const { overdueAll, leaveLanes } = queue;
  // Late patients sit inside their doctor's card. Only those no visible card
  // shows (doctor without a lane, or a collapsed session-over card) fall back
  // to the banner, so an overdue patient is never hidden.
  const inCards = new Set(
    [...activeViews, ...(showSessionOver ? sessionOverViews : [])].flatMap(
      (v) => v.lane.overdue.map((a) => a.id),
    ),
  );
  const strayOverdue = overdueAll.filter((a) => !inCards.has(a.id));
  const hasAlerts = strayOverdue.length > 0 || leaveLanes.length > 0;

  if (activeViews.length === 0 && sessionOverViews.length === 0) {
    return (
      <div className="bg-surface-paper border border-border rounded-xl py-14 px-6 text-center shadow-sm">
        {leaveLanes.length > 0 ? (
          <>
            <CalendarOff className="w-8 h-8 text-border mx-auto mb-3" />
            <h3 className="text-base font-semibold text-ink-900 mb-1 font-display tracking-tight">
              No doctor available today
            </h3>
            <p className="text-sm text-ink-500">
              {leaveLanes.length === 1
                ? `Dr. ${leaveLanes[0].lane.doctor.name} is on leave.`
                : "Every doctor is on leave."}
            </p>
          </>
        ) : (
          <>
            <UserPlus className="w-8 h-8 text-border mx-auto mb-3" />
            <h3 className="text-base font-semibold text-ink-900 mb-1 font-display tracking-tight">
              Nothing booked today
            </h3>
            <p className="text-sm text-ink-500">
              Add a walk-in, or check back once appointments come in.
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <>
      {hasAlerts && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5 items-start">
          {strayOverdue.length > 0 && (
            <div className="bg-status-danger-soft/50 border border-status-danger/30 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-status-danger/20 text-sm font-bold text-status-danger">
                Needs a decision · {strayOverdue.length}
              </div>
              {strayOverdue.map((appt) => (
                <OverdueRow
                  key={appt.id}
                  appt={appt}
                  queue={queue}
                  showDoctor
                />
              ))}
            </div>
          )}
          {leaveLanes.length > 0 && (
            <div className="bg-surface-paper border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2 text-sm font-bold text-ink-900">
                <CalendarOff size={14} className="text-status-danger" />
                On leave today · {leaveLanes.length}
              </div>
              {leaveLanes.map(({ lane }) => (
                <div
                  key={lane.doctor.id}
                  className="px-4 py-3 border-t border-border first:border-t-0"
                >
                  <div className="flex items-baseline gap-2 text-sm">
                    <button
                      type="button"
                      onClick={() => queue.setActiveDoctor(lane.doctor)}
                      className="font-semibold text-ink-900 hover:underline"
                    >
                      Dr. {lane.doctor.name}
                    </button>
                    <span className="text-xs text-ink-500">
                      {lane.doctor.specialization || "General"}
                    </span>
                  </div>
                  {lane.yetToArrive.length > 0 && (
                    <div className="mt-1.5 text-xs text-status-warning">
                      {lane.yetToArrive.length} booking
                      {lane.yetToArrive.length > 1 ? "s" : ""} still under this
                      doctor — move or reschedule:{" "}
                      {lane.yetToArrive.map((appt, i) => (
                        <span key={appt.id}>
                          {i > 0 && ", "}
                          <button
                            type="button"
                            onClick={() => queue.setSelectedAppt(appt)}
                            className="underline hover:text-ink-900"
                          >
                            {appt.patientName} ({formatTime12h(appt.time)})
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeViews.length === 0 ? (
        <div className="bg-surface-paper border border-border rounded-xl py-10 px-6 text-center text-sm text-ink-500">
          Every doctor&apos;s session is over for today.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
          {activeViews.map((v) => (
            <DoctorCard
              key={v.lane.doctor.id}
              view={v}
              queue={queue}
              onOpen={() => onOpenDoctor(v.lane.doctor.id)}
            />
          ))}
        </div>
      )}

      {sessionOverViews.length > 0 && (
        <div className="mt-5">
          <button
            type="button"
            onClick={onToggleSessionOver}
            className="text-xs font-semibold text-ink-500 hover:text-ink-900"
          >
            {showSessionOver ? "Hide" : "Show"} session over ·{" "}
            {sessionOverViews.length}
          </button>
          {showSessionOver && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start mt-3">
              {sessionOverViews.map((v) => (
                <DoctorCard
                  key={v.lane.doctor.id}
                  view={v}
                  queue={queue}
                  onOpen={() => onOpenDoctor(v.lane.doctor.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

    </>
  );
}

function OverdueRow({
  appt,
  queue,
  showDoctor,
  canMove,
}: {
  appt: AppointmentWithDetails;
  queue: TodaysQueue;
  showDoctor?: boolean;
  canMove?: boolean;
}) {
  const lateMins = minutesBetween(apptDateTime(appt), queue.now);
  return (
    <div className="px-4 py-3 border-t border-status-danger/15 first:border-t-0 flex flex-wrap items-center gap-x-3 gap-y-2">
      <button
        type="button"
        onClick={() => queue.setSelectedAppt(appt)}
        className="text-sm text-ink-700 text-left min-w-0 flex-1 hover:text-ink-900"
      >
        <span className="font-semibold text-ink-900">{appt.patientName}</span>
        {showDoctor && <> · Dr. {appt.doctorName}</>} · booked{" "}
        {formatTime12h(appt.time)} ·{" "}
        <b className="text-status-danger">{lateMins}m late</b>
      </button>
      <div className="flex flex-wrap gap-2">
        {appt.patientPhone && (
          <a
            href={`tel:${appt.patientPhone}`}
            className="h-8 px-3 rounded-lg border border-border bg-surface-paper text-xs font-semibold text-ink-900 hover:bg-surface-canvas flex items-center gap-1"
          >
            <Phone size={12} /> {canMove ? "Call patient" : "Call"}
          </a>
        )}
        {queue.canEdit && (
          <ActionButton
            label="Mark no-show"
            onClick={() => queue.setActionDialog({ kind: "noShow", appt })}
          />
        )}
        {queue.canEdit && canMove && (
          <ActionButton
            label="Move to another doctor"
            onClick={() =>
              queue.setActionDialog({ kind: "changeDoctor", appt })
            }
          />
        )}
      </div>
    </div>
  );
}

function DoctorAvatar({ name }: { name: string }) {
  return (
    <span className="w-10 h-10 rounded-lg bg-brand-violet-soft text-brand-violet flex items-center justify-center text-xs font-bold shrink-0">
      {getInitials(name)}
    </span>
  );
}

function DoctorCard({
  view,
  queue,
  onOpen,
}: {
  view: LaneView;
  queue: TodaysQueue;
  onOpen: () => void;
}) {
  const { lane, status, presence, tokens } = view;
  const { now, canEdit } = queue;
  const cap = sessionCapacity(lane, now);
  const badge = statusBadge(status);
  const available = doctorAvailabilityNow(lane.doctor, now).available;

  // Waiting patients first, then bookings still to arrive — but never the
  // overdue ones, which sit under "Needs a decision" instead.
  const overdueIds = new Set(lane.overdue.map((a) => a.id));
  const upcoming = lane.yetToArrive.filter((a) => !overdueIds.has(a.id));
  const shownWaiting = lane.waiting.slice(0, NEXT_UP_COUNT);
  const shownUpcoming = upcoming.slice(
    0,
    Math.max(0, NEXT_UP_COUNT - shownWaiting.length),
  );
  const moreWaiting = lane.waiting.length - shownWaiting.length;
  const moreUpcoming = upcoming.length - shownUpcoming.length;
  const footer = [
    moreWaiting > 0 ? `+${moreWaiting} waiting` : null,
    moreUpcoming > 0 ? `${moreUpcoming} yet to arrive` : null,
    lane.awaitingPayment.length > 0
      ? `${lane.awaitingPayment.length} awaiting payment`
      : null,
  ].filter(Boolean);

  const roomFreeDetail =
    presence.tone === "expected" && !available && cap.window
      ? `Session starts ${formatTime12h(minutesToTimeStr(cap.window.start))} · doctor not checked in`
      : presence.detail;

  return (
    <div className="bg-surface-paper border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3.5 border-b border-border flex items-start gap-3">
        <DoctorAvatar name={lane.doctor.name} />
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => queue.setActiveDoctor(lane.doctor)}
            className="text-sm font-semibold text-ink-900 truncate hover:underline text-left block"
          >
            Dr. {lane.doctor.name}
          </button>
          <div className="text-xs text-ink-500 truncate">
            {cap.window
              ? `${windowLabel(cap.window)} · ${cap.bookedCount} of ${cap.totalCapacity} booked`
              : lane.doctor.specialization || "Not consulting today"}
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${badge.cls}`}
        >
          {badge.label}
        </span>
      </div>

      <div className="p-4 space-y-2">
        {lane.inConsultation.length > 0 ? (
          lane.inConsultation.map((appt) => (
            <button
              key={appt.id}
              type="button"
              onClick={() => queue.setSelectedAppt(appt)}
              className="w-full flex items-center gap-3 rounded-lg bg-indigo-950 text-white px-4 py-3 text-left"
            >
              <span className="w-7 h-7 rounded-md bg-white/15 flex items-center justify-center font-mono text-sm font-bold shrink-0">
                {tokens.get(appt.id)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-white/60">
                  In room
                </span>
                <span className="block text-sm font-bold truncate">
                  {appt.patientName}
                </span>
              </span>
              <span className="font-mono text-xl font-bold">
                <LiveTimer
                  since={stageStart(appt, appt.consultationStartedAt)}
                />
              </span>
            </button>
          ))
        ) : (
          <div className="rounded-lg border border-dashed border-border px-4 py-3">
            <div className="text-sm font-semibold text-ink-900">Room free</div>
            <div className="text-xs text-ink-500 mt-0.5">{roomFreeDetail}</div>
          </div>
        )}
      </div>

      <div className="px-4 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-500">
        Next up
      </div>
      {shownWaiting.length + shownUpcoming.length === 0 ? (
        <div className="px-4 py-3 border-t border-border text-xs text-ink-500 flex items-center justify-between gap-2">
          Nobody waiting
          {canEdit && available && (
            <ActionButton
              label="Add walk-in"
              onClick={() => queue.openAddWalkIn(lane.doctor.id)}
            />
          )}
        </div>
      ) : (
        <div className="divide-y divide-border border-t border-border">
          {shownWaiting.map((appt, i) => {
            const wait = waitMinutes(appt, now);
            return (
              <QueueRow
                key={appt.id}
                token={tokens.get(appt.id)}
                appt={appt}
                sub={arrivalLine(appt)}
                right={
                  <span
                    className={`font-mono text-sm ${wait >= LONG_WAIT_MINUTES ? "text-status-danger font-semibold" : "text-ink-900"}`}
                  >
                    {wait}m
                  </span>
                }
                onClick={() => queue.setSelectedAppt(appt)}
                action={
                  canEdit && (
                    <ActionButton
                      label="Send in"
                      primary={i === 0}
                      onClick={() =>
                        queue.quickUpdate(
                          appt,
                          APPOINTMENT_STATUS.IN_CONSULTATION,
                        )
                      }
                    />
                  )
                }
              />
            );
          })}
          {shownUpcoming.map((appt) => (
            <QueueRow
              key={appt.id}
              token={tokens.get(appt.id)}
              appt={appt}
              sub={`Booked ${formatTime12h(appt.time)} · not arrived`}
              right={<DueIn appt={appt} now={now} />}
              onClick={() => queue.setSelectedAppt(appt)}
              action={
                canEdit && (
                  <ActionButton
                    label="Check in"
                    onClick={() =>
                      queue.quickUpdate(appt, APPOINTMENT_STATUS.CHECKED_IN)
                    }
                  />
                )
              }
            />
          ))}
        </div>
      )}

      {lane.overdue.length > 0 && (
        <div className="border-t border-status-danger/20 bg-status-danger-soft/40">
          <div className="px-4 pt-2.5 pb-1 text-[11px] font-bold uppercase tracking-wider text-status-danger">
            Late · not arrived · {lane.overdue.length}
          </div>
          {lane.overdue.map((appt) => (
            <OverdueRow key={appt.id} appt={appt} queue={queue} />
          ))}
        </div>
      )}

      <div className="px-4 py-3 border-t border-border bg-surface-canvas/40 flex items-center gap-2 text-xs">
        <span className="text-ink-500 truncate">
          {footer.length ? footer.join(" · ") : `${lane.done.length} done today`}
        </span>
        <button
          type="button"
          onClick={onOpen}
          className="ml-auto shrink-0 font-semibold text-brand-violet hover:underline flex items-center gap-1"
        >
          Open queue <ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
}

function DueIn({ appt, now }: { appt: AppointmentWithDetails; now: Date }) {
  const dueIn = minutesBetween(now, apptDateTime(appt));
  return (
    <span className="font-mono text-sm text-ink-700">
      {dueIn > 0 ? `in ${dueIn}m` : dueIn === 0 ? "now" : `${-dueIn}m late`}
    </span>
  );
}

function QueueRow({
  token,
  appt,
  sub,
  badge,
  right,
  action,
  onClick,
}: {
  token?: string;
  appt: AppointmentWithDetails;
  sub?: string;
  badge?: boolean;
  right?: ReactNode;
  action?: ReactNode;
  onClick: () => void;
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: contains nested action buttons, so it can't itself be a <button>.
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " "))
          onClick();
      }}
      className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-surface-canvas/50"
    >
      <span className="w-9 font-mono text-sm text-ink-700 shrink-0">
        {token}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-sm font-semibold text-ink-900 truncate">
            {appt.patientName}
          </span>
          {badge && <SourceBadge appt={appt} />}
        </span>
        {sub && (
          <span className="block text-xs text-ink-500 truncate">{sub}</span>
        )}
      </span>
      {right && <span className="shrink-0 text-right">{right}</span>}
      {action}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*                              Doctor view                               */
/* ---------------------------------------------------------------------- */

function DoctorView({ view, queue }: { view: LaneView; queue: TodaysQueue }) {
  const { lane, tokens } = view;
  const { now, canEdit } = queue;
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [showFinished, setShowFinished] = useState(false);

  const current = lane.inConsultation[0];
  const nextUp = lane.waiting.slice(0, NEXT_UP_COUNT);
  const paymentsOn = queue.isModuleEnabled("payments");

  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const sendIn = (appt: AppointmentWithDetails) =>
    run(async () => {
      await queue.quickUpdate(appt, APPOINTMENT_STATUS.IN_CONSULTATION);
    });

  // Finish the visit and go straight to collecting payment. With Payments
  // switched off, finishing closes the visit by itself — nothing to collect.
  const finishToPayment = (appt: AppointmentWithDetails) =>
    run(async () => {
      const ok = await queue.handleFinishSession(appt, { quiet: paymentsOn });
      if (ok && paymentsOn) {
        queue.setCompleteAppt({ ...appt, status: "awaiting-payment" });
      }
    });

  // Finish the current visit (payment left for the desk) and send the next
  // waiting patient in, in one go.
  const callNext = (appt: AppointmentWithDetails | undefined) =>
    run(async () => {
      const next = lane.waiting[0];
      if (appt) {
        const ok = await queue.handleFinishSession(appt, { quiet: !!next });
        if (!ok) return;
      }
      if (next) {
        const ok = await queue.quickUpdate(
          next,
          APPOINTMENT_STATUS.IN_CONSULTATION,
        );
        if (ok) queue.showToast(`${next.patientName} sent in`);
      }
    });

  // Later column — everything not already in Now / Next up / Needs a decision.
  const overdueIds = new Set(lane.overdue.map((a) => a.id));
  const q = search.trim().toLowerCase();
  const matches = (a: AppointmentWithDetails) =>
    !q ||
    a.patientName.toLowerCase().includes(q) ||
    (tokens.get(a.id) ?? "").toLowerCase() === q ||
    (a.patientPhone ?? "").replace(/\s/g, "").includes(q.replace(/\s/g, ""));
  const stillWaiting = lane.waiting.slice(NEXT_UP_COUNT).filter(matches);
  const upcoming = lane.yetToArrive.filter((a) => !overdueIds.has(a.id));
  const dueSoon = upcoming
    .filter((a) => minutesBetween(now, apptDateTime(a)) <= DUE_SOON_MINUTES)
    .filter(matches);
  const laterToday = upcoming
    .filter((a) => minutesBetween(now, apptDateTime(a)) > DUE_SOON_MINUTES)
    .filter(matches);
  const laterCount =
    lane.waiting.slice(NEXT_UP_COUNT).length + upcoming.length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
      {/* Now */}
      <div className="space-y-4 min-w-0">
        <SectionLabel>Now · Dr. {lane.doctor.name}</SectionLabel>
        <div className="rounded-xl bg-indigo-950 text-white p-5">
          {current ? (
            <>
              <button
                type="button"
                onClick={() => queue.setSelectedAppt(current)}
                className="flex items-center gap-4 text-left w-full"
              >
                <span className="w-14 h-14 rounded-xl bg-white/15 flex items-center justify-center font-mono text-xl font-bold shrink-0">
                  {tokens.get(current.id)}
                </span>
                <span className="min-w-0">
                  <span className="block text-xl font-bold truncate">
                    {current.patientName}
                  </span>
                  <span className="block text-sm text-white/70 truncate">
                    {arrivalLine(current)}
                  </span>
                </span>
              </button>
              <div className="flex items-end justify-between mt-5">
                <div>
                  <div className="text-xs text-white/70">Time in room</div>
                  <div className="font-mono text-5xl font-bold leading-tight">
                    <LiveTimer
                      since={stageStart(current, current.consultationStartedAt)}
                    />
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-white/70">Avg consult</div>
                  <div className="font-mono text-base font-bold">
                    {averageConsultMinutes(lane) ??
                      lane.doctor.appointmentDuration ??
                      30}
                    m
                  </div>
                </div>
              </div>
              {lane.inConsultation.length > 1 && (
                <div className="mt-3 text-xs text-white/70">
                  Also in room:{" "}
                  {lane.inConsultation
                    .slice(1)
                    .map((a) => a.patientName)
                    .join(", ")}
                </div>
              )}
              {canEdit && (
                <div className="flex gap-2 mt-4">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => finishToPayment(current)}
                    className="flex-1 h-11 rounded-lg bg-white text-ink-900 text-sm font-semibold hover:bg-white/90 disabled:opacity-60"
                  >
                    {paymentsOn ? "Done → payment" : "Finish session"}
                  </button>
                  <button
                    type="button"
                    disabled={busy || lane.waiting.length === 0}
                    title={
                      lane.waiting.length === 0
                        ? "Nobody waiting"
                        : `Finish this visit and send in ${lane.waiting[0].patientName}`
                    }
                    onClick={() => callNext(current)}
                    className="h-11 px-4 rounded-lg border border-white/30 text-sm font-semibold hover:bg-white/10 disabled:opacity-50"
                  >
                    Call next
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="text-xl font-bold">Room free</div>
              <div className="text-sm text-white/70 mt-1">
                {view.presence.detail}
              </div>
              {canEdit && lane.waiting.length > 0 && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => callNext(undefined)}
                  className="mt-4 w-full h-11 rounded-lg bg-white text-ink-900 text-sm font-semibold hover:bg-white/90 disabled:opacity-60"
                >
                  Call {lane.waiting[0].patientName}
                </button>
              )}
            </>
          )}
        </div>

        <SessionCard view={view} queue={queue} />

        {lane.overdue.length > 0 && (
          <div className="bg-status-danger-soft/50 border border-status-danger/30 rounded-xl overflow-hidden">
            <div className="px-4 py-3 text-sm font-bold text-status-danger">
              Needs a decision · {lane.overdue.length}
            </div>
            {lane.overdue.map((appt) => (
              <OverdueRow key={appt.id} appt={appt} queue={queue} canMove />
            ))}
          </div>
        )}
      </div>

      {/* Next up */}
      <div className="space-y-3 min-w-0">
        <SectionLabel>Next up · {nextUp.length}</SectionLabel>
        {nextUp.length === 0 ? (
          <div className="bg-surface-paper border border-dashed border-border rounded-xl px-5 py-8 text-center">
            <p className="text-sm text-ink-500">Nobody waiting</p>
            {canEdit && (
              <button
                type="button"
                onClick={() => queue.openAddWalkIn(lane.doctor.id)}
                className="mt-3 h-9 px-4 rounded-lg border border-border bg-surface-paper text-sm font-semibold text-ink-900 hover:bg-surface-canvas"
              >
                + Add walk-in
              </button>
            )}
          </div>
        ) : (
          nextUp.map((appt, i) => {
            const wait = waitMinutes(appt, now);
            return (
              <div
                key={appt.id}
                className={`bg-surface-paper rounded-xl p-4 ${i === 0 ? "border-2 border-brand-violet/70" : "border border-border"}`}
              >
                <button
                  type="button"
                  onClick={() => queue.setSelectedAppt(appt)}
                  className="flex items-start gap-3 w-full text-left"
                >
                  <span className="w-11 h-11 rounded-lg bg-surface-canvas flex items-center justify-center font-mono text-base font-bold text-ink-900 shrink-0">
                    {tokens.get(appt.id)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-base font-bold text-ink-900 truncate">
                        {appt.patientName}
                      </span>
                      <SourceBadge appt={appt} />
                    </span>
                    <span className="block text-sm text-ink-500 truncate">
                      {isWalkIn(appt)
                        ? arrivalLine(appt).replace("Walk-in ·", "Walked in")
                        : arrivalLine(appt)}
                    </span>
                  </span>
                  <span className="text-right shrink-0">
                    <span
                      className={`block font-mono text-xl font-bold ${wait >= LONG_WAIT_MINUTES ? "text-status-danger" : "text-ink-900"}`}
                    >
                      {wait}m
                    </span>
                    <span className="block text-[11px] text-ink-500">
                      waiting
                    </span>
                  </span>
                </button>
                {lane.waitingOrder[i]?.reason.startsWith("urgent") ||
                lane.waitingOrder[i]?.reason.startsWith("waited") ? (
                  <div className="mt-2 text-xs text-status-warning">
                    {lane.waitingOrder[i].reason}
                  </div>
                ) : null}
                {canEdit && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => sendIn(appt)}
                    className={`mt-3 w-full h-11 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60 ${
                      i === 0
                        ? "bg-brand-violet hover:bg-brand-violet-hover text-white"
                        : "border border-border bg-surface-paper text-ink-900 hover:bg-surface-canvas"
                    }`}
                  >
                    Send in
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Later */}
      <div className="min-w-0">
        <SectionLabel>Later · {laterCount}</SectionLabel>
        <div className="bg-surface-paper border border-border rounded-xl overflow-hidden">
          <div className="p-3 border-b border-border">
            <label className="flex items-center gap-2 h-10 px-3 rounded-lg border border-border focus-within:border-brand-violet">
              <Search size={14} className="text-ink-500 shrink-0" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, token or phone"
                className="w-full bg-transparent text-sm outline-none placeholder:text-ink-500"
              />
            </label>
          </div>

          {stillWaiting.length > 0 && (
            <LaterGroup title={`Still waiting · ${stillWaiting.length}`}>
              {stillWaiting.map((appt) => {
                const wait = waitMinutes(appt, now);
                return (
                  <QueueRow
                    key={appt.id}
                    token={tokens.get(appt.id)}
                    appt={appt}
                    badge
                    right={
                      <span className="font-mono text-xs text-status-warning">
                        {wait > 0 ? `waiting ${wait}m` : "just now"}
                      </span>
                    }
                    onClick={() => queue.setSelectedAppt(appt)}
                    action={
                      canEdit && (
                        <ActionButton
                          label="Send in"
                          disabled={busy}
                          onClick={() => sendIn(appt)}
                        />
                      )
                    }
                  />
                );
              })}
            </LaterGroup>
          )}
          {dueSoon.length > 0 && (
            <LaterGroup
              title={`Due in next ${DUE_SOON_MINUTES} min · ${dueSoon.length}`}
            >
              {dueSoon.map((appt) => (
                <UpcomingRow
                  key={appt.id}
                  appt={appt}
                  token={tokens.get(appt.id)}
                  queue={queue}
                />
              ))}
            </LaterGroup>
          )}
          {laterToday.length > 0 && (
            <LaterGroup title={`Later today · ${laterToday.length}`}>
              {laterToday.map((appt) => (
                <UpcomingRow
                  key={appt.id}
                  appt={appt}
                  token={tokens.get(appt.id)}
                  queue={queue}
                />
              ))}
            </LaterGroup>
          )}
          {stillWaiting.length + dueSoon.length + laterToday.length === 0 && (
            <div className="px-4 py-6 text-center text-xs text-ink-500">
              {q ? "No one matches that search." : "Nothing else queued today."}
            </div>
          )}

          <div className="px-4 py-3 border-t border-border flex items-center gap-2 text-xs text-ink-500">
            <span>
              Done · {lane.done.length}
              {lane.awaitingPayment.length > 0 &&
                ` · Awaiting payment · ${lane.awaitingPayment.length}`}
            </span>
            {lane.done.length + lane.awaitingPayment.length > 0 && (
              <button
                type="button"
                onClick={() => setShowFinished((s) => !s)}
                className="ml-auto underline text-brand-violet font-medium"
              >
                {showFinished ? "Hide" : "Show"}
              </button>
            )}
          </div>
          {showFinished && (
            <div className="divide-y divide-border border-t border-border">
              {lane.awaitingPayment.map((appt) => (
                <QueueRow
                  key={appt.id}
                  token={tokens.get(appt.id)}
                  appt={appt}
                  sub="Awaiting payment"
                  onClick={() => queue.setSelectedAppt(appt)}
                  action={
                    canEdit && (
                      <ActionButton
                        label={paymentsOn ? "Collect payment" : "Complete"}
                        onClick={() => queue.setCompleteAppt(appt)}
                      />
                    )
                  }
                />
              ))}
              {lane.done.map((appt) => (
                <QueueRow
                  key={appt.id}
                  token={tokens.get(appt.id)}
                  appt={appt}
                  sub={
                    appt.paymentCollectedAt
                      ? `Done ${format(new Date(appt.paymentCollectedAt), "h:mm a")}`
                      : "Done"
                  }
                  onClick={() => queue.setSelectedAppt(appt)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LaterGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <>
      <div className="px-4 py-2 bg-surface-canvas/60 border-b border-border text-[11px] font-bold uppercase tracking-wider text-ink-500">
        {title}
      </div>
      <div className="divide-y divide-border border-b border-border">
        {children}
      </div>
    </>
  );
}

function UpcomingRow({
  appt,
  token,
  queue,
}: {
  appt: AppointmentWithDetails;
  token?: string;
  queue: TodaysQueue;
}) {
  return (
    <QueueRow
      token={token}
      appt={appt}
      badge
      right={
        <span className="font-mono text-xs text-ink-700">
          due {formatTime12h(appt.time).replace(/ (AM|PM)$/, "")}
        </span>
      }
      onClick={() => queue.setSelectedAppt(appt)}
      action={
        queue.canEdit && (
          <ActionButton
            label="Check in"
            onClick={() =>
              queue.quickUpdate(appt, APPOINTMENT_STATUS.CHECKED_IN)
            }
          />
        )
      }
    />
  );
}

function SessionCard({ view, queue }: { view: LaneView; queue: TodaysQueue }) {
  const { lane, status, presence } = view;
  const { now, canEdit } = queue;
  const cap = sessionCapacity(lane, now);
  const windows = todaysWindows(lane.doctor, now);
  const msg = capacityMessage(cap, null, windows);
  const behind = status.tone === "late";
  const pct = cap.totalCapacity
    ? Math.min(100, (cap.bookedCount / cap.totalCapacity) * 100)
    : 0;

  const line = [
    behind ? `Running ${status.label}` : (msg?.text ?? status.label),
    cap.heldTotal > 0
      ? `${cap.heldFree} walk-in slot${cap.heldFree === 1 ? "" : "s"} left`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="bg-surface-paper border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-ink-700">
          {cap.window ? `Session ${windowLabel(cap.window)}` : "No session today"}
        </span>
        {cap.window && (
          <span className="ml-auto font-mono font-semibold text-ink-900">
            {cap.bookedCount} of {cap.totalCapacity}
          </span>
        )}
      </div>
      {cap.window && cap.totalCapacity > 0 && (
        <div className="h-2 rounded-full bg-surface-canvas overflow-hidden mt-2.5">
          <div
            className={`h-full rounded-full ${behind ? "bg-status-warning" : "bg-brand-violet"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      <div
        className={`text-xs mt-2.5 ${behind ? "text-status-warning font-medium" : msg?.tone === "danger" ? "text-status-danger" : "text-ink-500"}`}
      >
        {line}
      </div>
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
        <span className="text-xs text-ink-500 truncate">{presence.detail}</span>
        <span className="ml-auto shrink-0">
          <DoctorPresenceMenu
            label={presence.label}
            tone={presence.tone}
            canEdit={canEdit}
            now={now}
            onMarkHere={() => queue.handleMarkHere(lane.doctor.id)}
            onMarkRunningLate={(t) =>
              queue.handleMarkRunningLate(lane.doctor.id, t)
            }
            onMarkOnBreak={(t) => queue.handleMarkOnBreak(lane.doctor.id, t)}
            onOpenNotComing={() => queue.handleOpenNotComing(lane)}
            onLeftForDay={() => queue.handleLeftForDay(lane)}
          />
        </span>
      </div>
    </div>
  );
}
