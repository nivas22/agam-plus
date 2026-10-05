// components/inventory/InventoryItemDrawer.tsx
"use client";

import { Loader2, PackageMinus, PackagePlus, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Field,
  inputClass,
  ToggleSwitch,
} from "@/components/common/EditFormControls";
import {
  useCreateInventoryItem,
  useInventoryItem,
  useSetInventoryItemStatus,
  useUpdateInventoryItem,
} from "@/hooks/useInventoryApi";
import {
  INVENTORY_CATEGORY_OPTIONS,
  INVENTORY_MOVEMENT_LABELS,
  INVENTORY_UNIT_SUGGESTIONS,
  type InventoryCategory,
  type InventoryMutationResult,
} from "@/types/inventory";
import {
  EXPIRY_BADGE,
  STOCK_BADGE,
  errorMessage,
  formatDateTime,
  formatDay,
  formatMoney,
  formatQty,
} from "./inventoryFormat";
import type { StockAction } from "./StockActionModal";

interface InventoryItemDrawerProps {
  hospitalId: string;
  itemId?: string;
  onClose: () => void;
  onStockAction: (action: StockAction) => void;
  // Lets the page say so when the change was queued for approval.
  onResult: (result: InventoryMutationResult) => void;
}

export default function InventoryItemDrawer({
  hospitalId,
  itemId,
  onClose,
  onStockAction,
  onResult,
}: InventoryItemDrawerProps) {
  const isEdit = !!itemId;
  const { data: item, isLoading } = useInventoryItem(itemId || "", hospitalId);
  const createItem = useCreateInventoryItem(hospitalId);
  const updateItem = useUpdateInventoryItem(hospitalId);
  const setStatus = useSetInventoryItemStatus(hospitalId);

  const [name, setName] = useState("");
  const [category, setCategory] = useState<InventoryCategory>("consumables");
  const [unit, setUnit] = useState("piece");
  const [reorderLevel, setReorderLevel] = useState("0");
  const [tracksExpiry, setTracksExpiry] = useState(true);
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!item) return;
    setName(item.name);
    setCategory(item.category);
    setUnit(item.unit);
    setReorderLevel(String(item.reorderLevel));
    setTracksExpiry(item.tracksExpiry);
    setLocation(item.location || "");
    setNotes(item.notes || "");
  }, [item]);

  const saving = createItem.isPending || updateItem.isPending;

  const submit = async () => {
    setError(null);
    if (!name.trim()) return setError("Name is required");
    if (!unit.trim()) return setError("Unit is required");
    const reorder = Number(reorderLevel || 0);
    if (!(reorder >= 0)) return setError("Reorder level can't be negative");

    const data = {
      name: name.trim(),
      category,
      unit: unit.trim(),
      reorderLevel: reorder,
      tracksExpiry,
      location: location.trim() || undefined,
      notes: notes.trim() || undefined,
    };
    try {
      const result =
        isEdit && itemId
          ? await updateItem.mutateAsync({ itemId, data })
          : await createItem.mutateAsync(data);
      onResult(result);
      onClose();
    } catch (err) {
      setError(errorMessage(err, "Failed to save item"));
    }
  };

  const archiveOrRestore = async () => {
    if (!itemId || !item) return;
    try {
      const result = await setStatus.mutateAsync({
        itemId,
        status: item.status === "active" ? "archived" : "active",
      });
      onResult(result);
      onClose();
    } catch (err) {
      setError(errorMessage(err, "Failed to update item"));
    }
  };

  const isActive = item?.status === "active";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-ink-900/35" onClick={onClose} />
      <div className="relative w-full max-w-[560px] h-full bg-surface-paper shadow-2xl flex flex-col">
        <div className="px-6 pt-5 pb-4 border-b border-border flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-ink-900 font-display tracking-tight truncate">
              {isEdit ? item?.name || "Loading…" : "Add an inventory item"}
            </h2>
            {isEdit && item ? (
              <p className="text-xs text-ink-500 mt-1 font-mono">
                {item.code} · {formatQty(item.onHand, item.unit)} on hand ·{" "}
                {formatMoney(item.stockValue)}
              </p>
            ) : (
              <p className="text-xs text-ink-500 mt-1">
                Anything the hospital keeps in stock.
              </p>
            )}
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
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              {error && (
                <div className="text-sm text-status-danger">{error}</div>
              )}

              {isEdit && item && (
                <section>
                  <div className="flex items-center gap-2 mb-2.5">
                    <h3 className="text-sm font-semibold text-ink-900">
                      Stock
                    </h3>
                    <span
                      className={`rounded-md px-2 py-0.5 text-[10.5px] font-semibold ${STOCK_BADGE[item.stockStatus].className}`}
                    >
                      {STOCK_BADGE[item.stockStatus].label}
                    </span>
                    <div className="flex-1" />
                    {isActive && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            onStockAction({ kind: "receive", item })
                          }
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-ink-700"
                        >
                          <PackagePlus size={14} /> Receive
                        </button>
                        <button
                          type="button"
                          disabled={item.onHand <= 0}
                          onClick={() =>
                            onStockAction({
                              kind: "issue",
                              item,
                              batches: item.batches,
                            })
                          }
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-ink-700 disabled:opacity-50"
                        >
                          <PackageMinus size={14} /> Issue
                        </button>
                      </>
                    )}
                  </div>

                  <div className="border border-border rounded-lg overflow-hidden">
                    {item.batches.length === 0 ? (
                      <div className="px-3 py-4 text-sm text-ink-500 text-center">
                        Nothing in stock — receive a delivery to start.
                      </div>
                    ) : (
                      item.batches.map((batch) => (
                        <div
                          key={batch.id}
                          className="flex items-center gap-3 px-3 py-2.5 border-t border-border first:border-t-0 text-[13px]"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-ink-900 font-mono">
                              {batch.batchNumber || "No batch"}
                              {batch.expiryStatus && (
                                <span
                                  className={`ml-2 rounded-md px-1.5 py-0.5 text-[10px] font-sans font-semibold ${EXPIRY_BADGE[batch.expiryStatus].className}`}
                                >
                                  {EXPIRY_BADGE[batch.expiryStatus].label}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-ink-500 truncate">
                              {batch.expiryDate
                                ? `Expires ${formatDay(batch.expiryDate)} · `
                                : ""}
                              Received {formatDateTime(batch.receivedAt)}
                              {batch.supplier ? ` from ${batch.supplier}` : ""}
                            </div>
                          </div>
                          <div className="text-right font-mono">
                            <div className="text-ink-900">
                              {formatQty(batch.quantity, item.unit)}
                            </div>
                            {batch.unitCost !== undefined && (
                              <div className="text-[11px] text-ink-500">
                                ₹{batch.unitCost} each
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              onStockAction({ kind: "adjust", item, batch })
                            }
                            className="px-2.5 py-1 rounded-lg border border-border text-xs font-semibold text-ink-700"
                          >
                            Adjust
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              )}

              <section className="space-y-4">
                {isEdit && (
                  <h3 className="text-sm font-semibold text-ink-900">
                    Details
                  </h3>
                )}
                <Field label="Name" required>
                  <input
                    type="text"
                    className={inputClass}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Category">
                    <select
                      className={inputClass}
                      value={category}
                      onChange={(e) =>
                        setCategory(e.target.value as InventoryCategory)
                      }
                    >
                      {INVENTORY_CATEGORY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field
                    label="Counted in"
                    required
                    hint="The unit stock is counted in"
                  >
                    <input
                      type="text"
                      list="inventory-unit-suggestions"
                      className={inputClass}
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                    />
                    <datalist id="inventory-unit-suggestions">
                      {INVENTORY_UNIT_SUGGESTIONS.map((u) => (
                        <option key={u} value={u} />
                      ))}
                    </datalist>
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field
                    label="Reorder at"
                    hint="Flag as low stock at or below this. 0 = never."
                  >
                    <input
                      type="number"
                      min={0}
                      step="any"
                      className={`${inputClass} font-mono`}
                      value={reorderLevel}
                      onChange={(e) => setReorderLevel(e.target.value)}
                    />
                  </Field>
                  <Field label="Location" optional>
                    <input
                      type="text"
                      className={inputClass}
                      placeholder="e.g. Pharmacy shelf B"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                    />
                  </Field>
                </div>

                <div className="flex gap-3 items-start border border-border rounded-lg p-3">
                  <ToggleSwitch
                    checked={tracksExpiry}
                    onChange={setTracksExpiry}
                    ariaLabel="Track batches and expiry"
                  />
                  <div>
                    <div className="text-sm font-semibold text-ink-900">
                      Track batches & expiry
                    </div>
                    <div className="text-xs text-ink-500 mt-0.5 leading-snug">
                      Each delivery needs a batch number and expiry date, and
                      stock is issued first-to-expire first. Turn off for things
                      that don&apos;t expire, like equipment or stationery.
                    </div>
                  </div>
                </div>

                <Field label="Notes" optional>
                  <textarea
                    className={inputClass}
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </Field>
              </section>

              {isEdit && item && (
                <section>
                  <h3 className="text-sm font-semibold text-ink-900 mb-2.5">
                    History
                  </h3>
                  <div className="border border-border rounded-lg overflow-hidden">
                    {item.movements.length === 0 ? (
                      <div className="px-3 py-4 text-sm text-ink-500 text-center">
                        No stock movements yet.
                      </div>
                    ) : (
                      item.movements.map((m) => (
                        <div
                          key={m.id}
                          className="grid grid-cols-[70px_1fr] gap-2.5 px-3 py-2 border-t border-border first:border-t-0 text-[13px]"
                        >
                          <span
                            className={`font-mono font-medium ${m.quantity > 0 ? "text-status-open" : "text-status-danger"}`}
                          >
                            {m.quantity > 0 ? "+" : "−"}
                            {formatQty(Math.abs(m.quantity))}
                          </span>
                          <span className="min-w-0">
                            <span className="block font-medium text-ink-900">
                              {INVENTORY_MOVEMENT_LABELS[m.type]}
                              {m.issuedTo ? ` → ${m.issuedTo}` : ""}
                            </span>
                            <span className="block text-xs text-ink-500 truncate">
                              {formatDateTime(m.at)} · {m.actorName || "—"}
                              {m.batchNumber ? ` · batch ${m.batchNumber}` : ""}
                              {m.reason ? ` · ${m.reason}` : ""}
                            </span>
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              )}
            </div>

            <div className="px-6 py-4 border-t border-border flex items-center gap-3">
              {isEdit && item && (
                <button
                  type="button"
                  onClick={archiveOrRestore}
                  disabled={setStatus.isPending}
                  className="px-3.5 py-2 rounded-lg border border-status-danger/30 text-status-danger text-sm font-semibold disabled:opacity-60"
                >
                  {isActive ? "Archive item" : "Restore item"}
                </button>
              )}
              <div className="flex-1" />
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
            </div>
          </>
        )}
      </div>
    </div>
  );
}
