// components/settings/HospitalHolidaysPage.tsx
"use client";

import { AlertTriangle, Download, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  useApplyHolidayResolutions,
  useGenerateHolidayRepeats,
  useHospitalHolidays,
  useImportTnHolidayList,
  usePreviewHolidayImpact,
} from "@/hooks/useHospitalHolidaysApi";
import type { HospitalHoliday } from "@/types/hospitalHoliday";
import { getMonthWeeks } from "@/utils/dateUtils";
import HolidayImpactModal from "./HolidayImpactModal";
import HospitalHolidayDrawer from "./HospitalHolidayDrawer";

interface HospitalHolidaysPageProps {
  hospitalId: string;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const CLOSURE_PILL: Record<
  string,
  { label: string; cls: string; dot: string }
> = {
  full: {
    label: "Closed all day",
    cls: "bg-status-danger-soft text-status-danger",
    dot: "bg-status-danger",
  },
  opd_closed: {
    label: "OPD closed",
    cls: "bg-status-warning-soft text-status-warning",
    dot: "bg-status-warning",
  },
  half_day: {
    label: "Half day",
    cls: "bg-brand-violet-soft text-brand-violet",
    dot: "bg-brand-violet",
  },
};

function formatRange(startsOn: string, endsOn: string) {
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  const start = new Date(`${startsOn}T00:00:00`).toLocaleDateString(
    "en-IN",
    opts,
  );
  if (endsOn === startsOn) return start;
  const end = new Date(`${endsOn}T00:00:00`).toLocaleDateString("en-IN", opts);
  return `${start} – ${end}`;
}

function formatDateLabel(startsOn: string, endsOn: string) {
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" };
  const start = new Date(`${startsOn}T00:00:00`).toLocaleDateString(
    "en-IN",
    opts,
  );
  if (endsOn === startsOn) return start;
  const end = new Date(`${endsOn}T00:00:00`).toLocaleDateString("en-IN", opts);
  return `${start} – ${end}`;
}

export default function HospitalHolidaysPage({
  hospitalId,
}: HospitalHolidaysPageProps) {
  const nowYear = new Date().getFullYear();
  const [year, setYear] = useState(nowYear);
  const [drawerState, setDrawerState] = useState<
    HospitalHoliday | null | undefined
  >(undefined);
  const [reviewHoliday, setReviewHoliday] = useState<HospitalHoliday | null>(
    null,
  );

  const { data, isLoading } = useHospitalHolidays(year, hospitalId);
  const holidays = data?.holidays || [];
  const pendingRepeats = data?.pendingRepeats || [];

  const generateRepeats = useGenerateHolidayRepeats(hospitalId);
  const importTnList = useImportTnHolidayList(hospitalId);
  const reviewPreview = usePreviewHolidayImpact(hospitalId);
  const applyResolutions = useApplyHolidayResolutions(hospitalId);

  useEffect(() => {
    if (!reviewHoliday) return;
    reviewPreview.mutate({
      startsOn: reviewHoliday.startsOn,
      endsOn: reviewHoliday.endsOn,
      closureType: reviewHoliday.closureType,
      halfDayUntil: reviewHoliday.halfDayUntil,
      exceptionDoctorIds: reviewHoliday.exceptionDoctorIds,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewHoliday]);

  const holidaysNeedingReview = holidays.filter(
    (h) => !h.isPast && h.bookedCount > 0,
  );

  const dayColorMap = useMemo(() => {
    const map = new Map<string, { closureType: string; name: string }>();
    for (const h of holidays) {
      let cur = new Date(`${h.startsOn}T00:00:00`);
      const end = new Date(`${h.endsOn}T00:00:00`);
      while (cur <= end) {
        const iso = cur.toISOString().slice(0, 10);
        map.set(iso, { closureType: h.closureType, name: h.name });
        cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1);
      }
    }
    return map;
  }, [holidays]);

  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <div className="flex items-end gap-3.5 mb-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-ink-900 font-display tracking-tight">Hospital holidays</h1>
          <p className="text-sm text-ink-500 mt-0.5">
            Set once, applies to every doctor. Individual leave stays on each
            doctor&apos;s own schedule.
          </p>
        </div>
        <div className="flex-1" />
        <div className="flex bg-surface-paper border border-border rounded-lg p-0.5 gap-0.5">
          {[nowYear - 1, nowYear, nowYear + 1].map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => setYear(y)}
              className={`px-3.5 py-1.5 rounded-md text-xs font-mono font-semibold ${
                year === y ? "bg-brand-violet text-white" : "text-ink-700"
              }`}
            >
              {y}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => importTnList.mutate(year)}
          disabled={importTnList.isPending}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-border text-sm font-semibold text-ink-700 disabled:opacity-60"
        >
          <Download size={15} />
          Import Tamil Nadu list
        </button>
        <button
          type="button"
          onClick={() => setDrawerState(null)}
          className="flex items-center gap-1.5 bg-brand-violet hover:bg-brand-violet-hover text-white text-sm font-semibold rounded-lg px-4 py-2.5"
        >
          <Plus size={16} />
          Add holiday
        </button>
      </div>

      {pendingRepeats.length > 0 && (
        <div className="mb-3.5 flex items-center gap-2.5 bg-brand-violet-soft border border-brand-violet/30 rounded-lg p-3 text-sm text-brand-violet">
          <AlertTriangle size={16} className="flex-none" />
          <span>
            {pendingRepeats.length} repeating holiday
            {pendingRepeats.length === 1 ? "" : "s"} from {year - 1}{" "}
            haven&apos;t been added for {year} yet —{" "}
            {pendingRepeats.map((r) => r.name).join(", ")}.
          </span>
          <span className="flex-1" />
          <button
            type="button"
            onClick={() => generateRepeats.mutate(year)}
            disabled={generateRepeats.isPending}
            className="px-3 py-1.5 rounded-lg bg-brand-violet text-white text-xs font-semibold disabled:opacity-60"
          >
            Generate holidays for {year}
          </button>
        </div>
      )}

      {holidaysNeedingReview.map((h) => (
        <div
          key={h.id}
          className="mb-3.5 flex items-center gap-2.5 bg-status-warning-soft border border-status-warning/30 rounded-lg p-3 text-sm text-status-warning"
        >
          <AlertTriangle size={16} className="flex-none" />
          <span>
            <b>
              {formatRange(h.startsOn, h.endsOn)} — {h.name}
            </b>{" "}
            has {h.bookedCount} appointment
            {h.bookedCount === 1 ? "" : "s"} still booked against it.
          </span>
          <span className="flex-1" />
          <button
            type="button"
            onClick={() => setReviewHoliday(h)}
            className="px-3 py-1.5 rounded-lg bg-status-warning text-white text-xs font-semibold"
          >
            Review them
          </button>
        </div>
      ))}

      <div className="bg-surface-paper border border-border rounded-xl overflow-hidden mb-4">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-sm font-bold text-ink-900">{year}</span>
          <div className="flex items-center gap-3.5 text-xs text-ink-500">
            {Object.entries(CLOSURE_PILL).map(([key, v]) => (
              <span key={key} className="flex items-center gap-1.5">
                <span
                  className={`w-2.5 h-2.5 rounded-sm inline-block ${v.dot}`}
                />
                {v.label}
              </span>
            ))}
          </div>
        </div>
        <div className="p-4 grid grid-cols-6 gap-3">
          {MONTH_NAMES.map((monthName, monthIdx) => {
            const weeks = getMonthWeeks(year, monthIdx);
            return (
              <div
                key={monthName}
                className="border border-border rounded-lg p-2"
              >
                <div className="text-[11px] font-semibold text-center mb-1.5 text-ink-900">
                  {monthName}
                </div>
                <table className="w-full">
                  <thead>
                    <tr>
                      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                        (d) => (
                          <th
                            key={d}
                            className="text-[8px] uppercase text-ink-500 font-semibold pb-0.5"
                          >
                            {d[0]}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {weeks.map((week) => (
                      <tr key={week[0].dateString}>
                        {week.map((day) => {
                          const inMonth = day.date.getMonth() === monthIdx;
                          const holidayHit = inMonth
                            ? dayColorMap.get(day.dateString)
                            : undefined;
                          const pill = holidayHit
                            ? CLOSURE_PILL[holidayHit.closureType]
                            : null;
                          return (
                            <td
                              key={day.dateString}
                              className="text-center py-px"
                            >
                              {inMonth ? (
                                <span
                                  title={holidayHit?.name}
                                  className={`inline-grid place-items-center w-4 h-4 rounded text-[9px] font-mono ${
                                    pill
                                      ? `${pill.dot} text-white font-semibold`
                                      : "text-ink-700"
                                  } ${day.dateString === todayIso && !pill ? "ring-1 ring-brand-violet text-brand-violet font-bold" : ""}`}
                                >
                                  {day.dayNumber}
                                </span>
                              ) : (
                                <span className="inline-block w-4 h-4" />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-surface-paper border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-sm font-bold text-ink-900">
            Holidays this year
          </span>
          <span className="text-xs text-ink-500">
            {holidays.length} day{holidays.length === 1 ? "" : "s"} ·{" "}
            {holidays.filter((h) => !h.isPast).length} still to come
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <tbody>
              {!isLoading && holidays.length === 0 && (
                <tr>
                  <td className="px-4 py-8 text-center text-ink-500">
                    No holidays added for {year} yet.
                  </td>
                </tr>
              )}
              {holidays.map((h) => {
                const pill = CLOSURE_PILL[h.closureType];
                return (
                  <tr
                    key={h.id}
                    className={`border-t border-border first:border-t-0 ${h.isPast ? "text-ink-500" : ""}`}
                  >
                    <td className="px-4 py-3 font-mono text-xs whitespace-nowrap w-28">
                      {formatRange(h.startsOn, h.endsOn)}
                    </td>
                    <td
                      className="px-4 py-3 cursor-pointer"
                      onClick={() => setDrawerState(h)}
                    >
                      <span className="block font-semibold text-ink-900">
                        {h.name}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-md px-2 py-0.5 text-[10.5px] font-semibold ${pill.cls}`}
                      >
                        {pill.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block rounded-md px-2 py-0.5 text-[10.5px] font-semibold bg-surface-canvas text-ink-500">
                        {h.repeatsAnnually ? "Repeats yearly" : "Set each year"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      {h.isPast ? (
                        <span className="text-ink-500">Passed</span>
                      ) : h.bookedCount > 0 ? (
                        <button
                          type="button"
                          onClick={() => setReviewHoliday(h)}
                          className="text-status-danger font-semibold"
                        >
                          {h.bookedCount} booked
                        </button>
                      ) : (
                        <span className="text-ink-500">Nothing booked</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setDrawerState(h)}
                        className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-ink-700"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {drawerState !== undefined && (
        <HospitalHolidayDrawer
          hospitalId={hospitalId}
          holiday={drawerState ?? undefined}
          onClose={() => setDrawerState(undefined)}
        />
      )}

      {reviewHoliday && reviewPreview.data && (
        <HolidayImpactModal
          preview={reviewPreview.data}
          holidayLabel={formatDateLabel(
            reviewHoliday.startsOn,
            reviewHoliday.endsOn,
          )}
          isSubmitting={applyResolutions.isPending}
          onBack={() => setReviewHoliday(null)}
          onApply={(resolutions) => {
            applyResolutions.mutate(
              { holidayId: reviewHoliday.id, resolutions },
              { onSuccess: () => setReviewHoliday(null) },
            );
          }}
        />
      )}
    </div>
  );
}
