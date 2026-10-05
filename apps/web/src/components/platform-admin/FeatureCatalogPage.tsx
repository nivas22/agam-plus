// components/platform-admin/FeatureCatalogPage.tsx
"use client";

import { Layers, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { inputClass } from "@/components/common/EditFormControls";
import {
  type FeatureCatalog,
  useFeatureCatalog,
  useUpdateFeatureCatalog,
} from "@/hooks/useFeatureCatalogApi";
import {
  FEATURE_RELEASE_STATUS_OPTIONS,
  type FeatureReleaseStatus,
  HOSPITAL_MODULE_BY_KEY,
  HOSPITAL_MODULE_GROUPS,
  HOSPITAL_MODULES,
  type HospitalModuleGroup,
  type UpcomingFeature,
} from "@/lib/hospitalModules";

type Draft = Pick<FeatureCatalog, "moduleStatus" | "upcoming">;

const STATUS_STYLES: Record<FeatureReleaseStatus, string> = {
  available: "bg-status-open text-white",
  coming_soon: "bg-status-warning text-white",
  hidden: "bg-ink-700 text-white",
};

// "Lab reports" -> "labReports"; suffixed when it clashes with an existing key.
function keyFor(label: string, taken: Set<string>): string {
  const words = label
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  let base = words
    .map((w, i) => (i === 0 ? w : w[0].toUpperCase() + w.slice(1)))
    .join("")
    .replace(/^[0-9]+/, "")
    .slice(0, 36);
  if (!base) base = "feature";
  let key = base;
  for (let n = 2; taken.has(key); n++) key = `${base}${n}`;
  return key;
}

function normalize(draft: Draft): string {
  const moduleStatus = Object.fromEntries(
    Object.entries(draft.moduleStatus).filter(([, v]) => v !== "available"),
  );
  return JSON.stringify({ moduleStatus, upcoming: draft.upcoming });
}

export default function FeatureCatalogPage() {
  const { data, isLoading } = useFeatureCatalog();
  const updateCatalog = useUpdateFeatureCatalog();

  const server = useMemo<Draft>(
    () => ({
      moduleStatus: data?.moduleStatus || {},
      upcoming: data?.upcoming || [],
    }),
    [data],
  );
  const [draft, setDraft] = useState<Draft>(server);
  useEffect(() => setDraft(server), [server]);

  const [newLabel, setNewLabel] = useState("");
  const [newGroup, setNewGroup] = useState<HospitalModuleGroup>("care");
  const [newDescription, setNewDescription] = useState("");

  const isDirty = normalize(draft) !== normalize(server);

  const statusOf = (key: string): FeatureReleaseStatus =>
    draft.moduleStatus[key as keyof Draft["moduleStatus"]] || "available";

  const setStatus = (key: string, status: FeatureReleaseStatus) =>
    setDraft((prev) => ({
      ...prev,
      moduleStatus: { ...prev.moduleStatus, [key]: status },
    }));

  const updateUpcoming = (key: string, patch: Partial<UpcomingFeature>) =>
    setDraft((prev) => ({
      ...prev,
      upcoming: prev.upcoming.map((u) =>
        u.key === key ? { ...u, ...patch } : u,
      ),
    }));

  const removeUpcoming = (key: string) =>
    setDraft((prev) => ({
      ...prev,
      upcoming: prev.upcoming.filter((u) => u.key !== key),
    }));

  const addUpcoming = () => {
    const label = newLabel.trim();
    if (!label) return;
    const taken = new Set([
      ...draft.upcoming.map((u) => u.key),
      ...HOSPITAL_MODULES.map((m) => m.key as string),
    ]);
    const feature: UpcomingFeature = {
      key: keyFor(label, taken),
      label,
      group: newGroup,
      ...(newDescription.trim() ? { description: newDescription.trim() } : {}),
    };
    setDraft((prev) => ({ ...prev, upcoming: [...prev.upcoming, feature] }));
    setNewLabel("");
    setNewDescription("");
  };

  const save = async () => {
    if (draft.upcoming.some((u) => !u.label.trim())) {
      toast.error("Every upcoming feature needs a name");
      return;
    }
    try {
      await updateCatalog.mutateAsync({
        // Only store what differs from the default, so a newly added module
        // starts out available.
        moduleStatus: Object.fromEntries(
          Object.entries(draft.moduleStatus).filter(
            ([, v]) => v !== "available",
          ),
        ),
        upcoming: draft.upcoming.map((u) => ({
          ...u,
          label: u.label.trim(),
          description: u.description?.trim() || undefined,
        })),
      });
      toast.success("Feature catalog saved");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save changes",
      );
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-violet/20 border-t-brand-violet" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <h1 className="font-display tracking-tight text-xl font-bold text-ink-900 mb-1">
        Feature catalog
      </h1>
      <p className="text-sm text-ink-500 mb-5">
        Decide which features exist for every hospital. <b>Coming soon</b>{" "}
        features are listed on each hospital&apos;s Settings › Features with a
        badge but can&apos;t be used; <b>hidden</b> ones aren&apos;t shown at
        all. Which hospital gets which available feature is set per hospital
        under Subscriptions › Features.
      </p>

      <section className="bg-surface-paper rounded-xl border border-border shadow-sm overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-lg font-bold text-ink-900 flex items-center gap-2 font-display tracking-tight">
            <Layers className="w-5 h-5 text-brand-violet" />
            Modules
          </h2>
        </div>
        {HOSPITAL_MODULE_GROUPS.map((group) => (
          <div key={group.key}>
            <div className="px-5 pt-4 pb-2 text-xs font-bold uppercase tracking-wide text-ink-500">
              {group.label}
            </div>
            <ul className="divide-y divide-border border-y border-border">
              {HOSPITAL_MODULES.filter((m) => m.group === group.key).map(
                (info) => {
                  const status = statusOf(info.key);
                  const blockedBy = (info.requires || []).filter(
                    (dep) => statusOf(dep) !== "available",
                  );
                  return (
                    <li
                      key={info.key}
                      className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-ink-900">
                          {info.label}
                        </div>
                        <p className="text-xs text-ink-500 mt-0.5">
                          {info.description}
                        </p>
                        {status === "available" && blockedBy.length > 0 && (
                          <p className="text-xs text-status-warning mt-1">
                            Needs{" "}
                            {blockedBy
                              .map((k) => HOSPITAL_MODULE_BY_KEY[k].label)
                              .join(", ")}
                            , which isn&apos;t available — hospitals won&apos;t
                            be able to use it yet.
                          </p>
                        )}
                      </div>
                      <fieldset className="flex flex-none rounded-lg border border-border overflow-hidden text-xs font-semibold">
                        <legend className="sr-only">
                          {info.label} release status
                        </legend>
                        {FEATURE_RELEASE_STATUS_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            aria-pressed={status === opt.value}
                            onClick={() => setStatus(info.key, opt.value)}
                            className={`px-3 py-1.5 transition-colors ${
                              status === opt.value
                                ? STATUS_STYLES[opt.value]
                                : "bg-surface-paper text-ink-700 hover:bg-surface-canvas"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </fieldset>
                    </li>
                  );
                },
              )}
            </ul>
          </div>
        ))}
      </section>

      <section className="bg-surface-paper rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-lg font-bold text-ink-900 flex items-center gap-2 font-display tracking-tight">
            <Sparkles className="w-5 h-5 text-brand-violet" />
            Upcoming features
          </h2>
          <p className="text-sm text-ink-500">
            Features that aren&apos;t built yet. Every hospital sees them as
            &ldquo;Coming soon&rdquo; in the section you pick.
          </p>
        </div>

        {draft.upcoming.length > 0 && (
          <ul className="divide-y divide-border border-b border-border">
            {draft.upcoming.map((feature) => (
              <li
                key={feature.key}
                className="grid grid-cols-1 sm:grid-cols-[1fr_180px_auto] gap-2 px-5 py-3 items-start"
              >
                <div className="space-y-2">
                  <input
                    className={inputClass}
                    value={feature.label}
                    maxLength={60}
                    aria-label="Feature name"
                    onChange={(e) =>
                      updateUpcoming(feature.key, { label: e.target.value })
                    }
                  />
                  <input
                    className={inputClass}
                    value={feature.description || ""}
                    maxLength={200}
                    placeholder="Short description (optional)"
                    aria-label="Feature description"
                    onChange={(e) =>
                      updateUpcoming(feature.key, {
                        description: e.target.value,
                      })
                    }
                  />
                </div>
                <select
                  className={inputClass}
                  value={feature.group}
                  aria-label="Section"
                  onChange={(e) =>
                    updateUpcoming(feature.key, {
                      group: e.target.value as HospitalModuleGroup,
                    })
                  }
                >
                  {HOSPITAL_MODULE_GROUPS.map((g) => (
                    <option key={g.key} value={g.key}>
                      {g.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => removeUpcoming(feature.key)}
                  className="p-2.5 rounded-lg text-ink-500 hover:text-status-danger hover:bg-status-danger-soft transition-colors justify-self-start"
                  aria-label={`Remove ${feature.label}`}
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <form
          className="grid grid-cols-1 sm:grid-cols-[1fr_180px_auto] gap-2 px-5 py-4 items-start"
          onSubmit={(e) => {
            e.preventDefault();
            addUpcoming();
          }}
        >
          <div className="space-y-2">
            <input
              className={inputClass}
              value={newLabel}
              maxLength={60}
              placeholder="e.g. Lab reports"
              aria-label="New feature name"
              onChange={(e) => setNewLabel(e.target.value)}
            />
            <input
              className={inputClass}
              value={newDescription}
              maxLength={200}
              placeholder="Short description (optional)"
              aria-label="New feature description"
              onChange={(e) => setNewDescription(e.target.value)}
            />
          </div>
          <select
            className={inputClass}
            value={newGroup}
            aria-label="New feature section"
            onChange={(e) => setNewGroup(e.target.value as HospitalModuleGroup)}
          >
            {HOSPITAL_MODULE_GROUPS.map((g) => (
              <option key={g.key} value={g.key}>
                {g.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={!newLabel.trim() || draft.upcoming.length >= 30}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border border-border text-sm font-semibold text-ink-700 hover:bg-surface-canvas disabled:opacity-50"
          >
            <Plus size={16} />
            Add
          </button>
        </form>
      </section>

      {isDirty && (
        <div className="sticky bottom-4 mt-4 flex gap-2.5 items-center bg-surface-paper border border-border rounded-lg p-3 shadow-md">
          <span className="text-xs text-ink-500 flex-1">
            Unsaved changes apply to every hospital once saved.
          </span>
          <button
            type="button"
            onClick={() => setDraft(server)}
            disabled={updateCatalog.isPending}
            className="px-3.5 py-1.5 rounded-lg border border-border text-xs font-semibold text-ink-700 disabled:opacity-50"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={save}
            disabled={updateCatalog.isPending}
            className="flex items-center gap-1.5 bg-brand-violet hover:bg-brand-violet-hover text-white text-xs font-semibold rounded-lg px-3.5 py-1.5 transition-colors disabled:opacity-50"
          >
            {updateCatalog.isPending && (
              <Loader2 size={14} className="animate-spin" />
            )}
            Save changes
          </button>
        </div>
      )}
    </div>
  );
}
