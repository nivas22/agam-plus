// components/prescriptions/PrescriptionWriterPage.tsx
"use client";

import {
  AlertTriangle,
  ArrowLeft,
  Loader2,
  MessageCircle,
  Printer,
  Search,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { inputClass } from "@/components/common/EditFormControls";
import { useAuth } from "@/hooks/useAuth";
import { useMedicines } from "@/hooks/useMedicineApi";
import { useHospitalAppointment } from "@/hooks/useNewAppointmentsApi";
import { useHospitalDoctor } from "@/hooks/useNewDoctorApi";
import { useHospitalPatient } from "@/hooks/useNewPatientApi";
import {
  usePrescription,
  useSavePrescription,
  useSetPrescriptionStatus,
} from "@/hooks/usePrescriptionApi";
import { ApiRequestError } from "@/lib/api";
import type { FoodTiming, Medicine } from "@/types/medicine";
import { FOOD_TIMING_OPTIONS } from "@/types/medicine";
import type { AllergyOverride, PrescriptionItem } from "@/types/prescription";

interface PrescriptionWriterPageProps {
  hospitalId: string;
  appointmentId: string;
}

function lower(s?: string): string {
  return (s || "").trim().toLowerCase();
}

// Bidirectional substring match — mirrors PrescriptionsService's server-side
// check so the doctor sees the warning before saving, not just on rejection.
function findAllergyMatch(
  allergies: string[],
  medicine: Medicine,
): string | null {
  const haystacks = [
    medicine.name,
    medicine.genericName,
    ...(medicine.classes || []),
  ]
    .filter(Boolean)
    .map((s) => lower(s as string));

  for (const raw of allergies) {
    const allergy = lower(raw);
    if (!allergy) continue;
    if (haystacks.some((h) => h.includes(allergy) || allergy.includes(h)))
      return raw;
  }
  return null;
}

function todayDisplay(): string {
  return new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function PrescriptionWriterPage({
  hospitalId,
  appointmentId,
}: PrescriptionWriterPageProps) {
  const router = useRouter();
  const { currentHospital } = useAuth();

  const { data: apptData, isLoading: apptLoading } = useHospitalAppointment(
    appointmentId,
    hospitalId,
  );
  const appointment = apptData?.appointment;

  const { data: patientData } = useHospitalPatient(
    appointment?.patientId || "",
    hospitalId,
  );
  const patient = patientData?.patient;
  const allergies = useMemo(() => patient?.allergies || [], [patient]);

  const { data: doctorData } = useHospitalDoctor(
    appointment?.doctorProfileId || "",
    hospitalId,
  );
  const doctor = doctorData?.doctor;

  const { data: medicineData } = useMedicines(hospitalId, { status: "active" });
  const medicines = medicineData?.items || [];

  const { data: rxData, isLoading: rxLoading } = usePrescription(
    appointmentId,
    hospitalId,
  );
  const existing = rxData?.prescription;

  const saveMutation = useSavePrescription(appointmentId, hospitalId);
  const statusMutation = useSetPrescriptionStatus(appointmentId, hospitalId);

  const [items, setItems] = useState<PrescriptionItem[]>([]);
  const [allergyOverrides, setAllergyOverrides] = useState<AllergyOverride[]>(
    [],
  );
  const [advice, setAdvice] = useState("");
  const [loadedFromExisting, setLoadedFromExisting] = useState(false);

  const [query, setQuery] = useState("");
  const [pendingConflict, setPendingConflict] = useState<{
    medicine: Medicine;
    matchedTerm: string;
  } | null>(null);
  const [overrideReason, setOverrideReason] = useState("");

  useEffect(() => {
    if (existing && !loadedFromExisting) {
      setItems(existing.items || []);
      setAllergyOverrides(existing.allergyOverrides || []);
      setAdvice(existing.advice || "");
      setLoadedFromExisting(true);
    }
  }, [existing, loadedFromExisting]);

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return medicines
      .filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          (m.genericName || "").toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [medicines, query]);

  function addMedicine(
    medicine: Medicine,
    override?: { matchedTerm: string; reason: string },
  ) {
    setItems((prev) => [
      ...prev,
      {
        medicineId: medicine.id,
        medicineName: medicine.name,
        strength: medicine.strength,
        form: medicine.form,
        dose: medicine.defaultDose || "",
        frequency: medicine.defaultFrequency || "",
        foodTiming: medicine.defaultFoodTiming,
        duration: "",
        quantity: "",
        note: "",
      },
    ]);
    if (override) {
      setAllergyOverrides((prev) => [
        ...prev,
        {
          medicineId: medicine.id,
          medicineName: medicine.name,
          matchedAllergyTerm: override.matchedTerm,
          reason: override.reason,
          overriddenAt: new Date().toISOString(),
        },
      ]);
    }
    setQuery("");
  }

  function handlePick(medicine: Medicine) {
    const matchedTerm = allergies.length
      ? findAllergyMatch(allergies, medicine)
      : null;
    if (matchedTerm) {
      setPendingConflict({ medicine, matchedTerm });
      setOverrideReason("");
      return;
    }
    addMedicine(medicine);
  }

  function confirmOverride() {
    if (!pendingConflict || !overrideReason.trim()) return;
    addMedicine(pendingConflict.medicine, {
      matchedTerm: pendingConflict.matchedTerm,
      reason: overrideReason.trim(),
    });
    setPendingConflict(null);
    setOverrideReason("");
  }

  function updateItem(index: number, patch: Partial<PrescriptionItem>) {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, ...patch } : it)),
    );
  }

  function removeItem(index: number) {
    const removed = items[index];
    setItems((prev) => prev.filter((_, i) => i !== index));
    setAllergyOverrides((prev) =>
      prev.filter((o) => o.medicineId !== removed.medicineId),
    );
  }

  async function handleSave() {
    try {
      await saveMutation.mutateAsync({
        items,
        allergyOverrides,
        advice: advice || undefined,
      });
      toast.success("Prescription saved");
    } catch (err) {
      toast.error(
        err instanceof ApiRequestError
          ? err.message
          : "Failed to save prescription",
      );
    }
  }

  async function handleSign() {
    try {
      await saveMutation.mutateAsync({
        items,
        allergyOverrides,
        advice: advice || undefined,
      });
      await statusMutation.mutateAsync("signed");
      toast.success("Prescription signed");
    } catch (err) {
      toast.error(
        err instanceof ApiRequestError
          ? err.message
          : "Failed to sign prescription",
      );
    }
  }

  function handlePrint() {
    window.print();
  }

  function handleWhatsApp() {
    const lines = [
      currentHospital?.name || "Prescription",
      appointment?.patientName || "",
      "",
      ...items.map(
        (it, i) =>
          `${i + 1}. ${it.medicineName}${it.strength ? ` ${it.strength}` : ""} — ${it.dose}${
            it.frequency ? `, ${it.frequency}` : ""
          }${it.duration ? `, ${it.duration}` : ""}`,
      ),
      "",
      advice ? `Advice: ${advice}` : "",
    ].filter(Boolean);
    const text = encodeURIComponent(lines.join("\n"));
    const phone = appointment?.patientPhone
      ? appointment.patientPhone.replace(/\D/g, "")
      : "";
    const url = phone
      ? `https://wa.me/91${phone}?text=${text}`
      : `https://wa.me/?text=${text}`;
    window.open(url, "_blank");
  }

  const isEmpty = items.length === 0;
  const saving = saveMutation.isPending || statusMutation.isPending;
  const isSigned = existing?.status === "signed";

  if (apptLoading || rxLoading) {
    return (
      <div className="min-h-screen grid place-items-center text-ink-500 text-sm">
        Loading…
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="min-h-screen grid place-items-center text-ink-500 text-sm">
        Appointment not found.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-canvas pb-10">
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-2 text-sm">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-2 p-2 -ml-2 rounded-lg text-ink-700 hover:bg-surface-paper transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <span className="text-ink-500">Appointments</span>
        <span className="text-ink-500">/</span>
        <span className="font-semibold text-ink-900">Prescription</span>
        {isSigned && (
          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-status-open-soft text-status-open">
            Signed
          </span>
        )}
      </div>

      <div className="max-w-6xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-start">
        {/* editor */}
        <div className="space-y-5">
          {allergies.length > 0 && (
            <div className="flex items-start gap-2.5 bg-status-danger-soft border border-status-danger/20 rounded-xl px-3.5 py-3 text-sm text-status-danger">
              <AlertTriangle className="w-4 h-4 flex-none mt-0.5" />
              <span>
                <b>{appointment.patientName}</b> is allergic to:{" "}
                {allergies.join(", ")}
              </span>
            </div>
          )}

          <div className="bg-surface-paper border border-border rounded-xl p-4">
            <label className="block text-sm font-semibold text-ink-900 mb-2">
              Add a medicine
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or generic name"
                className={`${inputClass} pl-9`}
              />
            </div>
            {candidates.length > 0 && (
              <div className="mt-2 border border-border rounded-lg overflow-hidden divide-y divide-border">
                {candidates.map((m) => {
                  const conflict =
                    allergies.length > 0
                      ? findAllergyMatch(allergies, m)
                      : null;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handlePick(m)}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-surface-canvas/60"
                    >
                      <span>
                        <span className="block text-sm font-semibold text-ink-900">
                          {m.name}
                        </span>
                        <span className="block text-xs text-ink-500">
                          {m.strength ? `${m.strength} · ` : ""}
                          {m.form}
                          {m.genericName ? ` · ${m.genericName}` : ""}
                        </span>
                      </span>
                      {conflict && (
                        <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-status-danger-soft text-status-danger shrink-0">
                          Allergy match
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
            {query.trim() && candidates.length === 0 && (
              <p className="text-xs text-ink-500 mt-2">
                No matching medicine in the catalog.
              </p>
            )}
          </div>

          <div className="bg-surface-paper border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-bold text-ink-900 font-display tracking-tight">Prescription</h2>
              <span className="text-xs text-ink-500">
                {items.length} medicine{items.length === 1 ? "" : "s"}
              </span>
            </div>
            {items.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-ink-500">
                Search above to add a medicine.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {items.map((item, index) => {
                  const override = allergyOverrides.find(
                    (o) => o.medicineId === item.medicineId,
                  );
                  return (
                    <div key={`${item.medicineId}-${index}`} className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div>
                          <div className="text-sm font-semibold text-ink-900">
                            {index + 1}. {item.medicineName}{" "}
                            {item.strength ? `— ${item.strength}` : ""}
                          </div>
                          {override && (
                            <div className="text-[11px] text-status-danger mt-0.5">
                              Overrode &quot;{override.matchedAllergyTerm}&quot;
                              allergy: {override.reason}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="text-ink-500 hover:text-status-danger"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                        <input
                          placeholder="Dose e.g. 1-0-1"
                          value={item.dose}
                          onChange={(e) =>
                            updateItem(index, { dose: e.target.value })
                          }
                          className={inputClass}
                        />
                        <input
                          placeholder="Frequency"
                          value={item.frequency || ""}
                          onChange={(e) =>
                            updateItem(index, { frequency: e.target.value })
                          }
                          className={inputClass}
                        />
                        <select
                          value={item.foodTiming || ""}
                          onChange={(e) =>
                            updateItem(index, {
                              foodTiming: (e.target.value || undefined) as
                                | FoodTiming
                                | undefined,
                            })
                          }
                          className={inputClass}
                        >
                          <option value="">Food timing</option>
                          {FOOD_TIMING_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <input
                          placeholder="Duration e.g. 5 days"
                          value={item.duration || ""}
                          onChange={(e) =>
                            updateItem(index, { duration: e.target.value })
                          }
                          className={inputClass}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2.5 mt-2.5">
                        <input
                          placeholder="Quantity e.g. 10 tablets"
                          value={item.quantity || ""}
                          onChange={(e) =>
                            updateItem(index, { quantity: e.target.value })
                          }
                          className={inputClass}
                        />
                        <input
                          placeholder="Patient note (optional)"
                          value={item.note || ""}
                          onChange={(e) =>
                            updateItem(index, { note: e.target.value })
                          }
                          className={inputClass}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-surface-paper border border-border rounded-xl p-4">
            <label className="block text-sm font-semibold text-ink-900 mb-2">
              Advice &amp; follow-up
            </label>
            <textarea
              value={advice}
              onChange={(e) => setAdvice(e.target.value)}
              rows={3}
              placeholder="Any general advice for the patient..."
              className={`${inputClass} resize-none`}
            />
          </div>
        </div>

        {/* preview */}
        <div className="lg:sticky lg:top-4 space-y-3">
          <div
            id="prescription-print-area"
            className="bg-surface-paper border border-border rounded-xl p-5 text-sm"
          >
            <div className="border-b-2 border-brand-violet pb-3 mb-3">
              <div className="text-base font-bold text-ink-900">
                {currentHospital?.name || "Prescription"}
              </div>
              {currentHospital?.address && (
                <div className="text-xs text-ink-500 mt-0.5">
                  {currentHospital.address}
                </div>
              )}
            </div>
            <div className="flex items-baseline justify-between gap-2 text-xs text-ink-500 pb-3 mb-3 border-b border-dashed border-border">
              <span>
                <span className="block text-sm font-bold text-ink-900">
                  Dr. {appointment.doctorName}
                </span>
                {[doctor?.qualification, doctor?.specialization]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              <span className="shrink-0 font-mono tabular">{todayDisplay()}</span>
            </div>
            <div className="flex items-baseline justify-between gap-2 text-xs pb-3 mb-3 border-b border-border">
              <span>
                <span className="font-bold text-ink-900">
                  {appointment.patientName}
                </span>
                {appointment.patientGender
                  ? ` · ${appointment.patientGender}`
                  : ""}
                {appointment.patientAge != null
                  ? ` · ${appointment.patientAge}y`
                  : ""}
              </span>
              <span className="font-mono text-ink-500 shrink-0">
                {patient?.patientId ? `P-${patient.patientId}` : ""}
              </span>
            </div>
            {items.length === 0 ? (
              <p className="text-xs text-ink-500">No medicines added yet.</p>
            ) : (
              <div className="space-y-3">
                {items.map((item, index) => (
                  <div
                    key={`${item.medicineId}-${index}`}
                    className="pb-2.5 border-b border-dashed border-border last:border-0"
                  >
                    <div className="text-sm font-semibold text-ink-900">
                      {index + 1}. {item.medicineName}{" "}
                      {item.strength ? `— ${item.strength}` : ""}
                    </div>
                    <div className="text-xs text-ink-700 mt-0.5">
                      {[
                        item.dose,
                        item.frequency,
                        item.foodTiming?.replace("_", " "),
                        item.duration,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                    {item.quantity && (
                      <div className="text-[11px] text-ink-500">
                        Dispense {item.quantity}
                      </div>
                    )}
                    {item.note && (
                      <div className="text-[11px] text-ink-500 mt-0.5">
                        {item.note}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {advice && (
              <div className="mt-3 pt-3 border-t border-border text-xs text-ink-700">
                <b className="text-ink-900">Advice: </b>
                {advice}
              </div>
            )}
            <div className="mt-4 pt-3 border-t border-border text-[10.5px] text-ink-500">
              Printed on {todayDisplay()}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-border text-xs font-semibold text-ink-700"
            >
              <Printer className="w-3.5 h-3.5" /> Print
            </button>
            <button
              type="button"
              onClick={handleWhatsApp}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-status-open/30 bg-status-open-soft text-status-open text-xs font-semibold"
            >
              <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isEmpty || saving}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-border text-xs font-semibold text-ink-700 disabled:opacity-50"
            >
              {saveMutation.isPending && (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              )}
              Save draft
            </button>
          </div>
          <button
            type="button"
            onClick={handleSign}
            disabled={isEmpty || saving}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-brand-violet hover:bg-brand-violet-hover text-white text-sm font-semibold disabled:opacity-50"
          >
            {statusMutation.isPending && (
              <Loader2 className="w-4 h-4 animate-spin" />
            )}
            {isSigned ? "Re-sign & update" : "Sign & issue"}
          </button>
        </div>
      </div>

      {pendingConflict && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onClick={() => setPendingConflict(null)}
        >
          <div
            className="bg-surface-paper rounded-2xl shadow-2xl w-full max-w-md p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-3">
              <span className="w-9 h-9 rounded-xl bg-status-danger-soft text-status-danger flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4.5 h-4.5" />
              </span>
              <div>
                <h3 className="text-base font-semibold text-ink-900 font-display tracking-tight">
                  {pendingConflict.medicine.name} can&apos;t go on this
                  prescription
                </h3>
                <p className="text-sm text-ink-500 mt-0.5">
                  {appointment.patientName} is allergic to &quot;
                  {pendingConflict.matchedTerm}&quot;.
                </p>
              </div>
            </div>
            <label className="block text-sm font-semibold text-ink-900 mb-1.5">
              Reason to prescribe anyway
            </label>
            <textarea
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              rows={2}
              placeholder="e.g. Prior tolerance confirmed, benefit outweighs risk..."
              className={`${inputClass} resize-none`}
            />
            <div className="flex items-center gap-2.5 mt-4">
              <button
                type="button"
                onClick={() => setPendingConflict(null)}
                className="h-10 px-4 rounded-lg border border-border text-sm font-medium text-ink-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!overrideReason.trim()}
                onClick={confirmOverride}
                className="ml-auto h-10 px-4 rounded-lg bg-status-danger hover:opacity-90 text-white text-sm font-semibold disabled:opacity-50"
              >
                Add anyway
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #prescription-print-area,
          #prescription-print-area * {
            visibility: visible;
          }
          #prescription-print-area {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
