"use client";

import { format } from "date-fns";
import { ArrowLeft, Loader2 } from "lucide-react";
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
} from "@/components/common/EditFormControls";
import { useAuth } from "@/hooks/useAuth";
import { useHospitalPatient, usePatientApi } from "@/hooks/useNewPatientApi";
import { ApiRequestError } from "@/lib/api";
import { paletteFor } from "@/lib/avatarPalette";
import { patientStatusConfig } from "@/lib/patientStatus";
import type { CreatePatientData, UpdatePatientData } from "@/types/patientNew";
import { calculateAge } from "@/utils/dateUtils";
import { GENDER } from "../../constants";

interface AddEditPatientProps {
  isNew?: boolean;
  id?: string;
  userRole?: string;
  canEdit?: boolean;
  hospitalId?: string;
}

const GENDERS = [GENDER.MALE, GENDER.FEMALE, GENDER.OTHER];
const STATUSES: Array<"active" | "inactive" | "archived"> = [
  "active",
  "inactive",
  "archived",
];

type FormState = {
  name: string;
  email: string;
  phone: string;
  secondaryPhone: string;
  dateOfBirth: string;
  gender: string;
  address: string;
  notes: string;
  status: "active" | "inactive" | "archived" | "approved" | "pending";
};

const EMPTY_FORM: FormState = {
  name: "",
  email: "",
  phone: "",
  secondaryPhone: "",
  dateOfBirth: "",
  gender: "",
  address: "",
  notes: "",
  status: "active",
};

function getInitials(name?: string): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "P";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

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

export default function AddEditPatient1({
  isNew = false,
  id,
  hospitalId,
  canEdit = true,
}: AddEditPatientProps) {
  const { navigateToHospitalRoute } = useAuth();
  const { createPatient, updatePatient, deletePatient, isDeleting } =
    usePatientApi(hospitalId, undefined, true);
  const {
    data: patientData,
    isLoading: isPatientLoading,
    error: patientError,
  } = useHospitalPatient(id || "", hospitalId);

  const [formData, setFormData] = useState<FormState>(EMPTY_FORM);
  const [initialData, setInitialData] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [duplicateMatches, setDuplicateMatches] = useState<
    DuplicateMatch[] | null
  >(null);
  const [activeSection, setActiveSection] = useState<
    "personal" | "contact" | "notes"
  >("personal");

  const personalRef = useRef<HTMLDivElement>(null);
  const contactRef = useRef<HTMLDivElement>(null);
  const notesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isNew && patientData?.patient) {
      const p = patientData.patient;
      const next: FormState = {
        name: p.name || "",
        email: p.email || "",
        phone: p.phone || "",
        secondaryPhone: p.secondaryPhone || "",
        dateOfBirth: p.dateOfBirth || "",
        gender: p.gender || "",
        address: p.address || "",
        notes: p.notes || "",
        status: (p.status as FormState["status"]) || "active",
      };
      setFormData(next);
      setInitialData(next);
    }
  }, [isNew, patientData]);

  useEffect(() => {
    const sections: [HTMLDivElement | null, typeof activeSection][] = [
      [personalRef.current, "personal"],
      [contactRef.current, "contact"],
      [notesRef.current, "notes"],
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

  const personalFilled = [
    formData.name,
    formData.dateOfBirth,
    formData.gender,
  ].filter(Boolean).length;
  const contactFilled = [
    formData.email,
    formData.phone,
    formData.secondaryPhone,
    formData.address,
  ].filter(Boolean).length;
  const age = formData.dateOfBirth ? calculateAge(formData.dateOfBirth) : null;

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  function scrollToSection(ref: React.RefObject<HTMLDivElement | null>) {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function discardChanges() {
    setFormData(initialData);
  }

  async function savePatient(confirmDuplicate = false) {
    if (!formData.name.trim() || !formData.dateOfBirth) {
      toast.error("Please fill in Name and Date of Birth");
      return;
    }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    setSaving(true);
    try {
      const basePayload = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        secondaryPhone: formData.secondaryPhone,
        dateOfBirth: formData.dateOfBirth,
        gender: formData.gender as GENDER,
        address: formData.address,
        notes: formData.notes,
      };

      if (isNew) {
        await createPatient({
          ...basePayload,
          confirmDuplicate,
        } as CreatePatientData);
        toast.success("Patient added successfully");
      } else if (id) {
        await updatePatient(id, {
          ...basePayload,
          status: formData.status,
        } as UpdatePatientData);
        toast.success("Patient updated successfully");
        setInitialData(formData);
      }

      setDuplicateMatches(null);
      setTimeout(() => navigateToHospitalRoute("patients", hospitalId), 400);
    } catch (err) {
      if (err instanceof ApiRequestError && err.details?.duplicates?.length) {
        setDuplicateMatches(err.details.duplicates);
        return;
      }
      console.error("Error saving patient:", err);
      toast.error(`Failed to ${isNew ? "add" : "update"} patient`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!id) return;
    try {
      await deletePatient(id);
      toast.success("Patient removed");
      navigateToHospitalRoute("patients", hospitalId);
    } catch (err) {
      console.error("Error deleting patient:", err);
      toast.error("Failed to remove patient");
    } finally {
      setConfirmDelete(false);
    }
  }

  if (!isNew && isPatientLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-canvas">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-violet mx-auto mb-4"></div>
          <p className="text-ink-700">Loading patient information...</p>
        </div>
      </div>
    );
  }

  if (!isNew && patientError) {
    return (
      <div className="min-h-screen bg-surface-canvas flex items-center justify-center px-4">
        <div className="bg-status-danger-soft border border-status-danger/20 rounded-xl p-6 text-center max-w-md">
          <h3 className="text-lg font-semibold text-status-danger mb-2">
            Error loading patient
          </h3>
          <p className="text-status-danger text-sm">{patientError.message}</p>
          <button
            onClick={() => navigateToHospitalRoute("patients", hospitalId)}
            className="mt-4 px-4 py-2 bg-status-danger text-white rounded-lg hover:bg-status-danger-hover text-sm font-medium"
          >
            Return to patients
          </button>
        </div>
      </div>
    );
  }

  const displayName = formData.name || (isNew ? "New patient" : "Patient");
  const patientCode = patientData?.patient?.patientId;
  const shortId = id ? id.slice(-6).toUpperCase() : "";
  const [c1, c2] = paletteFor(displayName);
  const status = patientStatusConfig(formData.status);

  return (
    <div className="min-h-screen bg-surface-canvas pb-28">
      <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-2 text-sm">
        <button
          onClick={() => navigateToHospitalRoute("patients", hospitalId)}
          className="flex items-center gap-2 p-2 -ml-2 rounded-lg text-ink-700 hover:bg-surface-paper transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <span className="text-ink-500">Patients</span>
        <span className="text-ink-500">/</span>
        <span className="font-semibold text-ink-900 truncate">
          {displayName}
        </span>
      </div>

      <div className="max-w-5xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 items-start">
        {/* Sidebar */}
        <aside className="space-y-4 lg:sticky lg:top-4">
          <div className="bg-surface-paper rounded-xl border border-border shadow-sm p-5">
            <div className="flex items-center gap-3">
              <div
                className="w-14 h-14 rounded-lg flex items-center justify-center text-white font-semibold text-lg shrink-0 shadow-sm"
                style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}
              >
                {getInitials(displayName)}
              </div>
              <div className="min-w-0">
                <div className="font-bold text-ink-900 truncate">
                  {displayName}
                </div>
                <div className="text-xs text-ink-500 truncate">
                  {formData.gender || "Gender not set"}
                  {age !== null && ` · ${age} yrs`}
                </div>
              </div>
            </div>

            {!isNew && (
              <div className="mt-4 pt-4 border-t border-border space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-ink-500">Patient ID</span>
                  <span className="font-mono text-xs text-ink-900">
                    #{patientCode || shortId}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-500">Age</span>
                  <span className="text-ink-900">
                    {age !== null ? `${age} years` : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-500">Added</span>
                  <span className="text-ink-900">
                    {formatAdded(patientData?.patient?.createdAt)}
                  </span>
                </div>
              </div>
            )}

            {!isNew && (
              <div className="mt-4 pt-4 border-t border-border">
                <div className="text-sm font-medium text-ink-900 mb-2">
                  Status
                </div>
                <PillGroup
                  options={STATUSES}
                  value={
                    STATUSES.includes(formData.status as any)
                      ? formData.status
                      : ""
                  }
                  disabled={!canEdit}
                  onChange={(v) => update("status", v as FormState["status"])}
                />
                <span
                  className={`inline-flex items-center gap-1.5 mt-2.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${status.bg} ${status.text}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                  {status.label}
                </span>
              </div>
            )}
          </div>

          <div className="bg-surface-paper rounded-xl border border-border shadow-sm p-2">
            {[
              {
                key: "personal" as const,
                ref: personalRef,
                label: "Personal",
                value: `${personalFilled}/3`,
                done: personalFilled > 0,
              },
              {
                key: "contact" as const,
                ref: contactRef,
                label: "Contact",
                value: `${contactFilled}/4`,
                done: contactFilled > 0,
              },
              {
                key: "notes" as const,
                ref: notesRef,
                label: "Notes",
                value: formData.notes.trim() ? "Added" : "Empty",
                done: !!formData.notes.trim(),
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
              <p>Changes are saved to this patient's record when you save.</p>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="text-status-danger hover:underline font-medium"
                >
                  Remove this patient
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
              <h2 className="text-lg font-bold text-ink-900">Personal</h2>
              <p className="text-sm text-ink-500">Who this patient is</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field
                label="Full name"
                required
                hint="Used on records and appointment bookings."
              >
                <input
                  value={formData.name}
                  disabled={!canEdit}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder="John Smith"
                  className={inputClass}
                />
              </Field>
              <Field
                label="Date of birth"
                required
                hint={age !== null ? `Age: ${age} years` : undefined}
              >
                <input
                  type="date"
                  value={formData.dateOfBirth}
                  disabled={!canEdit}
                  onChange={(e) => update("dateOfBirth", e.target.value)}
                  className={inputClass}
                />
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
            </div>
          </section>

          {/* Contact */}
          <section
            ref={contactRef}
            id="contact"
            className="bg-surface-paper rounded-xl border border-border shadow-sm p-5 md:p-6 scroll-mt-24"
          >
            <div className="mb-5">
              <h2 className="text-lg font-bold text-ink-900">Contact</h2>
              <p className="text-sm text-ink-500">How to reach this patient</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label="Email" optional hint="Used for appointment alerts.">
                <input
                  type="email"
                  value={formData.email}
                  disabled={!canEdit}
                  onChange={(e) => update("email", e.target.value)}
                  placeholder="patient@example.com"
                  className={inputClass}
                />
              </Field>
              <Field label="Phone" optional hint="10 digits, no country code.">
                <div className="flex gap-2">
                  <span className="flex items-center px-3 rounded-lg border border-border bg-surface-canvas text-sm text-ink-700 shrink-0">
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
                    className={inputClass}
                  />
                </div>
              </Field>
              <Field
                label="Secondary phone"
                optional
                hint="An alternate contact number, if any."
              >
                <div className="flex gap-2">
                  <span className="flex items-center px-3 rounded-lg border border-border bg-surface-canvas text-sm text-ink-700 shrink-0">
                    +91
                  </span>
                  <input
                    value={formData.secondaryPhone}
                    disabled={!canEdit}
                    onChange={(e) =>
                      update(
                        "secondaryPhone",
                        e.target.value.replace(/\D/g, "").slice(0, 10),
                      )
                    }
                    placeholder="98765 43210"
                    className={inputClass}
                  />
                </div>
              </Field>
              <div className="md:col-span-2">
                <Field
                  label="Address"
                  optional
                  hint="Appears on records and home-visit requests."
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

          {/* Notes */}
          <section
            ref={notesRef}
            id="notes"
            className="bg-surface-paper rounded-xl border border-border shadow-sm p-5 md:p-6 scroll-mt-24"
          >
            <div className="mb-5">
              <h2 className="text-lg font-bold text-ink-900">Notes</h2>
              <p className="text-sm text-ink-500">
                Internal notes — not shown to the patient
              </p>
            </div>
            <Field label="Additional notes" optional>
              <textarea
                value={formData.notes}
                disabled={!canEdit}
                onChange={(e) => update("notes", e.target.value)}
                placeholder="Any additional information about the patient..."
                rows={4}
                className={`${inputClass} resize-none`}
              />
            </Field>
          </section>
        </div>
      </div>

      {/* Sticky footer */}
      <div className="fixed bottom-0 inset-x-0 bg-surface-paper border-t border-border shadow-[0_-2px_8px_rgba(0,0,0,0.04)] z-30">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <span className="text-sm text-ink-500">
            {isDirty
              ? "Unsaved changes"
              : isNew
                ? "Fill in the required fields to add this patient"
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
              onClick={() => savePatient()}
              disabled={!canEdit || !isDirty || saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-violet hover:bg-brand-violet-hover text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isNew ? "Add patient" : "Save changes"}
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
          title="Remove this patient?"
          message={`This will remove ${displayName} from the hospital's patient records.`}
          confirmText="Remove patient"
        />
      )}

      {duplicateMatches && (
        <DuplicateWarningModal
          entityLabel="patient"
          phone={formData.phone}
          matches={duplicateMatches}
          onCancel={() => setDuplicateMatches(null)}
          onConfirm={() => savePatient(true)}
          isSubmitting={saving}
          viewHrefFor={(patientId) =>
            `/hospital/${hospitalId}/patients/${patientId}`
          }
        />
      )}
    </div>
  );
}
