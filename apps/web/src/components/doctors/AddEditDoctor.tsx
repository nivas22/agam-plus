"use client";

import { format } from "date-fns";
import { ArrowLeft, Loader2, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";
import DuplicateWarningModal, {
  type DuplicateMatch,
} from "@/components/common/DuplicateWarningModal";
import {
  Field,
  inputClass,
  PillGroup,
  ToggleSwitch,
} from "@/components/common/EditFormControls";
import DoctorAvatar from "@/components/doctors/DoctorAvatar";
import { useAuth } from "@/hooks/useAuth";
import { useDoctorDashboardPracticeStats } from "@/hooks/useDoctorDashboardApi";
import { useHospitalDoctor, useNewDoctorApi } from "@/hooks/useNewDoctorApi";
import { ApiRequestError } from "@/lib/api";
import type { TimeSlot } from "@/types/appointment";
import type { CreateDoctorData, Doctor } from "@/types/doctorNew";
import { GENDER } from "../../constants";

interface AddEditDoctorProps {
  isNew?: boolean;
  id?: string;
  userRole?: string;
  canEdit?: boolean;
  hospitalId?: string;
}

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const DURATIONS = [15, 20, 30, 45, 60];
const GAPS = [0, 5, 10, 15, 20, 30];
const PATIENTS_PER_SLOT = [1, 2, 3, 4, 5];
const HELD_SLOT_OPTIONS = [0, 1, 2, 3, 4, 5];
const RELEASE_HELD_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: "Never" },
  { value: 240, label: "4 hours before" },
  { value: 120, label: "2 hours before" },
  { value: 60, label: "1 hour before" },
];
const OVER_CAPACITY_OPTIONS: {
  value: "allow" | "warn" | "block";
  label: string;
}[] = [
  { value: "allow", label: "Allow" },
  { value: "warn", label: "Warn the desk" },
  { value: "block", label: "Block" },
];
const GRACE_MINUTE_OPTIONS = [5, 10, 15];
const NO_SHOW_RELEASE_OPTIONS = [15, 20, 30];
const GENDERS = [GENDER.MALE, GENDER.FEMALE, GENDER.OTHER];
const MARITAL_STATUSES = ["Single", "Married"];
const SPECIALIZATIONS = [
  "General Practitioner",
  "Cardiologist",
  "Dermatologist",
  "Neurologist",
  "Pediatrician",
  "Orthopedic Surgeon",
  "Ophthalmologist",
  "Psychiatrist",
  "Dentist",
  "Gynecologist",
  "Urologist",
  "Endocrinologist",
  "Gastroenterologist",
  "Pulmonologist",
  "Oncologist",
  "Rheumatologist",
  "Nephrologist",
  "ENT Specialist",
];

const DAY_START = 7 * 60;
const DAY_END = 22 * 60;
const DAY_SPAN = DAY_END - DAY_START;

type FormState = {
  name: string;
  email: string;
  phone: string;
  specialization: string;
  experience: string;
  qualification: string;
  consultationFee: number | undefined;
  gender: string;
  maritalStatus: string;
  status: "active" | "inactive" | "pending";
  address: string;
  availability: TimeSlot[];
  appointmentDuration: number;
  bufferMinutes: number;
  patientsPerSlot: number;
  acceptWalkIns: boolean;
  heldSlotsPerSession: number;
  releaseHeldSlotsBeforeMinutes: number | null;
  overCapacityPolicy: "allow" | "warn" | "block";
  lateArrivalGraceMinutes: number;
  noShowReleaseMinutes: number;
};

const EMPTY_FORM: FormState = {
  name: "",
  email: "",
  phone: "",
  specialization: "",
  experience: "",
  qualification: "",
  consultationFee: undefined,
  gender: "",
  maritalStatus: "",
  status: "pending",
  address: "",
  availability: [],
  appointmentDuration: 30,
  bufferMinutes: 0,
  patientsPerSlot: 1,
  acceptWalkIns: true,
  heldSlotsPerSession: 2,
  releaseHeldSlotsBeforeMinutes: 120,
  overCapacityPolicy: "warn",
  lateArrivalGraceMinutes: 10,
  noShowReleaseMinutes: 20,
};

function minutesSinceMidnight(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(mins: number): string {
  const wrapped = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function formatTime(time: string): string {
  if (!time) return "";
  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours, 10);
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${period}`;
}

function slotCapacity(
  slot: TimeSlot,
  duration: number,
  gap: number = 0,
): number {
  if (!duration) return 0;
  const span = Math.max(
    0,
    minutesSinceMidnight(slot.endTime) - minutesSinceMidnight(slot.startTime),
  );
  if (span < duration) return 0;
  return Math.floor((span - duration) / (duration + gap)) + 1;
}

// Slots held back per contiguous booking window, always leaving at least one
// online-bookable slot in that window.
function blockHeldSlots(
  slot: TimeSlot,
  duration: number,
  gap: number,
  heldSlotsPerSession: number,
  acceptWalkIns: boolean,
): number {
  if (!acceptWalkIns || heldSlotsPerSession <= 0) return 0;
  const total = slotCapacity(slot, duration, gap);
  return Math.min(heldSlotsPerSession, Math.max(total - 1, 0));
}

function weekCapacity(
  availability: TimeSlot[],
  duration: number,
  gap: number = 0,
  patientsPerSlot: number = 1,
): number {
  const slots = availability.reduce(
    (sum, slot) => sum + slotCapacity(slot, duration, gap),
    0,
  );
  return slots * Math.max(1, patientsPerSlot);
}

function weekHours(availability: TimeSlot[]): number {
  const minutes = availability.reduce(
    (sum, slot) =>
      sum +
      Math.max(
        0,
        minutesSinceMidnight(slot.endTime) -
          minutesSinceMidnight(slot.startTime),
      ),
    0,
  );
  return Math.round((minutes / 60) * 10) / 10;
}

function overlaps(
  a: { startTime: string; endTime: string },
  b: { startTime: string; endTime: string },
): boolean {
  return a.startTime < b.endTime && b.startTime < a.endTime;
}

function buildAvailability(
  days: string[],
  slots: { startTime: string; endTime: string }[],
): TimeSlot[] {
  return days.flatMap((day) => slots.map((s) => ({ day, ...s })));
}

const PRESETS: { label: string; apply: () => TimeSlot[] }[] = [
  {
    label: "Mon–Fri · 9–1 & 5–8",
    apply: () =>
      buildAvailability(
        ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        [
          { startTime: "09:00", endTime: "13:00" },
          { startTime: "17:00", endTime: "20:00" },
        ],
      ),
  },
  {
    label: "Mon–Sat mornings",
    apply: () =>
      buildAvailability(
        ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        [{ startTime: "09:00", endTime: "13:00" }],
      ),
  },
  {
    label: "Tue · Thu · Sat full day",
    apply: () =>
      buildAvailability(
        ["Tuesday", "Thursday", "Saturday"],
        [{ startTime: "09:00", endTime: "19:00" }],
      ),
  },
  {
    label: "Clear the week",
    apply: () => [],
  },
];

function formatAdded(createdAt: any): string {
  if (!createdAt) return "—";
  try {
    const date =
      typeof createdAt === "string" || createdAt instanceof Date
        ? new Date(createdAt)
        : new Date(createdAt.seconds ? createdAt.seconds * 1000 : createdAt);
    if (isNaN(date.getTime())) return "—";
    return format(date, "d MMM yyyy");
  } catch {
    return "—";
  }
}

function RuleRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3 border-t border-border first:border-t-0 first:pt-0">
      <div className="min-w-0 max-w-md">
        <div className="text-sm font-semibold text-ink-900">{label}</div>
        {hint && <div className="text-xs text-ink-500 mt-0.5">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export default function AddEditDoctor({
  isNew = false,
  id,
  hospitalId,
  canEdit = true,
}: AddEditDoctorProps) {
  const router = useRouter();
  const { createDoctor, updateDoctor, deleteDoctor, isDeleting } =
    useNewDoctorApi(hospitalId, undefined, true);
  const { data: doctorData, isLoading: isDoctorLoading } = useHospitalDoctor(
    id || "",
    hospitalId,
  );
  const { hospitals } = useAuth();

  const [formData, setFormData] = useState<FormState>(EMPTY_FORM);
  const [initialData, setInitialData] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [duplicateMatches, setDuplicateMatches] = useState<
    DuplicateMatch[] | null
  >(null);
  const [addingDay, setAddingDay] = useState<string | null>(null);
  const [slotDraft, setSlotDraft] = useState({ start: "09:00", end: "10:00" });
  const [activeSection, setActiveSection] = useState<
    "personal" | "professional" | "availability"
  >("personal");

  const personalRef = useRef<HTMLDivElement>(null);
  const professionalRef = useRef<HTMLDivElement>(null);
  const availabilityRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isNew && doctorData?.doctor) {
      const d = doctorData.doctor as Doctor;
      const next: FormState = {
        name: d.name || "",
        email: d.email || "",
        phone: d.phone || "",
        specialization: d.specialization || "",
        experience: d.experience || "",
        qualification: d.qualification || "",
        consultationFee: d.consultationFee ?? undefined,
        gender: d.gender || "",
        maritalStatus: d.maritalStatus || "",
        status: (d.status as FormState["status"]) || "pending",
        address: d.address || "",
        availability: d.availability || [],
        appointmentDuration: d.appointmentDuration || 30,
        bufferMinutes: d.bufferMinutes ?? 0,
        patientsPerSlot: d.patientsPerSlot || 1,
        acceptWalkIns: d.acceptWalkIns !== false,
        heldSlotsPerSession: d.heldSlotsPerSession ?? 2,
        releaseHeldSlotsBeforeMinutes: d.releaseHeldSlotsBeforeMinutes ?? 120,
        overCapacityPolicy: d.overCapacityPolicy || "warn",
        lateArrivalGraceMinutes: d.lateArrivalGraceMinutes ?? 10,
        noShowReleaseMinutes: d.noShowReleaseMinutes ?? 20,
      };
      setFormData(next);
      setInitialData(next);
    }
  }, [isNew, doctorData]);

  useEffect(() => {
    const sections: [HTMLDivElement | null, typeof activeSection][] = [
      [personalRef.current, "personal"],
      [professionalRef.current, "professional"],
      [availabilityRef.current, "availability"],
    ];
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) {
          const match = sections.find(([el]) => el === visible[0].target);
          if (match) setActiveSection(match[1]);
        }
      },
      { rootMargin: "-96px 0px -55% 0px", threshold: [0, 0.25, 0.5, 1] },
    );
    sections.forEach(([el]) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const isDirty = useMemo(
    () => JSON.stringify(formData) !== JSON.stringify(initialData),
    [formData, initialData],
  );

  const hospitalName = useMemo(
    () =>
      hospitals?.find((h: any) => h.hospitalId === hospitalId)?.hospital?.name,
    [hospitals, hospitalId],
  );

  const personalFilled = [
    formData.name,
    formData.email,
    formData.phone,
    formData.gender,
  ].filter(Boolean).length;
  const professionalFilled = [
    formData.specialization,
    formData.experience,
    formData.qualification,
    formData.consultationFee != null ? String(formData.consultationFee) : "",
  ].filter(Boolean).length;
  const weeklyCapacity = weekCapacity(
    formData.availability,
    formData.appointmentDuration,
    formData.bufferMinutes,
    formData.patientsPerSlot,
  );
  const workingDays = new Set(formData.availability.map((s) => s.day)).size;
  const heldWeeklyCapacity = formData.availability.reduce(
    (sum, slot) =>
      sum +
      blockHeldSlots(
        slot,
        formData.appointmentDuration,
        formData.bufferMinutes,
        formData.heldSlotsPerSession,
        formData.acceptWalkIns,
      ) *
        Math.max(1, formData.patientsPerSlot),
    0,
  );
  const onlineWeeklyCapacity = weeklyCapacity - heldWeeklyCapacity;

  const statsMonth =
    !isNew && id ? format(new Date(), "yyyy-MM") : undefined;
  const { data: practiceStats } = useDoctorDashboardPracticeStats(
    statsMonth || "",
    hospitalId,
    id,
  );
  const avgConsultationMinutes = practiceStats?.avgConsultationMinutes ?? null;

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  function scrollToSection(ref: React.RefObject<HTMLDivElement | null>) {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function daySlots(day: string): TimeSlot[] {
    return formData.availability
      .filter((s) => s.day === day)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  function toggleDay(day: string, open: boolean) {
    setFormData((prev) => {
      if (open) {
        if (prev.availability.some((s) => s.day === day)) return prev;
        return {
          ...prev,
          availability: [
            ...prev.availability,
            { day, startTime: "09:00", endTime: "13:00" },
          ],
        };
      }
      return {
        ...prev,
        availability: prev.availability.filter((s) => s.day !== day),
      };
    });
    setAddingDay((cur) => (cur === day ? null : cur));
  }

  function removeSlot(day: string, slot: TimeSlot) {
    setFormData((prev) => {
      const idx = prev.availability.findIndex(
        (s) =>
          s.day === day &&
          s.startTime === slot.startTime &&
          s.endTime === slot.endTime,
      );
      if (idx === -1) return prev;
      const next = [...prev.availability];
      next.splice(idx, 1);
      return { ...prev, availability: next };
    });
  }

  function openAddSlot(day: string) {
    const slots = daySlots(day);
    const last = slots[slots.length - 1];
    const start = last ? last.endTime : "09:00";
    const end = last
      ? minutesToTime(minutesSinceMidnight(last.endTime) + 60)
      : "10:00";
    setSlotDraft({ start, end });
    setAddingDay(day);
  }

  function confirmAddSlot(day: string) {
    const { start, end } = slotDraft;
    if (!start || !end || start >= end) {
      toast.error("End time must be after start time");
      return;
    }
    const existing = daySlots(day);
    if (existing.some((s) => overlaps(s, { startTime: start, endTime: end }))) {
      toast.error("This overlaps with an existing slot");
      return;
    }
    setFormData((prev) => ({
      ...prev,
      availability: [
        ...prev.availability,
        { day, startTime: start, endTime: end },
      ],
    }));
    setAddingDay(null);
  }

  function copyToAllOpenDays(sourceDay: string) {
    const source = daySlots(sourceDay);
    const openDays = DAYS.filter(
      (d) => d !== sourceDay && formData.availability.some((s) => s.day === d),
    );
    if (!openDays.length) {
      toast.error("No other open days to copy to");
      return;
    }
    setFormData((prev) => {
      const kept = prev.availability.filter(
        (s) => s.day === sourceDay || !openDays.includes(s.day),
      );
      const added = openDays.flatMap((d) =>
        source.map((s) => ({
          day: d,
          startTime: s.startTime,
          endTime: s.endTime,
        })),
      );
      return { ...prev, availability: [...kept, ...added] };
    });
    toast.success(
      `Copied to ${openDays.length} open day${openDays.length > 1 ? "s" : ""}`,
    );
  }

  function applyPreset(preset: (typeof PRESETS)[number]) {
    update("availability", preset.apply());
  }

  function barStyle(slot: TimeSlot) {
    const start = Math.min(
      Math.max(minutesSinceMidnight(slot.startTime), DAY_START),
      DAY_END,
    );
    const end = Math.min(
      Math.max(minutesSinceMidnight(slot.endTime), DAY_START),
      DAY_END,
    );
    const left = ((start - DAY_START) / DAY_SPAN) * 100;
    const width = Math.max(((end - start) / DAY_SPAN) * 100, 1);
    return { left: `${left}%`, width: `${width}%` };
  }

  function discardChanges() {
    setFormData(initialData);
    setAddingDay(null);
  }

  async function saveDoctor(confirmDuplicate = false) {
    if (!formData.name.trim() || !formData.email.trim()) {
      toast.error("Please fill in Name and Email");
      return;
    }

    setSaving(true);
    try {
      const payload: Partial<CreateDoctorData> = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        specialization: formData.specialization,
        experience: formData.experience,
        qualification: formData.qualification,
        consultationFee: formData.consultationFee,
        gender: formData.gender,
        maritalStatus: formData.maritalStatus,
        status: formData.status,
        address: formData.address,
        availability: formData.availability,
        appointmentDuration: formData.appointmentDuration,
        bufferMinutes: formData.bufferMinutes,
        patientsPerSlot: formData.patientsPerSlot,
        acceptWalkIns: formData.acceptWalkIns,
        heldSlotsPerSession: formData.heldSlotsPerSession,
        releaseHeldSlotsBeforeMinutes: formData.releaseHeldSlotsBeforeMinutes,
        overCapacityPolicy: formData.overCapacityPolicy,
        lateArrivalGraceMinutes: formData.lateArrivalGraceMinutes,
        noShowReleaseMinutes: formData.noShowReleaseMinutes,
      };

      if (isNew) {
        await createDoctor({
          ...payload,
          hospitalId: hospitalId || "",
          confirmDuplicate,
        } as CreateDoctorData);
        toast.success("Doctor saved successfully! Welcome email sent.");
      } else if (id) {
        await updateDoctor(id, payload as any);
        toast.success("Doctor updated successfully!");
        setInitialData(formData);
      }

      setDuplicateMatches(null);
      setTimeout(() => router.push(`/hospital/${hospitalId}/doctors`), 400);
    } catch (err) {
      if (err instanceof ApiRequestError && err.details?.duplicates?.length) {
        setDuplicateMatches(err.details.duplicates);
        return;
      }
      console.error("Error saving doctor:", err);
      toast.error("Failed to save doctor. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!id) return;
    try {
      await deleteDoctor(id);
      toast.success("Doctor removed");
      router.push(`/hospital/${hospitalId}/doctors`);
    } catch (err) {
      console.error("Error deleting doctor:", err);
      toast.error("Failed to remove doctor");
    } finally {
      setConfirmDelete(false);
    }
  }

  if (!isNew && isDoctorLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-canvas">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-violet mx-auto mb-4"></div>
          <p className="text-ink-700">Loading doctor information...</p>
        </div>
      </div>
    );
  }

  const displayName = formData.name || (isNew ? "New doctor" : "Doctor");
  const shortId = id ? id.slice(-6).toUpperCase() : "";

  return (
    <div className="min-h-screen bg-surface-canvas pb-28">
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0 text-sm">
          <button
            onClick={() => router.push(`/hospital/${hospitalId}/doctors`)}
            className="flex items-center gap-2 p-2 -ml-2 rounded-lg text-ink-700 hover:bg-surface-paper transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-ink-500">Doctors</span>
          <span className="text-ink-500">/</span>
          <span className="font-semibold text-ink-900 truncate">
            {displayName}
          </span>
        </div>
        {!isNew && (
          <div className="flex items-center gap-4 text-sm shrink-0">
            <button
              onClick={() => toast("Coming soon")}
              className="text-ink-700 hover:text-brand-violet transition-colors"
            >
              View public profile
            </button>
            <button
              onClick={() => toast("Coming soon")}
              className="text-ink-700 hover:text-brand-violet transition-colors"
            >
              Appointment history
            </button>
          </div>
        )}
      </div>

      <div className="max-w-6xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 items-start">
        {/* Sidebar */}
        <aside className="space-y-4 lg:sticky lg:top-4">
          <div className="bg-surface-paper rounded-xl border border-border shadow-sm p-5">
            <div className="flex items-center gap-3">
              <DoctorAvatar name={displayName} size="lg" />
              <div className="min-w-0">
                <div className="font-bold text-ink-900 truncate">
                  {displayName}
                </div>
                <div className="text-xs text-ink-500 truncate">
                  {formData.specialization || "No specialization set"}
                </div>
              </div>
            </div>

            {!isNew && (
              <div className="mt-4 pt-4 border-t border-border space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-ink-500">Doctor ID</span>
                  <span className="font-mono text-xs text-ink-900">
                    DR-{shortId}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-500">Hospital</span>
                  <span className="text-ink-900 truncate ml-2">
                    {hospitalName || "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-500">Added</span>
                  <span className="font-mono tabular text-ink-900">
                    {formatAdded(doctorData?.doctor?.createdAt)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-500">Weekly capacity</span>
                  <span className="text-ink-900">
                    {weeklyCapacity} appointments
                  </span>
                </div>
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-border flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-ink-900">
                  Accepting bookings
                </div>
                <div className="text-xs text-ink-500">
                  Shown to patients when booking
                </div>
              </div>
              <ToggleSwitch
                checked={formData.status === "active"}
                disabled={!canEdit}
                onChange={(v) => update("status", v ? "active" : "inactive")}
              />
            </div>
          </div>

          <div className="bg-surface-paper rounded-xl border border-border shadow-sm p-2">
            {[
              {
                key: "personal" as const,
                ref: personalRef,
                label: "Personal",
                value: `${personalFilled}/4`,
                done: personalFilled > 0,
              },
              {
                key: "professional" as const,
                ref: professionalRef,
                label: "Professional",
                value: `${professionalFilled}/4`,
                done: professionalFilled > 0,
              },
              {
                key: "availability" as const,
                ref: availabilityRef,
                label: "Availability",
                value:
                  heldWeeklyCapacity > 0
                    ? `${onlineWeeklyCapacity} + ${heldWeeklyCapacity} held`
                    : `${weeklyCapacity} slots`,
                done: weeklyCapacity > 0,
              },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => scrollToSection(item.ref)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  activeSection === item.key
                    ? "bg-brand-violet-soft text-brand-violet font-semibold"
                    : "text-ink-700 hover:bg-surface-canvas"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${item.done ? "bg-status-open" : "bg-border"}`}
                  />
                  {item.label}
                </span>
                <span className="text-xs text-ink-500">{item.value}</span>
              </button>
            ))}
          </div>

          {!isNew && (
            <div className="px-1 text-xs text-ink-500 space-y-2">
              <p>Changes go live for patients as soon as you save.</p>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="text-status-danger hover:underline font-medium"
                >
                  Remove this doctor
                </button>
              )}
            </div>
          )}
        </aside>

        {/* Main content */}
        <div className="space-y-6 min-w-0">
          {/* Personal */}
          <section
            ref={personalRef}
            id="personal"
            className="bg-surface-paper rounded-xl border border-border shadow-sm p-5 md:p-6 scroll-mt-24"
          >
            <div className="mb-5">
              <h2 className="font-display tracking-tight text-lg font-bold text-ink-900">Personal</h2>
              <p className="text-sm text-ink-500">
                How patients and staff identify this doctor
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field
                label="Full name"
                required
                hint="Patients see this name on booking and prescriptions."
              >
                <input
                  value={formData.name}
                  disabled={!canEdit}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder="Dr. Jane Doe"
                  className={inputClass}
                />
              </Field>
              <Field
                label="Email"
                required
                hint="Used for login and appointment alerts."
              >
                <input
                  type="email"
                  value={formData.email}
                  disabled={!canEdit}
                  onChange={(e) => update("email", e.target.value)}
                  placeholder="doctor@example.com"
                  className={inputClass}
                />
              </Field>
              <Field label="Phone" hint="10 digits, no country code.">
                <div className="flex gap-2">
                  <span className="font-mono tabular flex items-center px-3 rounded-lg border border-border bg-surface-canvas text-sm text-ink-700 shrink-0">
                    +91
                  </span>
                  <input
                    value={formData.phone}
                    disabled={!canEdit}
                    onChange={(e) =>
                      update(
                        "phone",
                        e.target.value.replace(/\D/g, "").slice(0, 10),
                      )
                    }
                    placeholder="98765 43210"
                    className={`${inputClass} font-mono tabular`}
                  />
                </div>
              </Field>
              <Field label="Gender" optional>
                <PillGroup
                  options={GENDERS}
                  value={formData.gender}
                  disabled={!canEdit}
                  onChange={(v) => update("gender", v)}
                  onClear={() => update("gender", "")}
                />
              </Field>
              <Field label="Marital status" optional>
                <PillGroup
                  options={MARITAL_STATUSES}
                  value={formData.maritalStatus}
                  disabled={!canEdit}
                  onChange={(v) => update("maritalStatus", v)}
                  onClear={() => update("maritalStatus", "")}
                />
              </Field>
            </div>
          </section>

          {/* Professional */}
          <section
            ref={professionalRef}
            id="professional"
            className="bg-surface-paper rounded-xl border border-border shadow-sm p-5 md:p-6 scroll-mt-24"
          >
            <div className="mb-5">
              <h2 className="font-display tracking-tight text-lg font-bold text-ink-900">Professional</h2>
              <p className="text-sm text-ink-500">
                What this doctor practises and where
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field
                label="Specialization"
                required
                hint="Patients filter by this when booking."
              >
                <select
                  value={formData.specialization}
                  disabled={!canEdit}
                  onChange={(e) => update("specialization", e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select a specialization</option>
                  {SPECIALIZATIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label="Years of experience"
                optional
                hint="Shown on the doctor's profile card."
              >
                <input
                  type="number"
                  min={0}
                  value={formData.experience}
                  disabled={!canEdit}
                  onChange={(e) => update("experience", e.target.value)}
                  placeholder="0"
                  className={inputClass}
                />
              </Field>
              <Field
                label="Qualification"
                optional
                hint="Degrees and certifications, comma separated."
              >
                <input
                  value={formData.qualification}
                  disabled={!canEdit}
                  onChange={(e) => update("qualification", e.target.value)}
                  placeholder="MBBS, MD"
                  className={inputClass}
                />
              </Field>
              <Field
                label="Consultation fee"
                optional
                hint="Per appointment, before taxes."
              >
                <div className="flex gap-2">
                  <span className="font-mono tabular flex items-center px-3 rounded-lg border border-border bg-surface-canvas text-sm text-ink-700 shrink-0">
                    ₹
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={formData.consultationFee ?? ""}
                    disabled={!canEdit}
                    onChange={(e) =>
                      update(
                        "consultationFee",
                        e.target.value ? Number(e.target.value) : undefined,
                      )
                    }
                    placeholder="500"
                    className={`${inputClass} font-mono tabular`}
                  />
                </div>
              </Field>
              <div className="md:col-span-2">
                <Field
                  label="Clinic address"
                  optional
                  hint="Appears in booking confirmations and reminders."
                >
                  <textarea
                    value={formData.address}
                    disabled={!canEdit}
                    onChange={(e) => update("address", e.target.value)}
                    placeholder="Block, street, area, city, PIN"
                    rows={3}
                    className={`${inputClass} resize-none`}
                  />
                </Field>
              </div>
            </div>
          </section>

          {/* Availability */}
          <section
            ref={availabilityRef}
            id="availability"
            className="bg-surface-paper rounded-xl border border-border shadow-sm p-5 md:p-6 scroll-mt-24"
          >
            <div className="mb-5">
              <h2 className="font-display tracking-tight text-lg font-bold text-ink-900">Availability</h2>
              <p className="text-sm text-ink-500">
                The hours patients can book, and how long each visit runs
              </p>
            </div>

            <div className="bg-surface-canvas rounded-xl p-4 mb-5">
              <div className="mb-4">
                <h3 className="font-display tracking-tight text-sm font-bold text-ink-900">
                  Booking rules
                </h3>
                <p className="text-xs text-ink-500">
                  These turn working hours into bookable slots. Changing one
                  re-resolves every future day.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field label="Appointment length" hint="minutes per patient">
                  <select
                    value={formData.appointmentDuration}
                    disabled={!canEdit}
                    onChange={(e) =>
                      update("appointmentDuration", Number(e.target.value))
                    }
                    className={inputClass}
                  >
                    {DURATIONS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Gap after each" hint="minutes to reset the room">
                  <select
                    value={formData.bufferMinutes}
                    disabled={!canEdit}
                    onChange={(e) =>
                      update("bufferMinutes", Number(e.target.value))
                    }
                    className={inputClass}
                  >
                    {GAPS.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Patients per slot" hint="above 1 allows overlap">
                  <select
                    value={formData.patientsPerSlot}
                    disabled={!canEdit}
                    onChange={(e) =>
                      update("patientsPerSlot", Number(e.target.value))
                    }
                    className={inputClass}
                  >
                    {PATIENTS_PER_SLOT.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <RuleRow
                label="How long visits actually take"
                hint="Measured from this month's completed visits — drives the wait estimate patients see."
              >
                <span className="rounded-lg bg-status-open-soft border border-status-open/20 px-3 py-1.5 text-xs font-mono tabular font-semibold text-status-open whitespace-nowrap">
                  {avgConsultationMinutes != null
                    ? `${avgConsultationMinutes} min average`
                    : "Not enough data yet"}
                </span>
              </RuleRow>

              <RuleRow
                label="Accept walk-ins"
                hint="Off means the desk can only book them into a future slot."
              >
                <ToggleSwitch
                  checked={formData.acceptWalkIns}
                  disabled={!canEdit}
                  onChange={(v) => update("acceptWalkIns", v)}
                />
              </RuleRow>

              {formData.acceptWalkIns && (
                <>
                  <RuleRow
                    label="Slots held back for walk-ins"
                    hint="Per session. Patients booking online never see these."
                  >
                    <select
                      value={formData.heldSlotsPerSession}
                      disabled={!canEdit}
                      onChange={(e) =>
                        update("heldSlotsPerSession", Number(e.target.value))
                      }
                      className={`${inputClass} !w-auto`}
                    >
                      {HELD_SLOT_OPTIONS.map((n) => (
                        <option key={n} value={n}>
                          {n === 0 ? "None" : `${n} slot${n > 1 ? "s" : ""}`}
                        </option>
                      ))}
                    </select>
                  </RuleRow>

                  <RuleRow
                    label="Release unused held slots"
                    hint="If nobody has walked in by then, open them to online booking."
                  >
                    <select
                      value={formData.releaseHeldSlotsBeforeMinutes ?? "never"}
                      disabled={!canEdit}
                      onChange={(e) =>
                        update(
                          "releaseHeldSlotsBeforeMinutes",
                          e.target.value === "never"
                            ? null
                            : Number(e.target.value),
                        )
                      }
                      className={`${inputClass} !w-auto`}
                    >
                      {RELEASE_HELD_OPTIONS.map((o) => (
                        <option key={o.label} value={o.value ?? "never"}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </RuleRow>

                  <RuleRow
                    label="When the session is already full"
                    hint="A walk-in beyond capacity pushes the session past its end time."
                  >
                    <select
                      value={formData.overCapacityPolicy}
                      disabled={!canEdit}
                      onChange={(e) =>
                        update(
                          "overCapacityPolicy",
                          e.target.value as FormState["overCapacityPolicy"],
                        )
                      }
                      className={`${inputClass} !w-auto`}
                    >
                      {OVER_CAPACITY_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </RuleRow>

                  <RuleRow
                    label="Late arrival & no-show"
                    hint="Within the grace period a booked patient keeps their place ahead of walk-ins; after the release time the slot becomes free capacity."
                  >
                    <div className="flex items-center gap-2">
                      <select
                        value={formData.lateArrivalGraceMinutes}
                        disabled={!canEdit}
                        onChange={(e) =>
                          update(
                            "lateArrivalGraceMinutes",
                            Number(e.target.value),
                          )
                        }
                        className={`${inputClass} !w-auto`}
                      >
                        {GRACE_MINUTE_OPTIONS.map((m) => (
                          <option key={m} value={m}>
                            {m} min grace
                          </option>
                        ))}
                      </select>
                      <select
                        value={formData.noShowReleaseMinutes}
                        disabled={!canEdit}
                        onChange={(e) =>
                          update(
                            "noShowReleaseMinutes",
                            Number(e.target.value),
                          )
                        }
                        className={`${inputClass} !w-auto`}
                      >
                        {NO_SHOW_RELEASE_OPTIONS.map((m) => (
                          <option key={m} value={m}>
                            release at {m} min
                          </option>
                        ))}
                      </select>
                    </div>
                  </RuleRow>
                </>
              )}
            </div>

            {canEdit && (
              <div className="flex flex-wrap gap-2 mb-5">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className="px-3 py-1.5 rounded-full border border-border text-xs font-medium text-ink-700 hover:border-brand-violet hover:text-brand-violet transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            )}

            <div className="hidden sm:flex justify-between pl-[152px] pr-2 text-xs text-ink-500 mb-1">
              <span className="font-mono tabular">7a</span>
              <span className="font-mono tabular">10a</span>
              <span className="font-mono tabular">1p</span>
              <span className="font-mono tabular">4p</span>
              <span className="font-mono tabular">7p</span>
              <span className="font-mono tabular">10p</span>
            </div>

            <div className="border-t border-border">
              {DAYS.map((day) => {
                const slots = daySlots(day);
                const open = slots.length > 0;
                return (
                  <div
                    key={day}
                    className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-2 sm:gap-4 py-4 border-b border-border last:border-b-0"
                  >
                    <div className="flex items-center gap-3">
                      <ToggleSwitch
                        checked={open}
                        disabled={!canEdit}
                        onChange={(v) => toggleDay(day, v)}
                      />
                      <span className="font-medium text-ink-900 text-sm">
                        {day}
                      </span>
                    </div>
                    <div>
                      {!open ? (
                        <p className="text-sm text-ink-500 sm:pt-1">
                          Closed — patients can&apos;t book {day}.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          <div className="relative h-6 rounded-md bg-surface-canvas overflow-hidden">
                            {slots.map((slot, i) => {
                              const { left, width } = barStyle(slot);
                              const total = slotCapacity(
                                slot,
                                formData.appointmentDuration,
                                formData.bufferMinutes,
                              );
                              const held = blockHeldSlots(
                                slot,
                                formData.appointmentDuration,
                                formData.bufferMinutes,
                                formData.heldSlotsPerSession,
                                formData.acceptWalkIns,
                              );
                              const heldFrac = total ? held / total : 0;
                              const widthNum = parseFloat(width);
                              const heldWidth = widthNum * heldFrac;
                              const bookableWidth = widthNum - heldWidth;
                              return [
                                <div
                                  key={`${i}-bookable`}
                                  className="absolute top-0 h-full bg-status-open/70 rounded-l"
                                  style={{ left, width: `${bookableWidth}%` }}
                                />,
                                held > 0 ? (
                                  <div
                                    key={`${i}-held`}
                                    className="absolute top-0 h-full rounded-r bg-[repeating-linear-gradient(135deg,rgba(125,132,158,0.35)_0px,rgba(125,132,158,0.35)_5px,transparent_5px,transparent_10px)]"
                                    style={{
                                      left: `calc(${left} + ${bookableWidth}%)`,
                                      width: `${heldWidth}%`,
                                    }}
                                  />
                                ) : null,
                              ];
                            })}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {slots.map((slot, i) => {
                              const total = slotCapacity(
                                slot,
                                formData.appointmentDuration,
                                formData.bufferMinutes,
                              );
                              const held = blockHeldSlots(
                                slot,
                                formData.appointmentDuration,
                                formData.bufferMinutes,
                                formData.heldSlotsPerSession,
                                formData.acceptWalkIns,
                              );
                              const bookableAppts =
                                (total - held) * formData.patientsPerSlot;
                              const heldAppts = held * formData.patientsPerSlot;
                              return [
                                <span
                                  key={`${i}-slot`}
                                  className="inline-flex items-center gap-0 rounded-lg border border-status-open/30 bg-status-open-soft pl-2.5 pr-1 py-1 text-xs font-medium text-ink-900"
                                >
                                  {formatTime(slot.startTime)} –{" "}
                                  {formatTime(slot.endTime)}
                                  <span className="ml-2 pl-2 border-l border-status-open/30 text-ink-500 font-normal whitespace-nowrap">
                                    {bookableAppts} online
                                  </span>
                                  {canEdit && (
                                    <button
                                      type="button"
                                      onClick={() => removeSlot(day, slot)}
                                      className="ml-1 rounded-md p-0.5 text-ink-500 hover:text-status-danger hover:bg-status-danger-soft"
                                      aria-label="Remove slot"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  )}
                                </span>,
                                heldAppts > 0 ? (
                                  <span
                                    key={`${i}-held`}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-2.5 py-1 text-xs text-ink-500 whitespace-nowrap"
                                  >
                                    <span
                                      className="inline-block h-2.5 w-2.5 rounded-sm bg-[repeating-linear-gradient(135deg,rgba(125,132,158,0.5)_0px,rgba(125,132,158,0.5)_2px,transparent_2px,transparent_4px)]"
                                      aria-hidden="true"
                                    />
                                    {heldAppts} held for walk-ins
                                  </span>
                                ) : null,
                              ];
                            })}
                            {canEdit &&
                              (addingDay === day ? (
                                <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-paper px-2 py-1">
                                  <input
                                    type="time"
                                    value={slotDraft.start}
                                    onChange={(e) =>
                                      setSlotDraft((s) => ({
                                        ...s,
                                        start: e.target.value,
                                      }))
                                    }
                                    className="text-xs border border-border rounded px-1 py-0.5"
                                  />
                                  <span className="text-ink-500 text-xs">
                                    to
                                  </span>
                                  <input
                                    type="time"
                                    value={slotDraft.end}
                                    onChange={(e) =>
                                      setSlotDraft((s) => ({
                                        ...s,
                                        end: e.target.value,
                                      }))
                                    }
                                    className="text-xs border border-border rounded px-1 py-0.5"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => confirmAddSlot(day)}
                                    className="text-xs font-semibold text-brand-violet"
                                  >
                                    Add
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setAddingDay(null)}
                                    className="text-xs text-ink-500"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => openAddSlot(day)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-dashed border-border px-2.5 py-1 text-xs font-medium text-ink-700 hover:border-brand-violet hover:text-brand-violet"
                                >
                                  <Plus className="w-3 h-3" /> Add hours
                                </button>
                              ))}
                          </div>
                          {(() => {
                            const dayHeld = slots.reduce(
                              (sum, slot) =>
                                sum +
                                blockHeldSlots(
                                  slot,
                                  formData.appointmentDuration,
                                  formData.bufferMinutes,
                                  formData.heldSlotsPerSession,
                                  formData.acceptWalkIns,
                                ),
                              0,
                            );
                            if (!formData.acceptWalkIns || dayHeld <= 0)
                              return null;
                            const dayTotal = slots.reduce(
                              (sum, slot) =>
                                sum +
                                slotCapacity(
                                  slot,
                                  formData.appointmentDuration,
                                  formData.bufferMinutes,
                                ),
                              0,
                            );
                            const perSlot = Math.max(
                              1,
                              formData.patientsPerSlot,
                            );
                            return (
                              <p className="text-xs text-ink-500">
                                <span className="font-mono tabular font-semibold text-ink-700">
                                  {dayTotal * perSlot}
                                </span>{" "}
                                slots ·{" "}
                                <span className="font-mono tabular font-semibold text-ink-700">
                                  {(dayTotal - dayHeld) * perSlot}
                                </span>{" "}
                                bookable online ·{" "}
                                <span className="font-mono tabular font-semibold text-ink-700">
                                  {dayHeld * perSlot}
                                </span>{" "}
                                held for walk-ins
                              </p>
                            );
                          })()}
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => copyToAllOpenDays(day)}
                              className="text-xs font-medium text-brand-violet hover:underline"
                            >
                              Copy to all open days
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 rounded-xl bg-status-open-soft border border-status-open/20 p-4 flex flex-wrap items-center gap-x-8 gap-y-3 justify-between">
              <div className="flex flex-wrap gap-x-8 gap-y-3">
                <div>
                  <div className="text-xl font-bold text-status-open">
                    {weekHours(formData.availability)}h
                  </div>
                  <div className="text-xs text-ink-500">Open per week</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-status-open">
                    {heldWeeklyCapacity > 0
                      ? onlineWeeklyCapacity
                      : weeklyCapacity}
                  </div>
                  <div className="text-xs text-ink-500">
                    Bookable {heldWeeklyCapacity > 0 ? "online" : "appointments"}
                  </div>
                </div>
                {heldWeeklyCapacity > 0 && (
                  <div>
                    <div className="text-xl font-bold text-status-open">
                      {heldWeeklyCapacity}
                    </div>
                    <div className="text-xs text-ink-500">
                      Held for walk-ins
                    </div>
                  </div>
                )}
                <div>
                  <div className="text-xl font-bold text-status-open">
                    {workingDays}
                  </div>
                  <div className="text-xs text-ink-500">Working days</div>
                </div>
              </div>
              <p className="text-xs text-ink-500 max-w-xs text-right">
                {heldWeeklyCapacity > 0
                  ? `${onlineWeeklyCapacity} bookable online, ${heldWeeklyCapacity} kept back for people who walk in — about ${weeklyCapacity} patients a week.`
                  : `At ${formData.appointmentDuration} minutes each, that's about ${weeklyCapacity} patients a week.`}
              </p>
            </div>
          </section>
        </div>
      </div>

      {/* Sticky footer */}
      <div className="fixed bottom-0 inset-x-0 bg-surface-paper border-t border-border shadow-[0_-2px_8px_rgba(0,0,0,0.04)] z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <span className="text-sm text-ink-500">
            {isDirty
              ? "Unsaved changes"
              : isNew
                ? "Fill in the required fields to add this doctor"
                : "No changes yet"}
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={discardChanges}
              disabled={!isDirty || saving}
              className="px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-ink-700 hover:bg-surface-canvas transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isNew ? "Clear form" : "Discard changes"}
            </button>
            <button
              type="button"
              onClick={() => saveDoctor()}
              disabled={!canEdit || !isDirty || saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-violet hover:bg-brand-violet-hover text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isNew ? "Add doctor" : "Save changes"}
            </button>
          </div>
        </div>
      </div>

      {confirmDelete && (
        <ConfirmDeleteModal
          data={confirmDelete}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={handleDelete}
          isDeleting={isDeleting}
          title="Remove this doctor?"
          message={`This will remove ${displayName} from the hospital roster. Patients will no longer be able to book with them.`}
          confirmText="Remove doctor"
        />
      )}

      {duplicateMatches && (
        <DuplicateWarningModal
          entityLabel="doctor"
          phone={formData.phone}
          matches={duplicateMatches}
          onCancel={() => setDuplicateMatches(null)}
          onConfirm={() => saveDoctor(true)}
          isSubmitting={saving}
          viewHrefFor={(doctorId) =>
            `/hospital/${hospitalId}/doctors/${doctorId}`
          }
        />
      )}
    </div>
  );
}
