// components/settings/MedicineItemDrawer.tsx
"use client";

import { Loader2, X } from "lucide-react";
import { type KeyboardEvent, useEffect, useState } from "react";
import { Field, inputClass } from "@/components/common/EditFormControls";
import {
  useCreateMedicine,
  useMedicine,
  useSetMedicineStatus,
  useUpdateMedicine,
} from "@/hooks/useMedicineApi";
import type { FoodTiming, MedicineForm } from "@/types/medicine";
import { FOOD_TIMING_OPTIONS, MEDICINE_FORM_OPTIONS } from "@/types/medicine";

interface MedicineItemDrawerProps {
  hospitalId: string;
  itemId?: string;
  readOnly?: boolean;
  onClose: () => void;
}

export default function MedicineItemDrawer({
  hospitalId,
  itemId,
  readOnly = false,
  onClose,
}: MedicineItemDrawerProps) {
  const isEdit = !!itemId;
  const { data: item, isLoading } = useMedicine(itemId || "", hospitalId);
  const createItem = useCreateMedicine(hospitalId);
  const updateItem = useUpdateMedicine(hospitalId);
  const setStatus = useSetMedicineStatus(hospitalId);

  const [name, setName] = useState("");
  const [genericName, setGenericName] = useState("");
  const [classes, setClasses] = useState<string[]>([]);
  const [classInput, setClassInput] = useState("");
  const [form, setForm] = useState<MedicineForm>("tablet");
  const [strength, setStrength] = useState("");
  const [defaultDose, setDefaultDose] = useState("");
  const [defaultFrequency, setDefaultFrequency] = useState("");
  const [defaultFoodTiming, setDefaultFoodTiming] = useState<FoodTiming | "">(
    "",
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!item) return;
    setName(item.name);
    setGenericName(item.genericName || "");
    setClasses(item.classes || []);
    setForm(item.form);
    setStrength(item.strength || "");
    setDefaultDose(item.defaultDose || "");
    setDefaultFrequency(item.defaultFrequency || "");
    setDefaultFoodTiming(item.defaultFoodTiming || "");
  }, [item]);

  const saving = createItem.isPending || updateItem.isPending;

  const addClass = () => {
    const value = classInput.trim().toLowerCase();
    if (value && !classes.includes(value))
      setClasses((prev) => [...prev, value]);
    setClassInput("");
  };

  const onClassKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addClass();
    }
  };

  const submit = async () => {
    setError(null);
    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    const payload = {
      name: name.trim(),
      genericName: genericName.trim() || undefined,
      classes,
      form,
      strength: strength.trim() || undefined,
      defaultDose: defaultDose.trim() || undefined,
      defaultFrequency: defaultFrequency.trim() || undefined,
      defaultFoodTiming: defaultFoodTiming || undefined,
    };

    try {
      if (isEdit && itemId) {
        await updateItem.mutateAsync({ medicineId: itemId, updates: payload });
      } else {
        await createItem.mutateAsync(payload);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save medicine");
    }
  };

  const archiveOrRestore = async () => {
    if (!itemId || !item) return;
    await setStatus.mutateAsync({
      medicineId: itemId,
      status: item.status === "active" ? "archived" : "active",
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-ink-900/35" onClick={onClose} />
      <div className="relative w-full max-w-[520px] h-full bg-surface-paper shadow-2xl flex flex-col">
        <div className="px-6 pt-5 pb-4 border-b border-border flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-ink-900 font-display tracking-tight">
              {isEdit ? item?.name || "Loading…" : "Add a medicine"}
            </h2>
            <p className="text-xs text-ink-500 mt-1">
              {isEdit
                ? "Update its details or allergy class tags."
                : "Added to the catalog doctors search from."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-surface-canvas text-ink-500"
          >
            <X size={18} />
          </button>
        </div>

        {isEdit && isLoading ? (
          <div className="flex-1 grid place-items-center text-ink-500 text-sm">
            Loading…
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {error && (
                <div className="text-sm text-status-danger">{error}</div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Field label="Name">
                  <input
                    type="text"
                    className={inputClass}
                    value={name}
                    disabled={readOnly}
                    onChange={(e) => setName(e.target.value)}
                  />
                </Field>
                <Field label="Generic name" optional>
                  <input
                    type="text"
                    className={inputClass}
                    value={genericName}
                    disabled={readOnly}
                    onChange={(e) => setGenericName(e.target.value)}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Form">
                  <select
                    className={inputClass}
                    value={form}
                    disabled={readOnly}
                    onChange={(e) => setForm(e.target.value as MedicineForm)}
                  >
                    {MEDICINE_FORM_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Strength" optional hint="e.g. 500mg">
                  <input
                    type="text"
                    className={inputClass}
                    value={strength}
                    disabled={readOnly}
                    onChange={(e) => setStrength(e.target.value)}
                  />
                </Field>
              </div>

              <Field
                label="Allergy class tags"
                optional
                hint="e.g. penicillin, nsaid — matched against a patient's recorded allergies to warn a doctor before prescribing."
              >
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {classes.map((c) => (
                    <span
                      key={c}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold bg-status-warning-soft text-status-warning"
                    >
                      {c}
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() =>
                            setClasses((prev) => prev.filter((x) => x !== c))
                          }
                          className="hover:opacity-70"
                        >
                          <X size={11} />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
                {!readOnly && (
                  <input
                    type="text"
                    className={inputClass}
                    placeholder="Type a class and press Enter"
                    value={classInput}
                    onChange={(e) => setClassInput(e.target.value)}
                    onKeyDown={onClassKeyDown}
                    onBlur={addClass}
                  />
                )}
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Default dose" optional hint="e.g. 1-0-1">
                  <input
                    type="text"
                    className={inputClass}
                    value={defaultDose}
                    disabled={readOnly}
                    onChange={(e) => setDefaultDose(e.target.value)}
                  />
                </Field>
                <Field label="Default frequency" optional>
                  <input
                    type="text"
                    className={inputClass}
                    value={defaultFrequency}
                    disabled={readOnly}
                    onChange={(e) => setDefaultFrequency(e.target.value)}
                  />
                </Field>
              </div>

              <Field label="Default food timing" optional>
                <select
                  className={inputClass}
                  value={defaultFoodTiming}
                  disabled={readOnly}
                  onChange={(e) =>
                    setDefaultFoodTiming(e.target.value as FoodTiming)
                  }
                >
                  <option value="">Not set</option>
                  {FOOD_TIMING_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="px-6 py-4 border-t border-border flex items-center gap-3">
              {!readOnly && isEdit && item && (
                <button
                  type="button"
                  onClick={archiveOrRestore}
                  disabled={setStatus.isPending}
                  className="px-3.5 py-2 rounded-lg border border-status-danger/30 text-status-danger text-sm font-semibold disabled:opacity-60"
                >
                  {item.status === "active" ? "Archive" : "Restore"}
                </button>
              )}
              <div className="flex-1" />
              {readOnly ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg border border-border text-sm font-semibold text-ink-700"
                >
                  Close
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-lg border border-border text-sm font-semibold text-ink-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={submit}
                    className="px-4 py-2 rounded-lg bg-brand-violet hover:bg-brand-violet-hover text-white text-sm font-semibold disabled:opacity-60 flex items-center gap-1.5"
                  >
                    {saving && <Loader2 size={14} className="animate-spin" />}
                    Save
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
