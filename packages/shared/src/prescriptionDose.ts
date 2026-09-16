import { HOW_OFTEN_OPTIONS } from "./types/prescription";
import type {
  HowOften,
  PrescriptionItem,
  PrescriptionItemStructuredDose,
} from "./types/prescription";
import type { FoodTiming } from "./types/medicine";

// SOS has no fixed daily count — callers must treat 0 as "needs manual entry"
// rather than a real computed quantity.
export function computeDispenseQuantity(howOften: HowOften, days: number): number {
  const timesPerDay =
    HOW_OFTEN_OPTIONS.find((o) => o.value === howOften)?.timesPerDay ?? 0;
  return timesPerDay * days;
}

// Derives the legacy display strings from a structured dose so old
// consumers (WhatsApp message builder, any report reading item.dose) keep
// working unchanged for items authored through the new structured controls.
export function toLegacyFields(
  structured: PrescriptionItemStructuredDose,
  unitNoun: string,
): { dose: string; duration: string; quantity: string } {
  return {
    dose: structured.howOften,
    duration: `${structured.days} day${structured.days === 1 ? "" : "s"}`,
    quantity: `${structured.dispenseQty} ${unitNoun}${structured.dispenseQty === 1 ? "" : "s"}`,
  };
}

// Best-effort only, used to offer a starting point when reopening an old
// draft that has free-text fields but no structuredDose yet. Returns null
// (never a guess) if the free text doesn't cleanly match a known pattern —
// callers must not block editing on this succeeding.
export function tryParseLegacyToStructured(
  item: PrescriptionItem,
): PrescriptionItemStructuredDose | null {
  const howOften = HOW_OFTEN_OPTIONS.find(
    (o) => o.value === item.dose.trim(),
  )?.value;
  const daysMatch = (item.duration || "").match(/(\d+)/);
  if (!howOften || !daysMatch) return null;

  const days = parseInt(daysMatch[1], 10);
  const foodTiming: FoodTiming = item.foodTiming || "after_food";
  return {
    howOften,
    foodTiming,
    days,
    dispenseQty: computeDispenseQuantity(howOften, days),
  };
}
