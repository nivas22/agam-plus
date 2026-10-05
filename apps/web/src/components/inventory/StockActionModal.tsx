// components/inventory/StockActionModal.tsx
"use client";

import { Loader2, X } from "lucide-react";
import { useState } from "react";
import { Field, inputClass } from "@/components/common/EditFormControls";
import {
  useAdjustBatch,
  useIssueStock,
  useReceiveStock,
} from "@/hooks/useInventoryApi";
import type {
  InventoryBatch,
  InventoryItem,
  InventoryMutationResult,
} from "@/types/inventory";
import {
  errorMessage,
  formatDay,
  formatQty,
  todayIso,
} from "./inventoryFormat";

export type StockAction =
  | { kind: "receive"; item: InventoryItem }
  | { kind: "issue"; item: InventoryItem; batches?: InventoryBatch[] }
  | { kind: "adjust"; item: InventoryItem; batch: InventoryBatch };

interface StockActionModalProps {
  hospitalId: string;
  action: StockAction;
  onClose: () => void;
  onDone: (result: InventoryMutationResult) => void;
}

type AdjustMode = "adjusted" | "expired" | "damaged" | "returned";

const ADJUST_MODES: { value: AdjustMode; label: string; hint: string }[] = [
  {
    value: "adjusted",
    label: "Correct the count",
    hint: "Set this batch to what's actually on the shelf.",
  },
  {
    value: "expired",
    label: "Expired",
    hint: "Remove expired stock so it can't be issued.",
  },
  {
    value: "damaged",
    label: "Damaged / lost",
    hint: "Broken, spoiled, or missing.",
  },
  {
    value: "returned",
    label: "Returned to supplier",
    hint: "Sent back against a credit note.",
  },
];

const TITLES = {
  receive: "Receive stock",
  issue: "Issue stock",
  adjust: "Adjust batch",
};

export default function StockActionModal({
  hospitalId,
  action,
  onClose,
  onDone,
}: StockActionModalProps) {
  const { item } = action;
  const receive = useReceiveStock(hospitalId);
  const issue = useIssueStock(hospitalId);
  const adjust = useAdjustBatch(hospitalId);
  const saving = receive.isPending || issue.isPending || adjust.isPending;

  const [quantity, setQuantity] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [supplier, setSupplier] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [issuedTo, setIssuedTo] = useState("");
  const [batchId, setBatchId] = useState("");
  const [note, setNote] = useState("");
  const [adjustMode, setAdjustMode] = useState<AdjustMode>(
    action.kind === "adjust" && action.batch.expiryStatus === "expired"
      ? "expired"
      : "adjusted",
  );
  const [error, setError] = useState<string | null>(null);

  // Expired batches can't be issued from — the API refuses them too.
  const issuableBatches =
    action.kind === "issue"
      ? (action.batches || []).filter((b) => b.expiryStatus !== "expired")
      : [];

  const submit = async () => {
    setError(null);
    const qty = Number(quantity);
    try {
      let result: InventoryMutationResult;
      if (action.kind === "receive") {
        if (!(qty > 0)) return setError("Enter how many you received");
        if (item.tracksExpiry && (!batchNumber.trim() || !expiryDate)) {
          return setError(
            "Batch number and expiry date are required for this item",
          );
        }
        result = await receive.mutateAsync({
          itemId: item.id,
          data: {
            quantity: qty,
            batchNumber: item.tracksExpiry ? batchNumber.trim() : undefined,
            expiryDate: item.tracksExpiry ? expiryDate : undefined,
            unitCost: unitCost === "" ? undefined : Number(unitCost),
            supplier: supplier.trim() || undefined,
            invoiceNumber: invoiceNumber.trim() || undefined,
            note: note.trim() || undefined,
          },
        });
      } else if (action.kind === "issue") {
        if (!(qty > 0)) return setError("Enter how many to issue");
        result = await issue.mutateAsync({
          itemId: item.id,
          data: {
            quantity: qty,
            batchId: batchId || undefined,
            issuedTo: issuedTo.trim() || undefined,
            note: note.trim() || undefined,
          },
        });
      } else {
        if (adjustMode === "adjusted") {
          if (quantity === "" || !(qty >= 0))
            return setError("Enter the counted quantity");
          if (!note.trim()) return setError("Say why the count is different");
          result = await adjust.mutateAsync({
            itemId: item.id,
            batchId: action.batch.id,
            data: {
              type: "adjusted",
              countedQuantity: qty,
              reason: note.trim(),
            },
          });
        } else {
          if (!(qty > 0)) return setError("Enter how many to write off");
          result = await adjust.mutateAsync({
            itemId: item.id,
            batchId: action.batch.id,
            data: {
              type: adjustMode,
              quantity: qty,
              reason: note.trim() || undefined,
            },
          });
        }
      }
      onDone(result);
    } catch (err) {
      setError(errorMessage(err, "Couldn't save — try again"));
    }
  };

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center p-4">
      <div className="absolute inset-0 bg-ink-900/35" onClick={onClose} />
      <div className="relative w-full max-w-[460px] max-h-[90vh] overflow-y-auto bg-surface-paper rounded-xl shadow-2xl">
        <div className="px-5 pt-4 pb-3 border-b border-border flex items-start justify-between">
          <div>
            <h2 className="text-base font-bold text-ink-900 font-display tracking-tight">
              {TITLES[action.kind]}
            </h2>
            <p className="text-xs text-ink-500 mt-0.5">
              {item.name} · {formatQty(item.onHand, item.unit)} on hand
              {action.kind === "adjust" && (
                <>
                  {" "}
                  · batch {action.batch.batchNumber || "—"} has{" "}
                  {formatQty(action.batch.quantity, item.unit)}
                </>
              )}
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

        <div className="px-5 py-4 space-y-3.5">
          {error && <div className="text-sm text-status-danger">{error}</div>}

          {action.kind === "adjust" && (
            <div className="grid grid-cols-2 gap-2">
              {ADJUST_MODES.map((mode) => (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => setAdjustMode(mode.value)}
                  className={`text-left rounded-lg border p-2.5 ${
                    adjustMode === mode.value
                      ? "border-brand-violet bg-brand-violet-soft"
                      : "border-border"
                  }`}
                >
                  <span className="block text-[13px] font-semibold text-ink-900">
                    {mode.label}
                  </span>
                  <span className="block text-[11px] text-ink-500 leading-snug mt-0.5">
                    {mode.hint}
                  </span>
                </button>
              ))}
            </div>
          )}

          <Field
            label={
              action.kind === "adjust" && adjustMode === "adjusted"
                ? "Counted quantity"
                : action.kind === "adjust"
                  ? "Quantity to write off"
                  : "Quantity"
            }
            required
          >
            <div className="flex">
              <input
                type="number"
                min={0}
                step="any"
                autoFocus
                className={`${inputClass} rounded-r-none font-mono`}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
              <span className="grid place-items-center px-3 border border-l-0 border-border rounded-r-lg bg-surface-canvas text-sm text-ink-700 whitespace-nowrap">
                {item.unit}
              </span>
            </div>
          </Field>

          {action.kind === "receive" && (
            <>
              {item.tracksExpiry && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Batch number" required>
                    <input
                      className={`${inputClass} font-mono`}
                      value={batchNumber}
                      onChange={(e) => setBatchNumber(e.target.value)}
                    />
                  </Field>
                  <Field label="Expiry date" required>
                    <input
                      type="date"
                      className={inputClass}
                      min={todayIso()}
                      value={expiryDate}
                      onChange={(e) => setExpiryDate(e.target.value)}
                    />
                  </Field>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Cost per unit" optional>
                  <div className="flex">
                    <span className="grid place-items-center px-3 border border-r-0 border-border rounded-l-lg bg-surface-canvas text-sm font-mono text-ink-700">
                      ₹
                    </span>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      className={`${inputClass} rounded-l-none font-mono`}
                      value={unitCost}
                      onChange={(e) => setUnitCost(e.target.value)}
                    />
                  </div>
                </Field>
                <Field label="Supplier invoice no." optional>
                  <input
                    className={inputClass}
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                  />
                </Field>
              </div>
              <Field label="Supplier" optional>
                <input
                  className={inputClass}
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                />
              </Field>
            </>
          )}

          {action.kind === "issue" && (
            <>
              <Field
                label="Issued to"
                optional
                hint="A ward, room or person — e.g. OT, Ward 2, Dr. Priya."
              >
                <input
                  className={inputClass}
                  value={issuedTo}
                  onChange={(e) => setIssuedTo(e.target.value)}
                />
              </Field>
              {issuableBatches.length > 1 && (
                <Field
                  label="From batch"
                  hint="Leave on automatic to use the batch that expires first."
                >
                  <select
                    className={inputClass}
                    value={batchId}
                    onChange={(e) => setBatchId(e.target.value)}
                  >
                    <option value="">Automatic — first to expire</option>
                    {issuableBatches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.batchNumber || "No batch"} ·{" "}
                        {formatQty(b.quantity, item.unit)}
                        {b.expiryDate
                          ? ` · exp ${formatDay(b.expiryDate)}`
                          : ""}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
            </>
          )}

          <Field
            label={
              action.kind === "adjust" && adjustMode === "adjusted"
                ? "Reason"
                : "Note"
            }
            required={action.kind === "adjust" && adjustMode === "adjusted"}
            optional={!(action.kind === "adjust" && adjustMode === "adjusted")}
          >
            <input
              className={inputClass}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
        </div>

        <div className="px-5 py-3.5 border-t border-border flex justify-end gap-2.5">
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
            {action.kind === "receive"
              ? "Receive"
              : action.kind === "issue"
                ? "Issue"
                : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
