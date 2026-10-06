// components/platform-admin/HospitalFeaturesSection.tsx
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ToggleLeft } from "lucide-react";
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

async function setFeature(
  hospitalId: string,
  feature: HospitalModuleKey,
  enabled: boolean,
): Promise<void> {
  const response = await fetchWithAuth(
    apiUrl(`/platform-admin/hospitals/${hospitalId}/subscription/features`),
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feature, enabled }),
    },
  );
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(
      error?.error || error?.message || "Failed to update feature",
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

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["platform-admin", "subscriptions"],
    queryFn: fetchSubscriptions,
  });

  const featureMutation = useMutation({
    mutationFn: ({
      hospitalId,
      feature,
      enabled,
    }: {
      hospitalId: string;
      feature: HospitalModuleKey;
      enabled: boolean;
    }) => setFeature(hospitalId, feature, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["platform-admin", "subscriptions"],
      });
      toast.success("Feature access updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const row = rows.find((r) => r.hospitalId === hospitalId) ?? rows[0];
  const isGranted = (key: HospitalModuleKey) => row?.features?.[key] !== false;
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
            available above. Changes here save immediately.
          </p>
        </div>
        {rows.length > 0 && (
          <select
            className={`${inputClass} sm:w-72`}
            value={row?.hospitalId}
            aria-label="Hospital"
            onChange={(e) => setHospitalId(e.target.value)}
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
                            disabled={featureMutation.isPending}
                            onChange={(value) =>
                              featureMutation.mutate({
                                hospitalId: row.hospitalId,
                                feature: info.key,
                                enabled: value,
                              })
                            }
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
    </section>
  );
}
