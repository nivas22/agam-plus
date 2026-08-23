// components/audit/AuditTrailPage.tsx
"use client";

import { Download } from "lucide-react";
import { useState } from "react";
import { auditExportUrl, useAuditLog, type AuditFilters } from "@/hooks/useAuditApi";

interface AuditTrailPageProps {
  hospitalId: string;
}

const AREA_LABELS: Record<string, string> = {
  money: "Money",
  appointments: "Appointments",
  settings: "Settings",
  access: "Access",
  patients: "Patients",
};

const AREA_TAG_STYLES: Record<string, string> = {
  money: "bg-[#f2ebfd] text-[#7a3fd0]",
  appointments: "bg-brand-violet-soft text-brand-violet",
  settings: "bg-surface-canvas text-ink-700",
  access: "bg-status-open-soft text-status-open",
  patients: "bg-status-warning-soft text-status-warning",
};

function money(v: number): string {
  const sign = v < 0 ? "−" : v > 0 ? "+" : "";
  return `${sign}₹${Math.round(Math.abs(v)).toLocaleString("en-IN")}`;
}

export default function AuditTrailPage({ hospitalId }: AuditTrailPageProps) {
  const [search, setSearch] = useState("");
  const [area, setArea] = useState("");
  const [moneyOnly, setMoneyOnly] = useState(false);

  const filters: AuditFilters = { search: search || undefined, area: area || undefined, moneyOnly };
  const { data, isLoading } = useAuditLog(hospitalId, filters);
  const entries = data?.entries || [];

  return (
    <div>
      <div className="flex items-end gap-3.5 mb-4">
        <div>
          <h1 className="font-display tracking-tight text-xl font-bold text-ink-900">Audit trail</h1>
          <p className="text-sm text-ink-500 mt-0.5">
            Every action that changed money, a booking, or a permission. Written once, never edited.
          </p>
        </div>
        <div className="flex-1" />
        <a
          href={auditExportUrl(hospitalId, filters)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-sm font-semibold text-ink-700 hover:bg-surface-canvas"
        >
          <Download size={14} />
          Export CSV
        </a>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3.5">
        <input
          placeholder="Patient, invoice or person"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-60 px-3 py-2 border border-border rounded-lg text-sm bg-surface-paper"
        />
        <select value={area} onChange={(e) => setArea(e.target.value)} className="px-3 py-2 border border-border rounded-lg text-sm bg-surface-paper">
          <option value="">All areas</option>
          {Object.entries(AREA_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setMoneyOnly((v) => !v)}
          className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${
            moneyOnly ? "border-status-open bg-status-open-soft text-status-open" : "border-border bg-surface-paper text-ink-700"
          }`}
        >
          Money only
        </button>
        <div className="flex-1" />
        <span className="text-xs text-ink-500">{entries.length} entries</span>
      </div>

      <div className="bg-surface-paper border border-border rounded-xl overflow-hidden">
        {isLoading && <div className="px-4 py-8 text-center text-sm text-ink-500">Loading…</div>}
        {!isLoading && entries.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-ink-500">Nothing matches these filters.</div>
        )}
        {entries.map((e) => (
          <div key={e.id} className={`px-4 py-3 border-b border-border last:border-0 flex items-center gap-3 ${e.area === "money" ? "bg-[#fbfaff]" : ""}`}>
            <span className="text-xs font-mono text-ink-500 w-16 flex-none">
              {new Date(e.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
            <span className="w-40 flex-none min-w-0">
              <span className="block text-sm font-medium text-ink-900 truncate">{e.actorName}</span>
              <span className="block text-[10.5px] text-ink-500">{e.actorRole.replace("_", " ")}</span>
            </span>
            <span className="flex-1 min-w-0 text-sm text-ink-900">{e.summary}</span>
            {typeof e.amount === "number" && (
              <span className={`text-sm font-mono flex-none ${e.amount < 0 ? "text-status-danger" : "text-status-open"}`}>
                {money(e.amount)}
              </span>
            )}
            <span className={`text-[10.5px] font-semibold rounded-md px-2 py-0.5 flex-none ${AREA_TAG_STYLES[e.area]}`}>
              {AREA_LABELS[e.area]?.toUpperCase() || e.area.toUpperCase()}
            </span>
          </div>
        ))}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-surface-canvas/50 text-[11.5px] text-ink-500">
          Entries cannot be edited or deleted by anyone, including the owner. Corrections are added as new entries.
        </div>
      </div>
    </div>
  );
}
