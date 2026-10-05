// components/inventory/InventoryPage.tsx
"use client";

import { CheckCircle2, Plus, Search, X } from "lucide-react";
import { useState } from "react";
import {
  type InventoryListFilters,
  useExpiringBatches,
  useInventoryItems,
  useInventoryMovements,
  useInventorySummary,
} from "@/hooks/useInventoryApi";
import {
  INVENTORY_CATEGORY_OPTIONS,
  INVENTORY_MOVEMENT_LABELS,
  type InventoryItem,
  type InventoryMovementType,
  type InventoryMutationResult,
} from "@/types/inventory";
import InventoryItemDrawer from "./InventoryItemDrawer";
import StockActionModal, { type StockAction } from "./StockActionModal";
import {
  EXPIRY_BADGE,
  STOCK_BADGE,
  formatDateTime,
  formatDay,
  formatMoney,
  formatQty,
} from "./inventoryFormat";

interface InventoryPageProps {
  hospitalId: string;
}

type Tab = "stock" | "expiring" | "movements";
type StockFilter = NonNullable<InventoryListFilters["stock"]> | "";

const TABS: { key: Tab; label: string }[] = [
  { key: "stock", label: "Stock" },
  { key: "expiring", label: "Expiring" },
  { key: "movements", label: "History" },
];

const th =
  "text-left text-[10.5px] uppercase tracking-wide text-ink-500 font-semibold px-3 py-2.5 whitespace-nowrap";

export default function InventoryPage({ hospitalId }: InventoryPageProps) {
  const [tab, setTab] = useState<Tab>("stock");
  const [drawerItemId, setDrawerItemId] = useState<string | null | undefined>(
    undefined,
  );
  const [stockAction, setStockAction] = useState<StockAction | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const { data: summary } = useInventorySummary(hospitalId);

  const handleResult = (result: InventoryMutationResult) => {
    if (result.requiresApproval)
      setNotice(
        "Sent to an admin for approval — it'll apply once they approve it.",
      );
  };

  const cards: {
    label: string;
    value: string | number;
    tone?: string;
    onClick?: () => void;
  }[] = [
    { label: "Items", value: summary?.activeItems ?? "—" },
    {
      label: "Low stock",
      value: summary?.lowStock ?? "—",
      tone: summary?.lowStock ? "text-status-warning" : undefined,
    },
    {
      label: "Out of stock",
      value: summary?.outOfStock ?? "—",
      tone: summary?.outOfStock ? "text-status-danger" : undefined,
    },
    {
      label: `Expiring ≤ ${summary?.expiryWarningDays ?? 30} days`,
      value: summary?.expiringBatches ?? "—",
      tone: summary?.expiringBatches ? "text-status-warning" : undefined,
      onClick: () => setTab("expiring"),
    },
    {
      label: "Expired batches",
      value: summary?.expiredBatches ?? "—",
      tone: summary?.expiredBatches ? "text-status-danger" : undefined,
      onClick: () => setTab("expiring"),
    },
    {
      label: "Stock value",
      value: summary ? formatMoney(summary.stockValue) : "—",
    },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3.5 mb-4">
        <div>
          <h1 className="text-xl font-bold text-ink-900 font-display tracking-tight">
            Inventory
          </h1>
          <p className="text-sm text-ink-500 mt-0.5">
            What&apos;s in stock, what&apos;s running low, and what&apos;s about
            to expire.
          </p>
        </div>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setDrawerItemId(null)}
          className="flex items-center gap-1.5 bg-brand-violet hover:bg-brand-violet-hover text-white text-sm font-semibold rounded-lg px-4 py-2.5 transition-colors"
        >
          <Plus size={16} />
          Add item
        </button>
      </div>

      {notice && (
        <div className="mb-4 flex items-center gap-2 bg-status-open-soft border border-status-open/20 text-status-open rounded-lg px-3 py-2 text-sm">
          <CheckCircle2 size={16} className="flex-none" />
          <span className="flex-1">{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
        {cards.map((card) => (
          <button
            key={card.label}
            type="button"
            disabled={!card.onClick}
            onClick={card.onClick}
            className="text-left bg-surface-paper border border-border rounded-xl px-4 py-3 disabled:cursor-default enabled:hover:border-brand-violet"
          >
            <div className="text-[11px] uppercase tracking-wide text-ink-500 font-semibold">
              {card.label}
            </div>
            <div
              className={`text-xl font-bold font-mono tabular mt-1 ${card.tone || "text-ink-900"}`}
            >
              {card.value}
            </div>
          </button>
        ))}
      </div>

      <div className="flex gap-1 border-b border-border mb-4">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${
              tab === t.key
                ? "border-brand-violet text-brand-violet"
                : "border-transparent text-ink-500 hover:text-ink-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "stock" && (
        <StockTab
          hospitalId={hospitalId}
          onOpenItem={setDrawerItemId}
          onStockAction={setStockAction}
        />
      )}
      {tab === "expiring" && (
        <ExpiringTab hospitalId={hospitalId} onOpenItem={setDrawerItemId} />
      )}
      {tab === "movements" && (
        <MovementsTab hospitalId={hospitalId} onOpenItem={setDrawerItemId} />
      )}

      {drawerItemId !== undefined && (
        <InventoryItemDrawer
          hospitalId={hospitalId}
          itemId={drawerItemId ?? undefined}
          onClose={() => setDrawerItemId(undefined)}
          onStockAction={setStockAction}
          onResult={handleResult}
        />
      )}

      {stockAction && (
        <StockActionModal
          hospitalId={hospitalId}
          action={stockAction}
          onClose={() => setStockAction(null)}
          onDone={(result) => {
            setStockAction(null);
            handleResult(result);
          }}
        />
      )}
    </div>
  );
}

/* ---------------------------------- Stock --------------------------------- */

function StockTab({
  hospitalId,
  onOpenItem,
  onStockAction,
}: {
  hospitalId: string;
  onOpenItem: (id: string) => void;
  onStockAction: (action: StockAction) => void;
}) {
  const [activeCategory, setActiveCategory] = useState("all");
  const [stockFilter, setStockFilter] = useState<StockFilter>("");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useInventoryItems(hospitalId, {
    category:
      activeCategory !== "all" && activeCategory !== "archived"
        ? activeCategory
        : undefined,
    status: activeCategory === "archived" ? "archived" : undefined,
    stock: stockFilter || undefined,
    search: search || undefined,
  });
  const items = data?.items || [];
  const counts = data?.counts || {};

  const categoryTabs = [
    { key: "all", label: "All items", count: counts.all ?? 0 },
    ...INVENTORY_CATEGORY_OPTIONS.map((opt) => ({
      key: opt.value,
      label: opt.label,
      count: counts[opt.value] ?? 0,
    })),
    { key: "archived", label: "Archived", count: counts.archived ?? 0 },
  ];

  const stockFilters: { key: StockFilter; label: string }[] = [
    { key: "", label: "All" },
    { key: "low", label: "Needs reorder" },
    { key: "out", label: "Out of stock" },
    { key: "expiring", label: "Expiring / expired" },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4 items-start">
      <div className="bg-surface-paper border border-border rounded-xl overflow-hidden">
        {categoryTabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveCategory(t.key)}
            className={`flex items-center w-full text-left px-3.5 py-2.5 text-sm border-t border-border first:border-t-0 ${
              activeCategory === t.key
                ? "bg-brand-violet-soft text-brand-violet font-semibold"
                : "text-ink-700"
            }`}
          >
            {t.label}
            <span
              className={`ml-auto font-mono text-[11.5px] ${activeCategory === t.key ? "text-brand-violet" : "text-ink-500"}`}
            >
              {t.count}
            </span>
          </button>
        ))}
      </div>

      <div className="bg-surface-paper border border-border rounded-xl overflow-hidden min-w-0">
        <div className="flex items-center gap-2 p-3 border-b border-border flex-wrap">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500"
            />
            <input
              type="text"
              placeholder="Search by name or code"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-2 rounded-lg border border-border bg-surface-paper text-sm w-56"
            />
          </div>
          {stockFilters.map((f) => (
            <button
              key={f.key || "all"}
              type="button"
              onClick={() => setStockFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${
                stockFilter === f.key
                  ? "bg-brand-violet border-brand-violet text-white"
                  : "border-border text-ink-700 hover:border-brand-violet"
              }`}
            >
              {f.label}
            </button>
          ))}
          <div className="flex-1" />
          <span className="text-xs text-ink-500">
            {isLoading
              ? "Loading…"
              : `${items.length} item${items.length === 1 ? "" : "s"}`}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-canvas/60 border-b border-border">
                {[
                  "Item",
                  "Category",
                  "On hand",
                  "Reorder at",
                  "Next expiry",
                  "Value",
                  "Status",
                  "",
                ].map((h, i) => (
                  <th key={i} className={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!isLoading && items.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-ink-500"
                  >
                    {search || stockFilter || activeCategory !== "all"
                      ? "Nothing matches these filters."
                      : "No inventory items yet — add the first thing you stock."}
                  </td>
                </tr>
              )}
              {items.map((item: InventoryItem) => {
                const archived = item.status === "archived";
                return (
                  <tr
                    key={item.id}
                    className={`border-b border-border last:border-0 hover:bg-surface-canvas/40 ${archived ? "text-ink-500" : ""}`}
                  >
                    <td className="px-3 py-2.5">
                      <button
                        type="button"
                        className="text-left"
                        onClick={() => onOpenItem(item.id)}
                      >
                        <span className="block font-medium text-ink-900 hover:text-brand-violet">
                          {item.name}
                        </span>
                        <span className="block text-[10.5px] text-ink-500 font-mono">
                          {item.code}
                          {item.location ? ` · ${item.location}` : ""}
                        </span>
                      </button>
                    </td>
                    <td className="px-3 py-2.5 text-ink-700 whitespace-nowrap">
                      {INVENTORY_CATEGORY_OPTIONS.find(
                        (o) => o.value === item.category,
                      )?.label || item.category}
                    </td>
                    <td className="px-3 py-2.5 font-mono whitespace-nowrap text-ink-900">
                      {formatQty(item.onHand, item.unit)}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-ink-700">
                      {item.reorderLevel || "—"}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap font-mono text-xs">
                      {formatDay(item.nearestExpiry)}
                      {item.expiryStatus && (
                        <span
                          className={`block w-fit mt-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-sans font-semibold ${EXPIRY_BADGE[item.expiryStatus].className}`}
                        >
                          {EXPIRY_BADGE[item.expiryStatus].label}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-right">
                      {formatMoney(item.stockValue)}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-block rounded-md px-2 py-0.5 text-[10.5px] font-semibold whitespace-nowrap ${
                          archived
                            ? "bg-surface-canvas text-ink-500"
                            : STOCK_BADGE[item.stockStatus].className
                        }`}
                      >
                        {archived
                          ? "Archived"
                          : STOCK_BADGE[item.stockStatus].label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      {!archived && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              onStockAction({ kind: "receive", item })
                            }
                            className="px-2.5 py-1.5 rounded-lg border border-border text-xs font-semibold text-ink-700 mr-1.5"
                          >
                            Receive
                          </button>
                          <button
                            type="button"
                            disabled={item.onHand <= 0}
                            onClick={() =>
                              onStockAction({ kind: "issue", item })
                            }
                            className="px-2.5 py-1.5 rounded-lg border border-border text-xs font-semibold text-ink-700 disabled:opacity-50"
                          >
                            Issue
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------- Expiring -------------------------------- */

const EXPIRY_WINDOWS = [30, 60, 90];

function ExpiringTab({
  hospitalId,
  onOpenItem,
}: {
  hospitalId: string;
  onOpenItem: (id: string) => void;
}) {
  const [withinDays, setWithinDays] = useState(30);
  const { data, isLoading } = useExpiringBatches(hospitalId, withinDays);
  const batches = data?.batches || [];

  return (
    <div className="bg-surface-paper border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 p-3 border-b border-border flex-wrap">
        <span className="text-sm text-ink-700">Expiring within</span>
        {EXPIRY_WINDOWS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setWithinDays(d)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${
              withinDays === d
                ? "bg-brand-violet border-brand-violet text-white"
                : "border-border text-ink-700"
            }`}
          >
            {d} days
          </button>
        ))}
        <div className="flex-1" />
        <span className="text-xs text-ink-500">
          Open an item and use Adjust to write a batch off.
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-canvas/60 border-b border-border">
              {["Item", "Batch", "Expiry", "Left", "Value", ""].map((h, i) => (
                <th key={i} className={th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!isLoading && batches.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-ink-500">
                  Nothing expires in the next {withinDays} days.
                </td>
              </tr>
            )}
            {batches.map((b) => (
              <tr
                key={b.id}
                className="border-b border-border last:border-0 hover:bg-surface-canvas/40"
              >
                <td className="px-3 py-2.5">
                  <button
                    type="button"
                    className="text-left"
                    onClick={() => onOpenItem(b.itemId)}
                  >
                    <span className="block font-medium text-ink-900 hover:text-brand-violet">
                      {b.itemName}
                    </span>
                    <span className="block text-[10.5px] text-ink-500 font-mono">
                      {b.itemCode}
                    </span>
                  </button>
                </td>
                <td className="px-3 py-2.5 font-mono">
                  {b.batchNumber || "—"}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <span className="font-mono text-xs">
                    {formatDay(b.expiryDate)}
                  </span>
                  {b.expiryStatus && (
                    <span
                      className={`ml-2 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${EXPIRY_BADGE[b.expiryStatus].className}`}
                    >
                      {EXPIRY_BADGE[b.expiryStatus].label}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 font-mono whitespace-nowrap">
                  {formatQty(b.quantity, b.unit)}
                </td>
                <td className="px-3 py-2.5 font-mono">
                  {b.unitCost !== undefined
                    ? formatMoney(b.unitCost * b.quantity)
                    : "—"}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => onOpenItem(b.itemId)}
                    className="px-2.5 py-1.5 rounded-lg border border-border text-xs font-semibold text-ink-700"
                  >
                    Open
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* -------------------------------- Movements ------------------------------- */

function MovementsTab({
  hospitalId,
  onOpenItem,
}: {
  hospitalId: string;
  onOpenItem: (id: string) => void;
}) {
  const [type, setType] = useState("");
  const { data: movements = [], isLoading } = useInventoryMovements(
    hospitalId,
    { type: type || undefined },
  );

  return (
    <div className="bg-surface-paper border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 p-3 border-b border-border flex-wrap">
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="px-3 py-2 border border-border rounded-lg text-sm bg-surface-paper"
        >
          <option value="">All movements</option>
          {Object.entries(INVENTORY_MOVEMENT_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <div className="flex-1" />
        <span className="text-xs text-ink-500">
          Latest 200 · every change is kept
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-canvas/60 border-b border-border">
              {["When", "Item", "What", "Qty", "Batch", "By", "Details"].map(
                (h) => (
                  <th key={h} className={th}>
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {!isLoading && movements.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-ink-500">
                  No stock movements yet.
                </td>
              </tr>
            )}
            {movements.map((m) => (
              <tr
                key={m.id}
                className="border-b border-border last:border-0 hover:bg-surface-canvas/40"
              >
                <td className="px-3 py-2.5 whitespace-nowrap font-mono text-xs">
                  {formatDateTime(m.at)}
                </td>
                <td className="px-3 py-2.5">
                  <button
                    type="button"
                    className="text-left font-medium text-ink-900 hover:text-brand-violet"
                    onClick={() => onOpenItem(m.itemId)}
                  >
                    {m.itemName}
                  </button>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-ink-700">
                  {INVENTORY_MOVEMENT_LABELS[m.type as InventoryMovementType] ||
                    m.type}
                </td>
                <td
                  className={`px-3 py-2.5 whitespace-nowrap font-mono ${m.quantity > 0 ? "text-status-open" : "text-status-danger"}`}
                >
                  {m.quantity > 0 ? "+" : "−"}
                  {formatQty(Math.abs(m.quantity), m.unit)}
                </td>
                <td className="px-3 py-2.5 font-mono text-xs">
                  {m.batchNumber || "—"}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-ink-700">
                  {m.actorName || "—"}
                </td>
                <td className="px-3 py-2.5 text-ink-500 text-xs">
                  {[m.issuedTo && `To ${m.issuedTo}`, m.reason]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
