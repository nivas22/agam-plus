import type { HowOften, PrescriptionItemStructuredDose } from "./types/prescription";
import type { FoodTiming, MedicineForm } from "./types/medicine";
import { MEDICINE_FORM_UNIT_NOUN } from "./types/medicine";

// This is table lookup + composition, not translation: a finite 5 (HowOften)
// x 4 (FoodTiming) x 8 (MedicineForm) space, with `days` as the only free
// variable (interpolated as a raw number, no wording needed). It generates
// the bilingual per-medicine instruction line at render time from the
// structured dose — nothing here is ever persisted.
//
// The Tamil wording below is a first draft; flag for a native-speaker
// proofread pass before relying on it clinically. Correcting it later is a
// table edit, not an architecture change.

export interface InstructionText {
  en: string;
  ta: string;
}

const HOW_OFTEN_PHRASE: Record<HowOften, { en: string; ta: string }> = {
  "1-0-0": { en: "every morning", ta: "காலை" },
  "0-0-1": { en: "every night", ta: "இரவு" },
  "1-0-1": { en: "every morning and night", ta: "காலையும் இரவும்" },
  "1-1-1": { en: "three times a day", ta: "நாளொன்றுக்கு மூன்று முறை" },
  SOS: { en: "when needed", ta: "தேவைப்படும்போது" },
};

const FOOD_PHRASE: Record<FoodTiming, { en: string; ta: string }> = {
  before_food: { en: "before food", ta: "உணவுக்கு முன்" },
  after_food: { en: "after food", ta: "உணவுக்குப் பிறகு" },
  with_food: { en: "with food", ta: "உணவுடன்" },
  anytime: { en: "", ta: "" },
};

export function generateInstructionText(
  structured: PrescriptionItemStructuredDose,
  form: MedicineForm = "tablet",
): InstructionText {
  const unit = MEDICINE_FORM_UNIT_NOUN[form] ?? MEDICINE_FORM_UNIT_NOUN.other;
  const timing = HOW_OFTEN_PHRASE[structured.howOften];
  const food = FOOD_PHRASE[structured.foodTiming] ?? FOOD_PHRASE.anytime;
  const dayWordEn = structured.days === 1 ? "day" : "days";

  const en = `One ${unit.en} ${timing.en}${food.en ? ` ${food.en}` : ""}, for ${structured.days} ${dayWordEn}.`;
  const ta = `${food.ta ? `${food.ta} ` : ""}${timing.ta} ஒரு ${unit.ta}, ${structured.days} நாட்கள்.`;
  return { en, ta };
}
