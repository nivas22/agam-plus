// components/settings/MedicinePacksPage.tsx
"use client";

import { AlertTriangle, Plus, Search } from "lucide-react";
import { useState } from "react";
import { useMedicinePacks } from "@/hooks/useMedicinePackApi";
import type { MedicinePack } from "@/types/medicinePack";
import MedicinePackDrawer from "./MedicinePackDrawer";

interface MedicinePacksPageProps {
  hospitalId: string;
  canEdit?: boolean;
}

export default function MedicinePacksPage({
  hospitalId,
  canEdit = true,
}: MedicinePacksPageProps) {
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState("");
  const [drawerPackId, setDrawerPackId] = useState<string | null | undefined>(
    undefined,
  );

  const { data, isLoading } = useMedicinePacks(hospitalId, {
    status: showArchived ? "archived" : undefined,
    search: search || undefined,
  });
  const items = data?.items || [];
  const counts = data?.counts || {};

  return (
    <div>
      <div className="flex items-end gap-3.5 mb-4">
        <div>
          <h1 className="text-xl font-bold text-ink-900 font-display tracking-tight">
            Medicine packs
          </h1>
          <p className="text-sm text-ink-500 mt-0.5">
            Treatment templates doctors can apply in one click from the
            prescription writer.
          </p>
        </div>
        <div className="flex-1" />
        {canEdit && (
          <button
            type="button"
            onClick={() => setDrawerPackId(null)}
            className="flex items-center gap-1.5 bg-brand-violet hover:bg-brand-violet-hover text-white text-sm font-semibold rounded-lg px-4 py-2.5 transition-colors"
          >
            <Plus size={16} />
            New pack
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
              placeholder="Search by name"
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
                {["Pack", "Medicines", "Status", ""].map((h) => (
                  <th
                    key={h}
                    className="text-left text-[10.5px] uppercase tracking-wide text-ink-500 font-semibold px-3 py-2.5 whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!isLoading && items.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-ink-500">
                    {showArchived ? "No archived packs." : "No medicine packs yet."}
                  </td>
                </tr>
              )}
              {items.map((pack: MedicinePack) => (
                <tr
                  key={pack.id}
                  className="border-b border-border last:border-0 hover:bg-surface-canvas/40 cursor-pointer"
                  onClick={() => setDrawerPackId(pack.id)}
                >
                  <td className="px-3 py-2.5 font-medium text-ink-900">
                    {pack.name}
                  </td>
                  <td className="px-3 py-2.5 text-ink-700">
                    {pack.items.map((i) => i.medicineName).join(", ")}
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`inline-block rounded-md px-2 py-0.5 text-[10.5px] font-semibold ${
                        pack.status === "archived"
                          ? "bg-surface-canvas text-ink-500"
                          : "bg-status-open-soft text-status-open"
                      }`}
                    >
                      {pack.status === "archived" ? "Archived" : "Active"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDrawerPackId(pack.id);
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

      {drawerPackId !== undefined && (
        <MedicinePackDrawer
          hospitalId={hospitalId}
          packId={drawerPackId ?? undefined}
          readOnly={!canEdit}
          onClose={() => setDrawerPackId(undefined)}
        />
      )}

      {canEdit && items.length === 0 && !isLoading && !showArchived && !search && (
        <div className="mt-5 flex gap-2.5 items-start bg-status-warning-soft border border-status-warning/30 rounded-lg p-3 text-xs text-status-warning">
          <AlertTriangle size={16} className="flex-none mt-0.5" />
          <span>
            No packs yet — bundle your common treatments so doctors can
            apply them in one click.
          </span>
        </div>
      )}
    </div>
  );
}
