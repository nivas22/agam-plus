// components/settings/ChargeCatalogItemDrawer.tsx
"use client";

import { Loader2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  useChargeCatalogItem,
  useCreateChargeCatalogItem,
  useSetChargeCatalogItemStatus,
  useUpdateChargeCatalogItem,
} from "@/hooks/useChargeCatalogApi";
import { Field, inputClass, ToggleSwitch } from "@/components/common/EditFormControls";
import { CHARGE_CATALOG_CATEGORY_OPTIONS } from "@/types/chargeCatalog";
import type { ChargeCatalogCategory } from "@/types/chargeCatalog";
import { GST_RATES } from "@/constants";

interface ChargeCatalogItemDrawerProps {
  hospitalId: string;
  itemId?: string;
  onClose: () => void;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function ChargeCatalogItemDrawer({
  hospitalId,
  itemId,
  onClose,
}: ChargeCatalogItemDrawerProps) {
  const isEdit = !!itemId;
  const { data: item, isLoading } = useChargeCatalogItem(itemId || "", hospitalId);
  const createItem = useCreateChargeCatalogItem(hospitalId);
  const updateItem = useUpdateChargeCatalogItem(hospitalId);
  const setStatus = useSetChargeCatalogItemStatus(hospitalId);

  const [name, setName] = useState("");
  const [category, setCategory] = useState<ChargeCatalogCategory>(
    CHARGE_CATALOG_CATEGORY_OPTIONS[0].value as ChargeCatalogCategory,
  );
  const [price, setPrice] = useState("");
  const [gstPercent, setGstPercent] = useState(0);
  const [frontDeskCanAdd, setFrontDeskCanAdd] = useState(true);
  const [coveredByPackages, setCoveredByPackages] = useState(false);
  const [timing, setTiming] = useState<"now" | "scheduled">("now");
  const [effectiveFrom, setEffectiveFrom] = useState(todayIso());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!item) return;
    setName(item.name);
    setCategory(item.category);
    setPrice(String(item.currentPrice));
    setGstPercent(item.currentGstPercent);
    setFrontDeskCanAdd(item.frontDeskCanAdd);
    setCoveredByPackages(item.coveredByPackages);
  }, [item]);

  const priceChanged = isEdit && item && Number(price) !== item.currentPrice;
  const saving = createItem.isPending || updateItem.isPending;

  const submit = async () => {
    setError(null);
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    const priceValue = Number(price);
    if (!(priceValue >= 0)) {
      setError("Enter a valid price");
      return;
    }

    try {
      if (isEdit && itemId) {
        const updates: Record<string, unknown> = {
          name: name.trim(),
          category,
          frontDeskCanAdd,
          coveredByPackages,
        };
        if (priceChanged) {
          updates.price = priceValue;
          updates.gstPercent = gstPercent;
          updates.effectiveFrom = timing === "now" ? todayIso() : effectiveFrom;
        }
        await updateItem.mutateAsync({ itemId, updates });
      } else {
        await createItem.mutateAsync({
          name: name.trim(),
          category: category as any,
          price: priceValue,
          gstPercent,
          frontDeskCanAdd,
          coveredByPackages,
        });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save item");
    }
  };

  const archiveOrRestore = async () => {
    if (!itemId || !item) return;
    await setStatus.mutateAsync({
      itemId,
      status: item.status === "active" ? "archived" : "active",
    });
    onClose();
  };

  const sortedHistory = useMemo(
    () =>
      item
        ? [...item.priceHistory].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))
        : [],
    [item],
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-ink-900/35" onClick={onClose} />
      <div className="relative w-full max-w-[520px] h-full bg-surface-paper shadow-2xl flex flex-col">
        <div className="px-6 pt-5 pb-4 border-b border-border flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-ink-900">
              {isEdit ? item?.name || "Loading…" : "Add a charge catalog item"}
            </h2>
            {isEdit && item && (
              <p className="text-xs text-ink-500 mt-1 font-mono">
                {item.code} · billed {item.usageThisMonth} time{item.usageThisMonth === 1 ? "" : "s"} this month
              </p>
            )}
            {!isEdit && (
              <p className="text-xs text-ink-500 mt-1">Everything the front desk can add to a bill.</p>
            )}
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-surface-canvas text-ink-500">
            <X size={18} />
          </button>
        </div>

        {isEdit && isLoading ? (
          <div className="flex-1 grid place-items-center text-ink-500 text-sm">Loading…</div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {error && <div className="text-sm text-status-danger">{error}</div>}

              <Field label="Name" hint="As it appears on the bill">
                <input type="text" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Category">
                  <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value as any)}>
                    {CHARGE_CATALOG_CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Code" optional>
                  <input
                    type="text"
                    className={`${inputClass} font-mono text-ink-500`}
                    value={isEdit ? item?.code || "" : "auto"}
                    disabled
                  />
                </Field>
              </div>

              <Field label="Price">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex">
                    <span className="grid place-items-center px-3 border border-r-0 border-border rounded-l-lg bg-surface-canvas text-sm font-mono text-ink-700">
                      ₹
                    </span>
                    <input
                      type="number"
                      className={`${inputClass} rounded-l-none font-mono`}
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                    />
                  </div>
                  <select
                    className={inputClass}
                    value={gstPercent}
                    onChange={(e) => setGstPercent(Number(e.target.value))}
                  >
                    {GST_RATES.map((rate) => (
                      <option key={rate} value={rate}>
                        {rate === 0 ? "GST — Nil" : `${rate}%`}
                      </option>
                    ))}
                  </select>
                </div>

                {priceChanged && (
                  <div className="mt-2.5 bg-status-warning-soft border border-status-warning/30 rounded-lg p-3">
                    <div className="text-[13px] font-semibold text-status-warning">
                      When does ₹{price} start?
                    </div>
                    <div className="mt-2 space-y-2">
                      <label className="flex items-center gap-2 text-[13px] text-status-warning cursor-pointer">
                        <span
                          className={`w-3.5 h-3.5 rounded-full border flex-none ${
                            timing === "now" ? "border-[4px] border-status-warning bg-white" : "border-status-warning/40 bg-white"
                          }`}
                          onClick={() => setTiming("now")}
                        />
                        <span onClick={() => setTiming("now")}>Right away — next bill uses it</span>
                      </label>
                      <label className="flex items-center gap-2 text-[13px] text-status-warning cursor-pointer">
                        <span
                          className={`w-3.5 h-3.5 rounded-full border flex-none ${
                            timing === "scheduled" ? "border-[4px] border-status-warning bg-white" : "border-status-warning/40 bg-white"
                          }`}
                          onClick={() => setTiming("scheduled")}
                        />
                        <span onClick={() => setTiming("scheduled")}>From a date</span>
                        <input
                          type="date"
                          className="ml-1 px-2 py-1 border border-status-warning/40 rounded-md text-xs bg-white"
                          value={effectiveFrom}
                          min={todayIso()}
                          onChange={(e) => {
                            setEffectiveFrom(e.target.value);
                            setTiming("scheduled");
                          }}
                        />
                      </label>
                    </div>
                    {timing === "scheduled" && (
                      <p className="text-xs text-status-warning/80 mt-2 leading-relaxed">
                        Until {formatDate(effectiveFrom)} the desk still bills ₹{item?.currentPrice}.
                      </p>
                    )}
                  </div>
                )}
              </Field>

              <Field label="Behaviour">
                <div className="space-y-2.5">
                  <div className="flex gap-3 items-start border border-border rounded-lg p-3">
                    <ToggleSwitch checked={frontDeskCanAdd} onChange={setFrontDeskCanAdd} />
                    <div>
                      <div className="text-sm font-semibold text-ink-900">Front desk can add it</div>
                      <div className="text-xs text-ink-500 mt-0.5 leading-snug">
                        Off means only a doctor can put this on a bill.
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3 items-start border border-border rounded-lg p-3">
                    <ToggleSwitch checked={coveredByPackages} onChange={setCoveredByPackages} />
                    <div>
                      <div className="text-sm font-semibold text-ink-900">Covered by prepaid packages</div>
                      <div className="text-xs text-ink-500 mt-0.5 leading-snug">
                        Off means it&apos;s charged even when the visit uses a package visit. Most extras should stay off.
                      </div>
                    </div>
                  </div>
                </div>
              </Field>

              {isEdit && item && (
                <Field label="Price history">
                  <div className="border border-border rounded-lg overflow-hidden">
                    <div className="bg-surface-canvas/60 px-3 py-1.5 text-[10.5px] uppercase tracking-wide text-ink-500 font-semibold border-b border-border">
                      Every version is kept
                    </div>
                    {sortedHistory.map((version, idx) => {
                      const isFuture = version.effectiveFrom > todayIso();
                      const isCurrent = !isFuture && idx === sortedHistory.findIndex((v) => v.effectiveFrom <= todayIso());
                      return (
                        <div
                          key={`${version.effectiveFrom}-${idx}`}
                          className="grid grid-cols-[64px_1fr] gap-2.5 px-3 py-2 border-t border-border first:border-t-0 text-[13px]"
                        >
                          <span
                            className={`font-mono font-medium ${isFuture ? "text-status-warning" : isCurrent ? "text-status-open" : "text-ink-700"}`}
                          >
                            ₹{version.price}
                          </span>
                          <span>
                            <span className="block font-medium text-ink-900">
                              {isFuture ? `From ${formatDate(version.effectiveFrom)}` : isCurrent ? `Since ${formatDate(version.effectiveFrom)}` : formatDate(version.effectiveFrom)}
                            </span>
                            <span className="block text-xs text-ink-500">
                              {isFuture
                                ? `Queued by ${version.createdByName || "—"}`
                                : isCurrent
                                  ? "Current price"
                                  : `Changed by ${version.createdByName || "—"}`}
                            </span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-ink-500 mt-2 leading-relaxed bg-status-open-soft border border-status-open/20 rounded-lg p-2.5">
                    Changing the price never touches a bill that&apos;s already been raised. Each invoice keeps the
                    name and amount charged on the day, so past reports stay correct.
                  </p>
                </Field>
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
                  {item.status === "active" ? "Archive item" : "Restore item"}
                </button>
              )}
              <div className="flex-1" />
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm font-semibold text-ink-700">
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
