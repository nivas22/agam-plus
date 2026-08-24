// components/appointments/SellPackageDialog.tsx
"use client";

import { format } from "date-fns";
import {
  AlertCircle,
  CreditCard,
  Loader2,
  Package as PackageIcon,
  RefreshCw,
  Smartphone,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  usePreviewPackageSchedule,
  useSellPackage,
} from "@/hooks/useNewPackageApi";
import type { Doctor } from "@/types/doctorNew";
import type {
  PackageFrequency,
  PackagePaymentMethod,
  PackageVisitPlan,
} from "@/types/package";
import type { Patient } from "@/types/patientNew";
import {
  computePackagePricePerVisit,
  PACKAGE_VALIDITY_MONTHS,
  PACKAGE_VISIT_TIERS,
} from "../../constants";
import {
  DialogShell,
  primaryBtn,
  secondaryBtn,
} from "./AppointmentActionDialogs";

interface SellPackageDialogProps {
  hospitalId: string;
  patient: Patient;
  doctors: Doctor[];
  initialDoctorId?: string;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

type FrequencyMode = "once" | "twice" | "thrice" | "every-3-days";

const FREQUENCY_OPTIONS: { value: FrequencyMode; label: string }[] = [
  { value: "once", label: "Once a week" },
  { value: "twice", label: "Twice a week" },
  { value: "thrice", label: "Three times a week" },
  { value: "every-3-days", label: "Every 3 days" },
];

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday-first, matching how staff think about a work week

function money(v: number): string {
  return `₹${Math.round(v).toLocaleString("en-IN")}`;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function formatTime12h(time: string): string {
  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours, 10);
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${period}`;
}

function dateLabel(dateStr: string): string {
  return format(new Date(`${dateStr}T00:00:00`), "EEE, d MMM");
}

function getInitials(name?: string): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Formats the LOCAL calendar date directly — `.toISOString()` converts to
// UTC first, which shifts the date a day back in timezones ahead of UTC (e.g. IST).
function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function SellPackageDialog({
  hospitalId,
  patient,
  doctors,
  initialDoctorId,
  onClose,
  onSuccess,
}: SellPackageDialogProps) {
  const bookableDoctors = doctors;
  const [doctorId, setDoctorId] = useState(
    initialDoctorId || bookableDoctors[0]?.id || "",
  );
  const [packageCount, setPackageCount] = useState<number>(
    PACKAGE_VISIT_TIERS[1] ?? 10,
  );
  const today = useMemo(() => toISODate(new Date()), []);
  const [startDate, setStartDate] = useState(today);
  const [preferredTime, setPreferredTime] = useState("");
  const [frequencyMode, setFrequencyMode] = useState<FrequencyMode>("twice");
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [bookNowMode, setBookNowMode] = useState<"first4" | "all" | "none">(
    "all",
  );
  const [paymentMethod, setPaymentMethod] =
    useState<PackagePaymentMethod>("upi");
  const [manualOverrides, setManualOverrides] = useState<
    Record<number, { date: string; time: string }>
  >({});
  const [openAlternatesFor, setOpenAlternatesFor] = useState<number | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const selectedDoctor = bookableDoctors.find((d) => d.id === doctorId) || null;
  const pricePerVisit = computePackagePricePerVisit(
    selectedDoctor?.consultationFee || 0,
  );
  const totalPrice = pricePerVisit * packageCount;
  const bookNowCount =
    bookNowMode === "first4"
      ? Math.min(4, packageCount)
      : bookNowMode === "all"
        ? packageCount
        : 0;

  const workingDaySet = useMemo(() => {
    const set = new Set<number>();
    (selectedDoctor?.availability || []).forEach((a) => {
      const idx = DAY_NAMES.indexOf(a.day);
      if (idx >= 0) set.add(idx);
    });
    return set;
  }, [selectedDoctor]);

  const timeOptions = useMemo(() => {
    const duration = selectedDoctor?.appointmentDuration || 30;
    const set = new Set<string>();
    (selectedDoctor?.availability || []).forEach((w) => {
      let cur = toMinutes(w.startTime);
      const end = toMinutes(w.endTime);
      while (cur + duration <= end) {
        set.add(
          `${String(Math.floor(cur / 60)).padStart(2, "0")}:${String(cur % 60).padStart(2, "0")}`,
        );
        cur += duration;
      }
    });
    return Array.from(set).sort();
  }, [selectedDoctor]);

  // Re-fit the default day selection whenever the doctor or frequency changes.
  useEffect(() => {
    const workingOrdered = DAY_ORDER.filter((d) => workingDaySet.has(d));
    const want =
      frequencyMode === "once"
        ? 1
        : frequencyMode === "twice"
          ? 2
          : frequencyMode === "thrice"
            ? 3
            : 0;
    if (want === 0) return;
    setSelectedDays(
      workingOrdered.length
        ? workingOrdered.slice(0, Math.min(want, workingOrdered.length))
        : [],
    );
  }, [workingDaySet, frequencyMode]);

  useEffect(() => {
    if (!timeOptions.length) return;
    if (!timeOptions.includes(preferredTime)) {
      setPreferredTime(timeOptions[Math.min(2, timeOptions.length - 1)]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeOptions]);

  const preview = usePreviewPackageSchedule(hospitalId);
  const sellPackage = useSellPackage(hospitalId);

  const scheduleKey = JSON.stringify({
    doctorId,
    startDate,
    preferredTime,
    frequencyMode,
    selectedDays,
    bookNowCount,
  });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setManualOverrides({});
    setOpenAlternatesFor(null);

    if (!doctorId || !startDate || !preferredTime || bookNowCount === 0) return;
    if (frequencyMode !== "every-3-days" && selectedDays.length === 0) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      preview.mutate({
        doctorProfileId: doctorId,
        startDate,
        preferredTime,
        frequency:
          frequencyMode === "every-3-days"
            ? "every-3-days"
            : ("weekly" as PackageFrequency),
        daysOfWeek: selectedDays,
        count: bookNowCount,
      });
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleKey]);

  const rerun = () => {
    setManualOverrides({});
    if (!doctorId || !startDate || !preferredTime || bookNowCount === 0) return;
    preview.mutate({
      doctorProfileId: doctorId,
      startDate,
      preferredTime,
      frequency:
        frequencyMode === "every-3-days"
          ? "every-3-days"
          : ("weekly" as PackageFrequency),
      daysOfWeek: selectedDays,
      count: bookNowCount,
    });
  };

  const effectiveVisits: PackageVisitPlan[] = (preview.data?.visits || []).map(
    (v) => {
      const override = manualOverrides[v.visitNumber];
      if (!override) return v;
      return {
        ...v,
        date: override.date,
        time: override.time,
        moved: false,
        reason: null,
      };
    },
  );

  const placed = effectiveVisits.filter((v) => !v.unplaced);
  const movedCount = placed.filter(
    (v) => v.moved && !manualOverrides[v.visitNumber],
  ).length;
  const lastVisit = placed.length ? placed[placed.length - 1] : null;
  const validUntilDate = useMemo(() => {
    const d = new Date(`${startDate}T00:00:00`);
    d.setMonth(d.getMonth() + PACKAGE_VALIDITY_MONTHS);
    return toISODate(d);
  }, [startDate]);
  const lastVisitOutsideValidity = !!(
    lastVisit?.date && lastVisit.date > validUntilDate
  );

  const pickAlternate = (visitNumber: number, date: string, time: string) => {
    setManualOverrides((cur) => ({ ...cur, [visitNumber]: { date, time } }));
    setOpenAlternatesFor(null);
  };

  const submit = async (bookVisits: boolean) => {
    if (!selectedDoctor) return;
    setError(null);
    try {
      const visits = bookVisits
        ? placed.map((v) => ({
            date: v.date as string,
            time: v.time as string,
          }))
        : [];
      const result = await sellPackage.mutateAsync({
        patientId: patient.id,
        doctorProfileId: doctorId,
        totalVisits: packageCount,
        pricePerVisit,
        paymentMethod,
        visits,
      });
      onSuccess(result.message);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to sell the package",
      );
    }
  };

  const submitting = sellPackage.isPending;
  const ctaLabel =
    bookNowMode === "none"
      ? `Collect ${money(totalPrice)} & activate`
      : `Collect ${money(totalPrice)} & book ${placed.length} visits`;

  return (
    <DialogShell
      icon={<PackageIcon className="w-4.5 h-4.5" />}
      iconTone="bg-brand-violet-soft text-brand-violet"
      title={`Sell prepaid package — ${patient.name}`}
      subtitle={patient.phone}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <button type="button" className={secondaryBtn} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={secondaryBtn}
            disabled={submitting}
            onClick={() => submit(false)}
          >
            Activate without booking
          </button>
          <button
            type="button"
            className={`${primaryBtn} bg-brand-violet hover:bg-brand-violet-hover disabled:opacity-60`}
            disabled={submitting || !selectedDoctor}
            onClick={() => submit(true)}
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin inline mr-1.5" />
            ) : null}
            {ctaLabel}
          </button>
        </>
      }
    >
      {error && (
        <div className="mx-5 mt-3 flex items-start gap-2 px-3.5 py-2.5 rounded-lg bg-status-danger-soft border border-status-danger/20 text-sm text-status-danger">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-[0.85fr_1.15fr] flex-1 overflow-y-auto">
        {/* doctor + package */}
        <div className="p-5 pt-4">
          <h4 className="text-sm font-semibold text-ink-900">Doctor</h4>
          <p className="text-[11.5px] text-ink-500 mb-2">
            Everything below depends on this — fee, price, and free slots.
          </p>
          <select
            value={doctorId}
            onChange={(e) => setDoctorId(e.target.value)}
            className="w-full h-10 px-3 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-brand-violet/20 focus:border-brand-violet"
          >
            {bookableDoctors.map((d) => (
              <option key={d.id} value={d.id}>
                Dr. {d.name} — {d.specialization} ·{" "}
                {money(d.consultationFee || 0)}
              </option>
            ))}
          </select>

          {selectedDoctor && (
            <div className="border border-border rounded-xl bg-surface-paper p-3 mt-2.5 flex gap-2.5">
              <div className="w-10 h-10 rounded-lg bg-brand-violet text-white flex items-center justify-center font-bold text-sm shrink-0">
                {getInitials(selectedDoctor.name)}
              </div>
              <div className="min-w-0">
                <div className="text-[13.5px] font-semibold text-ink-900">
                  Dr. {selectedDoctor.name}
                </div>
                <div className="text-[11.5px] text-ink-500">
                  {selectedDoctor.specialization}
                </div>
                <div className="font-mono text-xs text-ink-700 mt-1">
                  {money(selectedDoctor.consultationFee || 0)} per consultation
                </div>
                <div className="flex gap-1 mt-1.5">
                  {DAY_LABELS.map((label, idx) => (
                    <span
                      key={label}
                      className={`text-[9.5px] w-6 text-center py-0.5 rounded ${
                        workingDaySet.has(idx)
                          ? "bg-status-open-soft text-status-open font-semibold"
                          : "bg-surface-canvas text-ink-500"
                      }`}
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="mt-4">
            <h4 className="text-sm font-semibold text-ink-900">Package</h4>
            <p className="text-[11.5px] text-ink-500 mb-2">
              Priced from this doctor's consultation fee.
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {PACKAGE_VISIT_TIERS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPackageCount(n)}
                  aria-pressed={packageCount === n}
                  className={`text-left border rounded-lg px-2.5 py-2 ${
                    packageCount === n
                      ? "border-brand-violet bg-brand-violet-soft"
                      : "border-border bg-surface-paper"
                  }`}
                >
                  <div
                    className={`text-[11px] font-semibold ${packageCount === n ? "text-brand-violet" : "text-ink-500"}`}
                  >
                    {n} visits
                  </div>
                  <div
                    className={`font-mono text-lg font-bold ${packageCount === n ? "text-brand-violet" : "text-ink-900"}`}
                  >
                    {money(pricePerVisit * n)}
                  </div>
                  <div className="font-mono text-[10px] text-ink-500">
                    {money(pricePerVisit)} each
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 text-[12.5px]">
            <div className="flex justify-between border-t border-border py-1.5">
              <span className="text-ink-500">Usable with</span>
              <span className="font-medium">
                {selectedDoctor ? `Dr. ${selectedDoctor.name} only` : "—"}
              </span>
            </div>
            <div className="flex justify-between border-t border-border py-1.5">
              <span className="text-ink-500">Valid until</span>
              <span className="font-mono">{dateLabel(validUntilDate)}</span>
            </div>
            <div className="flex justify-between border-t border-border py-1.5">
              <span className="text-ink-500">Covers</span>
              <span className="font-medium">Consultation only</span>
            </div>
          </div>

          <div className="mt-4">
            <label className="text-xs font-semibold text-ink-700 mb-1.5 block">
              Paying now by
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { m: "cash" as const, icon: Wallet, label: "Cash" },
                { m: "upi" as const, icon: Smartphone, label: "UPI / GPay" },
                { m: "card" as const, icon: CreditCard, label: "Card" },
              ].map(({ m, icon: Icon, label }) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPaymentMethod(m)}
                  aria-pressed={paymentMethod === m}
                  className={`flex flex-col items-center gap-1 border rounded-lg py-2 text-xs font-medium ${
                    paymentMethod === m
                      ? "border-brand-violet bg-brand-violet-soft text-brand-violet"
                      : "border-border text-ink-700"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* scheduling */}
        <div className="p-5 pt-4 border-t md:border-t-0 md:border-l border-border bg-surface-canvas/30">
          <h4 className="text-sm font-semibold text-ink-900">
            Schedule the visits
          </h4>
          <p className="text-[11.5px] text-ink-500 mb-2.5">
            {selectedDoctor
              ? `Checked against Dr. ${selectedDoctor.name}'s hours and existing bookings.`
              : "Choose a doctor first."}
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-ink-700 mb-1 block">
                First visit
              </label>
              <input
                type="date"
                value={startDate}
                min={today}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full h-9 px-2.5 border border-border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-ink-700 mb-1 block">
                Preferred time
              </label>
              <select
                value={preferredTime}
                onChange={(e) => setPreferredTime(e.target.value)}
                className="w-full h-9 px-2.5 border border-border rounded-lg text-sm"
              >
                {timeOptions.map((t) => (
                  <option key={t} value={t}>
                    {formatTime12h(t)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-3">
            <label className="text-xs font-semibold text-ink-700 mb-1 block">
              How often
            </label>
            <select
              value={frequencyMode}
              onChange={(e) =>
                setFrequencyMode(e.target.value as FrequencyMode)
              }
              className="w-full h-9 px-2.5 border border-border rounded-lg text-sm"
            >
              {FREQUENCY_OPTIONS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>

            {frequencyMode !== "every-3-days" && (
              <div className="flex gap-1.5 mt-2">
                {DAY_ORDER.map((d) => {
                  const works = workingDaySet.has(d);
                  const isSelected = selectedDays.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      disabled={!works}
                      onClick={() =>
                        setSelectedDays((cur) =>
                          cur.includes(d)
                            ? cur.filter((x) => x !== d)
                            : [...cur, d],
                        )
                      }
                      aria-pressed={isSelected}
                      className={`w-10 py-1.5 rounded-lg text-xs border ${
                        !works
                          ? "opacity-40 cursor-not-allowed bg-surface-canvas border-border"
                          : isSelected
                            ? "border-brand-violet bg-brand-violet-soft text-brand-violet font-semibold"
                            : "border-border text-ink-700"
                      }`}
                    >
                      {DAY_LABELS[d]}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-3">
            <label className="text-xs font-semibold text-ink-700 mb-1.5 block">
              Book how many now?
            </label>
            <div className="flex flex-wrap gap-1.5">
              {[
                { v: "first4" as const, label: "First 4 only" },
                { v: "all" as const, label: "All of them" },
                { v: "none" as const, label: "None — leave as credits" },
              ].map((o) => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => setBookNowMode(o.v)}
                  aria-pressed={bookNowMode === o.v}
                  className={`px-3 py-1.5 rounded-lg text-xs border ${
                    bookNowMode === o.v
                      ? "border-brand-violet bg-brand-violet-soft text-brand-violet font-semibold"
                      : "border-border text-ink-700"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {bookNowCount === 0 ? (
            <div className="mt-4 py-6 text-center text-[12.5px] text-ink-500 border border-border rounded-xl bg-surface-paper">
              All {packageCount} visits stay as credits — the patient books them
              later.
            </div>
          ) : (
            <>
              <div className="mt-4 border border-border rounded-xl bg-surface-paper overflow-hidden">
                <div className="flex items-center gap-2 px-3.5 py-2.5 bg-surface-canvas/60 border-b border-border">
                  <span className="text-[11px] uppercase tracking-wide font-semibold text-ink-500">
                    Planned visits
                  </span>
                  <div className="flex-1" />
                  <button
                    type="button"
                    onClick={rerun}
                    disabled={preview.isPending}
                    className="text-xs text-brand-violet hover:underline flex items-center gap-1 disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`w-3 h-3 ${preview.isPending ? "animate-spin" : ""}`}
                    />
                    Re-run against availability
                  </button>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {preview.isPending && !preview.data ? (
                    <div className="py-8 text-center text-sm text-ink-500 flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> Checking
                      availability…
                    </div>
                  ) : (
                    effectiveVisits.map((v) => {
                      const isOpen = openAlternatesFor === v.visitNumber;
                      const overridden = !!manualOverrides[v.visitNumber];
                      const moved = !!v.moved && !overridden;
                      return (
                        <div
                          key={v.visitNumber}
                          className="border-t border-border first:border-t-0 px-3.5 py-2.5"
                        >
                          <div className="grid grid-cols-[24px_1fr_84px_60px] gap-2 items-center text-[13px]">
                            <span className="font-mono text-[11px] text-ink-500">
                              {v.visitNumber}
                            </span>
                            {v.unplaced ? (
                              <div>
                                <div className="font-medium text-ink-900">
                                  {dateLabel(v.plannedDate)}
                                </div>
                                <div className="text-[11px] text-status-danger">
                                  {v.reason}
                                </div>
                              </div>
                            ) : (
                              <div>
                                {moved && (
                                  <div className="text-[11px] text-ink-500 line-through font-mono">
                                    {dateLabel(v.plannedDate)}{" "}
                                    {formatTime12h(preferredTime)}
                                  </div>
                                )}
                                <div className="font-mono font-medium text-ink-900">
                                  {dateLabel(v.date as string)} ·{" "}
                                  {formatTime12h(v.time as string)}
                                </div>
                                {moved && v.reason && (
                                  <div className="text-[11px] text-status-warning">
                                    {v.reason}
                                  </div>
                                )}
                              </div>
                            )}
                            <span
                              className={`text-[10.5px] font-semibold rounded-md px-2 py-0.5 text-center ${
                                v.unplaced
                                  ? "bg-status-danger-soft text-status-danger"
                                  : moved
                                    ? "bg-status-warning-soft text-status-warning"
                                    : "bg-status-open-soft text-status-open"
                              }`}
                            >
                              {v.unplaced
                                ? "Not booked"
                                : moved
                                  ? "Moved"
                                  : "Confirmed"}
                            </span>
                            {!v.unplaced && v.alternates.length > 0 ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setOpenAlternatesFor(
                                    isOpen ? null : v.visitNumber,
                                  )
                                }
                                className="text-xs text-brand-violet hover:underline text-right"
                              >
                                Change
                              </button>
                            ) : (
                              <span />
                            )}
                          </div>
                          {isOpen && (
                            <div className="flex flex-wrap items-center gap-1.5 mt-2 pt-2 border-t border-dashed border-border">
                              <span className="text-[11px] text-ink-500">
                                Other free slots:
                              </span>
                              {v.alternates.map((a) => (
                                <button
                                  key={`${a.date}-${a.time}`}
                                  type="button"
                                  onClick={() =>
                                    pickAlternate(v.visitNumber, a.date, a.time)
                                  }
                                  className="font-mono text-xs border border-border rounded-md px-2 py-1 text-ink-700 hover:border-brand-violet hover:text-brand-violet"
                                >
                                  {dateLabel(a.date)} {formatTime12h(a.time)}
                                </button>
                              ))}
                              <button
                                type="button"
                                onClick={() => setOpenAlternatesFor(null)}
                                className="text-[11px] text-ink-500 underline"
                              >
                                keep as is
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {preview.data && (
                <div
                  className={`mt-2.5 flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-[12.5px] ${
                    lastVisitOutsideValidity ||
                    placed.length < effectiveVisits.length
                      ? "bg-status-warning-soft border border-status-warning/20 text-status-warning"
                      : "bg-status-open-soft border border-status-open/20 text-status-open"
                  }`}
                >
                  <span>
                    <b className="font-mono">{placed.length}</b> of{" "}
                    {bookNowCount} booked
                    {movedCount > 0 && (
                      <>
                        {" "}
                        · <b className="font-mono">{movedCount}</b> moved to fit
                      </>
                    )}
                  </span>
                  <span className="flex-1" />
                  {lastVisit?.date && (
                    <span>
                      Last visit{" "}
                      <b className="font-mono">{dateLabel(lastVisit.date)}</b>
                      {lastVisitOutsideValidity
                        ? " — after the package expires"
                        : " · inside validity"}
                    </span>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </DialogShell>
  );
}
