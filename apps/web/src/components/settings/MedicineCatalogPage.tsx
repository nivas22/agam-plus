// components/settings/MedicineCatalogPage.tsx
"use client";

import { AlertTriangle, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useMedicines } from "@/hooks/useMedicineApi";
import type { Medicine } from "@/types/medicine";
import { MEDICINE_FORM_OPTIONS } from "@/types/medicine";
import MedicineItemDrawer from "./MedicineItemDrawer";

interface MedicineCatalogPageProps {
  hospitalId: string;
  canEdit?: boolean;
}

export default function MedicineCatalogPage({
  hospitalId,
  canEdit = true,
}: MedicineCatalogPageProps) {
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState("");
  const [drawerItemId, setDrawerItemId] = useState<string | null | undefined>(
    undefined,
  );

  const { data, isLoading } = useMedicines(hospitalId, {
    status: showArchived ? "archived" : undefined,
    search: search || undefined,
  });
  const items = useMemo(
    () =>
      (data?.items || []).filter((item) =>
        showArchived ? item.status === "archived" : item.status !== "archived",
      ),
    [data, showArchived],
  );
  const counts = data?.counts || {};

  return (
    <div>
      <div className="flex items-end gap-3.5 mb-4">
        <div>
          <h1 className="text-xl font-bold text-ink-900">Medicines</h1>
          <p className="text-sm text-ink-500 mt-0.5">
            The catalog doctors search from when writing a prescription —
            including allergy class tags.
          </p>
        </div>
        <div className="flex-1" />
        {canEdit && (
          <button
            type="button"
            onClick={() => setDrawerItemId(null)}
            className="flex items-center gap-1.5 bg-brand-violet hover:bg-brand-violet-hover text-white text-sm font-semibold rounded-lg px-4 py-2.5 transition-colors"
          >
            <Plus size={16} />
            Add medicine
          </button>
        )}
      </div>

      <div className="bg-surface-paper border border-border rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 p-3 border-b border-border flex-wrap">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500"
            />
            <input
              type="text"
              placeholder="Search by name, generic name or class"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-2 rounded-lg border border-border bg-surface-paper text-sm w-72"
            />
          </div>
          <div className="flex-1" />
          <div className="flex bg-surface-canvas border border-border rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setShowArchived(false)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                !showArchived
                  ? "bg-surface-paper text-ink-900 shadow-sm"
                  : "text-ink-500"
              }`}
            >
              Active · {counts.all ?? 0}
            </button>
            <button
              type="button"
              onClick={() => setShowArchived(true)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                showArchived
                  ? "bg-surface-paper text-ink-900 shadow-sm"
                  : "text-ink-500"
              }`}
            >
              Archived · {counts.archived ?? 0}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-canvas/60 border-b border-border">
                {["Medicine", "Classes", "Form", "Strength", "Status", ""].map(
                  (h) => (
                    <th
                      key={h}
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
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-ink-500"
                  >
                    {showArchived
                      ? "No archived medicines."
                      : "No medicines in the catalog yet."}
                  </td>
                </tr>
              )}
              {items.map((item: Medicine) => (
                <tr
                  key={item.id}
                  className="border-b border-border last:border-0 hover:bg-surface-canvas/40 cursor-pointer"
                  onClick={() => setDrawerItemId(item.id)}
                >
                  <td className="px-3 py-2.5">
                    <span className="block font-medium text-ink-900">
                      {item.name}
                    </span>
                    {item.genericName && (
                      <span className="block text-[10.5px] text-ink-500">
                        {item.genericName}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {item.classes.length === 0 ? (
                        <span className="text-xs text-ink-500">—</span>
                      ) : (
                        item.classes.map((c) => (
                          <span
                            key={c}
                            className="inline-block rounded-md px-2 py-0.5 text-[10.5px] font-semibold bg-status-warning-soft text-status-warning"
                          >
                            {c}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-ink-700 whitespace-nowrap">
                    {MEDICINE_FORM_OPTIONS.find((o) => o.value === item.form)
                      ?.label || item.form}
                  </td>
                  <td className="px-3 py-2.5 text-ink-700 whitespace-nowrap">
                    {item.strength || "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`inline-block rounded-md px-2 py-0.5 text-[10.5px] font-semibold ${
                        item.status === "archived"
                          ? "bg-surface-canvas text-ink-500"
                          : "bg-status-open-soft text-status-open"
                      }`}
                    >
                      {item.status === "archived" ? "Archived" : "Active"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDrawerItemId(item.id);
                      }}
                      className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-ink-700"
                    >
                      {canEdit ? "Edit" : "View"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {drawerItemId !== undefined && (
        <MedicineItemDrawer
          hospitalId={hospitalId}
          itemId={drawerItemId ?? undefined}
          readOnly={!canEdit}
          onClose={() => setDrawerItemId(undefined)}
        />
      )}

      {canEdit && items.length === 0 && !isLoading && !showArchived && !search && (
        <div className="mt-5 flex gap-2.5 items-start bg-status-warning-soft border border-status-warning/30 rounded-lg p-3 text-xs text-status-warning">
          <AlertTriangle size={16} className="flex-none mt-0.5" />
          <span>
            Nothing in the catalog yet — add your first medicine so doctors can
            prescribe it.
          </span>
        </div>
      )}
    </div>
  );
}
