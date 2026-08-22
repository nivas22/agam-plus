// components/settings/BulkRevisePricesModal.tsx
"use client";

import { AlertTriangle, Loader2, Percent } from "lucide-react";
import { useMemo, useState } from "react";
import { DialogShell, primaryBtn, secondaryBtn } from "@/components/appointments/AppointmentActionDialogs";
import { useBulkReviseChargeCatalog } from "@/hooks/useChargeCatalogApi";
import type { BulkReviseMethod, ChargeCatalogItem } from "@/types/chargeCatalog";

interface BulkRevisePricesModalProps {
  hospitalId: string;
  items: ChargeCatalogItem[];
  onClose: () => void;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

const METHODS: { value: BulkReviseMethod; label: string; description: string }[] = [
  { value: "percent", label: "Increase by %", description: "Same percentage on every item" },
  { value: "fixed", label: "Add a fixed amount", description: "₹ added to each price" },
  { value: "manual", label: "Set each by hand", description: "Type a new price per item" },
];

export default function BulkRevisePricesModal({ hospitalId, items, onClose }: BulkRevisePricesModalProps) {
  const [method, setMethod] = useState<BulkReviseMethod>("percent");
  const [value, setValue] = useState("10");
  const [roundTo, setRoundTo] = useState<"none" | "5" | "10">("10");
  const [effectiveFrom, setEffectiveFrom] = useState(todayIso());
  const [manualPrices, setManualPrices] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const bulkRevise = useBulkReviseChargeCatalog(hospitalId);

  const round = (price: number) => {
    if (roundTo === "none") return Math.round(price);
    const step = Number(roundTo);
    return Math.round(price / step) * step;
  };

  const preview = useMemo(() => {
    return items.map((item) => {
      let newPrice = item.currentPrice;
      if (method === "percent") {
        newPrice = round(item.currentPrice * (1 + (Number(value) || 0) / 100));
      } else if (method === "fixed") {
        newPrice = round(item.currentPrice + (Number(value) || 0));
      } else {
        newPrice = Number(manualPrices[item.id] ?? item.currentPrice);
      }
      return { item, newPrice };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, method, value, roundTo, manualPrices]);

  const packageCoveredCount = items.filter((i) => i.coveredByPackages).length;

  const submit = async () => {
    setError(null);
    try {
      await bulkRevise.mutateAsync({
        itemIds: items.map((i) => i.id),
        method,
        value: method === "manual" ? undefined : Number(value),
        roundTo,
        effectiveFrom,
        manualPrices:
          method === "manual"
            ? Object.fromEntries(items.map((i) => [i.id, Number(manualPrices[i.id] ?? i.currentPrice)]))
            : undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to queue price revision");
    }
  };

  return (
    <DialogShell
      icon={<Percent size={16} />}
      iconTone="bg-brand-violet-soft text-brand-violet"
      title={`Revise prices — ${items.length} item${items.length === 1 ? "" : "s"}`}
      subtitle="Creates a new version of each price. Nothing already billed changes."
      onClose={onClose}
      wide
      footer={
        <>
          <span className="text-xs text-ink-500 mr-auto">Recorded in the audit trail against your name</span>
          <button type="button" onClick={onClose} className={secondaryBtn}>
            Cancel
          </button>
          <button
            type="button"
            disabled={bulkRevise.isPending}
            onClick={submit}
            className={`${primaryBtn} bg-brand-violet hover:bg-brand-violet-hover flex items-center gap-1.5`}
          >
            {bulkRevise.isPending && <Loader2 size={14} className="animate-spin" />}
            Queue for {new Date(`${effectiveFrom}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
          </button>
        </>
      }
    >
      <div className="px-5 py-4 overflow-y-auto space-y-4">
        {error && <div className="text-sm text-status-danger">{error}</div>}

        <div>
          <label className="block text-sm font-semibold text-ink-900 mb-1.5">How</label>
          <div className="grid grid-cols-3 gap-2">
            {METHODS.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setMethod(m.value)}
                className={`text-left border rounded-lg p-2.5 ${
                  method === m.value ? "border-brand-violet bg-brand-violet-soft" : "border-border bg-surface-paper hover:border-brand-violet/50"
                }`}
              >
                <span className={`text-[12.5px] font-semibold block ${method === m.value ? "text-brand-violet" : "text-ink-900"}`}>
                  {m.label}
                </span>
                <span className="text-[11px] text-ink-500 block mt-0.5 leading-snug">{m.description}</span>
              </button>
            ))}
          </div>
        </div>

        {method !== "manual" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-ink-900 mb-1.5">
                {method === "percent" ? "Increase by" : "Add"}
              </label>
              <div className="flex">
                <span className="grid place-items-center px-3 border border-r-0 border-border rounded-l-lg bg-surface-canvas text-sm font-mono text-ink-700">
                  {method === "percent" ? "%" : "₹"}
                </span>
                <input
                  type="number"
                  className="w-full px-3.5 py-2.5 rounded-r-lg border border-border bg-surface-paper text-sm font-mono"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-ink-900 mb-1.5">Round to</label>
              <select
                className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface-paper text-sm"
                value={roundTo}
                onChange={(e) => setRoundTo(e.target.value as any)}
              >
                <option value="10">Nearest ₹10</option>
                <option value="5">Nearest ₹5</option>
                <option value="none">No rounding</option>
              </select>
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold text-ink-900 mb-1.5">Effective from</label>
          <input
            type="date"
            className="w-56 px-3.5 py-2.5 rounded-lg border border-border bg-surface-paper text-sm"
            value={effectiveFrom}
            min={todayIso()}
            onChange={(e) => setEffectiveFrom(e.target.value)}
          />
          <p className="text-xs text-ink-500 mt-1.5">Front desk keeps billing today&apos;s prices until this date.</p>
        </div>

        <div className="border border-border rounded-lg overflow-hidden">
          <div className="flex bg-surface-canvas/60 px-3 py-1.5 text-[10.5px] uppercase tracking-wide text-ink-500 font-semibold border-b border-border">
            <span>What changes</span>
            <span className="flex-1" />
            <span>Old → new</span>
          </div>
          {preview.map(({ item, newPrice }) => (
            <div
              key={item.id}
              className="grid grid-cols-[1fr_84px_20px_84px] gap-2.5 items-center px-3 py-2 border-t border-border first:border-t-0 text-[12.5px]"
            >
              <span className="text-ink-900">{item.name}</span>
              {method === "manual" ? (
                <input
                  type="number"
                  className="w-full px-2 py-1 rounded-md border border-border text-right font-mono text-xs"
                  value={manualPrices[item.id] ?? item.currentPrice}
                  onChange={(e) => setManualPrices((prev) => ({ ...prev, [item.id]: e.target.value }))}
                />
              ) : (
                <span className="font-mono text-ink-500 line-through text-right">₹{item.currentPrice}</span>
              )}
              <span className="text-ink-500 text-center">→</span>
              <span className="font-mono text-status-open font-medium text-right">₹{newPrice}</span>
            </div>
          ))}
        </div>

        {packageCoveredCount > 0 && (
          <div className="flex gap-2.5 bg-status-warning-soft border border-status-warning/30 rounded-lg p-3 text-[11.5px] text-status-warning leading-relaxed">
            <AlertTriangle size={16} className="flex-none mt-0.5" />
            <span>
              <b>{packageCoveredCount} of these items are marked as covered by prepaid packages.</b> Check package
              pricing separately — revising a catalog price here doesn&apos;t change what an existing package is worth.
            </span>
          </div>
        )}
      </div>
    </DialogShell>
  );
}
