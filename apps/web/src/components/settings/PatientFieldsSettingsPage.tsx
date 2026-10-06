// components/settings/PatientFieldsSettingsPage.tsx
"use client";

import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { inputClass, ToggleSwitch } from "@/components/common/EditFormControls";
import {
  useHospitalPatientNoteFields,
  useUpdateHospitalPatientNoteFields,
} from "@/hooks/useHospitalPatientNoteFieldsApi";
import {
  newCustomFieldKey,
  type PatientNoteField,
  type PatientNoteFieldType,
} from "@/lib/patientNoteFields";

interface PatientFieldsSettingsPageProps {
  hospitalId: string;
  canEdit: boolean;
}

const TYPE_LABELS: Record<PatientNoteFieldType, string> = {
  tags: "Tags",
  text: "Text",
};

export default function PatientFieldsSettingsPage({
  hospitalId,
  canEdit,
}: PatientFieldsSettingsPageProps) {
  const { data, isLoading } = useHospitalPatientNoteFields(hospitalId);
  const updateFields = useUpdateHospitalPatientNoteFields(hospitalId);

  const [list, setList] = useState<PatientNoteField[]>([]);
  const [draftLabel, setDraftLabel] = useState("");
  const [draftType, setDraftType] = useState<PatientNoteFieldType>("tags");

  useEffect(() => {
    if (data) setList(data.fields);
  }, [data]);

  const isDirty = JSON.stringify(list) !== JSON.stringify(data?.fields || []);

  const updateField = (key: string, patch: Partial<PatientNoteField>) => {
    setList((prev) =>
      prev.map((f) => (f.key === key ? { ...f, ...patch } : f)),
    );
  };

  const moveField = (index: number, delta: number) => {
    setList((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const removeField = (key: string) => {
    setList((prev) => prev.filter((f) => f.key !== key));
  };

  const addField = () => {
    const label = draftLabel.trim();
    if (!label) return;
    if (list.some((f) => f.label.toLowerCase() === label.toLowerCase())) {
      toast.error("A field with this name already exists");
      return;
    }
    setList((prev) => [
      ...prev,
      {
        key: newCustomFieldKey(),
        label,
        type: draftType,
        enabled: true,
        builtIn: false,
      },
    ]);
    setDraftLabel("");
  };

  const save = async () => {
    if (list.some((f) => !f.label.trim())) {
      toast.error("Every field needs a name");
      return;
    }
    try {
      await updateFields.mutateAsync(
        list.map((f) => ({
          ...f,
          label: f.label.trim(),
          hint: f.hint?.trim() || undefined,
          placeholder: f.placeholder?.trim() || undefined,
        })),
      );
      toast.success("Patient fields updated");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save changes",
      );
    }
  };

  const reset = () => setList(data?.fields || []);

  return (
    <div>
      <h1 className="font-display tracking-tight text-xl font-bold text-ink-900 mb-1">
        Patient fields
      </h1>
      <p className="text-sm text-ink-500 mb-5">
        Choose what the Notes section of the patient form collects. Turning a
        field off hides it from the form but keeps any data already saved.
      </p>

      <div className="bg-surface-paper border border-border rounded-xl p-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-ink-500 py-6 justify-center">
            <Loader2 size={16} className="animate-spin" />
            Loading…
          </div>
        ) : (
          <ul className="border border-border rounded-lg divide-y divide-border overflow-hidden">
            {list.map((field, i) => (
              <li
                key={field.key}
                className={`flex flex-col sm:flex-row sm:items-start gap-3 px-3 py-3 ${
                  field.enabled ? "" : "bg-surface-canvas"
                }`}
              >
                <div className="flex items-center gap-2 sm:pt-2">
                  <ToggleSwitch
                    checked={field.enabled}
                    disabled={!canEdit}
                    onChange={(enabled) => updateField(field.key, { enabled })}
                  />
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={field.label}
                      disabled={!canEdit}
                      maxLength={60}
                      onChange={(e) =>
                        updateField(field.key, { label: e.target.value })
                      }
                      className={inputClass}
                      aria-label="Field name"
                    />
                    <span className="shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold bg-surface-canvas text-ink-700 border border-border">
                      {TYPE_LABELS[field.type]}
                    </span>
                    {field.builtIn && (
                      <span className="shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold bg-brand-violet-soft text-brand-violet">
                        Built-in
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={field.hint || ""}
                    disabled={!canEdit}
                    maxLength={200}
                    onChange={(e) =>
                      updateField(field.key, { hint: e.target.value })
                    }
                    placeholder="Help text shown under the field (optional)"
                    className={`${inputClass} text-xs py-2`}
                    aria-label="Help text"
                  />
                  {field.key === "allergies" && !field.enabled && (
                    <p className="text-xs text-status-warning">
                      The prescription allergy check only uses allergies already
                      recorded; new patients won&apos;t have any.
                    </p>
                  )}
                </div>
                {canEdit && (
                  <div className="flex sm:flex-col items-center gap-1 sm:pt-1">
                    <button
                      type="button"
                      onClick={() => moveField(i, -1)}
                      disabled={i === 0}
                      className="rounded-md p-1 text-ink-500 hover:text-ink-900 hover:bg-surface-canvas disabled:opacity-30"
                      aria-label={`Move ${field.label} up`}
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveField(i, 1)}
                      disabled={i === list.length - 1}
                      className="rounded-md p-1 text-ink-500 hover:text-ink-900 hover:bg-surface-canvas disabled:opacity-30"
                      aria-label={`Move ${field.label} down`}
                    >
                      <ArrowDown size={14} />
                    </button>
                    {!field.builtIn && (
                      <button
                        type="button"
                        onClick={() => removeField(field.key)}
                        className="rounded-md p-1 text-ink-500 hover:text-status-danger hover:bg-status-danger-soft"
                        aria-label={`Remove ${field.label}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {canEdit && !isLoading && (
          <div className="mt-4">
            <div className="text-xs font-semibold text-ink-700 mb-2">
              Add a custom field
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={draftLabel}
                maxLength={60}
                onChange={(e) => setDraftLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addField();
                  }
                }}
                placeholder="e.g. Blood group, Insurance ID, Referred by"
                className={inputClass}
              />
              <select
                value={draftType}
                onChange={(e) =>
                  setDraftType(e.target.value as PatientNoteFieldType)
                }
                className={`${inputClass} sm:w-40`}
                aria-label="Field type"
              >
                <option value="tags">Tags (list)</option>
                <option value="text">Text</option>
              </select>
              <button
                type="button"
                onClick={addField}
                disabled={!draftLabel.trim()}
                className="flex items-center justify-center gap-1.5 bg-brand-violet hover:bg-brand-violet-hover text-white text-sm font-semibold rounded-lg px-4 py-2.5 transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                <Plus size={16} />
                Add
              </button>
            </div>
          </div>
        )}
      </div>

      {canEdit && isDirty && (
        <div className="mt-4 flex gap-2.5 items-center bg-surface-paper border border-border rounded-lg p-3">
          <span className="text-xs text-ink-500 flex-1">
            You have unsaved changes.
          </span>
          <button
            type="button"
            onClick={reset}
            disabled={updateFields.isPending}
            className="px-3.5 py-1.5 rounded-lg border border-border text-xs font-semibold text-ink-700 disabled:opacity-50"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={save}
            disabled={updateFields.isPending}
            className="flex items-center gap-1.5 bg-brand-violet hover:bg-brand-violet-hover text-white text-xs font-semibold rounded-lg px-3.5 py-1.5 transition-colors disabled:opacity-50"
          >
            {updateFields.isPending && (
              <Loader2 size={14} className="animate-spin" />
            )}
            Save changes
          </button>
        </div>
      )}

      {!canEdit && (
        <div className="mt-5 flex gap-2.5 items-start bg-status-warning-soft border border-status-warning/30 rounded-lg p-3 text-xs text-status-warning">
          <AlertTriangle size={16} className="flex-none mt-0.5" />
          <span>Only hospital admins can change patient fields.</span>
        </div>
      )}
    </div>
  );
}
