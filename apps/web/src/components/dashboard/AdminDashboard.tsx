"use client";

import { format, formatDistanceToNowStrict, startOfMonth } from "date-fns";
import {
  AlertCircle,
  Clock,
  IndianRupee,
  Package,
  Stethoscope,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import ApprovalModal, {
  ACTION_LABELS,
  getApprovalAmount,
  MONEY_ACTIONS,
} from "@/components/approvals/ApprovalModal";
import {
  activePatientCount,
  apptDateTime,
  buildLanes,
  computePresence,
  doctorAvailabilityNow,
  formatTime12h,
  getInitials,
  minutesBetween,
  minutesToTimeStr,
  readPresenceOverrides,
  todaysWindows,
  toISODate,
} from "@/components/queue/queueBoard";
import StackedDayBars from "@/components/reports/charts/StackedDayBars";
import { usePendingApprovals } from "@/hooks/useApprovalsApi";
import { useAuditLog } from "@/hooks/useAuditApi";
import { useAuth } from "@/hooks/useAuth";
import { useChargeCatalogItems } from "@/hooks/useChargeCatalogApi";
import { useHospitalHolidays } from "@/hooks/useHospitalHolidaysApi";
import { useHospitalAppointmentsApi } from "@/hooks/useNewAppointmentsApi";
import { useHospitalDoctors } from "@/hooks/useNewDoctorApi";
import { usePackageStats } from "@/hooks/useNewPackageApi";
import {
  useDailyCollectionReport,
  useDoctorRevenueReport,
  useDuesAgingReport,
} from "@/hooks/useReportsApi";
import type { ApprovalRequest } from "@/types/audit";

function money(v: number | undefined): string {
  return `₹${Math.round(v || 0).toLocaleString("en-IN")}`;
}

export default function AdminDashboardClient() {
  const { id: hospitalId } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const today = toISODate(now);
  const monthStart = toISODate(startOfMonth(now));
  const year = now.getFullYear();

  const [activeApproval, setActiveApproval] = useState<ApprovalRequest | null>(
    null,
  );

  const todayParams = useMemo(() => {
    const p = new URLSearchParams();
    p.append("startDate", today);
    p.append("endDate", today);
    p.append("userRole", "admin");
    return p;
  }, [today]);

  const { data: doctorsData, isLoading: doctorsLoading } = useHospitalDoctors(
    hospitalId,
    undefined,
    true,
  );
  const { appointments, isLoading: apptsLoading } = useHospitalAppointmentsApi(
    hospitalId,
    "admin",
    true,
    todayParams,
  );

  const { data: todayReport } = useDailyCollectionReport(hospitalId, {
    startDate: today,
    endDate: today,
  });
  const { data: monthReport } = useDailyCollectionReport(hospitalId, {
    startDate: monthStart,
    endDate: today,
  });
  const { data: doctorRevenue } = useDoctorRevenueReport(hospitalId, {
    startDate: monthStart,
    endDate: today,
  });
  const { data: duesAging } = useDuesAgingReport(hospitalId);
  const { data: pendingApprovals = [] } = usePendingApprovals(hospitalId);
  const { data: auditData } = useAuditLog(hospitalId);
  const { data: packageStats } = usePackageStats(hospitalId);
  const { data: holidaysData } = useHospitalHolidays(year, hospitalId);
  const { data: catalogData } = useChargeCatalogItems(hospitalId);

  const doctors = doctorsData?.doctors || [];
  const lanes = useMemo(
    () => buildLanes(doctors, appointments, now),
    [doctors, appointments, now],
  );
  const presenceOverrides = useMemo(
    () => readPresenceOverrides(hospitalId, today),
    [hospitalId, today],
  );

  // ---- live strip -----------------------------------------------------
  const waitingNow = lanes.reduce((n, l) => n + l.waiting.length, 0);
  const allWaiting = lanes.flatMap((l) =>
    l.waiting.map((a) => ({ appt: a, lane: l })),
  );
  const longestWaitMin = allWaiting.length
    ? Math.max(
        ...allWaiting.map((w) =>
          minutesBetween(new Date(w.appt.updatedAt), now),
        ),
      )
    : 0;
  const inConsultationCount = lanes.reduce(
    (n, l) => n + l.inConsultation.length,
    0,
  );
  const doctorsInConsultCount = lanes.filter(
    (l) => l.inConsultation.length > 0,
  ).length;
  const seenToday = lanes.reduce((n, l) => n + l.done.length, 0);
  const overdueAppts = lanes.flatMap((l) => l.overdue);
  const longestOverdueMin = overdueAppts.length
    ? Math.max(...overdueAppts.map((a) => minutesBetween(apptDateTime(a), now)))
    : 0;

  // ---- doctors right now ------------------------------------------------
  const relevantLanes = lanes.filter(
    (l) => l.all.length > 0 || doctorAvailabilityNow(l.doctor, now).available,
  );
  const presenceByLane = relevantLanes.map((lane) => ({
    lane,
    presence: computePresence(lane, presenceOverrides[lane.doctor.id], now),
  }));
  const notableDoctors = presenceByLane.filter(
    (p) => p.presence.tone !== "expected",
  );
  const laterTodayCount = presenceByLane.length - notableDoctors.length;
  const DOCTOR_CHIP_TONE: Record<string, string> = {
    in: "bg-status-open-soft border-status-open/30 text-status-open",
    late: "bg-status-warning-soft border-status-warning/30 text-status-warning",
    notIn: "bg-status-danger-soft border-status-danger/30 text-status-danger",
    expected: "bg-surface-canvas border-border text-ink-500",
  };

  // ---- today's doctors (availability) -----------------------------------
  const todaysDoctors = lanes
    .map((lane) => ({
      lane,
      windows: todaysWindows(lane.doctor, now),
      presence: computePresence(lane, presenceOverrides[lane.doctor.id], now),
    }))
    .filter((d) => d.windows.length > 0)
    .sort((a, b) => a.windows[0].start - b.windows[0].start);

  // ---- needs you ----------------------------------------------------
  type NeedsYouItem = {
    id: string;
    icon: ReactNode;
    iconCls: string;
    title: string;
    detail: string;
    when?: string;
    actionLabel: string;
    actionCls: string;
    onAction: () => void;
  };

  const needsYou: NeedsYouItem[] = [];

  for (const approval of pendingApprovals) {
    const isMoney = MONEY_ACTIONS.has(approval.action);
    const amount = getApprovalAmount(approval);
    const label =
      ACTION_LABELS[approval.action] || approval.action.replace(/_/g, " ");
    needsYou.push({
      id: `approval-${approval.id}`,
      icon: isMoney ? <IndianRupee size={16} /> : <AlertCircle size={16} />,
      iconCls: "bg-status-danger-soft text-status-danger",
      title:
        typeof amount === "number"
          ? `${label} of ${money(amount)} waiting for your approval`
          : `${label} waiting for your approval`,
      detail: `Requested by ${approval.requestedBy.name}${approval.reason ? ` · "${approval.reason}"` : ""}`,
      when: formatDistanceToNowStrict(new Date(approval.requestedAt), {
        addSuffix: true,
      }),
      actionLabel: "Review",
      actionCls: "bg-status-danger text-white",
      onAction: () => setActiveApproval(approval),
    });
  }

  for (const { lane, presence } of presenceByLane) {
    if (presence.tone !== "notIn") continue;
    const unhandled = activePatientCount(lane);
    if (unhandled === 0) continue;
    needsYou.push({
      id: `absence-${lane.doctor.id}`,
      icon: <Stethoscope size={16} />,
      iconCls: "bg-brand-violet-soft text-brand-violet",
      title: `${lane.doctor.name} isn't coming — ${unhandled} appointment${unhandled === 1 ? "" : "s"} still unhandled`,
      detail: presence.detail,
      actionLabel: "Handle now",
      actionCls: "bg-status-danger text-white",
      onAction: () => router.push(`/hospital/${hospitalId}/queue`),
    });
  }

  const unclosedDates = monthReport?.unclosedDates || [];
  if (unclosedDates.length > 0) {
    needsYou.push({
      id: "unclosed-days",
      icon: <Clock size={16} />,
      iconCls: "bg-status-warning-soft text-status-warning",
      title: `${unclosedDates.length} day${unclosedDates.length === 1 ? "" : "s"} were never closed`,
      detail: `${unclosedDates
        .map((d) => format(new Date(`${d}T00:00:00`), "d MMM"))
        .join(", ")} — the drawer was never counted`,
      actionLabel: "Close them",
      actionCls: "bg-status-warning text-white",
      onAction: () => router.push(`/hospital/${hospitalId}/reports`),
    });
  }

  if (duesAging && duesAging.tiles.over30.amount > 0) {
    needsYou.push({
      id: "dues-over30",
      icon: <IndianRupee size={16} />,
      iconCls: "bg-status-danger-soft text-status-danger",
      title: `${money(duesAging.tiles.over30.amount)} unpaid for more than 30 days`,
      detail: `${duesAging.tiles.over30.billCount} bill${duesAging.tiles.over30.billCount === 1 ? "" : "s"}`,
      actionLabel: "Open dues",
      actionCls: "bg-surface-paper border border-border text-ink-700",
      onAction: () => router.push(`/hospital/${hospitalId}/reports/dues-aging`),
    });
  }

  if (packageStats && packageStats.lapsingSoon.patients > 0) {
    needsYou.push({
      id: "packages-lapsing",
      icon: <Package size={16} />,
      iconCls: "bg-[#A6337B]/10 text-[#A6337B]",
      title: `${packageStats.lapsingSoon.patients} patient package${packageStats.lapsingSoon.patients === 1 ? "" : "s"} lapse within 30 days`,
      detail: `${money(packageStats.lapsingSoon.value)} of visits patients paid for and haven't used`,
      actionLabel: "See packages",
      actionCls: "bg-surface-paper border border-border text-ink-700",
      onAction: () => router.push(`/hospital/${hospitalId}/payments`),
    });
  }

  const visibleNeedsYou = needsYou.slice(0, 5);

  // ---- money today -----------------------------------------------------
  const paymentCount = (todayReport?.byUser || []).reduce(
    (n, u) => n + u.paymentCount,
    0,
  );

  // ---- queue right now ---------------------------------------------------
  type QueueRow = {
    key: string;
    label: string;
    sub: string;
    right: string;
    rightLabel: string;
    bad?: boolean;
  };
  const queueRows: QueueRow[] = [];

  const inConsultRows = lanes
    .filter((l) => l.inConsultation.length > 0)
    .map((l) => {
      const appt = l.inConsultation[0];
      const elapsed = minutesBetween(new Date(appt.updatedAt), now);
      return { lane: l, appt, elapsed };
    })
    .sort((a, b) => b.elapsed - a.elapsed);

  for (const row of inConsultRows) {
    queueRows.push({
      key: `consult-${row.appt.id}`,
      label: row.lane.doctor.name,
      sub: row.appt.patientName,
      right: `${row.elapsed}m`,
      rightLabel: "elapsed",
    });
  }

  if (allWaiting.length > 0) {
    const longest = allWaiting.reduce((max, w) =>
      minutesBetween(new Date(w.appt.updatedAt), now) >
      minutesBetween(new Date(max.appt.updatedAt), now)
        ? w
        : max,
    );
    queueRows.push({
      key: `waiting-${longest.appt.id}`,
      label: "Waiting longest",
      sub: `${longest.appt.patientName} · ${longest.lane.doctor.name}`,
      right: `${minutesBetween(new Date(longest.appt.updatedAt), now)}m`,
      rightLabel: "waiting",
      bad: true,
    });
  }

  const idleLane = lanes.find(
    (l) =>
      l.waiting.length === 0 &&
      l.inConsultation.length === 0 &&
      l.yetToArrive.length > 0 &&
      doctorAvailabilityNow(l.doctor, now).available,
  );
  if (idleLane) {
    queueRows.push({
      key: `idle-${idleLane.doctor.id}`,
      label: idleLane.doctor.name,
      sub: `Room free · next at ${formatTime12h(idleLane.yetToArrive[0].time)}`,
      right: "idle",
      rightLabel: "",
    });
  }

  const visibleQueueRows = queueRows.slice(0, 4);

  // ---- coming up ---------------------------------------------------
  type UpRow = {
    key: string;
    date: string;
    title: string;
    sub: string;
    pillLabel: string;
    pillCls: string;
    sortKey: string;
  };
  const upRows: UpRow[] = [];

  const upcomingHolidays = (holidaysData?.holidays || [])
    .filter((h) => h.status === "active" && !h.isPast)
    .sort((a, b) => a.startsOn.localeCompare(b.startsOn));
  for (const h of upcomingHolidays.slice(0, 2)) {
    const start = new Date(`${h.startsOn}T00:00:00`);
    const end = new Date(`${h.endsOn}T00:00:00`);
    const dateLabel =
      h.startsOn === h.endsOn
        ? format(start, "d MMM")
        : `${format(start, "d")}–${format(end, "d MMM")}`;
    upRows.push({
      key: `holiday-${h.id}`,
      date: dateLabel,
      title: h.name,
      sub:
        h.closureType === "opd_closed"
          ? `OPD closed${h.bookedCount > 0 ? ` · ${h.bookedCount} bookings still on that date` : ""}`
          : h.bookedCount > 0
            ? `${h.bookedCount} bookings still on that date`
            : "Hospital closed",
      pillLabel: h.closureType === "half_day" ? "HALF DAY" : "HOLIDAY",
      pillCls: "bg-status-danger-soft text-status-danger",
      sortKey: h.startsOn,
    });
  }

  const scheduledPriceItems = (catalogData?.items || []).filter(
    (i) => i.scheduledEffectiveFrom,
  );
  if (scheduledPriceItems.length > 0) {
    const earliest = scheduledPriceItems.reduce((min, i) =>
      (i.scheduledEffectiveFrom as string) <
      (min.scheduledEffectiveFrom as string)
        ? i
        : min,
    );
    const sameDate = scheduledPriceItems.filter(
      (i) => i.scheduledEffectiveFrom === earliest.scheduledEffectiveFrom,
    );
    upRows.push({
      key: "prices",
      date: format(
        new Date(`${earliest.scheduledEffectiveFrom}T00:00:00`),
        "d MMM",
      ),
      title: "New prices take effect",
      sub: `${sameDate.length} catalog item${sameDate.length === 1 ? "" : "s"}`,
      pillLabel: "PRICES",
      pillCls: "bg-brand-violet-soft text-brand-violet",
      sortKey: earliest.scheduledEffectiveFrom as string,
    });
  }

  upRows.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  const visibleUpRows = upRows.slice(0, 4);

  // ---- latest activity -------------------------------------------------
  const activityEntries = (auditData?.entries || []).slice(0, 4);

  const greeting =
    now.getHours() < 12
      ? "Good morning"
      : now.getHours() < 17
        ? "Good afternoon"
        : "Good evening";
  const firstName = (user?.name || "").split(" ")[0] || "there";

  const coreLoading = doctorsLoading || apptsLoading;

  return (
    <div className="space-y-4 pb-10">
      {activeApproval && (
        <ApprovalModal
          hospitalId={hospitalId}
          approval={activeApproval}
          onClose={() => setActiveApproval(null)}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4">
        <div className="flex-1">
          <h1 className="font-display tracking-tight text-2xl font-bold text-ink-900">
            {greeting}, {firstName}
          </h1>
          <p className="text-ink-500 text-sm mt-0.5">
            {format(now, "EEEE, d MMMM yyyy")} · {format(now, "h:mm a")} ·{" "}
            {appointments.length} appointments booked today
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => router.push(`/hospital/${hospitalId}/reports`)}
            className="px-3.5 py-2 text-sm font-semibold rounded-lg border border-border bg-surface-paper text-ink-700 hover:bg-surface-canvas transition-colors"
          >
            Reports
          </button>
          <button
            type="button"
            onClick={() => router.push(`/hospital/${hospitalId}/queue`)}
            className="px-3.5 py-2 text-sm font-semibold rounded-lg border border-border bg-surface-paper text-ink-700 hover:bg-surface-canvas transition-colors"
          >
            Day sheet
          </button>
        </div>
      </div>

      {/* Live strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        <Tile
          label="Waiting now"
          value={coreLoading ? "—" : waitingNow}
          sub={
            waitingNow > 0 ? `longest ${longestWaitMin} min` : "none right now"
          }
          tone={waitingNow > 0 ? "warning" : undefined}
        />
        <Tile
          label="In consultation"
          value={coreLoading ? "—" : inConsultationCount}
          sub={`${doctorsInConsultCount} doctor${doctorsInConsultCount === 1 ? "" : "s"} seeing patients`}
        />
        <Tile
          label="Seen today"
          value={coreLoading ? "—" : seenToday}
          sub={`of ${appointments.length} booked`}
          tone="good"
        />
        <Tile
          label="Overdue arrival"
          value={coreLoading ? "—" : overdueAppts.length}
          sub={
            overdueAppts.length > 0
              ? `${longestOverdueMin} min past · needs a call`
              : "none right now"
          }
          tone={overdueAppts.length > 0 ? "bad" : undefined}
        />
        <div className="col-span-2 lg:col-span-4 xl:col-span-1 bg-surface-paper border border-border rounded-xl p-3">
          <div className="text-[10.5px] uppercase tracking-wide text-ink-500 font-bold mb-2">
            Doctors right now
          </div>
          <div className="flex flex-wrap gap-1.5">
            {notableDoctors.length === 0 && laterTodayCount === 0 && (
              <span className="text-xs text-ink-500">
                No doctors scheduled today
              </span>
            )}
            {notableDoctors.slice(0, 4).map(({ lane, presence }) => (
              <span
                key={lane.doctor.id}
                className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-1 rounded-md border whitespace-nowrap ${DOCTOR_CHIP_TONE[presence.tone] || DOCTOR_CHIP_TONE.notIn}`}
              >
                <i className="w-1.5 h-1.5 rounded-full bg-current" />
                {lane.doctor.name} · {presence.label.toLowerCase()}
              </span>
            ))}
            {laterTodayCount > 0 && (
              <span className="inline-flex items-center text-[11px] font-medium text-ink-500 px-2 py-1">
                +{laterTodayCount} later today
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Today's doctors */}
      <div className="bg-surface-paper border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border">
          <h2 className="font-display tracking-tight text-[14.5px] font-bold text-ink-900">
            Today&apos;s doctors
          </h2>
          <span className="flex-1" />
          <span className="text-[11.5px] text-ink-500">
            {coreLoading ? "—" : `${todaysDoctors.length} scheduled today`}
          </span>
        </div>
        {!coreLoading && todaysDoctors.length === 0 ? (
          <div className="p-5 text-center text-[12.5px] text-ink-500">
            No doctors are scheduled to consult today.
          </div>
        ) : (
          todaysDoctors.map(({ lane, windows, presence }) => (
            <div
              key={lane.doctor.id}
              className="flex items-center gap-3 px-4 py-2.5 border-t border-border first:border-t-0"
            >
              <span className="w-8 h-8 rounded-lg bg-brand-violet-soft text-brand-violet text-[11px] font-bold grid place-items-center flex-none">
                {getInitials(lane.doctor.name)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-semibold text-ink-900 truncate">
                  {lane.doctor.name}
                </div>
                <div className="text-[11.5px] text-ink-500 truncate">
                  {lane.doctor.specialization || "—"}
                </div>
              </div>
              <div className="text-[12px] font-mono text-ink-700 text-right flex-none hidden sm:block">
                {windows
                  .map(
                    (w) =>
                      `${formatTime12h(minutesToTimeStr(w.start))}–${formatTime12h(minutesToTimeStr(w.end))}`,
                  )
                  .join(", ")}
              </div>
              <span
                className={`text-[10.5px] font-bold px-2 py-1 rounded-md border whitespace-nowrap flex-none ${DOCTOR_CHIP_TONE[presence.tone] || DOCTOR_CHIP_TONE.expected}`}
              >
                {presence.label}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_372px] gap-4 items-start">
        <div className="space-y-4">
          {/* Needs you */}
          <div className="bg-surface-paper border border-border rounded-xl overflow-hidden shadow-sm">
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border">
              <h2 className="font-display tracking-tight text-[14.5px] font-bold text-ink-900 flex items-center gap-2">
                Needs you
                {visibleNeedsYou.length > 0 && (
                  <span className="bg-status-danger text-white rounded-full text-[10.5px] px-2 py-0.5 font-bold">
                    {visibleNeedsYou.length}
                  </span>
                )}
              </h2>
              <span className="flex-1" />
              <span className="text-[11.5px] text-ink-500 hidden sm:inline">
                Nothing here moves without a decision from an admin
              </span>
            </div>
            {visibleNeedsYou.length === 0 ? (
              <div className="p-6 text-center text-[12.5px] text-ink-500">
                Nothing needs your attention right now.
              </div>
            ) : (
              visibleNeedsYou.map((item) => (
                <div
                  key={item.id}
                  className="flex gap-3 items-center px-4 py-3 border-t border-border first:border-t-0"
                >
                  <span
                    className={`w-8 h-8 rounded-lg grid place-items-center flex-none ${item.iconCls}`}
                  >
                    {item.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-semibold text-ink-900 leading-tight">
                      {item.title}
                    </div>
                    <div className="text-[11.5px] text-ink-500 leading-snug mt-0.5 truncate">
                      {item.detail}
                    </div>
                  </div>
                  {item.when && (
                    <span className="text-[11px] text-ink-500 font-mono hidden md:inline flex-none">
                      {item.when}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={item.onAction}
                    className={`text-[11.5px] font-semibold px-2.5 py-1.5 rounded-lg flex-none ${item.actionCls}`}
                  >
                    {item.actionLabel}
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Money today */}
          <div className="bg-surface-paper border border-border rounded-xl overflow-hidden shadow-sm">
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border">
              <h2 className="font-display tracking-tight text-[14.5px] font-bold text-ink-900">
                Money today
              </h2>
              <span className="flex-1" />
              <span className="text-[11.5px] text-ink-500">
                as of {format(now, "h:mm a")}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4">
              <div className="p-4 bg-gradient-to-br from-status-open to-status-open-hover text-white">
                <div className="text-[10.5px] uppercase tracking-wide font-bold text-white/80">
                  Collected
                </div>
                <div className="font-mono tabular text-2xl font-bold mt-0.5">
                  {money(todayReport?.tiles.collected.amount)}
                </div>
                <div className="text-[11.5px] text-white/85 mt-0.5">
                  {paymentCount} payments taken
                </div>
              </div>
              <div className="p-4 border-t sm:border-t-0 sm:border-l border-border">
                <div className="text-[10.5px] uppercase tracking-wide font-bold text-ink-500">
                  Cash
                </div>
                <div className="font-mono tabular text-xl font-bold mt-0.5 text-ink-900">
                  {money(todayReport?.totals.cash)}
                </div>
                <div className="text-[11.5px] text-ink-500 mt-0.5">
                  in the drawer
                </div>
              </div>
              <div className="p-4 border-t sm:border-t-0 sm:border-l border-border">
                <div className="text-[10.5px] uppercase tracking-wide font-bold text-ink-500">
                  UPI
                </div>
                <div className="font-mono tabular text-xl font-bold mt-0.5 text-ink-900">
                  {money(todayReport?.totals.upi)}
                </div>
                <div className="text-[11.5px] text-ink-500 mt-0.5">
                  collected today
                </div>
              </div>
              <div className="p-4 border-t sm:border-t-0 sm:border-l border-border">
                <div className="text-[10.5px] uppercase tracking-wide font-bold text-ink-500">
                  Unpaid raised
                </div>
                <div className="font-mono tabular text-xl font-bold mt-0.5 text-status-danger">
                  {money(todayReport?.tiles.raisedButUnpaid.amount)}
                </div>
                <div className="text-[11.5px] text-ink-500 mt-0.5">
                  {todayReport?.tiles.raisedButUnpaid.patientCount || 0}{" "}
                  patients today
                </div>
              </div>
            </div>
            {todayReport?.insight && (
              <div className="px-4 py-3 bg-surface-canvas/60 border-t border-border text-[11.5px] text-ink-500 leading-relaxed">
                {todayReport.insight}
              </div>
            )}
          </div>

          {/* Month chart */}
          <div className="bg-surface-paper border border-border rounded-xl overflow-hidden shadow-sm">
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border">
              <h2 className="font-display tracking-tight text-[14.5px] font-bold text-ink-900">
                {format(now, "MMMM")} so far
              </h2>
            </div>
            <div className="p-4">
              {monthReport?.chart.days ? (
                <StackedDayBars days={monthReport.chart.days} />
              ) : (
                <div className="text-[12.5px] text-ink-500 py-6 text-center">
                  Loading…
                </div>
              )}
            </div>
          </div>

          {/* Doctors this month */}
          <div className="bg-surface-paper border border-border rounded-xl overflow-hidden shadow-sm">
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border">
              <h2 className="font-display tracking-tight text-[14.5px] font-bold text-ink-900">
                Doctors this month
              </h2>
              <span className="flex-1" />
              <button
                type="button"
                onClick={() =>
                  router.push(`/hospital/${hospitalId}/reports/doctor-revenue`)
                }
                className="text-[11.5px] font-semibold px-2.5 py-1.5 rounded-lg border border-border text-ink-700 hover:bg-surface-canvas"
              >
                Full report
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-surface-canvas/60">
                    <Th>Doctor</Th>
                    <Th right>Visits</Th>
                    <Th right>Billed</Th>
                    <Th right>Unpaid</Th>
                    <Th>Diary full</Th>
                    <Th right>No-show</Th>
                  </tr>
                </thead>
                <tbody>
                  {(doctorRevenue?.table || []).map((d) => (
                    <tr
                      key={d.doctorProfileId}
                      className="border-t border-border"
                    >
                      <td className="px-4 py-2.5">
                        <div className="text-sm font-medium text-ink-900">
                          {d.name}
                        </div>
                        <div className="text-[11px] text-ink-500">
                          {d.specialization || "—"}
                        </div>
                      </td>
                      <Td right>{d.visits}</Td>
                      <Td right>{money(d.billed)}</Td>
                      <Td right>{money(d.outstanding)}</Td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        {d.diaryFullPct == null ? (
                          <span className="text-[11.5px] text-ink-500">—</span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5">
                            <span className="h-1.5 rounded-full bg-border/50 w-16 inline-block overflow-hidden">
                              <i
                                className={`block h-full ${
                                  d.diaryFullPct >= 85
                                    ? "bg-status-open"
                                    : d.diaryFullPct >= 70
                                      ? "bg-brand-violet"
                                      : "bg-status-warning"
                                }`}
                                style={{
                                  width: `${Math.min(100, d.diaryFullPct)}%`,
                                }}
                              />
                            </span>
                            <span className="text-[11.5px] font-mono text-ink-700">
                              {d.diaryFullPct}%
                            </span>
                          </span>
                        )}
                      </td>
                      <Td
                        right
                        className={
                          d.noShowPct != null && d.noShowPct >= 10
                            ? "text-status-danger"
                            : undefined
                        }
                      >
                        {d.noShowPct == null ? "—" : `${d.noShowPct}%`}
                      </Td>
                    </tr>
                  ))}
                  {(!doctorRevenue || doctorRevenue.table.length === 0) && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-6 text-center text-[12.5px] text-ink-500"
                      >
                        No doctor activity yet this month.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {doctorRevenue?.insight && (
              <div className="px-4 py-3 bg-surface-canvas/60 border-t border-border text-[11.5px] text-ink-500 leading-relaxed">
                {doctorRevenue.insight}
              </div>
            )}
          </div>
        </div>

        {/* Rail */}
        <div className="space-y-4">
          <div className="bg-surface-paper border border-border rounded-xl overflow-hidden shadow-sm">
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border">
              <h2 className="font-display tracking-tight text-[14.5px] font-bold text-ink-900">
                Queue right now
              </h2>
              <span className="flex-1" />
              <button
                type="button"
                onClick={() => router.push(`/hospital/${hospitalId}/queue`)}
                className="text-[11.5px] font-semibold px-2.5 py-1.5 rounded-lg border border-border text-ink-700 hover:bg-surface-canvas"
              >
                Open
              </button>
            </div>
            {visibleQueueRows.length === 0 ? (
              <div className="p-5 text-center text-[12.5px] text-ink-500">
                Nothing in the queue right now.
              </div>
            ) : (
              visibleQueueRows.map((row) => (
                <div
                  key={row.key}
                  className="flex items-center gap-2.5 px-4 py-2.5 border-t border-border first:border-t-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold text-ink-900 truncate">
                      {row.label}
                    </div>
                    <div className="text-[11.5px] text-ink-500 truncate">
                      {row.sub}
                    </div>
                  </div>
                  <div className="text-right flex-none">
                    <div
                      className={`font-mono text-[12.5px] font-semibold ${row.bad ? "text-status-danger" : "text-ink-900"}`}
                    >
                      {row.right}
                    </div>
                    {row.rightLabel && (
                      <div className="text-[9.5px] uppercase tracking-wide text-ink-500">
                        {row.rightLabel}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="bg-surface-paper border border-border rounded-xl overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="font-display tracking-tight text-[14.5px] font-bold text-ink-900">
                Coming up
              </h2>
            </div>
            {visibleUpRows.length === 0 ? (
              <div className="p-5 text-center text-[12.5px] text-ink-500">
                Nothing scheduled in the days ahead.
              </div>
            ) : (
              visibleUpRows.map((row) => (
                <div
                  key={row.key}
                  className="flex items-start gap-2.5 px-4 py-2.5 border-t border-border first:border-t-0"
                >
                  <span className="font-mono text-[11.5px] text-ink-700 font-medium w-14 flex-none pt-0.5">
                    {row.date}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-medium text-ink-900">
                      {row.title}
                    </div>
                    <div className="text-[11px] text-ink-500">{row.sub}</div>
                  </div>
                  <span
                    className={`text-[9.5px] font-bold rounded px-1.5 py-0.5 flex-none ${row.pillCls}`}
                  >
                    {row.pillLabel}
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="bg-surface-paper border border-border rounded-xl overflow-hidden shadow-sm">
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border">
              <h2 className="font-display tracking-tight text-[14.5px] font-bold text-ink-900">
                Latest activity
              </h2>
              <span className="flex-1" />
              <button
                type="button"
                onClick={() =>
                  router.push(`/hospital/${hospitalId}/settings/audit`)
                }
                className="text-[11.5px] font-semibold px-2.5 py-1.5 rounded-lg border border-border text-ink-700 hover:bg-surface-canvas"
              >
                Audit trail
              </button>
            </div>
            {activityEntries.length === 0 ? (
              <div className="p-5 text-center text-[12.5px] text-ink-500">
                No recent activity.
              </div>
            ) : (
              activityEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start gap-2.5 px-4 py-2.5 border-t border-border first:border-t-0"
                >
                  <span className="w-6 h-6 rounded-lg bg-brand-violet text-white text-[9.5px] font-bold grid place-items-center flex-none">
                    {entry.actorName
                      .split(" ")
                      .map((n) => n[0])
                      .filter(Boolean)
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1 text-[12px] text-ink-700 leading-snug">
                    <b className="text-ink-900 font-semibold">
                      {entry.actorName}
                    </b>{" "}
                    {entry.summary}
                  </div>
                  <span className="font-mono text-[10.5px] text-ink-500 flex-none whitespace-nowrap">
                    {format(new Date(entry.at), "h:mm a")}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Tile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: number | string;
  sub: string;
  tone?: "good" | "warning" | "bad";
}) {
  const valueCls =
    tone === "good"
      ? "text-status-open"
      : tone === "warning"
        ? "text-status-warning"
        : tone === "bad"
          ? "text-status-danger"
          : "text-ink-900";
  return (
    <div className="bg-surface-paper border border-border rounded-xl p-3.5">
      <div className="text-[10.5px] uppercase tracking-wide text-ink-500 font-bold">
        {label}
      </div>
      <div className={`font-mono text-2xl font-bold mt-0.5 ${valueCls}`}>
        {value}
      </div>
      <div className="text-[11.5px] text-ink-500">{sub}</div>
    </div>
  );
}

function Th({ children, right }: { children: ReactNode; right?: boolean }) {
  return (
    <th
      className={`px-4 py-2.5 text-[10.5px] uppercase tracking-wide text-ink-500 font-semibold whitespace-nowrap ${right ? "text-right" : "text-left"}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  right,
  className,
}: {
  children: ReactNode;
  right?: boolean;
  className?: string;
}) {
  return (
    <td
      className={`px-4 py-2.5 text-sm text-ink-900 font-mono whitespace-nowrap ${right ? "text-right" : ""} ${className || ""}`}
    >
      {children}
    </td>
  );
}
