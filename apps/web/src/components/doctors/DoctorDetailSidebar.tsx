"use client";

import { formatDistanceToNowStrict } from "date-fns";
import {
  Briefcase,
  Calendar,
  GraduationCap,
  IndianRupee,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Trash2,
  UserCheck,
  UserCircle2,
  UserX,
  X,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { doctorStatusConfig } from "@/lib/doctorStatus";
import type { AvailabilitySlot } from "@/types/doctor";
import type { Doctor } from "@/types/doctorNew";
import DoctorAvatar from "./DoctorAvatar";

interface DoctorDetailSidebarProps {
  doctor: Doctor | null;
  onClose: () => void;
  onDelete?: (doctor: Doctor) => void;
  updateStatus?: (
    id: string,
    status: "pending" | "approved" | "rejected",
  ) => void;
  onEdit?: (doctor: Doctor) => void;
  canEdit?: boolean;
}

function groupAvailabilityByTime(
  availability: AvailabilitySlot[] | undefined,
): Record<string, { days: string[]; startTime: string; endTime: string }> {
  if (!availability || !Array.isArray(availability)) return {};

  const grouped: Record<
    string,
    { days: string[]; startTime: string; endTime: string }
  > = {};
  availability.forEach((item) => {
    const timeKey = `${item.startTime}-${item.endTime}`;
    if (!grouped[timeKey]) {
      grouped[timeKey] = {
        days: [],
        startTime: item.startTime,
        endTime: item.endTime,
      };
    }
    grouped[timeKey].days.push(item.day);
  });
  return grouped;
}

const DAY_NAMES: Record<string, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};
const DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

function formatDayName(day: string): string {
  return DAY_NAMES[day.toLowerCase()] || day;
}

function sortDays(days: string[]): string[] {
  return [...days].sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));
}

function formatTime(time: string): string {
  if (!time) return "";
  const [hours, minutes] = time.split(":");
  const h = parseInt(hours, 10);
  const period = h >= 12 ? "PM" : "AM";
  const displayHours = h % 12 || 12;
  return `${displayHours}:${minutes} ${period}`;
}

export default function DoctorDetailSidebar({
  doctor,
  onClose,
  onDelete,
  updateStatus,
  onEdit,
  canEdit = false,
}: DoctorDetailSidebarProps) {
  const [renderedDoctor, setRenderedDoctor] = useState<Doctor | null>(doctor);
  const [closing, setClosing] = useState(false);
  const router = useRouter();
  const params = useParams();
  const hospitalId = params.id as string;

  useEffect(() => {
    if (doctor) {
      setRenderedDoctor(doctor);
      setClosing(false);
      return;
    }

    setClosing(true);
    // Keep the last doctor rendered while the close animation plays out.
    const timeout = setTimeout(() => setRenderedDoctor(null), 300);
    return () => clearTimeout(timeout);
  }, [doctor]);

  if (!renderedDoctor) return null;
  const d = renderedDoctor;
  const status = doctorStatusConfig(d.membershipStatus);
  const groupedAvailability = groupAvailabilityByTime(d.availability);
  const joinedLabel = d.joinedAt
    ? `${formatDistanceToNowStrict(new Date(d.joinedAt))} ago`
    : null;

  const handleStatusChange = (next: "approved" | "rejected") => {
    if (canEdit && updateStatus && d.membershipId) {
      updateStatus(d.membershipId, next);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50">
      <div
        className={`absolute inset-0 bg-ink-900/40 ${closing ? "animate-sidebarFadeOut" : "animate-sidebarFadeIn"}`}
        onClick={onClose}
      />

      <div
        className={`absolute right-0 top-0 h-full w-full sm:w-[440px] bg-surface-paper shadow-2xl flex flex-col ${
          closing ? "animate-sidebarSlideOut" : "animate-sidebarSlideIn"
        }`}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-border bg-gradient-to-br from-brand-violet-soft to-white shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <DoctorAvatar name={d.name} size="lg" />
              <div className="min-w-0">
                <h2 className="text-base font-bold text-ink-900 truncate">
                  Dr. {d.name}
                </h2>
                <p className="text-sm text-ink-500 truncate">
                  {d.specialization || "General Practitioner"}
                </p>
                <span
                  className={`inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${status.bg} ${status.text}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                  {status.label}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    router.push(`/hospital/${hospitalId}/doctors/${d.id}`)
                  }
                  className="flex items-center gap-1 mt-1.5 text-xs font-medium text-brand-violet hover:underline"
                >
                  <UserCircle2 className="w-3.5 h-3.5" /> View full profile
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {canEdit && onEdit && (
                <button
                  onClick={() => onEdit(d)}
                  className="p-2 rounded-lg text-ink-500 hover:text-brand-violet hover:bg-brand-violet-soft transition-colors"
                  title="Edit doctor"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              )}
              {canEdit && onDelete && (
                <button
                  onClick={() => onDelete(d)}
                  className="p-2 rounded-lg text-ink-500 hover:text-status-danger hover:bg-status-danger-soft transition-colors"
                  title="Delete doctor"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-ink-500 hover:text-ink-700 hover:bg-surface-canvas transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wide text-ink-500">
              Contact
            </h3>
            <div className="space-y-2.5">
              {d.email && (
                <div className="flex items-center gap-3 text-sm text-ink-700">
                  <Mail className="w-4 h-4 text-ink-500 shrink-0" />
                  <span className="truncate">{d.email}</span>
                </div>
              )}
              {d.phone && (
                <div className="flex items-center gap-3 text-sm text-ink-700">
                  <Phone className="w-4 h-4 text-ink-500 shrink-0" />
                  <span>{d.phone}</span>
                </div>
              )}
              {(d.address || d.location) && (
                <div className="flex items-center gap-3 text-sm text-ink-700">
                  <MapPin className="w-4 h-4 text-ink-500 shrink-0" />
                  <span className="truncate">{d.address || d.location}</span>
                </div>
              )}
              {joinedLabel && (
                <div className="flex items-center gap-3 text-sm text-ink-700">
                  <Calendar className="w-4 h-4 text-ink-500 shrink-0" />
                  <span>Joined {joinedLabel}</span>
                </div>
              )}
            </div>
          </section>

          {(d.experience || d.qualification || d.consultationFee != null) && (
            <section className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wide text-ink-500">
                Professional
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {d.experience && (
                  <div className="bg-surface-canvas rounded-xl p-3">
                    <div className="flex items-center gap-2 text-ink-500 text-xs mb-1">
                      <Briefcase className="w-3.5 h-3.5" /> Experience
                    </div>
                    <div className="text-sm font-semibold text-ink-900">
                      {d.experience} yrs
                    </div>
                  </div>
                )}
                {d.qualification && (
                  <div className="bg-surface-canvas rounded-xl p-3">
                    <div className="flex items-center gap-2 text-ink-500 text-xs mb-1">
                      <GraduationCap className="w-3.5 h-3.5" /> Qualification
                    </div>
                    <div className="text-sm font-semibold text-ink-900 truncate">
                      {d.qualification}
                    </div>
                  </div>
                )}
                {d.consultationFee != null && (
                  <div className="bg-surface-canvas rounded-xl p-3">
                    <div className="flex items-center gap-2 text-ink-500 text-xs mb-1">
                      <IndianRupee className="w-3.5 h-3.5" /> Consultation Fee
                    </div>
                    <div className="text-sm font-semibold text-ink-900">
                      ₹{d.consultationFee}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wide text-ink-500">
              Availability
            </h3>
            <div className="space-y-2">
              {Object.keys(groupedAvailability).length > 0 ? (
                Object.values(groupedAvailability).map((slot, index) => (
                  <div
                    key={index}
                    className="bg-brand-violet-soft/60 border border-brand-violet/20 rounded-xl p-3"
                  >
                    <div className="text-sm font-medium text-ink-900">
                      {sortDays(slot.days).map(formatDayName).join(", ")}
                    </div>
                    <div className="text-xs text-ink-500 mt-0.5">
                      {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-ink-500 italic">
                  No availability set
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Footer */}
        {canEdit && d.membershipStatus === "pending" && (
          <div className="px-6 py-4 border-t border-border flex gap-3 shrink-0">
            <button
              onClick={() => handleStatusChange("approved")}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-violet hover:bg-brand-violet-hover text-white text-sm font-medium rounded-xl transition-colors"
            >
              <UserCheck className="w-4 h-4" /> Approve
            </button>
            <button
              onClick={() => handleStatusChange("rejected")}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-status-danger hover:bg-status-danger-hover text-white text-sm font-medium rounded-xl transition-colors"
            >
              <UserX className="w-4 h-4" /> Reject
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
