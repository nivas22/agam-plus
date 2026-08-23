// components/settings/ChargeCatalogPage.tsx
"use client";

import { AlertTriangle, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useChargeCatalogItems } from "@/hooks/useChargeCatalogApi";
import { CHARGE_CATALOG_CATEGORY_OPTIONS } from "@/types/chargeCatalog";
import type { ChargeCatalogItem } from "@/types/chargeCatalog";
import ChargeCatalogItemDrawer from "./ChargeCatalogItemDrawer";
import BulkRevisePricesModal from "./BulkRevisePricesModal";

interface ChargeCatalogPageProps {
  hospitalId: string;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Today";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function ChargeCatalogPage({ hospitalId }: ChargeCatalogPageProps) {
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawerItemId, setDrawerItemId] = useState<string | null | undefined>(undefined);
  const [showBulkModal, setShowBulkModal] = useState<"selected" | "all" | null>(null);

  const status = activeCategory === "archived" ? "archived" : undefined;
  const category = activeCategory !== "all" && activeCategory !== "archived" ? activeCategory : undefined;

  const { data, isLoading } = useChargeCatalogItems(hospitalId, { category, status, search: search || undefined });
  const items = useMemo(
    () => (data?.items || []).filter((item) => (activeCategory === "archived" ? true : item.status !== "archived")),
    [data, activeCategory],
  );
  const counts = data?.counts || {};

  const scheduledCount = (data?.items || []).filter((i) => i.scheduledPrice != null).length;

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedItems = items.filter((i) => selected.has(i.id));

  const categoryTabs = [
    { key: "all", label: "All items", count: counts.all ?? 0 },
    ...CHARGE_CATALOG_CATEGORY_OPTIONS.map((opt) => ({
      key: opt.value,
      label: opt.label,
      count: counts[opt.value] ?? 0,
    })),
    { key: "archived", label: "Archived", count: counts.archived ?? 0 },
  ];

  return (
    <div>
      <div className="flex items-end gap-3.5 mb-4">
        <div>
          <h1 className="text-xl font-bold text-ink-900">Charge catalog</h1>
          <p className="text-sm text-ink-500 mt-0.5">
            Everything the front desk can add to a bill, and what it costs today.
          </p>
        </div>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setShowBulkModal("all")}
          disabled={items.length === 0}
          className="px-4 py-2.5 rounded-lg border border-border text-sm font-semibold text-ink-700 disabled:opacity-50"
        >
          Revise prices
        </button>
        <button
          type="button"
          onClick={() => setDrawerItemId(null)}
          className="flex items-center gap-1.5 bg-brand-violet hover:bg-brand-violet-hover text-white text-sm font-semibold rounded-lg px-4 py-2.5 transition-colors"
        >
          <Plus size={16} />
          Add item
        </button>
      </div>

      <div className="grid grid-cols-[220px_1fr] gap-4 items-start">
        <div>
          <div className="bg-surface-paper border border-border rounded-xl overflow-hidden">
            {categoryTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveCategory(tab.key)}
                className={`flex items-center w-full text-left px-3.5 py-2.5 text-sm border-t border-border first:border-t-0 ${
                  activeCategory === tab.key ? "bg-brand-violet-soft text-brand-violet font-semibold" : "text-ink-700"
                }`}
              >
                {tab.label}
                <span className={`ml-auto font-mono text-[11.5px] ${activeCategory === tab.key ? "text-brand-violet" : "text-ink-500"}`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          <div className="bg-surface-paper border border-border border-l-2 border-l-brand-violet rounded-lg p-3 mt-3.5 text-xs text-ink-700 leading-relaxed">
            <b className="text-ink-900">Consultation fees aren&apos;t here.</b> They live on each doctor&apos;s
            profile, because they differ per doctor.{" "}
            <Link href={`/hospital/${hospitalId}/doctors`} className="text-brand-violet font-medium">
              Open Doctors →
            </Link>
          </div>

          {scheduledCount > 0 && (
            <div className="bg-surface-paper border border-border border-l-2 border-l-status-warning rounded-lg p-3 mt-3.5 text-xs text-ink-700 leading-relaxed">
              <b className="text-ink-900">
                {scheduledCount} item{scheduledCount === 1 ? "" : "s"} scheduled to change
              </b>
              . Current prices apply until then.
            </div>
          )}
        </div>

        <div className="bg-surface-paper border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 p-3 border-b border-border flex-wrap">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
              <input
                type="text"
                placeholder="Search by name or code"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-3 py-2 rounded-lg border border-border bg-surface-paper text-sm w-60"
              />
            </div>
            {selected.size > 0 && (
              <>
                <span className="bg-brand-violet-soft text-brand-violet rounded-lg px-3 py-1.5 text-xs font-semibold">
                  {selected.size} selected
                </span>
                <button
                  type="button"
                  onClick={() => setShowBulkModal("selected")}
                  className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-ink-700"
                >
                  Revise price
                </button>
              </>
            )}
            <div className="flex-1" />
            <span className="text-xs text-ink-500">
              {isLoading ? "Loading…" : `Showing ${items.length} of ${counts.all ?? items.length}`}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-canvas/60 border-b border-border">
                  {["", "Item", "Category", "Price", "GST", "Packages", "Used · month", "Last changed", "Status", ""].map(
                    (h, i) => (
                      <th
                        key={i}
                        className="text-left text-[10.5px] uppercase tracking-wide text-ink-500 font-semibold px-3 py-2.5 whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {!isLoading && items.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-ink-500">
                      No items in this category yet.
                    </td>
                  </tr>
                )}
                {items.map((item: ChargeCatalogItem) => (
                  <tr
                    key={item.id}
                    className={`border-b border-border last:border-0 hover:bg-surface-canvas/40 ${
                      item.status === "archived" ? "bg-surface-canvas/30 text-ink-500" : ""
                    }`}
                  >
                    <td className="px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={selected.has(item.id)}
                        onChange={() => toggleSelected(item.id)}
                        className="w-4 h-4 rounded border-border text-brand-violet"
                      />
                    </td>
                    <td className="px-3 py-2.5 cursor-pointer" onClick={() => setDrawerItemId(item.id)}>
                      <span className="block font-medium text-ink-900">{item.name}</span>
                      <span className="block text-[10.5px] text-ink-500 font-mono">{item.code}</span>
                    </td>
                    <td className="px-3 py-2.5 text-ink-700 whitespace-nowrap">
                      {CHARGE_CATALOG_CATEGORY_OPTIONS.find((o) => o.value === item.category)?.label || item.category}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono">
                      ₹{item.currentPrice}
                      {item.scheduledPrice != null && (
                        <span className="block text-[10.5px] text-status-warning font-mono">
                          ₹{item.scheduledPrice} from {formatDate(item.scheduledEffectiveFrom!)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-ink-700 whitespace-nowrap">
                      {item.currentGstPercent ? `${item.currentGstPercent}%` : "Nil"}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-block rounded-md px-2 py-0.5 text-[10.5px] font-semibold ${
                          item.coveredByPackages ? "bg-brand-violet-soft text-brand-violet" : "bg-surface-canvas text-ink-500"
                        }`}
                      >
                        {item.coveredByPackages ? "Covered" : "Not covered"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono">{item.usageThisMonth}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap font-mono text-xs">{formatDate(item.lastChangedAt)}</td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-block rounded-md px-2 py-0.5 text-[10.5px] font-semibold ${
                          item.status === "archived"
                            ? "bg-surface-canvas text-ink-500"
                            : item.scheduledPrice != null
                              ? "bg-status-warning-soft text-status-warning"
                              : "bg-status-open-soft text-status-open"
                        }`}
                      >
                        {item.status === "archived" ? "Archived" : item.scheduledPrice != null ? "Change queued" : "Active"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => setDrawerItemId(item.id)}
                        className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-ink-700"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {drawerItemId !== undefined && (
        <ChargeCatalogItemDrawer
          hospitalId={hospitalId}
          itemId={drawerItemId ?? undefined}
          onClose={() => setDrawerItemId(undefined)}
        />
      )}

      {showBulkModal && (
        <BulkRevisePricesModal
          hospitalId={hospitalId}
          items={showBulkModal === "selected" ? selectedItems : items.filter((i) => i.status === "active")}
          onClose={() => {
            setShowBulkModal(null);
            setSelected(new Set());
          }}
        />
      )}

      {items.length === 0 && !isLoading && activeCategory === "all" && !search && (
        <div className="mt-5 flex gap-2.5 items-start bg-status-warning-soft border border-status-warning/30 rounded-lg p-3 text-xs text-status-warning">
          <AlertTriangle size={16} className="flex-none mt-0.5" />
          <span>Nothing in the catalog yet — add your first billable item.</span>
        </div>
      )}
    </div>
  );
}
