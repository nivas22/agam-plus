// components/appointments/FollowUpBookingCard.tsx
"use client";

import { CalendarPlus } from "lucide-react";
import { useAvailableSlots } from "@/hooks/useAvailability";
import { FOLLOW_UP_OPTIONS } from "../../constants";

export interface FollowUpBookingValue {
  enabled: boolean;
  date: string;
  time: string;
}

function formatDay(iso: string) {
  if (!iso) return "";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

// The follow-up the doctor asked for at finish-session, offered for booking
// while payment is collected. Optional — leaving it unticked books nothing.
export default function FollowUpBookingCard({
  hospitalId,
  doctorId,
  followUpOption,
  dueDate,
  value,
  onChange,
  disabled,
}: {
  hospitalId: string;
  doctorId: string;
  followUpOption: string;
  dueDate: string;
  value: FollowUpBookingValue;
  onChange: (value: FollowUpBookingValue) => void;
  disabled?: boolean;
}) {
  const { data: slotData, isFetching: slotsLoading } = useAvailableSlots(
    hospitalId,
    doctorId,
    value.enabled ? value.date : "",
  );
  const slots = slotData?.availableSlots || [];
  const optionLabel =
    FOLLOW_UP_OPTIONS.find((o) => o.value === followUpOption)?.label ??
    "Follow-up";

  return (
    <div className="mt-4 border border-border rounded-xl bg-surface-paper">
      <label className="flex items-start gap-2.5 px-3.5 py-3 cursor-pointer">
        <input
          type="checkbox"
          checked={value.enabled}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, enabled: e.target.checked })}
          className="mt-0.5 w-3.5 h-3.5 rounded border-border text-brand-violet focus:ring-2 focus:ring-brand-violet/30"
        />
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-ink-900">
            <CalendarPlus size={15} className="text-brand-violet" />
            Book follow-up
            <span className="text-[11px] font-medium text-ink-500">
              (optional)
            </span>
          </span>
          <span className="block text-[11.5px] text-ink-500 mt-0.5">
            Doctor asked for a review {optionLabel.toLowerCase()} —{" "}
            {formatDay(dueDate)}
          </span>
        </span>
      </label>

      {value.enabled && (
        <div className="px-3.5 pb-3.5 border-t border-border pt-3">
          <label className="text-[11.5px] font-semibold text-ink-700 block mb-1">
            Date
          </label>
          <input
            type="date"
            value={value.date}
            disabled={disabled}
            onChange={(e) =>
              onChange({ ...value, date: e.target.value, time: "" })
            }
            className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface-paper"
          />

          <div className="text-[11.5px] font-semibold text-ink-700 mt-3 mb-1.5">
            Time
          </div>
          {slotsLoading ? (
            <div className="text-xs text-ink-500">Loading slots…</div>
          ) : slots.length === 0 ? (
            <div className="text-xs text-status-warning">
              No free slots on this day — pick another date.
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {slots.map((s) => (
                <button
                  key={s.time}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange({ ...value, time: s.time })}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${
                    value.time === s.time
                      ? "bg-brand-violet text-white border-brand-violet"
                      : "border-border text-ink-700 hover:bg-surface-canvas"
                  }`}
                >
                  {s.time}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
