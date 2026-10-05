// Fields collected in the Notes section of the patient Add/Edit form.
// Each hospital configures these at Settings → Patient fields; the API
// (GET /hospitals/:id/patient-note-fields) always returns the full resolved
// list. The defaults below mirror BUILT_IN_PATIENT_NOTE_FIELDS in
// apps/api/src/constants.ts and are only used until that request resolves.

export type PatientNoteFieldType = "tags" | "text";

export interface PatientNoteField {
  key: string;
  label: string;
  type: PatientNoteFieldType;
  enabled: boolean;
  hint?: string;
  placeholder?: string;
  builtIn?: boolean;
}

// Built-in keys are top-level Patient properties; everything else is stored
// under Patient.customFields[key].
export type BuiltInNoteFieldKey =
  | "allergies"
  | "conditions"
  | "flags"
  | "notes";

export const BUILT_IN_NOTE_FIELD_KEYS: BuiltInNoteFieldKey[] = [
  "allergies",
  "conditions",
  "flags",
  "notes",
];

export function isBuiltInNoteField(key: string): key is BuiltInNoteFieldKey {
  return (BUILT_IN_NOTE_FIELD_KEYS as string[]).includes(key);
}

export const DEFAULT_PATIENT_NOTE_FIELDS: PatientNoteField[] = [
  {
    key: "allergies",
    label: "Allergies",
    type: "tags",
    enabled: true,
    builtIn: true,
    hint: "Checked against a medicine's allergy class tags when a doctor writes a prescription.",
    placeholder: "Type an allergy and press Enter (e.g. Penicillin)",
  },
  {
    key: "conditions",
    label: "Conditions",
    type: "tags",
    enabled: true,
    builtIn: true,
    hint: "Shown as badges on the prescription writer, e.g. diabetic, hypertensive.",
    placeholder: "Type a condition and press Enter (e.g. Diabetic)",
  },
  {
    key: "flags",
    label: "Flags",
    type: "tags",
    enabled: true,
    builtIn: true,
    hint: "Any other context worth surfacing on the prescription writer, e.g. eGFR normal.",
    placeholder: "Type a flag and press Enter (e.g. eGFR normal)",
  },
  {
    key: "notes",
    label: "Additional notes",
    type: "text",
    enabled: true,
    builtIn: true,
    placeholder: "Any additional information about the patient...",
  },
];

// Chip colours per built-in tag field; custom tag fields use the neutral style.
export const NOTE_TAG_CLASSES: Record<string, string> = {
  allergies: "bg-status-danger-soft text-status-danger",
  conditions: "bg-status-warning-soft text-status-warning",
  flags: "bg-status-open-soft text-status-open",
};
export const DEFAULT_NOTE_TAG_CLASS = "bg-brand-violet-soft text-brand-violet";

export function newCustomFieldKey(): string {
  return `cf_${Math.random().toString(36).slice(2, 10)}`;
}
