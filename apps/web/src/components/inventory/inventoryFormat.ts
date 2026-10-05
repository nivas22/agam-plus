import { ApiRequestError } from "@/lib/api";
import type {
  InventoryExpiryStatus,
  InventoryStockStatus,
} from "@/types/inventory";

// Local calendar day — toISOString() would give yesterday before 5:30am IST.
export function todayIso() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatQty(n: number, unit?: string) {
  const value = Number.isInteger(n)
    ? n.toLocaleString("en-IN")
    : n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  return unit ? `${value} ${unit}` : value;
}

export function formatMoney(v: number) {
  return `₹${Math.round(v).toLocaleString("en-IN")}`;
}

// YYYY-MM-DD dates are calendar days, not instants — parse as local midnight.
export function formatDay(iso?: string | null) {
  if (!iso) return "—";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Prefers the first field-level validation message over the generic
// "Validation failed".
export function errorMessage(err: unknown, fallback: string) {
  if (
    err instanceof ApiRequestError &&
    Array.isArray(err.details) &&
    err.details[0]?.message
  ) {
    return err.details[0].message as string;
  }
  return err instanceof Error ? err.message : fallback;
}

export const STOCK_BADGE: Record<
  InventoryStockStatus,
  { label: string; className: string }
> = {
  ok: { label: "In stock", className: "bg-status-open-soft text-status-open" },
  low: {
    label: "Low stock",
    className: "bg-status-warning-soft text-status-warning",
  },
  out: {
    label: "Out of stock",
    className: "bg-status-danger-soft text-status-danger",
  },
};

export const EXPIRY_BADGE: Record<
  Exclude<InventoryExpiryStatus, null>,
  { label: string; className: string }
> = {
  expiring: {
    label: "Expiring soon",
    className: "bg-status-warning-soft text-status-warning",
  },
  expired: {
    label: "Expired",
    className: "bg-status-danger-soft text-status-danger",
  },
};
