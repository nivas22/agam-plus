"use client";

import {
  Calendar,
  Clock,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Stethoscope,
  Trash2,
  UserCircle2,
  X,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { paletteFor } from "@/lib/avatarPalette";
import { patientStatusConfig } from "@/lib/patientStatus";
import type { Appointment } from "@/types/appointment";
import type { Patient } from "@/types/patientNew";
import { calculateAge, formatAppointmentDate } from "@/utils/dateUtils";

interface PatientDetailSidebarProps {
  patient: Patient | null;
  onClose: () => void;
  onEdit?: (patient: Patient) => void;
  onDelete?: (patient: Patient) => void;
  futureAppointments?: Appointment[];
  canEdit?: boolean;
}

const getInitials = (name?: string) => {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "P";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export default function PatientDetailSidebar({
  patient,
  onClose,
  onEdit,
  onDelete,
  futureAppointments = [],
  canEdit = true,
}: PatientDetailSidebarProps) {
  const [renderedPatient, setRenderedPatient] = useState<Patient | null>(
    patient,
  );
  const [closing, setClosing] = useState(false);
  const router = useRouter();
  const params = useParams();
  const hospitalId = params.id as string;

  useEffect(() => {
    if (patient) {
      setRenderedPatient(patient);
      setClosing(false);
      return;
    }

    setClosing(true);
    // Keep the last patient rendered while the close animation plays out.
    const timeout = setTimeout(() => setRenderedPatient(null), 300);
    return () => clearTimeout(timeout);
  }, [patient]);

  if (!renderedPatient) return null;
  const p = renderedPatient;
  const status = patientStatusConfig(p.status);
  const [c1, c2] = paletteFor(p.name || "Patient");
  const initials = getInitials(p.name);
  const age = p.dateOfBirth ? calculateAge(p.dateOfBirth) : null;

  const patientAppointments = futureAppointments
    .filter((appt) => appt.patientId === p.id)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const nextAppointment = patientAppointments[0] || null;

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
              <div
                className="w-14 h-14 rounded-lg flex items-center justify-center text-white font-semibold text-lg shrink-0 shadow-sm"
                style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}
              >
                {initials}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-ink-900 truncate font-display tracking-tight">
                    {p.name || "Unnamed Patient"}
                  </h2>
                  {p.patientId && (
                    <span className="px-2 py-0.5 bg-brand-violet-soft text-brand-violet text-xs font-semibold rounded-md shrink-0 font-mono tabular">
                      #{p.patientId}
                    </span>
                  )}
                </div>
                <p className="text-sm text-ink-500 truncate">
                  {p.gender
                    ? p.gender.charAt(0).toUpperCase() +
                      p.gender.slice(1).toLowerCase()
                    : "Unknown"}
                  {age !== null && ` · ${age} yrs`}
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
                    router.push(`/hospital/${hospitalId}/patients/${p.id}`)
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
                  onClick={() => onEdit(p)}
                  className="p-2 rounded-lg text-ink-500 hover:text-brand-violet hover:bg-brand-violet-soft transition-colors"
                  title="Edit patient"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              )}
              {canEdit && onDelete && (
                <button
                  onClick={() => onDelete(p)}
                  className="p-2 rounded-lg text-ink-500 hover:text-status-danger hover:bg-status-danger-soft transition-colors"
                  title="Delete patient"
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
            <h3 className="text-xs font-bold uppercase tracking-wide text-ink-500 font-display tracking-tight">
              Contact
            </h3>
            <div className="space-y-2.5">
              {p.email && (
                <div className="flex items-center gap-3 text-sm text-ink-700">
                  <Mail className="w-4 h-4 text-ink-500 shrink-0" />
                  <span className="truncate">{p.email}</span>
                </div>
              )}
              {p.phone && (
                <div className="flex items-center gap-3 text-sm text-ink-700">
                  <Phone className="w-4 h-4 text-ink-500 shrink-0" />
                  <span className="font-mono tabular">{p.phone}</span>
                </div>
              )}
              {p.address && (
                <div className="flex items-center gap-3 text-sm text-ink-700">
                  <MapPin className="w-4 h-4 text-ink-500 shrink-0" />
                  <span className="truncate">{p.address}</span>
                </div>
              )}
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wide text-ink-500 font-display tracking-tight">
              Next Appointment
            </h3>
            {nextAppointment ? (
              <div className="bg-brand-violet-soft rounded-xl p-3.5 border border-brand-violet/20">
                <div className="flex items-center gap-3">
                  <div className="bg-surface-paper rounded-lg shadow-sm px-2.5 py-1.5 text-center shrink-0">
                    <div className="text-brand-violet font-bold text-base leading-none font-mono tabular">
                      {formatAppointmentDate(nextAppointment.date).day}
                    </div>
                    <div className="text-brand-violet text-[10px] uppercase leading-none mt-0.5">
                      {formatAppointmentDate(nextAppointment.date).month}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-ink-900 truncate font-mono tabular">
                      {formatAppointmentDate(nextAppointment.date).date}
                    </div>
                    <div className="text-xs text-ink-700 flex items-center gap-1 font-mono tabular">
                      <Clock className="w-3 h-3 text-brand-violet shrink-0" />
                      {nextAppointment.time}
                    </div>
                  </div>
                </div>
                {nextAppointment.doctor?.name && (
                  <div className="mt-2.5 pt-2.5 border-t border-brand-violet/20 flex items-center gap-2 text-sm text-ink-700">
                    <Stethoscope className="w-3.5 h-3.5 text-brand-violet shrink-0" />
                    <span className="truncate">
                      Dr. {nextAppointment.doctor.name}
                      {nextAppointment.doctor.specialization && (
                        <span className="text-ink-500">
                          {" "}
                          ({nextAppointment.doctor.specialization})
                        </span>
                      )}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-surface-canvas rounded-xl p-4 border border-border text-center">
                <Calendar className="w-5 h-5 text-ink-500 mx-auto mb-1.5" />
                <p className="text-sm text-ink-500">No upcoming appointments</p>
              </div>
            )}
            {patientAppointments.length > 1 && (
              <div className="space-y-2">
                {patientAppointments.slice(1, 4).map((appt, index) => (
                  <div
                    key={appt.id || index}
                    className="bg-surface-canvas rounded-lg p-2.5 border border-border"
                  >
                    <div className="text-sm font-medium text-ink-900 font-mono tabular">
                      {formatAppointmentDate(appt.date).date}
                    </div>
                    <div className="text-xs text-ink-500 flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3 shrink-0" />
                      {appt.time}
                      {appt.doctor?.name && ` · Dr. ${appt.doctor.name}`}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {p.notes && (
            <section className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wide text-ink-500 font-display tracking-tight">
                Notes
              </h3>
              <div className="bg-status-warning-soft border border-status-warning/20 rounded-xl p-3.5">
                <p className="text-sm text-ink-700">{p.notes}</p>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
