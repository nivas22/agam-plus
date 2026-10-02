// components/prescriptions/PrescriptionPreviewPanel.tsx
"use client";

import { Download, Loader2, MessageCircle, Printer } from "lucide-react";
import { generateInstructionText } from "@agam/shared";
import type { Medicine, MedicineForm } from "@/types/medicine";
import { MEDICINE_FORM_UNIT_NOUN } from "@/types/medicine";
import type { PrescriptionItem } from "@/types/prescription";

interface PrescriptionPreviewPanelProps {
  hospitalName?: string;
  hospitalAddress?: string;
  hospitalRegistrationNumber?: string;
  doctorName: string;
  doctorQualification?: string;
  doctorSpecialization?: string;
  doctorRegistrationNumber?: string;
  dateDisplay: string;
  patientName: string;
  patientGender?: string;
  patientAge?: number | null;
  patientCode?: string;
  items: PrescriptionItem[];
  medicineById: Map<string, Medicine>;
  advice: string;
  rxNumber?: string;
  isSigned: boolean;
  onSign: () => void;
  onPrint: () => void;
  onWhatsApp: () => void;
  onExportPdf: () => void;
  saving: boolean;
  exportingPdf: boolean;
}

function medicineForm(item: PrescriptionItem): MedicineForm {
  const form = item.form as MedicineForm;
  return form && MEDICINE_FORM_UNIT_NOUN[form] ? form : "tablet";
}

export default function PrescriptionPreviewPanel({
  hospitalName,
  hospitalAddress,
  hospitalRegistrationNumber,
  doctorName,
  doctorQualification,
  doctorSpecialization,
  doctorRegistrationNumber,
  dateDisplay,
  patientName,
  patientGender,
  patientAge,
  patientCode,
  items,
  medicineById,
  advice,
  rxNumber,
  isSigned,
  onSign,
  onPrint,
  onWhatsApp,
  onExportPdf,
  saving,
  exportingPdf,
}: PrescriptionPreviewPanelProps) {
  const isEmpty = items.length === 0;

  return (
    <div className="lg:sticky lg:top-4 space-y-3">
      <div
        id="prescription-print-area"
        className="bg-surface-paper border border-border rounded-xl p-5 text-sm"
      >
        <div className="border-b-2 border-brand-violet pb-3 mb-3">
          <div className="text-base font-bold text-ink-900">
            {hospitalName || "Prescription"}
          </div>
          <div className="text-xs text-ink-500 mt-0.5">
            {hospitalAddress}
            {hospitalRegistrationNumber ? ` · Reg. ${hospitalRegistrationNumber}` : ""}
          </div>
        </div>
        <div className="flex items-baseline justify-between gap-2 text-xs text-ink-500 pb-3 mb-3 border-b border-dashed border-border">
          <span>
            <span className="block text-sm font-bold text-ink-900">
              Dr. {doctorName}
            </span>
            {[doctorQualification, doctorSpecialization].filter(Boolean).join(" · ")}
            {doctorRegistrationNumber ? (
              <>
                <br />
                Reg. No. {doctorRegistrationNumber}
              </>
            ) : null}
          </span>
          <span className="shrink-0 font-mono tabular">{dateDisplay}</span>
        </div>
        <div className="flex items-baseline justify-between gap-2 text-xs pb-3 mb-3 border-b border-border">
          <span>
            <span className="font-bold text-ink-900">{patientName}</span>
            {patientGender ? ` · ${patientGender}` : ""}
            {patientAge != null ? ` · ${patientAge}y` : ""}
          </span>
          <span className="font-mono text-ink-500 shrink-0">{patientCode}</span>
        </div>

        {isEmpty ? (
          <p className="text-xs text-ink-500">No medicines added yet.</p>
        ) : (
          <div className="space-y-3">
            {items.map((item, index) => {
              const medicine = medicineById.get(item.medicineId);
              const structured = item.structuredDose;
              const instruction = structured
                ? generateInstructionText(structured, medicineForm(item))
                : null;
              return (
                <div
                  key={`${item.medicineId}-${index}`}
                  className="pb-2.5 border-b border-dashed border-border last:border-0"
                >
                  <div className="text-sm font-semibold text-ink-900">
                    {index + 1}. {medicine?.genericName || item.medicineName}
                    {item.strength ? ` ${item.strength}` : ""}
                    {item.form ? ` — ${item.form}` : ""}
                    {medicine?.scheduleClass && (
                      <span className="ml-1.5 inline-block rounded-md px-1.5 py-0.5 text-[9.5px] font-bold tracking-wide align-middle bg-status-warning-soft text-status-warning">
                        SCHEDULE {medicine.scheduleClass}
                      </span>
                    )}
                  </div>
                  {medicine?.genericName && medicine.genericName !== item.medicineName && (
                    <div className="text-[11px] text-ink-500">{item.medicineName}</div>
                  )}
                  <div className="text-xs text-ink-700 mt-0.5">
                    {structured
                      ? `${structured.howOften} · ${structured.foodTiming.replace("_", " ")} · ${structured.days} days`
                      : [item.dose, item.frequency, item.foodTiming?.replace("_", " "), item.duration]
                          .filter(Boolean)
                          .join(" · ")}
                  </div>
                  <div className="text-[11px] text-ink-500">
                    Dispense{" "}
                    {structured
                      ? `${structured.dispenseQty} ${MEDICINE_FORM_UNIT_NOUN[medicineForm(item)].en}${structured.dispenseQty === 1 ? "" : "s"}`
                      : item.quantity}
                    {medicine?.brandNames && medicine.brandNames.length > 0
                      ? ` · ${medicine.brandNames.join(" / ")}`
                      : ""}
                  </div>
                  {instruction && (
                    <div className="text-xs text-ink-700 mt-0.5" lang="ta">
                      {instruction.ta}
                    </div>
                  )}
                  {item.note && (
                    <div className="text-[11px] text-ink-500 mt-0.5">{item.note}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {advice && (
          <div className="mt-3 pt-3 border-t border-border text-xs text-ink-700">
            <b className="text-ink-900">Advice: </b>
            {advice}
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-[10.5px] text-ink-500">
          <span>Printed on {dateDisplay}</span>
          {rxNumber && <span className="font-mono">{rxNumber}</span>}
        </div>

        {!isSigned && (
          <div className="mt-3 text-xs text-status-warning bg-status-warning-soft border border-dashed border-status-warning/40 rounded-lg px-3 py-2 text-center leading-relaxed">
            Not signed yet — this is a draft.
            <br />
            The pharmacy can&apos;t dispense against it.
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onSign}
        disabled={isEmpty || saving}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-3.5 rounded-xl bg-status-open hover:opacity-90 text-white text-sm font-bold disabled:opacity-50"
      >
        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
        {isSigned ? "Re-sign & update" : `Sign & issue · ${items.length} medicine${items.length === 1 ? "" : "s"}`}
      </button>

      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={onPrint}
          disabled={!isSigned}
          className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-border text-xs font-semibold text-ink-700 disabled:opacity-40"
        >
          <Printer className="w-3.5 h-3.5" /> Print
        </button>
        <button
          type="button"
          onClick={onWhatsApp}
          disabled={!isSigned}
          className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-status-open/30 bg-status-open-soft text-status-open text-xs font-semibold disabled:opacity-40"
        >
          <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
        </button>
        <button
          type="button"
          onClick={onExportPdf}
          disabled={!isSigned || exportingPdf}
          className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-border text-xs font-semibold text-ink-700 disabled:opacity-40"
        >
          {exportingPdf ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Download className="w-3.5 h-3.5" />
          )}
          PDF
        </button>
      </div>
      {!isSigned && (
        <div className="text-[11px] text-ink-500 text-center">
          Printing and sending unlock once you sign.
        </div>
      )}
    </div>
  );
}
