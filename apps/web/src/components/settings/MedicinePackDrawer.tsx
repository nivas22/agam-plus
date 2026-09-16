// components/settings/MedicinePackDrawer.tsx
"use client";

import { Loader2, Search, X } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { Field, inputClass } from "@/components/common/EditFormControls";
import DoseControls from "@/components/prescriptions/DoseControls";
import { useMedicines } from "@/hooks/useMedicineApi";
import {
  useCreateMedicinePack,
  useMedicinePack,
  useSetMedicinePackStatus,
  useUpdateMedicinePack,
} from "@/hooks/useMedicinePackApi";
import type { FoodTiming } from "@/types/medicine";
import type { HowOften } from "@/types/prescription";
import type { MedicinePackItem } from "@/types/medicinePack";

interface MedicinePackDrawerProps {
  hospitalId: string;
  packId?: string;
  readOnly?: boolean;
  onClose: () => void;
}

export default function MedicinePackDrawer({
  hospitalId,
  packId,
  readOnly = false,
  onClose,
}: MedicinePackDrawerProps) {
  const isEdit = !!packId;
  const { data: pack, isLoading } = useMedicinePack(packId || "", hospitalId);
  const createPack = useCreateMedicinePack(hospitalId);
  const updatePack = useUpdateMedicinePack(hospitalId);
  const setStatus = useSetMedicinePackStatus(hospitalId);

  const { data: medicineData } = useMedicines(hospitalId, { status: "active" });
  const medicines = medicineData?.items || [];

  const [name, setName] = useState("");
  const [items, setItems] = useState<MedicinePackItem[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pack) return;
    setName(pack.name);
    setItems(pack.items || []);
  }, [pack]);

  const saving = createPack.isPending || updatePack.isPending;

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return medicines
      .filter((m) => m.name.toLowerCase().includes(q))
      .slice(0, 6);
  }, [medicines, query]);

  function addMedicine(medicineId: string, medicineName: string) {
    if (items.some((i) => i.medicineId === medicineId)) {
      setQuery("");
      return;
    }
    setItems((prev) => [
      ...prev,
      { medicineId, medicineName, howOften: "1-0-0", foodTiming: "after_food", days: 3 },
    ]);
    setQuery("");
  }

  function updateItem(index: number, patch: Partial<MedicinePackItem>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  const submit = async () => {
    setError(null);
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    if (items.length === 0) {
      setError("Add at least one medicine");
      return;
    }

    try {
      if (isEdit && packId) {
        await updatePack.mutateAsync({ packId, updates: { name: name.trim(), items } });
      } else {
        await createPack.mutateAsync({ name: name.trim(), items });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save pack");
    }
  };

  const archiveOrRestore = async () => {
    if (!packId || !pack) return;
    await setStatus.mutateAsync({
      packId,
      status: pack.status === "active" ? "archived" : "active",
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-ink-900/35" onClick={onClose} />
      <div className="relative w-full max-w-[560px] h-full bg-surface-paper shadow-2xl flex flex-col">
        <div className="px-6 pt-5 pb-4 border-b border-border flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-ink-900 font-display tracking-tight">
              {isEdit ? pack?.name || "Loading…" : "New medicine pack"}
            </h2>
            <p className="text-xs text-ink-500 mt-1">
              A treatment template doctors can apply in one click.
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
              {error && <div className="text-sm text-status-danger">{error}</div>}

              <Field label="Pack name" hint="e.g. Fever pack, URI pack">
                <input
                  type="text"
                  className={inputClass}
                  value={name}
                  disabled={readOnly}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>

              {!readOnly && (
                <Field label="Add medicines">
                  <div className="relative">
                    <Search
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500"
                    />
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search by name"
                      className={`${inputClass} pl-8`}
                    />
                  </div>
                  {candidates.length > 0 && (
                    <div className="mt-2 border border-border rounded-lg overflow-hidden divide-y divide-border">
                      {candidates.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => addMedicine(m.id, m.name)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-surface-canvas/60"
                        >
                          {m.name}
                          {m.strength ? ` — ${m.strength}` : ""}
                        </button>
                      ))}
                    </div>
                  )}
                </Field>
              )}

              <div className="space-y-3">
                {items.length === 0 && (
                  <p className="text-xs text-ink-500">No medicines added yet.</p>
                )}
                {items.map((item, index) => (
                  <div
                    key={`${item.medicineId}-${index}`}
                    className="border border-border rounded-lg p-3"
                  >
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-sm font-semibold text-ink-900">
                        {item.medicineName}
                      </span>
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="text-ink-500 hover:text-status-danger"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    <DoseControls
                      howOften={item.howOften}
                      onHowOftenChange={(v: HowOften) => updateItem(index, { howOften: v })}
                      foodTiming={item.foodTiming}
                      onFoodTimingChange={(v: FoodTiming) => updateItem(index, { foodTiming: v })}
                      days={item.days}
                      onDaysChange={(v) => updateItem(index, { days: v })}
                      disabled={readOnly}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border flex items-center gap-3">
              {!readOnly && isEdit && pack && (
                <button
                  type="button"
                  onClick={archiveOrRestore}
                  disabled={setStatus.isPending}
                  className="px-3.5 py-2 rounded-lg border border-status-danger/30 text-status-danger text-sm font-semibold disabled:opacity-60"
                >
                  {pack.status === "active" ? "Archive" : "Restore"}
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
