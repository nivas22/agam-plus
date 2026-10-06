// components/platform-admin/HospitalFeaturesSection.tsx
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, ToggleLeft } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { inputClass, ToggleSwitch } from "@/components/common/EditFormControls";
import type { FeatureCatalog } from "@/hooks/useFeatureCatalogApi";
import { apiUrl, fetchWithAuth } from "@/lib/api";
import {
  HOSPITAL_MODULE_BY_KEY,
  HOSPITAL_MODULE_GROUPS,
  HOSPITAL_MODULES,
  type HospitalModuleKey,
} from "@/lib/hospitalModules";

interface HospitalFeaturesRow {
  hospitalId: string;
  hospitalName: string;
  // Only an explicit false withholds a module; missing means granted.
  features: Partial<Record<HospitalModuleKey, boolean>>;
}

// Shares the Subscriptions page's query, so both stay in sync.
async function fetchSubscriptions(): Promise<HospitalFeaturesRow[]> {
  const response = await fetchWithAuth(apiUrl("/platform-admin/subscriptions"));
  if (!response.ok) throw new Error("Failed to load subscriptions");
  return response.json();
}

type FeatureChanges = Partial<Record<HospitalModuleKey, boolean>>;

async function saveFeatures(
  hospitalId: string,
  features: FeatureChanges,
): Promise<void> {
  const response = await fetchWithAuth(
    apiUrl(`/platform-admin/hospitals/${hospitalId}/subscription/features`),
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ features }),
    },
  );
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(
      error?.error || error?.message || "Failed to update features",
    );
  }
}

export default function HospitalFeaturesSection({
  catalog,
}: {
  catalog?: FeatureCatalog;
}) {
  const queryClient = useQueryClient();
  const [hospitalId, setHospitalId] = useState<string>("");
  // Unsaved toggles for the selected hospital, sent together on save.
  const [changes, setChanges] = useState<FeatureChanges>({});

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["platform-admin", "subscriptions"],
    queryFn: fetchSubscriptions,
  });

  const saveMutation = useMutation({
    mutationFn: ({
      hospitalId,
      features,
    }: {
      hospitalId: string;
      features: FeatureChanges;
    }) => saveFeatures(hospitalId, features),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["platform-admin", "subscriptions"],
      });
      setChanges({});
      toast.success("Feature access updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const row = rows.find((r) => r.hospitalId === hospitalId) ?? rows[0];
  const savedGranted = (key: HospitalModuleKey) =>
    row?.features?.[key] !== false;
  const isGranted = (key: HospitalModuleKey) =>
    changes[key] ?? savedGranted(key);
  const changedCount = Object.keys(changes).length;

  const toggle = (key: HospitalModuleKey, value: boolean) =>
    setChanges((prev) => {
      const next = { ...prev };
      if (value === savedGranted(key)) delete next[key];
      else next[key] = value;
      return next;
    });

  const selectHospital = (id: string) => {
    if (
      changedCount > 0 &&
      !window.confirm("Discard unsaved feature changes for this hospital?")
    ) {
      return;
    }
    setChanges({});
    setHospitalId(id);
  };
  const withheldCount = row
    ? HOSPITAL_MODULES.filter((m) => !isGranted(m.key)).length
    : 0;

  return (
    <section className="bg-surface-paper rounded-xl border border-border shadow-sm overflow-hidden mb-6">
      <div className="px-5 py-4 border-b border-border flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-ink-900 flex items-center gap-2 font-display tracking-tight">
            <ToggleLeft className="w-5 h-5 text-brand-violet" />
            Features by hospital
          </h2>
          <p className="text-sm text-ink-500">
            Choose what this hospital&apos;s plan includes. Its admin can only
            switch on what&apos;s granted here, and only once it&apos;s
            available in the Feature catalog.
          </p>
        </div>
        {rows.length > 0 && (
          <select
            className={`${inputClass} sm:w-72`}
            value={row?.hospitalId}
            aria-label="Hospital"
            onChange={(e) => selectHospital(e.target.value)}
          >
            {rows.map((r) => (
              <option key={r.hospitalId} value={r.hospitalId}>
                {r.hospitalName}
              </option>
            ))}
          </select>
        )}
      </div>

      {isLoading && (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-violet/20 border-t-brand-violet" />
        </div>
      )}

      {row && (
        <>
          <div className="px-5 py-2.5 text-xs text-ink-500 border-b border-border bg-surface-canvas">
            {withheldCount === 0
              ? "Every feature is included."
              : `${withheldCount} of ${HOSPITAL_MODULES.length} features withheld.`}
          </div>
          {HOSPITAL_MODULE_GROUPS.map((group) => (
            <div key={group.key}>
              <div className="px-5 pt-4 pb-2 text-xs font-bold uppercase tracking-wide text-ink-500">
                {group.label}
              </div>
              <ul className="divide-y divide-border border-y border-border">
                {HOSPITAL_MODULES.filter((m) => m.group === group.key).map(
                  (info) => {
                    const release =
                      catalog?.moduleStatus?.[info.key] || "available";
                    const missingDeps = (info.requires || []).filter(
                      (dep) => !isGranted(dep),
                    );
                    return (
                      <li
                        key={info.key}
                        className="flex items-start gap-3 px-5 py-3"
                      >
                        <div className="pt-0.5">
                          <ToggleSwitch
                            checked={isGranted(info.key)}
                            ariaLabel={info.label}
                            disabled={saveMutation.isPending}
                            onChange={(value) => toggle(info.key, value)}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold text-ink-900">
                              {info.label}
                            </span>
                            {release !== "available" && (
                              <span className="rounded-md px-2 py-0.5 text-[11px] font-semibold bg-status-warning-soft text-status-warning">
                                {release === "coming_soon"
                                  ? "Coming soon"
                                  : "Hidden"}{" "}
                                platform-wide
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-ink-500 mt-0.5">
                            {info.description}
                          </p>
                          {isGranted(info.key) && missingDeps.length > 0 && (
                            <p className="text-xs text-status-warning mt-1">
                              Needs{" "}
                              {missingDeps
                                .map((k) => HOSPITAL_MODULE_BY_KEY[k].label)
                                .join(", ")}
                              , which this plan doesn&apos;t include.
                            </p>
                          )}
                        </div>
                      </li>
                    );
                  },
                )}
              </ul>
            </div>
          ))}
        </>
      )}

      {!isLoading && rows.length === 0 && (
        <p className="text-sm text-ink-500 italic px-4 py-8 text-center">
          No hospitals yet
        </p>
      )}

      {row && changedCount > 0 && (
        <div className="sticky bottom-4 m-4 flex gap-2.5 items-center bg-surface-paper border border-border rounded-lg p-3 shadow-md">
          <span className="text-xs text-ink-500 flex-1">
            {changedCount} unsaved change{changedCount === 1 ? "" : "s"} for{" "}
            {row.hospitalName}.
          </span>
          <button
            type="button"
            onClick={() => setChanges({})}
            disabled={saveMutation.isPending}
            className="px-3.5 py-1.5 rounded-lg border border-border text-xs font-semibold text-ink-700 disabled:opacity-50"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={() =>
              saveMutation.mutate({
                hospitalId: row.hospitalId,
                features: changes,
              })
            }
            disabled={saveMutation.isPending}
            className="flex items-center gap-1.5 bg-brand-violet hover:bg-brand-violet-hover text-white text-xs font-semibold rounded-lg px-3.5 py-1.5 transition-colors disabled:opacity-50"
          >
            {saveMutation.isPending && (
              <Loader2 size={14} className="animate-spin" />
            )}
            Save changes
          </button>
        </div>
      )}
    </section>
  );
}
