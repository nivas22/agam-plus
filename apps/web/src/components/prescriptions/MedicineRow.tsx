// components/prescriptions/MedicineRow.tsx
"use client";

import { X } from "lucide-react";
import { useState } from "react";
import {
  computeDispenseQuantity,
  generateInstructionText,
  toLegacyFields,
  tryParseLegacyToStructured,
} from "@agam/shared";
import type { FoodTiming, Medicine, MedicineForm } from "@/types/medicine";
import { MEDICINE_FORM_UNIT_NOUN } from "@/types/medicine";
import type {
  AllergyOverride,
  HowOften,
  PrescriptionItem,
  PrescriptionItemStructuredDose,
} from "@/types/prescription";
import DoseControls from "./DoseControls";

interface MedicineRowProps {
  item: PrescriptionItem;
  index: number;
  medicine?: Medicine;
  override?: AllergyOverride;
  patientAllergies: string[];
  onUpdate: (patch: Partial<PrescriptionItem>) => void;
  onRemove: () => void;
}

function medicineForm(item: PrescriptionItem): MedicineForm {
  const form = item.form as MedicineForm;
  return form && MEDICINE_FORM_UNIT_NOUN[form] ? form : "tablet";
}

export default function MedicineRow({
  item,
  index,
  medicine,
  override,
  patientAllergies,
  onUpdate,
  onRemove,
}: MedicineRowProps) {
  const [editingDispense, setEditingDispense] = useState(false);
  const [showNoteInput, setShowNoteInput] = useState(!!item.note);

  const form = medicineForm(item);
  const structured = item.structuredDose;

  function applyStructured(patch: Partial<PrescriptionItemStructuredDose>) {
    const current = structured;
    if (!current) return;
    const next: PrescriptionItemStructuredDose = { ...current, ...patch };
    // Recompute the auto dispense quantity whenever how-often/days change,
    // unless the user already hand-edited it for this item.
    if (!next.dispenseOverridden && (patch.howOften !== undefined || patch.days !== undefined)) {
      next.dispenseQty = computeDispenseQuantity(next.howOften, next.days);
    }
    const unitNoun = MEDICINE_FORM_UNIT_NOUN[form].en;
    onUpdate({ structuredDose: next, ...toLegacyFields(next, unitNoun) });
  }

  function convertToStructured() {
    const parsed = tryParseLegacyToStructured(item) || {
      howOften: "1-0-0" as HowOften,
      foodTiming: (item.foodTiming || "after_food") as FoodTiming,
      days: 3,
      dispenseQty: computeDispenseQuantity("1-0-0", 3),
    };
    const unitNoun = MEDICINE_FORM_UNIT_NOUN[form].en;
    onUpdate({ structuredDose: parsed, ...toLegacyFields(parsed, unitNoun) });
  }

  const instruction = structured ? generateInstructionText(structured, form) : null;

  return (
    <div className="p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="text-sm font-semibold text-ink-900">
            {index + 1}. {item.medicineName} {item.strength ? `— ${item.strength}` : ""}
            {medicine?.scheduleClass && (
              <span className="ml-1.5 inline-block rounded-md px-1.5 py-0.5 text-[9.5px] font-bold tracking-wide align-middle bg-status-warning-soft text-status-warning">
                SCHEDULE {medicine.scheduleClass}
              </span>
            )}
          </div>
          <div className="text-xs text-ink-500 mt-0.5">
            {[item.form, medicine?.genericName].filter(Boolean).join(" · ")}
            {medicine?.brandNames && medicine.brandNames.length > 0
              ? ` · sold as ${medicine.brandNames.join(", ")}`
              : ""}
            {!override && patientAllergies.length > 0
              ? ` · safe with ${patientAllergies.join(", ")} allergy`
              : ""}
          </div>
          {override && (
            <div className="text-[11px] text-status-danger mt-0.5">
              Overrode &quot;{override.matchedAllergyTerm}&quot; allergy: {override.reason}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="text-ink-500 hover:text-status-danger"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {structured ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-start">
            <DoseControls
              howOften={structured.howOften}
              onHowOftenChange={(v) => applyStructured({ howOften: v })}
              foodTiming={structured.foodTiming}
              onFoodTimingChange={(v) => applyStructured({ foodTiming: v })}
              days={structured.days}
              onDaysChange={(v) => applyStructured({ days: v })}
            />
            <div>
              <div className="text-[10.5px] uppercase tracking-wide text-ink-500 font-semibold mb-1.5">
                Dispense
              </div>
              <div className="bg-status-open-soft border border-status-open/30 rounded-lg px-3 py-2 flex items-center gap-2">
                {editingDispense ? (
                  <input
                    type="number"
                    min={0}
                    autoFocus
                    defaultValue={structured.dispenseQty}
                    onBlur={(e) => {
                      applyStructured({
                        dispenseQty: Math.max(0, Number(e.target.value) || 0),
                        dispenseOverridden: true,
                      });
                      setEditingDispense(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    }}
                    className="w-16 font-mono text-lg font-bold text-status-open bg-transparent focus:outline-none"
                  />
                ) : (
                  <span className="font-mono text-lg font-bold text-status-open">
                    {structured.dispenseQty}
                  </span>
                )}
                <span className="text-[11px] text-status-open leading-tight">
                  {MEDICINE_FORM_UNIT_NOUN[form].en}
                  {structured.dispenseQty === 1 ? "" : "s"}
                  <br />
                  {structured.howOften} × {structured.days}d
                </span>
                {!editingDispense && (
                  <button
                    type="button"
                    onClick={() => setEditingDispense(true)}
                    className="text-[11px] text-status-open underline ml-1"
                  >
                    edit
                  </button>
                )}
              </div>
            </div>
          </div>

          {instruction && (
            <div className="mt-3 bg-surface-canvas/60 border border-border rounded-lg px-3 py-2 text-xs text-ink-700 space-y-0.5">
              <div>{instruction.en}</div>
              <div lang="ta">{instruction.ta}</div>
            </div>
          )}
        </>
      ) : (
        <div className="bg-surface-canvas/60 border border-border rounded-lg px-3 py-2.5 text-sm text-ink-700 flex items-center justify-between gap-3">
          <span>
            {[item.dose, item.frequency, item.foodTiming?.replace("_", " "), item.duration]
              .filter(Boolean)
              .join(" · ") || "No dose recorded"}
            {item.quantity ? ` · Dispense ${item.quantity}` : ""}
          </span>
          <button
            type="button"
            onClick={convertToStructured}
            className="text-xs font-semibold text-brand-violet underline shrink-0"
          >
            Convert to structured
          </button>
        </div>
      )}

      <div className="mt-2.5">
        {showNoteInput ? (
          <input
            type="text"
            value={item.note || ""}
            onChange={(e) => onUpdate({ note: e.target.value })}
            placeholder="Note for the patient (optional)"
            className="w-full text-xs text-ink-700 bg-surface-paper border border-border rounded-lg px-3 py-2"
          />
        ) : (
          <button
            type="button"
            onClick={() => setShowNoteInput(true)}
            className="text-xs text-brand-violet underline"
          >
            + Add a note for the patient
          </button>
        )}
      </div>
    </div>
  );
}
