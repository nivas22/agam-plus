// components/prescriptions/PrescriptionWriterPage.tsx
"use client";

import { AlertTriangle, ArrowLeft, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { computeDispenseQuantity, toLegacyFields } from "@agam/shared";
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
import type { Medicine } from "@/types/medicine";
import { MEDICINE_FORM_UNIT_NOUN } from "@/types/medicine";
import type { AllergyOverride, FollowUpOption, PrescriptionItem } from "@/types/prescription";
import AdviceAndFollowUp from "./AdviceAndFollowUp";
import MedicineRow from "./MedicineRow";
import PatientContextBar from "./PatientContextBar";
import PrescriptionPreviewPanel from "./PrescriptionPreviewPanel";
import QuickStartRow from "./QuickStartRow";

interface PrescriptionWriterPageProps {
  hospitalId: string;
  appointmentId: string;
}

function lower(s?: string): string {
  return (s || "").trim().toLowerCase();
}

// Bidirectional substring match — mirrors PrescriptionsService's server-side
// check so the doctor sees the warning before saving, not just on rejection.
function findAllergyMatch(allergies: string[], medicine: Medicine): string | null {
  const haystacks = [medicine.name, medicine.genericName, ...(medicine.classes || [])]
    .filter(Boolean)
    .map((s) => lower(s as string));

  for (const raw of allergies) {
    const allergy = lower(raw);
    if (!allergy) continue;
    if (haystacks.some((h) => h.includes(allergy) || allergy.includes(h))) return raw;
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

function defaultItemForMedicine(medicine: Medicine): PrescriptionItem {
  const structured = {
    howOften: "1-0-0" as const,
    foodTiming: medicine.defaultFoodTiming || ("after_food" as const),
    days: 3,
    dispenseQty: computeDispenseQuantity("1-0-0", 3),
  };
  const unitNoun = MEDICINE_FORM_UNIT_NOUN[medicine.form]?.en || "dose";
  return {
    medicineId: medicine.id,
    medicineName: medicine.name,
    strength: medicine.strength,
    form: medicine.form,
    structuredDose: structured,
    ...toLegacyFields(structured, unitNoun),
  };
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

  const { data: patientData } = useHospitalPatient(appointment?.patientId || "", hospitalId);
  const patient = patientData?.patient;
  const allergies = useMemo(() => patient?.allergies || [], [patient]);
  const conditions = useMemo(() => patient?.conditions || [], [patient]);
  const flags = useMemo(() => patient?.flags || [], [patient]);

  const { data: doctorData } = useHospitalDoctor(appointment?.doctorProfileId || "", hospitalId);
  const doctor = doctorData?.doctor;

  const { data: medicineData } = useMedicines(hospitalId, { status: "active" });
  const medicines = medicineData?.items || [];
  const medicineById = useMemo(
    () => new Map(medicines.map((m) => [m.id, m])),
    [medicines],
  );

  const { data: rxData, isLoading: rxLoading } = usePrescription(appointmentId, hospitalId);
  const existing = rxData?.prescription;

  const saveMutation = useSavePrescription(appointmentId, hospitalId);
  const statusMutation = useSetPrescriptionStatus(appointmentId, hospitalId);

  const [items, setItems] = useState<PrescriptionItem[]>([]);
  const [allergyOverrides, setAllergyOverrides] = useState<AllergyOverride[]>([]);
  const [advice, setAdvice] = useState("");
  const [followUpOption, setFollowUpOption] = useState<FollowUpOption>("none");
  const [loadedFromExisting, setLoadedFromExisting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

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
      setFollowUpOption(existing.followUpOption || "none");
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

  // Appends new items, replacing an existing one by medicineId (so quick-start
  // shortcuts compose instead of clobbering the whole list).
  function applyItems(newItems: PrescriptionItem[]) {
    setItems((prev) => {
      const byId = new Map<string, PrescriptionItem>(prev.map((it) => [it.medicineId, it]));
      for (const ni of newItems) byId.set(ni.medicineId, ni);
      const seen = new Set<string>();
      const result: PrescriptionItem[] = [];
      for (const it of prev) {
        result.push(byId.get(it.medicineId)!);
        seen.add(it.medicineId);
      }
      for (const ni of newItems) {
        if (!seen.has(ni.medicineId)) {
          result.push(ni);
          seen.add(ni.medicineId);
        }
      }
      return result;
    });
  }

  function addMedicine(medicine: Medicine, override?: { matchedTerm: string; reason: string }) {
    applyItems([defaultItemForMedicine(medicine)]);
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
    const matchedTerm = allergies.length ? findAllergyMatch(allergies, medicine) : null;
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
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function removeItem(index: number) {
    const removed = items[index];
    setItems((prev) => prev.filter((_, i) => i !== index));
    setAllergyOverrides((prev) => prev.filter((o) => o.medicineId !== removed.medicineId));
  }

  async function handleSave() {
    try {
      await saveMutation.mutateAsync({
        items,
        allergyOverrides,
        advice: advice || undefined,
        followUpOption,
      });
      toast.success("Prescription saved");
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : "Failed to save prescription");
    }
  }

  async function handleSign() {
    try {
      await saveMutation.mutateAsync({
        items,
        allergyOverrides,
        advice: advice || undefined,
        followUpOption,
      });
      await statusMutation.mutateAsync({ status: "signed", followUpOption });
      toast.success("Prescription signed");
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : "Failed to sign prescription");
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
    const phone = appointment?.patientPhone ? appointment.patientPhone.replace(/\D/g, "") : "";
    const url = phone ? `https://wa.me/91${phone}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(url, "_blank");
  }

  async function handleExportPdf() {
    const node = document.getElementById("prescription-print-area");
    if (!node) return;
    setExportingPdf(true);
    try {
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import("jspdf"),
        import("html2canvas"),
      ]);
      const canvas = await html2canvas(node, { scale: 2, backgroundColor: "#ffffff" });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ unit: "pt", format: "a5" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = (canvas.height * pageWidth) / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 0, pageWidth, pageHeight);
      pdf.save(`prescription-${existing?.rxNumber || appointmentId}.pdf`);
    } catch (err) {
      console.error("PDF export failed:", err);
      toast.error("Failed to export PDF");
    } finally {
      setExportingPdf(false);
    }
  }

  const isEmpty = items.length === 0;
  const saving = saveMutation.isPending || statusMutation.isPending;
  const isSigned = existing?.status === "signed";

  if (apptLoading || rxLoading) {
    return (
      <div className="min-h-screen grid place-items-center text-ink-500 text-sm">Loading…</div>
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
            Signed{existing?.rxNumber ? ` · ${existing.rxNumber}` : ""}
          </span>
        )}
      </div>

      <div className="max-w-6xl mx-auto px-4 mb-4">
        <PatientContextBar allergies={allergies} conditions={conditions} flags={flags} />
      </div>

      <div className="max-w-6xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-start">
        {/* editor */}
        <div className="space-y-5">
          <div className="bg-surface-paper border border-border rounded-xl p-4 space-y-3">
            <label className="block text-sm font-semibold text-ink-900">Add a medicine</label>
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
              <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
                {candidates.map((m) => {
                  const conflict = allergies.length > 0 ? findAllergyMatch(allergies, m) : null;
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
              <p className="text-xs text-ink-500">No matching medicine in the catalog.</p>
            )}

            <QuickStartRow
              hospitalId={hospitalId}
              appointmentId={appointmentId}
              medicines={medicines}
              onApplyItems={applyItems}
            />
          </div>

          <div className="bg-surface-paper border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-bold text-ink-900 font-display tracking-tight">
                Prescription
              </h2>
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
                {items.map((item, index) => (
                  <MedicineRow
                    key={`${item.medicineId}-${index}`}
                    item={item}
                    index={index}
                    medicine={medicineById.get(item.medicineId)}
                    override={allergyOverrides.find((o) => o.medicineId === item.medicineId)}
                    patientAllergies={allergies}
                    onUpdate={(patch) => updateItem(index, patch)}
                    onRemove={() => removeItem(index)}
                  />
                ))}
              </div>
            )}
          </div>

          <AdviceAndFollowUp
            advice={advice}
            onAdviceChange={setAdvice}
            followUpOption={followUpOption}
            onFollowUpOptionChange={setFollowUpOption}
          />

          <button
            type="button"
            onClick={handleSave}
            disabled={isEmpty || saving}
            className="text-sm font-semibold text-ink-700 underline disabled:opacity-50"
          >
            Save draft
          </button>
        </div>

        {/* preview */}
        <PrescriptionPreviewPanel
          hospitalName={currentHospital?.name}
          hospitalAddress={currentHospital?.address}
          hospitalRegistrationNumber={currentHospital?.registrationNumber}
          doctorName={appointment.doctorName}
          doctorQualification={doctor?.qualification}
          doctorSpecialization={doctor?.specialization}
          doctorRegistrationNumber={doctor?.medicalRegistrationNumber}
          dateDisplay={todayDisplay()}
          patientName={appointment.patientName}
          patientGender={appointment.patientGender}
          patientAge={appointment.patientAge}
          patientCode={patient?.patientId ? `P-${patient.patientId}` : undefined}
          items={items}
          medicineById={medicineById}
          advice={advice}
          rxNumber={existing?.rxNumber}
          isSigned={isSigned}
          onSign={handleSign}
          onPrint={handlePrint}
          onWhatsApp={handleWhatsApp}
          onExportPdf={handleExportPdf}
          saving={saving}
          exportingPdf={exportingPdf}
        />
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
                  {pendingConflict.medicine.name} can&apos;t go on this prescription
                </h3>
                <p className="text-sm text-ink-500 mt-0.5">
                  {appointment.patientName} is allergic to &quot;{pendingConflict.matchedTerm}
                  &quot;.
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
