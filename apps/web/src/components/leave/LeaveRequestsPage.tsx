// components/leave/LeaveRequestsPage.tsx
"use client";

import { Check, Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useAvailableSlots } from "@/hooks/useAvailability";
import {
  useLeaveAffectedAppointments,
  useLeaveRequests,
  useNudgeLeaveRequest,
  useResolveLeaveRequest,
} from "@/hooks/useLeaveRequestsApi";
import type {
  LeaveAffectedAppointment,
  LeaveAppointmentResolution,
  LeaveRequest,
  LeaveRequestStatus,
} from "@/types/leaveRequest";
import ApplyForLeaveDialog from "./ApplyForLeaveDialog";

interface LeaveRequestsPageProps {
  hospitalId: string;
}

type StatusTab = LeaveRequestStatus | "all";
type AudienceFilter = "all" | "doctors" | "team";

const STATUS_TABS: { key: StatusTab; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "declined", label: "Declined" },
  { key: "all", label: "All" },
];

const AUDIENCE_FILTERS: { key: AudienceFilter; label: string }[] = [
  { key: "all", label: "Everyone" },
  { key: "doctors", label: "Doctors" },
  { key: "team", label: "Team" },
];

const ROLE_LABEL: Record<string, string> = {
  doctor: "Doctor",
  front_desk: "Front desk",
  nurse: "Nurse",
  accountant: "Accountant",
  admin: "Admin",
};

const STATUS_PILL: Record<LeaveRequestStatus, string> = {
  pending: "bg-status-warning-soft text-status-warning",
  approved: "bg-status-open-soft text-status-open",
  declined: "bg-status-danger-soft text-status-danger",
};

function formatRange(startDate: string, endDate: string) {
  const opts: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
  };
  const start = new Date(`${startDate}T00:00:00`).toLocaleDateString(
    "en-IN",
    opts,
  );
  if (endDate === startDate) return start;
  const end = new Date(`${endDate}T00:00:00`).toLocaleDateString("en-IN", opts);
  return `${start} – ${end}`;
}

function dayCount(startDate: string, endDate: string) {
  const ms =
    new Date(`${endDate}T00:00:00`).getTime() -
    new Date(`${startDate}T00:00:00`).getTime();
  return Math.round(ms / 86_400_000) + 1;
}

// Whether the requester practises — includes admins who also see patients.
// Older rows have no isDoctor, so fall back to the role (or to "doctor" for
// the oldest, from before staff could file leave).
function isFromDoctor(r: LeaveRequest) {
  const by = r.requestedBy;
  if (!by?.role) return true;
  return by.isDoctor ?? by.role === "doctor";
}

function isSameDay(iso: string | undefined, other: Date) {
  return !!iso && new Date(iso).toDateString() === other.toDateString();
}

export default function LeaveRequestsPage({
  hospitalId,
}: LeaveRequestsPageProps) {
  const { getCurrentHospitalRole, practisesAsDoctor } = useAuth();
  const role = getCurrentHospitalRole();
  const isAdmin = role === "admin";

  const [statusTab, setStatusTab] = useState<StatusTab>(
    isAdmin ? "pending" : "all",
  );
  const [audience, setAudience] = useState<AudienceFilter>("all");
  const [showApply, setShowApply] = useState(false);
  const [resolving, setResolving] = useState<{
    request: LeaveRequest;
    action: "approve" | "decline";
  } | null>(null);

  // Fetch everything once and filter client-side so the tab counts stay
  // accurate without a request per tab. Non-admins only get their own rows.
  const { data, isLoading } = useLeaveRequests(undefined, hospitalId);
  const nudge = useNudgeLeaveRequest(hospitalId);

  const byAudience = useMemo(() => {
    const all = data || [];
    if (!isAdmin || audience === "all") return all;
    return all.filter((r) =>
      audience === "doctors"
        ? isFromDoctor(r)
        : !isFromDoctor(r),
    );
  }, [data, audience, isAdmin]);

  const counts = useMemo(() => {
    const c: Record<StatusTab, number> = {
      pending: 0,
      approved: 0,
      declined: 0,
      all: byAudience.length,
    };
    for (const r of byAudience) c[r.status] += 1;
    return c;
  }, [byAudience]);

  const rows =
    statusTab === "all"
      ? byAudience
      : byAudience.filter((r) => r.status === statusTab);

  const today = new Date();

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div>
          <h1 className="font-display tracking-tight text-xl font-bold text-ink-900">
            {isAdmin ? "Leave requests" : "My leave"}
          </h1>
          <p className="text-sm text-ink-500 mt-0.5">
            {isAdmin
              ? "Review leave applied for by doctors and team members."
              : "Apply for leave and track whether it's been approved."}
          </p>
        </div>
        <span className="flex-1" />
        {!isAdmin && (
          <button
            type="button"
            onClick={() => setShowApply(true)}
            className="flex items-center gap-1.5 bg-brand-violet hover:bg-brand-violet-hover text-white text-sm font-semibold rounded-lg px-4 py-2.5"
          >
            <Plus size={16} />
            Apply for leave
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex gap-1 bg-surface-canvas border border-border rounded-lg p-1">
          {STATUS_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setStatusTab(t.key)}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold ${
                statusTab === t.key
                  ? "bg-brand-violet text-white"
                  : "text-ink-700"
              }`}
            >
              {t.label}
              <span className="ml-1.5 opacity-80">{counts[t.key]}</span>
            </button>
          ))}
        </div>
        {isAdmin && (
          <div className="flex gap-1 bg-surface-canvas border border-border rounded-lg p-1">
            {AUDIENCE_FILTERS.map((a) => (
              <button
                key={a.key}
                type="button"
                onClick={() => setAudience(a.key)}
                className={`px-3.5 py-1.5 rounded-md text-xs font-semibold ${
                  audience === a.key
                    ? "bg-surface-paper text-ink-900 shadow-sm"
                    : "text-ink-500"
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="bg-surface-paper border border-border rounded-xl overflow-x-auto">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-ink-500">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-ink-500">
            No {statusTab === "all" ? "" : `${statusTab} `}leave requests.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-ink-500 border-b border-border">
                {isAdmin && <th className="px-4 py-3 font-semibold">Who</th>}
                <th className="px-4 py-3 font-semibold">Dates</th>
                <th className="px-4 py-3 font-semibold">Reason</th>
                <th className="px-4 py-3 font-semibold">Appointments</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">
                  {isAdmin ? "Action" : ""}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const requesterRole = r.requestedBy?.role;
                const days = dayCount(r.startDate, r.endDate);
                return (
                  <tr
                    key={r.id}
                    className="border-b border-border last:border-0 align-top"
                  >
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <div className="font-semibold text-ink-900">
                          {r.requestedBy?.name || r.doctorName || "—"}
                        </div>
                        <div className="text-xs text-ink-500">
                          {ROLE_LABEL[requesterRole] || requesterRole}
                        </div>
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="text-ink-900">
                        {formatRange(r.startDate, r.endDate)}
                      </div>
                      <div className="text-xs text-ink-500">
                        {days} day{days === 1 ? "" : "s"} · requested{" "}
                        {new Date(r.requestedAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink-700 max-w-xs">
                      {r.reason || <span className="text-ink-500">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {requesterRole === "doctor" ? (
                        <span
                          className={
                            r.affectedAppointmentCount > 0
                              ? "text-status-warning font-semibold"
                              : "text-ink-500"
                          }
                        >
                          {r.affectedAppointmentCount}
                        </span>
                      ) : (
                        <span className="text-ink-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-md text-xs font-semibold capitalize ${STATUS_PILL[r.status]}`}
                      >
                        {r.status}
                      </span>
                      {r.resolvedBy && (
                        <div className="text-xs text-ink-500 mt-1">
                          by {r.resolvedBy.name}
                          {r.resolutionNote ? ` — “${r.resolutionNote}”` : ""}
                        </div>
                      )}
                      {!!r.appointmentResolutions?.length && (
                        <div
                          className="text-xs text-ink-500 mt-1"
                          title={r.appointmentResolutions
                            .map((m) =>
                              m.action === "reassign"
                                ? `${m.patientName ?? "Patient"} → ${m.to.doctorName}`
                                : `${m.patientName ?? "Patient"} → ${m.to.date} ${m.to.time}`,
                            )
                            .join("\n")}
                        >
                          {r.appointmentResolutions.length} appointment
                          {r.appointmentResolutions.length === 1 ? "" : "s"}{" "}
                          moved
                        </div>
                      )}
                      {r.status === "pending" && r.lastNudgedAt && (
                        <div className="text-xs text-ink-500 mt-1">
                          Nudged{" "}
                          {new Date(r.lastNudgedAt).toLocaleDateString(
                            "en-IN",
                            { day: "numeric", month: "short" },
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {r.status === "pending" && isAdmin && (
                        <span className="inline-flex gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setResolving({ request: r, action: "decline" })
                            }
                            className="inline-flex items-center gap-1 h-8 px-3 rounded-lg border border-border text-xs font-semibold text-status-danger hover:bg-status-danger-soft"
                          >
                            <X size={14} />
                            Decline
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setResolving({ request: r, action: "approve" })
                            }
                            className="inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-brand-violet hover:bg-brand-violet-hover text-white text-xs font-semibold"
                          >
                            <Check size={14} />
                            Approve
                          </button>
                        </span>
                      )}
                      {r.status === "pending" && !isAdmin && (
                        <button
                          type="button"
                          disabled={
                            nudge.isPending || isSameDay(r.lastNudgedAt, today)
                          }
                          onClick={() => nudge.mutate(r.id)}
                          className="h-8 px-3 rounded-lg border border-border text-xs font-semibold text-ink-700 hover:bg-surface-canvas disabled:opacity-50"
                        >
                          Nudge admin
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showApply && (
        <ApplyForLeaveDialog
          hospitalId={hospitalId}
          showImpact={practisesAsDoctor}
          onClose={() => setShowApply(false)}
        />
      )}

      {resolving && (
        <ResolveLeaveDialog
          hospitalId={hospitalId}
          request={resolving.request}
          action={resolving.action}
          onClose={() => setResolving(null)}
        />
      )}
    </div>
  );
}

// What the admin picked for one affected appointment. Nothing is chosen by
// default — approval stays blocked until every row has a complete choice.
type RowChoice =
  | { action: "reassign"; doctorProfileId: string }
  | { action: "reschedule"; date: string; time: string };

function choiceToResolution(
  appointmentId: string,
  choice: RowChoice | undefined,
  leave: { startDate: string; endDate: string },
): LeaveAppointmentResolution | null {
  if (!choice) return null;
  if (choice.action === "reassign") {
    return choice.doctorProfileId
      ? {
          appointmentId,
          action: "reassign",
          newDoctorProfileId: choice.doctorProfileId,
        }
      : null;
  }
  const insideLeave =
    choice.date >= leave.startDate && choice.date <= leave.endDate;
  return choice.date && choice.time && !insideLeave
    ? {
        appointmentId,
        action: "reschedule",
        newDate: choice.date,
        newTime: choice.time,
      }
    : null;
}

function ResolveLeaveDialog({
  hospitalId,
  request,
  action,
  onClose,
}: {
  hospitalId: string;
  request: LeaveRequest;
  action: "approve" | "decline";
  onClose: () => void;
}) {
  const [note, setNote] = useState("");
  const [choices, setChoices] = useState<Record<string, RowChoice>>({});
  const resolve = useResolveLeaveRequest(hospitalId);
  const name = request.requestedBy?.name || request.doctorName || "this";
  const isApprove = action === "approve";
  const needsAppointmentCheck =
    isApprove && isFromDoctor(request);

  const affected = useLeaveAffectedAppointments(
    needsAppointmentCheck ? request.id : undefined,
    hospitalId,
  );
  const appointments = affected.data?.appointments || [];

  const resolutions = appointments.map((a) =>
    choiceToResolution(a.appointmentId, choices[a.appointmentId], request),
  );
  const unresolvedCount = resolutions.filter((r) => !r).length;
  const loadingAppointments = needsAppointmentCheck && affected.isLoading;
  const canSubmit =
    !resolve.isPending &&
    !loadingAppointments &&
    !affected.isError &&
    unresolvedCount === 0;

  const setChoice = (appointmentId: string, choice: RowChoice) =>
    setChoices((prev) => ({ ...prev, [appointmentId]: choice }));

  const applySuggestedToAll = () =>
    setChoices((prev) => {
      const next = { ...prev };
      for (const a of appointments) {
        if (next[a.appointmentId]) continue;
        if (a.suggestedSlot) {
          next[a.appointmentId] = { action: "reschedule", ...a.suggestedSlot };
        } else if (a.alternativeDoctors[0]) {
          next[a.appointmentId] = {
            action: "reassign",
            doctorProfileId: a.alternativeDoctors[0].doctorProfileId,
          };
        }
      }
      return next;
    });

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div
        className={`bg-surface-paper rounded-xl border border-border w-full max-h-[90vh] flex flex-col ${
          appointments.length > 0 ? "max-w-3xl" : "max-w-md"
        }`}
      >
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-display tracking-tight text-base font-bold text-ink-900">
            {isApprove ? "Approve" : "Decline"} leave
          </h3>
          <p className="text-sm text-ink-500 mt-0.5">
            {name} · {formatRange(request.startDate, request.endDate)}
          </p>
        </div>
        <div className="p-5 space-y-3 overflow-y-auto">
          {loadingAppointments && (
            <div className="text-sm text-ink-500">
              Checking booked appointments…
            </div>
          )}
          {affected.isError && (
            <div className="rounded-lg bg-status-danger-soft border border-status-danger/30 text-status-danger text-sm px-3 py-2">
              Couldn&apos;t load the doctor&apos;s appointments for these
              dates. Close and try again.
            </div>
          )}

          {appointments.length > 0 && (
            <>
              <div className="flex flex-wrap items-center gap-2 rounded-lg bg-status-warning-soft border border-status-warning/30 text-status-warning text-sm px-3 py-2">
                <span>
                  <b>
                    {appointments.length} appointment
                    {appointments.length === 1 ? " is" : "s are"} booked
                  </b>{" "}
                  during this leave. Give each one to another doctor or
                  reschedule it before approving.
                </span>
                <span className="flex-1" />
                <button
                  type="button"
                  onClick={applySuggestedToAll}
                  className="px-3 py-1.5 rounded-lg bg-status-warning text-white text-xs font-semibold"
                >
                  Use suggestions for the rest
                </button>
              </div>
              <div className="border border-border rounded-lg divide-y divide-border">
                {appointments.map((a) => (
                  <AffectedAppointmentRow
                    key={a.appointmentId}
                    hospitalId={hospitalId}
                    doctorProfileId={request.doctorProfileId}
                    leaveStart={request.startDate}
                    leaveEnd={request.endDate}
                    appointment={a}
                    choice={choices[a.appointmentId]}
                    onChange={(c) => setChoice(a.appointmentId, c)}
                  />
                ))}
              </div>
            </>
          )}

          <label className="block text-xs font-semibold text-ink-500">
            Note (optional)
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="mt-1 w-full px-3 py-2 border border-border rounded-lg text-sm"
            />
          </label>
          {resolve.isError && (
            <div className="rounded-lg bg-status-danger-soft border border-status-danger/30 text-status-danger text-sm px-3 py-2">
              {(resolve.error as Error)?.message || "Something went wrong."}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 px-5 py-4 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-lg border border-border text-sm font-medium text-ink-700 hover:bg-surface-canvas"
          >
            Cancel
          </button>
          <span className="flex-1" />
          {unresolvedCount > 0 && (
            <span className="text-xs text-ink-500">
              {unresolvedCount} still to sort out
            </span>
          )}
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() =>
              resolve.mutate(
                {
                  leaveRequestId: request.id,
                  action,
                  note: note.trim() || undefined,
                  resolutions: isApprove
                    ? (resolutions as LeaveAppointmentResolution[])
                    : undefined,
                },
                {
                  onSuccess: onClose,
                  // A slot may have filled up since the list loaded.
                  onError: () => affected.refetch(),
                },
              )
            }
            className={`h-9 px-4 rounded-lg text-white text-sm font-semibold disabled:opacity-50 ${
              isApprove
                ? "bg-brand-violet hover:bg-brand-violet-hover"
                : "bg-status-danger hover:opacity-90"
            }`}
          >
            {isApprove
              ? appointments.length > 0
                ? `Move ${appointments.length} & approve`
                : "Approve"
              : "Decline"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AffectedAppointmentRow({
  hospitalId,
  doctorProfileId,
  leaveStart,
  leaveEnd,
  appointment,
  choice,
  onChange,
}: {
  hospitalId: string;
  doctorProfileId: string;
  leaveStart: string;
  leaveEnd: string;
  appointment: LeaveAffectedAppointment;
  choice: RowChoice | undefined;
  onChange: (choice: RowChoice) => void;
}) {
  const rescheduleDate = choice?.action === "reschedule" ? choice.date : "";
  const { data: slotData, isFetching: slotsLoading } = useAvailableSlots(
    hospitalId,
    doctorProfileId,
    rescheduleDate,
  );
  const dateInsideLeave =
    !!rescheduleDate &&
    rescheduleDate >= leaveStart &&
    rescheduleDate <= leaveEnd;
  const slotTimes = dateInsideLeave
    ? []
    : (slotData?.availableSlots || []).map((s) => s.time);
  const noAlternatives = appointment.alternativeDoctors.length === 0;

  const pillClass = (active: boolean) =>
    `px-3 py-1.5 rounded-md text-xs font-semibold border disabled:opacity-40 ${
      active
        ? "bg-brand-violet text-white border-brand-violet"
        : "border-border text-ink-700 hover:bg-surface-canvas"
    }`;

  return (
    <div className="p-3 flex flex-wrap items-start gap-3">
      <div className="min-w-[180px] flex-1">
        <div className="font-semibold text-sm text-ink-900">
          {appointment.patientName || "Patient"}
        </div>
        <div className="text-xs text-ink-500">
          {formatRange(appointment.date, appointment.date)} ·{" "}
          {appointment.time}
          {appointment.patientPhone ? ` · ${appointment.patientPhone}` : ""}
        </div>
      </div>

      <div className="flex flex-col gap-2 min-w-[300px]">
        <div className="flex gap-1.5">
          <button
            type="button"
            disabled={noAlternatives}
            title={
              noAlternatives
                ? "No other doctor is free at this time"
                : undefined
            }
            onClick={() =>
              onChange({
                action: "reassign",
                doctorProfileId:
                  appointment.alternativeDoctors[0]?.doctorProfileId || "",
              })
            }
            className={pillClass(choice?.action === "reassign")}
          >
            Change doctor
          </button>
          <button
            type="button"
            onClick={() =>
              onChange({
                action: "reschedule",
                date: appointment.suggestedSlot?.date || "",
                time: appointment.suggestedSlot?.time || "",
              })
            }
            className={pillClass(choice?.action === "reschedule")}
          >
            Reschedule
          </button>
        </div>

        {choice?.action === "reassign" && (
          <select
            value={choice.doctorProfileId}
            onChange={(e) =>
              onChange({ action: "reassign", doctorProfileId: e.target.value })
            }
            className="px-3 py-2 border border-border rounded-lg text-sm bg-surface-paper"
          >
            {appointment.alternativeDoctors.map((d) => (
              <option key={d.doctorProfileId} value={d.doctorProfileId}>
                {d.name} — free at {appointment.time}
              </option>
            ))}
          </select>
        )}

        {choice?.action === "reschedule" && (
          <div className="flex flex-wrap gap-2 items-center">
            <input
              type="date"
              value={choice.date}
              min={toLocalIso(new Date())}
              onChange={(e) =>
                onChange({
                  action: "reschedule",
                  date: e.target.value,
                  time: "",
                })
              }
              className="px-3 py-2 border border-border rounded-lg text-sm"
            />
            <select
              value={choice.time}
              disabled={!choice.date || slotsLoading}
              onChange={(e) =>
                onChange({
                  action: "reschedule",
                  date: choice.date,
                  time: e.target.value,
                })
              }
              className="px-3 py-2 border border-border rounded-lg text-sm bg-surface-paper disabled:opacity-50"
            >
              <option value="">
                {slotsLoading ? "Loading…" : "Pick a time"}
              </option>
              {/* Keep the suggested time selectable even before the slot list loads. */}
              {choice.time && !slotTimes.includes(choice.time) && (
                <option value={choice.time}>{choice.time}</option>
              )}
              {slotTimes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            {dateInsideLeave && (
              <span className="text-xs text-status-danger">
                That date is inside the leave
              </span>
            )}
            {!dateInsideLeave &&
              !!choice.date &&
              !slotsLoading &&
              slotTimes.length === 0 && (
                <span className="text-xs text-status-danger">
                  No free slots that day
                </span>
              )}
          </div>
        )}

        {!choice && (
          <span className="text-xs text-status-warning">
            {appointment.suggestedSlot
              ? `Suggested: ${formatRange(appointment.suggestedSlot.date, appointment.suggestedSlot.date)} ${appointment.suggestedSlot.time}`
              : noAlternatives
                ? "No open slot in the next 4 weeks — pick a date"
                : "Choose an option"}
          </span>
        )}
      </div>
    </div>
  );
}

function toLocalIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
