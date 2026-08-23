// components/queue/DoctorPresenceMenu.tsx
"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatTime12h } from "./queueBoard";

interface DoctorPresenceMenuProps {
  label: string;
  tone: "in" | "expected" | "late" | "notIn";
  canEdit: boolean;
  now: Date;
  onMarkHere: () => void;
  onMarkRunningLate: (expectedTime: string) => void;
  onMarkOnBreak: (returnTime: string) => void;
  onOpenNotComing: () => void;
  onLeftForDay: () => void;
}

const TONE_CLS: Record<DoctorPresenceMenuProps["tone"], string> = {
  in: "bg-status-open-soft border-status-open/30 text-status-open",
  expected:
    "bg-status-warning-soft border-status-warning/30 text-status-warning",
  late: "bg-status-warning-soft border-status-warning/30 text-status-warning",
  notIn: "bg-status-danger-soft border-status-danger/30 text-status-danger",
};

function roundedTimeOptions(now: Date): string[] {
  const base = new Date(now);
  base.setSeconds(0, 0);
  base.setMinutes(Math.ceil(base.getMinutes() / 30) * 30);
  return [0, 30, 60, 90].map((offset) => {
    const d = new Date(base.getTime() + offset * 60000);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  });
}

// Common afternoon/evening return slots for a doctor stepping out after
// their morning session — later in the day than "running late" cares about,
// so a fixed clock-hour list reads better than an offset from now. Only
// hours still ahead of now are offered.
function laterTimeOptions(now: Date): string[] {
  const nowMins = now.getHours() * 60 + now.getMinutes();
  return ["13:00", "14:00", "16:00", "18:00"].filter((t) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m > nowMins;
  });
}

export default function DoctorPresenceMenu({
  label,
  tone,
  canEdit,
  now,
  onMarkHere,
  onMarkRunningLate,
  onMarkOnBreak,
  onOpenNotComing,
  onLeftForDay,
}: DoctorPresenceMenuProps) {
  const [open, setOpen] = useState(false);
  const [pickingTime, setPickingTime] = useState(false);
  const [customTime, setCustomTime] = useState("");
  const [pickingBreakTime, setPickingBreakTime] = useState(false);
  const [customBreakTime, setCustomBreakTime] = useState("");
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        !btnRef.current?.contains(target) &&
        !popRef.current?.contains(target)
      ) {
        setOpen(false);
        setPickingTime(false);
      }
    };
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [open]);

  const toggle = () => {
    if (!canEdit) return;
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const width = 320;
      setPos({
        top: r.bottom + 6,
        left: Math.min(
          Math.max(8, r.right - width),
          window.innerWidth - width - 8,
        ),
      });
    }
    setOpen((o) => !o);
    setPickingTime(false);
    setPickingBreakTime(false);
  };

  const close = () => {
    setOpen(false);
    setPickingTime(false);
    setPickingBreakTime(false);
  };

  const timeOptions = roundedTimeOptions(now);
  const breakTimeOptions = laterTimeOptions(now);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        disabled={!canEdit}
        className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-1 rounded-md whitespace-nowrap border ${TONE_CLS[tone]} ${canEdit ? "" : "cursor-default"}`}
      >
        {label}
        {canEdit && <ChevronDown size={12} className="opacity-70" />}
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popRef}
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              width: 320,
            }}
            className="z-[70] bg-surface-paper border border-border rounded-xl shadow-2xl overflow-hidden"
          >
            <div className="px-3.5 py-2.5 bg-surface-canvas/60 border-b border-border text-[10.5px] font-bold uppercase tracking-wide text-ink-500">
              Where is the doctor?
            </div>

            <button
              type="button"
              onClick={() => {
                onMarkHere();
                close();
              }}
              className="w-full flex items-start gap-2.5 px-3.5 py-2.5 border-t border-border text-left hover:bg-surface-canvas/60"
            >
              <span className="w-2 h-2 rounded-full bg-status-open mt-1.5 shrink-0" />
              <span>
                <span className="block text-sm font-semibold text-ink-900">
                  He&apos;s here
                </span>
                <span className="block text-xs text-ink-500 mt-0.5">
                  Starts the clock, waiting patients go in
                </span>
              </span>
            </button>

            <div className="border-t border-border">
              <button
                type="button"
                onClick={() => setPickingTime((p) => !p)}
                className="w-full flex items-start gap-2.5 px-3.5 py-2.5 text-left hover:bg-surface-canvas/60"
              >
                <span className="w-2 h-2 rounded-full bg-status-warning mt-1.5 shrink-0" />
                <span>
                  <span className="block text-sm font-semibold text-ink-900">
                    Running late
                  </span>
                  <span className="block text-xs text-ink-500 mt-0.5">
                    Tell the waiting patients when to expect them
                  </span>
                </span>
              </button>
              {pickingTime && (
                <div className="px-3.5 pb-3 flex flex-wrap gap-1.5">
                  {timeOptions.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        onMarkRunningLate(t);
                        close();
                      }}
                      className="border border-border rounded-lg px-2.5 py-1.5 font-mono text-xs text-ink-700 hover:border-brand-violet hover:text-brand-violet"
                    >
                      {formatTime12h(t)}
                    </button>
                  ))}
                  <div className="flex items-center gap-1.5">
                    <input
                      type="time"
                      value={customTime}
                      onChange={(e) => setCustomTime(e.target.value)}
                      className="border border-border rounded-lg px-2 py-1.5 text-xs font-mono"
                    />
                    <button
                      type="button"
                      disabled={!customTime}
                      onClick={() => {
                        onMarkRunningLate(customTime);
                        close();
                      }}
                      className="border border-border rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink-700 hover:bg-surface-canvas disabled:opacity-50"
                    >
                      Set
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-border">
              <button
                type="button"
                onClick={() => setPickingBreakTime((p) => !p)}
                className="w-full flex items-start gap-2.5 px-3.5 py-2.5 text-left hover:bg-surface-canvas/60"
              >
                <span className="w-2 h-2 rounded-full bg-status-warning mt-1.5 shrink-0" />
                <span>
                  <span className="block text-sm font-semibold text-ink-900">
                    Morning session done
                  </span>
                  <span className="block text-xs text-ink-500 mt-0.5">
                    Stepping out, back later today — evening bookings stay as
                    they are
                  </span>
                </span>
              </button>
              {pickingBreakTime && (
                <div className="px-3.5 pb-3 flex flex-wrap gap-1.5">
                  {breakTimeOptions.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        onMarkOnBreak(t);
                        close();
                      }}
                      className="border border-border rounded-lg px-2.5 py-1.5 font-mono text-xs text-ink-700 hover:border-brand-violet hover:text-brand-violet"
                    >
                      {formatTime12h(t)}
                    </button>
                  ))}
                  <div className="flex items-center gap-1.5">
                    <input
                      type="time"
                      value={customBreakTime}
                      onChange={(e) => setCustomBreakTime(e.target.value)}
                      className="border border-border rounded-lg px-2 py-1.5 text-xs font-mono"
                    />
                    <button
                      type="button"
                      disabled={!customBreakTime}
                      onClick={() => {
                        onMarkOnBreak(customBreakTime);
                        close();
                      }}
                      className="border border-border rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink-700 hover:bg-surface-canvas disabled:opacity-50"
                    >
                      Set
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                onOpenNotComing();
                close();
              }}
              className="w-full flex items-start gap-2.5 px-3.5 py-2.5 border-t border-border text-left hover:bg-surface-canvas/60"
            >
              <span className="w-2 h-2 rounded-full bg-status-danger mt-1.5 shrink-0" />
              <span>
                <span className="block text-sm font-semibold text-status-danger">
                  Not coming today
                </span>
                <span className="block text-xs text-ink-500 mt-0.5">
                  Decide what happens to today&apos;s remaining bookings
                </span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                onLeftForDay();
                close();
              }}
              className="w-full flex items-start gap-2.5 px-3.5 py-2.5 border-t border-border text-left hover:bg-surface-canvas/60"
            >
              <span className="w-2 h-2 rounded-full bg-ink-500 mt-1.5 shrink-0" />
              <span>
                <span className="block text-sm font-semibold text-ink-900">
                  Left for the day
                </span>
                <span className="block text-xs text-ink-500 mt-0.5">
                  Use when they finish early
                </span>
              </span>
            </button>

            <div className="px-3.5 py-2.5 bg-surface-canvas/60 border-t border-border text-[11px] text-ink-500 leading-snug">
              Saved on this device for today — clears automatically tomorrow. A
              different front-desk computer won&apos;t see it until there&apos;s
              a shared presence record.
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
