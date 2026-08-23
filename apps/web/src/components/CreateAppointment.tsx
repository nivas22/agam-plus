// components/CreateAppointment.tsx
"use client";

import { format } from "date-fns";
import {
  AlertCircle,
  ArrowLeft,
  CalendarCheck,
  CheckCircle2,
  ChevronDown,
  Info,
  Loader2,
  Package as PackageIcon,
  Search,
} from "lucide-react";
import { DateTime } from "luxon";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import SellPackageDialog from "@/components/appointments/SellPackageDialog";
import { Field, inputClass } from "@/components/common/EditFormControls";
import { useAuth } from "@/hooks/useAuth";
import { useDoctorSlots } from "@/hooks/useDoctorSlots";
import { useHospitalAppointmentsApi } from "@/hooks/useNewAppointmentsApi";
import { useHospitalDoctors } from "@/hooks/useNewDoctorApi";
import { useHospitalPatients } from "@/hooks/useNewPatientApi";
import { paletteFor } from "@/lib/avatarPalette";
import type { TimeSlot } from "@/types/appointment";
import type { Doctor } from "@/types/doctorNew";
import type { Patient } from "@/types/patientNew";

interface CreateAppointmentProps {
  canEdit: boolean;
  userRole: string;
  hospitalId: string;
}

const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const DAY_ORDER = Object.fromEntries(DAYS_OF_WEEK.map((d, i) => [d, i]));

const FREQUENCIES: {
  value: "once" | "weekly" | "monthly";
  label: string;
  hint: string;
}[] = [
  { value: "once", label: "Just once", hint: "A single visit" },
  { value: "weekly", label: "Weekly", hint: "Same days each week" },
  { value: "monthly", label: "Monthly", hint: "Same date each month" },
];

interface ComboItem {
  id: string;
  label: string;
  avatarName: string;
  subtitle: string;
  acceptingBookings?: boolean;
}

function getInitials(name?: string): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function InitialsAvatar({ name, size = 34 }: { name: string; size?: number }) {
  const [c1, c2] = paletteFor(name || "?");
  return (
    <div
      className="rounded-lg flex items-center justify-center text-white font-semibold shrink-0 shadow-sm"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.36),
        background: `linear-gradient(135deg, ${c1}, ${c2})`,
      }}
    >
      {getInitials(name)}
    </div>
  );
}

function uniqueAvailableDays(availability?: TimeSlot[]): string[] {
  if (!availability?.length) return [];
  const set = new Set(availability.map((a) => a.day));
  return DAYS_OF_WEEK.filter((d) => set.has(d));
}

function formatTimeForDisplay(time: string): string {
  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours, 10);
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${period}`;
}

function Combobox({
  label,
  required,
  placeholder,
  meta,
  items,
  selected,
  search,
  onSearchChange,
  open,
  onOpenChange,
  onSelect,
  searchPlaceholder,
  emptyLabel,
  accent,
}: {
  label: string;
  required?: boolean;
  placeholder: string;
  meta: string;
  items: ComboItem[];
  selected: ComboItem | null;
  search: string;
  onSearchChange: (v: string) => void;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (item: ComboItem) => void;
  searchPlaceholder: string;
  emptyLabel: string;
  accent: "violet" | "open";
}) {
  const openRing =
    accent === "open"
      ? "border-status-open ring-2 ring-status-open/15"
      : "border-brand-violet ring-2 ring-brand-violet/15";
  const selectedRow =
    accent === "open" ? "bg-status-open-soft" : "bg-brand-violet-soft";

  return (
    <div className="relative">
      <label className="block text-sm font-semibold text-ink-900 mb-2">
        {label}
        {required && <span className="text-brand-violet ml-0.5">*</span>}
      </label>
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg border bg-surface-paper text-left transition-colors min-h-[58px] ${
          open ? openRing : "border-border hover:border-ink-500"
        }`}
      >
        {selected ? (
          <>
            <InitialsAvatar name={selected.avatarName} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="block text-sm font-semibold text-ink-900 truncate">
                  {selected.label}
                </span>
                {selected.acceptingBookings === false && (
                  <BookingStatusBadge accepting={false} />
                )}
              </span>
              <span className="block text-xs text-ink-500 truncate">
                {selected.subtitle}
              </span>
            </span>
          </>
        ) : (
          <>
            <span className="w-[34px] h-[34px] rounded-lg bg-surface-canvas border border-border flex items-center justify-center text-ink-500 shrink-0">
              —
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-ink-500">
                {placeholder}
              </span>
              <span className="block text-xs text-ink-500 truncate">
                {meta}
              </span>
            </span>
          </>
        )}
        <ChevronDown
          className={`w-4 h-4 text-ink-500 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute z-20 mt-2 w-full bg-surface-paper border border-border rounded-lg shadow-lg overflow-hidden">
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-500" />
              <input
                autoFocus
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                onMouseDown={(e) => e.stopPropagation()}
                placeholder={searchPlaceholder}
                className="w-full pl-8 pr-3 py-2 text-sm rounded-md border border-border bg-surface-canvas focus:outline-none focus:ring-2 focus:ring-brand-violet/20"
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto p-2">
            {items.length ? (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelect(item)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left hover:bg-surface-canvas transition-colors ${
                    selected?.id === item.id ? selectedRow : ""
                  }`}
                >
                  <InitialsAvatar name={item.avatarName} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="block text-sm font-medium text-ink-900 truncate">
                        {item.label}
                      </span>
                      {item.acceptingBookings === false && (
                        <BookingStatusBadge accepting={false} />
                      )}
                    </span>
                    <span className="block text-xs text-ink-500 truncate">
                      {item.subtitle}
                    </span>
                  </span>
                </button>
              ))
            ) : (
              <div className="py-6 text-center text-sm text-ink-500">
                {emptyLabel}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function BookingStatusBadge({ accepting }: { accepting: boolean }) {
  return accepting ? (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-status-open-soft text-status-open shrink-0">
      Accepting bookings
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-status-danger-soft text-status-danger shrink-0">
      Not accepting bookings
    </span>
  );
}

function SlipRow({ k, v, sub }: { k: string; v?: string; sub?: string }) {
  return (
    <div className="flex gap-3 text-xs">
      <span className="w-16 shrink-0 font-mono text-[10px] uppercase tracking-wider text-ink-500 pt-0.5">
        {k}
      </span>
      {v ? (
        <span className="font-medium text-ink-900 min-w-0">
          {v}
          {sub && (
            <>
              <br />
              <span className="text-ink-500 font-normal">{sub}</span>
            </>
          )}
        </span>
      ) : (
        <span className="text-ink-500/60">Not chosen</span>
      )}
    </div>
  );
}

export default function CreateAppointment({
  userRole,
  hospitalId,
}: CreateAppointmentProps) {
  const { data: patientsData = { patients: [] }, isLoading: patientsLoading } =
    useHospitalPatients(hospitalId, undefined, true);
  const { data: doctorsData = { doctors: [] }, isLoading: doctorsLoading } =
    useHospitalDoctors(hospitalId, undefined, true);
  const { navigateToHospitalRoute, currentHospitalMembership } = useAuth();

  const { addAppointment } = useHospitalAppointmentsApi(
    hospitalId,
    userRole,
    false,
    undefined,
  );
  const searchParams = useSearchParams();

  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [appointmentDate, setAppointmentDate] = useState("");
  const [appointmentTime, setAppointmentTime] = useState("");
  const [frequency, setFrequency] = useState<"once" | "weekly" | "monthly">(
    "once",
  );
  const [numberOfOccurrences, setNumberOfOccurrences] = useState(1);

  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState("");
  const [doctorSearch, setDoctorSearch] = useState("");
  const [patientSearch, setPatientSearch] = useState("");
  const [showSellPackage, setShowSellPackage] = useState(false);
  const [showDoctorList, setShowDoctorList] = useState(false);
  const [showPatientList, setShowPatientList] = useState(false);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [prefilled, setPrefilled] = useState(false);

  // Prefill from a "Book this slot" deep link (?doctorId=&date=&time=&patientId=)
  useEffect(() => {
    if (prefilled || !doctorsData.doctors?.length) return;
    const doctorId = searchParams.get("doctorId");
    const patientId = searchParams.get("patientId");
    const date = searchParams.get("date");
    const time = searchParams.get("time");
    if (doctorId) {
      const match = doctorsData.doctors.find((d) => d.id === doctorId);
      if (match) setSelectedDoctor(match);
    }
    if (patientId) {
      const match = patientsData.patients.find((p) => p.id === patientId);
      if (match) setSelectedPatient(match);
    }
    if (date) setAppointmentDate(date);
    if (time) setAppointmentTime(time);
    setPrefilled(true);
  }, [doctorsData.doctors, patientsData.patients, searchParams, prefilled]);

  const isoDate = appointmentDate
    ? (DateTime.fromISO(appointmentDate).toISODate() ?? undefined)
    : undefined;

  const { data: slotData, isLoading: slotsLoading } = useDoctorSlots(
    hospitalId,
    selectedDoctor?.id ?? undefined,
    isoDate,
  );
  const availableSlots = slotData?.availableSlots ?? [];
  const availableDays = useMemo(
    () => uniqueAvailableDays(selectedDoctor?.availability),
    [selectedDoctor],
  );

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showDoctorList && !(event.target as Element).closest(".doctor-combo"))
        setShowDoctorList(false);
      if (
        showPatientList &&
        !(event.target as Element).closest(".patient-combo")
      )
        setShowPatientList(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showDoctorList, showPatientList]);

  // Auto-select doctor if user role is doctor
  useEffect(() => {
    if (
      currentHospitalMembership?.role === "doctor" &&
      doctorsData.doctors?.length &&
      !selectedDoctor
    ) {
      const currentUserDoctor = doctorsData.doctors.find(
        (doctor) =>
          doctor.profileId === currentHospitalMembership?.userId ||
          doctor.id === currentHospitalMembership?.userId,
      );
      if (currentUserDoctor) setSelectedDoctor(currentUserDoctor);
    }
  }, [doctorsData.doctors, currentHospitalMembership, selectedDoctor]);

  // Reset day selection whenever the doctor changes
  useEffect(() => {
    setSelectedDays(availableDays);
  }, [availableDays]);

  const doctorItems: ComboItem[] = useMemo(() => {
    const q = doctorSearch.toLowerCase();
    return (doctorsData.doctors || [])
      .filter(
        (d) =>
          !q ||
          d.name?.toLowerCase().includes(q) ||
          d.specialization?.toLowerCase().includes(q),
      )
      .map((d) => ({
        id: d.id,
        label: `Dr. ${d.name}`,
        avatarName: d.name,
        subtitle: [
          d.specialization,
          uniqueAvailableDays(d.availability)
            .map((day) => day.slice(0, 3))
            .join(" "),
        ]
          .filter(Boolean)
          .join(" · "),
        acceptingBookings: d.isAcceptingBookings,
      }));
  }, [doctorsData.doctors, doctorSearch]);

  const patientItems: ComboItem[] = useMemo(() => {
    const q = patientSearch.toLowerCase();
    return (patientsData.patients || [])
      .filter(
        (p) =>
          !q ||
          p.name?.toLowerCase().includes(q) ||
          p.email?.toLowerCase().includes(q) ||
          p.phone?.toLowerCase().includes(q),
      )
      .map((p) => ({
        id: p.id,
        label: p.name,
        avatarName: p.name,
        subtitle:
          [p.phone, p.email].filter(Boolean).join(" · ") ||
          "No contact on file",
      }));
  }, [patientsData.patients, patientSearch]);

  const selectedDoctorItem: ComboItem | null = selectedDoctor
    ? {
        id: selectedDoctor.id,
        label: `Dr. ${selectedDoctor.name}`,
        avatarName: selectedDoctor.name,
        subtitle: selectedDoctor.specialization || "",
        acceptingBookings: selectedDoctor.isAcceptingBookings,
      }
    : null;
  const selectedPatientItem: ComboItem | null = selectedPatient
    ? {
        id: selectedPatient.id,
        label: selectedPatient.name,
        avatarName: selectedPatient.name,
        subtitle: [selectedPatient.phone, selectedPatient.email]
          .filter(Boolean)
          .join(" · "),
      }
    : null;

  function toggleDaySelection(day: string) {
    setSelectedDays((prev) =>
      prev.includes(day)
        ? prev.filter((d) => d !== day)
        : [...prev, day].sort((a, b) => DAY_ORDER[a] - DAY_ORDER[b]),
    );
  }

  const previewDates = useMemo(() => {
    if (!appointmentDate) return [];
    if (frequency === "once")
      return [{ iso: appointmentDate, warn: null as string | null }];

    const limit = Math.min(Math.max(numberOfOccurrences || 1, 1), 52);
    const results: { iso: string; warn: string | null }[] = [];

    if (frequency === "weekly") {
      if (!selectedDays.length) return [];
      let cursor = DateTime.fromISO(appointmentDate);
      let guard = 0;
      while (results.length < limit && guard++ < 400) {
        if (selectedDays.includes(cursor.toFormat("cccc")))
          results.push({ iso: cursor.toISODate()!, warn: null });
        cursor = cursor.plus({ days: 1 });
      }
    } else {
      const start = DateTime.fromISO(appointmentDate);
      for (let i = 0; i < limit; i++) {
        const d = start.plus({ months: i });
        const warn =
          availableDays.length && !availableDays.includes(d.toFormat("cccc"))
            ? "Outside the doctor's usual consulting days"
            : null;
        results.push({ iso: d.toISODate()!, warn });
      }
    }
    return results;
  }, [
    appointmentDate,
    frequency,
    numberOfOccurrences,
    selectedDays,
    availableDays,
  ]);

  const hasAnyWarning = previewDates.some((d) => d.warn);

  let blockerMessage: string | null = null;
  if (!selectedDoctor) blockerMessage = "Choose a doctor";
  else if (!selectedPatient) blockerMessage = "Choose a patient";
  else if (!appointmentDate) blockerMessage = "Choose a date";
  else if (!appointmentTime) blockerMessage = "Choose a time";
  else if (frequency === "weekly" && selectedDays.length === 0)
    blockerMessage = "Choose at least one day to repeat on";

  const isValid = !blockerMessage;
  const previewCount = isValid ? previewDates.length : 0;

  const repeatsLabel =
    frequency === "once"
      ? "Just once"
      : frequency === "weekly"
        ? selectedDays.length
          ? `Every ${selectedDays.map((d) => d.slice(0, 3)).join(", ")}`
          : "Weekly — pick days"
        : `Monthly on day ${appointmentDate ? DateTime.fromISO(appointmentDate).day : "—"}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (blockerMessage) {
      toast.error(blockerMessage);
      return;
    }

    setSaving(true);
    try {
      await addAppointment({
        doctorProfileId: selectedDoctor!.id,
        patientId: selectedPatient!.id,
        startDate: appointmentDate,
        preferredTime: appointmentTime,
        frequency,
        numberOfOccurrences: frequency === "once" ? 1 : numberOfOccurrences,
        selectedDays: frequency === "weekly" ? selectedDays : [],
        notes,
      });

      toast.success("Appointment created successfully");
      navigateToHospitalRoute("appointments", hospitalId);
    } catch (err) {
      console.error("Error scheduling:", err);
      toast.error("Error scheduling appointments. See console for details.");
    } finally {
      setSaving(false);
    }
  };

  function renderSlotArea() {
    if (!selectedDoctor) {
      return (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-surface-canvas text-sm text-ink-500">
          <Info className="w-4 h-4 shrink-0" />
          Choose a doctor first — times come from their consulting hours.
        </div>
      );
    }
    if (!appointmentDate) {
      return (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-surface-canvas text-sm text-ink-500">
          <Info className="w-4 h-4 shrink-0" />
          Choose a date to see available times.
        </div>
      );
    }
    if (slotsLoading || patientsLoading || doctorsLoading) {
      return (
        <div className="flex items-center gap-2 px-4 py-3 text-sm text-ink-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading times…
        </div>
      );
    }
    if (!availableSlots.length) {
      return (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-status-warning-soft text-sm text-status-warning">
          <AlertCircle className="w-4 h-4 shrink-0" />
          No available times on this date. Try another date.
        </div>
      );
    }

    const groups: Record<
      "Morning" | "Afternoon" | "Evening",
      typeof availableSlots
    > = { Morning: [], Afternoon: [], Evening: [] };
    availableSlots.forEach((slot) => {
      const h = parseInt(slot.time.slice(0, 2), 10);
      (h < 12
        ? groups.Morning
        : h < 16
          ? groups.Afternoon
          : groups.Evening
      ).push(slot);
    });

    return (
      <div className="space-y-4">
        {(["Morning", "Afternoon", "Evening"] as const)
          .filter((k) => groups[k].length)
          .map((k) => (
            <div key={k}>
              <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-ink-500 mb-2">
                {k}
                <span className="flex-1 h-px bg-border" />
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {groups[k].map((slot) => (
                  <button
                    key={slot.time}
                    type="button"
                    onClick={() => setAppointmentTime(slot.time)}
                    className={`rounded-lg border text-sm font-mono transition-colors ${
                      slot.capacity > 1 ? "h-11 leading-tight" : "h-9"
                    } ${
                      appointmentTime === slot.time
                        ? "bg-brand-violet border-brand-violet text-white"
                        : "bg-surface-paper border-border text-ink-700 hover:border-brand-violet hover:text-brand-violet"
                    }`}
                  >
                    {formatTimeForDisplay(slot.time)}
                    {slot.capacity > 1 && (
                      <span
                        className={`block text-[10px] font-sans ${appointmentTime === slot.time ? "text-white/80" : "text-ink-500"}`}
                      >
                        {slot.remaining} of {slot.capacity} left
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        <p className="text-xs text-ink-500">
          {availableSlots.length} time slot
          {availableSlots.length !== 1 ? "s" : ""} free on{" "}
          {format(new Date(`${appointmentDate}T00:00:00`), "EEEE, d MMMM")}. For
          a repeating series the same time is held every occurrence.
        </p>
      </div>
    );
  }

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="min-h-screen bg-surface-canvas pb-10">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-start gap-3 mb-5">
          <button
            type="button"
            onClick={() => navigateToHospitalRoute("appointments", hospitalId)}
            className="flex items-center gap-2 p-2 -ml-2 mt-0.5 rounded-lg text-ink-700 hover:bg-surface-paper transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-display tracking-tight text-xl font-bold text-ink-900">
              Schedule an appointment
            </h1>
            <p className="text-sm text-ink-500 mt-0.5">
              Book once, or set up a repeating series. Nothing is saved until
              you confirm.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowSellPackage(true)}
            disabled={!selectedPatient}
            title={selectedPatient ? undefined : "Choose a patient first"}
            className="mt-0.5 h-9 px-3.5 rounded-lg border border-brand-violet text-brand-violet text-sm font-medium flex items-center gap-1.5 hover:bg-brand-violet-soft transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent shrink-0"
          >
            <PackageIcon className="w-4 h-4" /> Sell package
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-5 items-start"
        >
          <div className="min-w-0">
            {/* 01 */}
            <section className="bg-surface-paper rounded-xl border border-border shadow-sm mb-4">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
                <span className="w-7 h-7 rounded-md bg-brand-violet-soft text-brand-violet text-xs font-mono font-semibold flex items-center justify-center shrink-0">
                  01
                </span>
                <div>
                  <div className="text-sm font-semibold text-ink-900">
                    Who is this for?
                  </div>
                  <div className="text-xs text-ink-500">
                    The doctor's consulting days set what you can book below.
                  </div>
                </div>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {currentHospitalMembership?.role === "doctor" ? (
                    <div>
                      <label className="block text-sm font-semibold text-ink-900 mb-2">
                        Doctor
                      </label>
                      <div className="flex items-center gap-3 px-3 py-3 rounded-lg border border-brand-violet bg-brand-violet-soft min-h-[58px]">
                        {selectedDoctor ? (
                          <>
                            <InitialsAvatar name={selectedDoctor.name} />
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-2">
                                <span className="block text-sm font-semibold text-ink-900 truncate">
                                  Dr. {selectedDoctor.name}
                                </span>
                                {selectedDoctor.isAcceptingBookings ===
                                  false && (
                                  <BookingStatusBadge accepting={false} />
                                )}
                              </span>
                              <span className="block text-xs text-ink-500 truncate">
                                {selectedDoctor.specialization}
                              </span>
                            </span>
                          </>
                        ) : (
                          <span className="text-sm text-ink-500">
                            Loading your profile…
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="doctor-combo">
                      <Combobox
                        label="Doctor"
                        required
                        placeholder="Choose a doctor"
                        meta={`${doctorsData.doctors?.length ?? 0} on the roster`}
                        items={doctorItems}
                        selected={selectedDoctorItem}
                        search={doctorSearch}
                        onSearchChange={setDoctorSearch}
                        open={showDoctorList}
                        onOpenChange={setShowDoctorList}
                        onSelect={(item) => {
                          const d =
                            doctorsData.doctors.find((x) => x.id === item.id) ??
                            null;
                          setSelectedDoctor(d);
                          setAppointmentTime("");
                          setShowDoctorList(false);
                          setDoctorSearch("");
                        }}
                        searchPlaceholder="Search doctors"
                        emptyLabel="No doctors found"
                        accent="violet"
                      />
                    </div>
                  )}

                  <div className="patient-combo">
                    <Combobox
                      label="Patient"
                      required
                      placeholder="Choose a patient"
                      meta="Search by name, phone or email"
                      items={patientItems}
                      selected={selectedPatientItem}
                      search={patientSearch}
                      onSearchChange={setPatientSearch}
                      open={showPatientList}
                      onOpenChange={setShowPatientList}
                      onSelect={(item) => {
                        const p =
                          patientsData.patients.find((x) => x.id === item.id) ??
                          null;
                        setSelectedPatient(p);
                        setShowPatientList(false);
                        setPatientSearch("");
                      }}
                      searchPlaceholder="Search patients"
                      emptyLabel="No patients found"
                      accent="open"
                    />
                  </div>
                </div>

                {selectedDoctor &&
                  selectedDoctor.isAcceptingBookings === false && (
                    <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-status-danger-soft text-xs text-status-danger">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>
                        <strong>Dr. {selectedDoctor.name}</strong> is currently
                        not accepting bookings. You can still schedule, but
                        consider checking with them first.
                      </span>
                    </div>
                  )}

                {selectedDoctor && (
                  <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-surface-canvas text-xs text-ink-700">
                    <Info className="w-4 h-4 text-ink-500 shrink-0 mt-0.5" />
                    <span>
                      <strong>Dr. {selectedDoctor.name}</strong> consults{" "}
                      {availableDays.length
                        ? availableDays.join(", ")
                        : "no days set"}
                      . Times below are already filtered to their hours and
                      existing bookings.
                    </span>
                  </div>
                )}
              </div>
            </section>

            {/* 02 */}
            <section className="bg-surface-paper rounded-xl border border-border shadow-sm mb-4">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
                <span className="w-7 h-7 rounded-md bg-brand-violet-soft text-brand-violet text-xs font-mono font-semibold flex items-center justify-center shrink-0">
                  02
                </span>
                <div>
                  <div className="text-sm font-semibold text-ink-900">
                    When does it start?
                  </div>
                  <div className="text-xs text-ink-500">
                    Pick the first date and time.
                  </div>
                </div>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="First appointment" required>
                    <input
                      type="date"
                      value={appointmentDate}
                      min={today}
                      onChange={(e) => {
                        const selected = e.target.value;
                        if (selected < today) {
                          toast.error(
                            "Please select a date that is today or in the future.",
                          );
                          return;
                        }
                        setAppointmentDate(selected);
                        setAppointmentTime("");
                      }}
                      className={inputClass}
                    />
                  </Field>
                  <div>
                    <label className="block text-sm font-semibold text-ink-900 mb-2">
                      Appointment length
                    </label>
                    <div className="flex items-center h-[42px] px-4 rounded-lg border border-border bg-surface-canvas text-sm text-ink-700">
                      {selectedDoctor
                        ? `${slotData?.doctor.appointmentDuration ?? selectedDoctor.appointmentDuration ?? 30} minutes`
                        : "Set by the doctor you choose"}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-ink-900 mb-2">
                    Time <span className="text-brand-violet">*</span>
                  </label>
                  {renderSlotArea()}
                </div>
              </div>
            </section>

            {/* 03 */}
            <section className="bg-surface-paper rounded-xl border border-border shadow-sm mb-4">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
                <span className="w-7 h-7 rounded-md bg-brand-violet-soft text-brand-violet text-xs font-mono font-semibold flex items-center justify-center shrink-0">
                  03
                </span>
                <div>
                  <div className="text-sm font-semibold text-ink-900">
                    Does it repeat?
                  </div>
                  <div className="text-xs text-ink-500">
                    Weekly and monthly series are created as individual
                    appointments.
                  </div>
                </div>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {FREQUENCIES.map((f) => (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => setFrequency(f.value)}
                      className={`text-left px-4 py-3 rounded-lg border transition-colors ${
                        frequency === f.value
                          ? "border-brand-violet bg-brand-violet-soft"
                          : "border-border bg-surface-paper hover:border-ink-500"
                      }`}
                    >
                      <div className="text-sm font-semibold text-ink-900">
                        {f.label}
                      </div>
                      <div className="text-xs text-ink-500 mt-0.5">
                        {f.hint}
                      </div>
                    </button>
                  ))}
                </div>

                {frequency === "weekly" && (
                  <div>
                    <label className="block text-sm font-semibold text-ink-900 mb-2">
                      Repeat on
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {DAYS_OF_WEEK.map((day) => {
                        const isAvailable = availableDays.includes(day);
                        const isSelected = selectedDays.includes(day);
                        return (
                          <button
                            key={day}
                            type="button"
                            disabled={!isAvailable}
                            onClick={() => toggleDaySelection(day)}
                            title={
                              isAvailable
                                ? undefined
                                : "Doctor does not consult on this day"
                            }
                            className={`min-w-[64px] px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                              !isAvailable
                                ? "bg-surface-canvas text-ink-500 border-dashed border-border cursor-not-allowed"
                                : isSelected
                                  ? "bg-ink-900 border-ink-900 text-white"
                                  : "bg-surface-paper border-border text-ink-700 hover:border-ink-500"
                            }`}
                          >
                            {day.slice(0, 3)}
                          </button>
                        );
                      })}
                    </div>
                    {!selectedDoctor ? (
                      <p className="text-xs text-ink-500 mt-2">
                        Choose a doctor to see which days they consult.
                      </p>
                    ) : (
                      <div className="flex items-start gap-3 mt-3 px-4 py-3 rounded-lg bg-surface-canvas text-xs text-ink-700">
                        <Info className="w-4 h-4 text-ink-500 shrink-0 mt-0.5" />
                        <span>
                          Dashed days are outside this doctor's consulting
                          schedule. Change the doctor to book them.
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {frequency !== "once" && (
                  <Field label="Number of appointments">
                    <input
                      type="number"
                      min={1}
                      max={52}
                      value={numberOfOccurrences}
                      onChange={(e) =>
                        setNumberOfOccurrences(
                          Math.max(
                            1,
                            Math.min(52, parseInt(e.target.value || "1", 10)),
                          ),
                        )
                      }
                      className={`${inputClass} font-mono`}
                    />
                  </Field>
                )}
              </div>
            </section>

            {/* 04 */}
            <section className="bg-surface-paper rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
                <span className="w-7 h-7 rounded-md bg-brand-violet-soft text-brand-violet text-xs font-mono font-semibold flex items-center justify-center shrink-0">
                  04
                </span>
                <div>
                  <div className="text-sm font-semibold text-ink-900">
                    Anything the doctor should know?
                  </div>
                  <div className="text-xs text-ink-500">
                    Shown on the appointment card and in the doctor's day view.
                  </div>
                </div>
              </div>
              <div className="p-5">
                <Field label="Notes" optional>
                  <textarea
                    value={notes}
                    maxLength={500}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                    placeholder="Fasting required, follow-up on ECG, wheelchair access needed…"
                    className={`${inputClass} resize-none`}
                  />
                </Field>
                <div className="text-right text-xs font-mono text-ink-500 mt-1">
                  {notes.length}/500
                </div>
              </div>
            </section>
          </div>

          {/* ── live slip ── */}
          <aside className="lg:sticky lg:top-4">
            <div className="bg-surface-paper rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="bg-ink-900 text-white px-5 py-4">
                <div className="text-[10px] font-mono uppercase tracking-widest text-white/50 mb-2">
                  You are about to create
                </div>
                <div className="text-xl font-bold flex items-baseline gap-2">
                  {previewCount}
                  <span className="text-xs font-normal text-white/60">
                    {previewCount === 1 ? "appointment" : "appointments"}
                  </span>
                </div>
              </div>

              <div className="px-5 py-4 border-b border-dashed border-border space-y-3">
                <SlipRow k="Patient" v={selectedPatient?.name} />
                <SlipRow
                  k="Doctor"
                  v={selectedDoctor ? `Dr. ${selectedDoctor.name}` : undefined}
                  sub={selectedDoctor?.specialization}
                />
                <SlipRow
                  k="Time"
                  v={
                    appointmentTime
                      ? formatTimeForDisplay(appointmentTime)
                      : undefined
                  }
                  sub={
                    appointmentTime
                      ? `${slotData?.doctor.appointmentDuration ?? selectedDoctor?.appointmentDuration ?? 30} minutes`
                      : undefined
                  }
                />
                <SlipRow k="Repeats" v={repeatsLabel} />
              </div>

              {previewCount > 0 ? (
                <div>
                  <div className="flex items-center justify-between px-5 pt-3 pb-2">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-ink-500">
                      Dates
                    </span>
                  </div>
                  <div
                    key={`${appointmentDate}-${frequency}-${numberOfOccurrences}-${selectedDays.join(",")}`}
                    className="max-h-64 overflow-y-auto px-3 pb-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full"
                  >
                    {previewDates.map((o, i) => (
                      <div
                        key={o.iso}
                        className="grid grid-cols-[20px_58px_34px_1fr] items-center gap-3 px-2 py-2 rounded-md text-xs"
                      >
                        <span className="font-mono text-[10px] text-ink-500">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="font-mono text-ink-900">
                          {format(new Date(`${o.iso}T00:00:00`), "dd MMM")}
                        </span>
                        <span className="font-mono tabular text-ink-500">
                          {format(new Date(`${o.iso}T00:00:00`), "EEE")}
                        </span>
                        <span className="flex justify-end">
                          {o.warn ? (
                            <span
                              className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-status-warning-soft text-status-warning"
                              title={o.warn}
                            >
                              Check
                            </span>
                          ) : i === 0 ? (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand-violet-soft text-brand-violet">
                              First
                            </span>
                          ) : null}
                        </span>
                      </div>
                    ))}
                  </div>
                  {hasAnyWarning && (
                    <p className="px-5 pb-3 text-[11px] text-status-warning">
                      Dates marked "Check" fall outside this doctor's usual
                      consulting days.
                    </p>
                  )}
                </div>
              ) : (
                <div className="px-5 py-8 text-center text-sm text-ink-500">
                  <CalendarCheck className="w-6 h-6 text-border mx-auto mb-2" />
                  Pick a doctor, a patient and a time. Every date you're
                  creating will be listed here before you commit.
                </div>
              )}

              <div className="px-5 py-4 border-t border-border bg-surface-canvas/50">
                {blockerMessage && (
                  <div className="flex items-center gap-2 text-xs text-status-danger mb-3">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {blockerMessage}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={!isValid || saving}
                  className="w-full h-11 rounded-lg bg-brand-violet hover:bg-brand-violet-hover disabled:bg-border disabled:text-ink-500 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Scheduling…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      {isValid
                        ? `Schedule ${previewCount === 1 ? "appointment" : `${previewCount} appointments`}`
                        : "Schedule appointment"}
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    navigateToHospitalRoute("appointments", hospitalId)
                  }
                  className="w-full h-9 mt-2 rounded-lg border border-border text-sm text-ink-700 hover:bg-surface-canvas transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </aside>
        </form>
      </div>

      {showSellPackage && selectedPatient && (
        <SellPackageDialog
          hospitalId={hospitalId}
          patient={selectedPatient}
          doctors={doctorsData.doctors || []}
          initialDoctorId={selectedDoctor?.id}
          onClose={() => setShowSellPackage(false)}
          onSuccess={(message) => toast.success(message)}
        />
      )}
    </div>
  );
}
