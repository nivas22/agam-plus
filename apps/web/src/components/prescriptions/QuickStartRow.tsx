// components/prescriptions/QuickStartRow.tsx
"use client";

import { Layers, RotateCcw, Star } from "lucide-react";
import { computeDispenseQuantity, toLegacyFields } from "@agam/shared";
import { useMedicinePacks } from "@/hooks/useMedicinePackApi";
import { useLastSignedPrescription } from "@/hooks/usePrescriptionApi";
import type { Medicine } from "@/types/medicine";
import { MEDICINE_FORM_UNIT_NOUN } from "@/types/medicine";
import type { PrescriptionItem } from "@/types/prescription";

interface QuickStartRowProps {
  hospitalId: string;
  appointmentId: string;
  medicines: Medicine[];
  onApplyItems: (items: PrescriptionItem[]) => void;
}

function defaultStructuredItem(medicine: Medicine): PrescriptionItem {
  const structured = {
    howOften: "1-0-0" as const,
    foodTiming: "after_food" as const,
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

export default function QuickStartRow({
  hospitalId,
  appointmentId,
  medicines,
  onApplyItems,
}: QuickStartRowProps) {
  const { data: lastSignedData } = useLastSignedPrescription(appointmentId, hospitalId);
  const lastSigned = lastSignedData?.prescription;

  const { data: packsData } = useMedicinePacks(hospitalId, { status: "active" });
  const packs = packsData?.items || [];

  const favourites = medicines.filter((m) => m.isFavourite);

  function repeatLast() {
    if (!lastSigned) return;
    onApplyItems(lastSigned.items);
  }

  function applyPack(packId: string) {
    const pack = packs.find((p) => p.id === packId);
    if (!pack) return;
    const items: PrescriptionItem[] = pack.items.map((packItem) => {
      const medicine = medicines.find((m) => m.id === packItem.medicineId);
      const structured = {
        howOften: packItem.howOften,
        foodTiming: packItem.foodTiming,
        days: packItem.days,
        dispenseQty: computeDispenseQuantity(packItem.howOften, packItem.days),
      };
      const unitNoun = medicine
        ? MEDICINE_FORM_UNIT_NOUN[medicine.form]?.en || "dose"
        : "dose";
      return {
        medicineId: packItem.medicineId,
        medicineName: packItem.medicineName,
        strength: medicine?.strength,
        form: medicine?.form,
        note: packItem.note,
        structuredDose: structured,
        ...toLegacyFields(structured, unitNoun),
      };
    });
    onApplyItems(items);
  }

  function applyFavourite(medicine: Medicine) {
    onApplyItems([defaultStructuredItem(medicine)]);
  }

  if (!lastSigned && packs.length === 0 && favourites.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-xs text-ink-500 mr-1">Start from</span>
      {lastSigned && (
        <button
          type="button"
          onClick={repeatLast}
          className="flex items-center gap-1.5 rounded-full border border-brand-violet/30 bg-brand-violet-soft text-brand-violet px-3.5 py-1.5 text-xs font-semibold"
        >
          <RotateCcw className="w-3 h-3" />
          Repeat last
        </button>
      )}
      {packs.map((pack) => (
        <button
          key={pack.id}
          type="button"
          onClick={() => applyPack(pack.id)}
          className="flex items-center gap-1.5 rounded-full border border-border bg-surface-paper text-ink-700 px-3.5 py-1.5 text-xs font-semibold"
        >
          <Layers className="w-3 h-3" />
          {pack.name}
        </button>
      ))}
      {favourites.length > 0 && (
        <div className="relative group">
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-full border border-border bg-surface-paper text-ink-700 px-3.5 py-1.5 text-xs font-semibold"
          >
            <Star className="w-3 h-3" />
            My favourites
          </button>
          <div className="hidden group-hover:block group-focus-within:block absolute left-0 top-full mt-1 z-10 bg-surface-paper border border-border rounded-lg shadow-lg overflow-hidden min-w-[180px]">
            {favourites.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => applyFavourite(m)}
                className="w-full text-left px-3 py-2 text-xs hover:bg-surface-canvas/60"
              >
                {m.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
