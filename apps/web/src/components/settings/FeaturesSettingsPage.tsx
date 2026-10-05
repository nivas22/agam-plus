// components/settings/FeaturesSettingsPage.tsx
"use client";

import { AlertTriangle, Loader2, Lock, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { ToggleSwitch } from "@/components/common/EditFormControls";
import {
  useHospitalModules,
  useUpdateHospitalModules,
} from "@/hooks/useHospitalModulesApi";
import {
  describeDisabledModule,
  HOSPITAL_MODULE_BY_KEY,
  HOSPITAL_MODULE_GROUPS,
  HOSPITAL_MODULES,
  type HospitalModuleKey,
  isPlatformLocked,
  resolveDraftModules,
} from "@/lib/hospitalModules";

interface FeaturesSettingsPageProps {
  hospitalId: string;
  canEdit: boolean;
}

type Switches = Partial<Record<HospitalModuleKey, boolean>>;

export default function FeaturesSettingsPage({
  hospitalId,
  canEdit,
}: FeaturesSettingsPageProps) {
  const { data, isLoading } = useHospitalModules(hospitalId);
  const updateModules = useUpdateHospitalModules(hospitalId);

  const serverSwitches = useMemo<Switches>(
    () =>
      Object.fromEntries(
        (data?.modules || []).map((m) => [m.key, m.switchedOn]),
      ),
    [data],
  );
  const [switches, setSwitches] = useState<Switches>({});

  useEffect(() => {
    setSwitches(serverSwitches);
  }, [serverSwitches]);

  const resolved = useMemo(
    () => resolveDraftModules(data?.modules || [], switches),
    [data, switches],
  );

  const changes = HOSPITAL_MODULES.filter(
    (m) => switches[m.key] !== serverSwitches[m.key],
  );
  const isDirty = changes.length > 0;

  // Turning something off also takes down whatever builds on it — list
  // those next to the switch so it's not a surprise after saving.
  const dependentsOf = (key: HospitalModuleKey) =>
    HOSPITAL_MODULES.filter((m) => m.requires?.includes(key)).map((m) => m.key);
  const cascadeFor = (key: HospitalModuleKey): HospitalModuleKey[] => {
    const seen = new Set<HospitalModuleKey>();
    const visit = (k: HospitalModuleKey) =>
      dependentsOf(k).forEach((d) => {
        if (!seen.has(d)) {
          seen.add(d);
          visit(d);
        }
      });
    visit(key);
    return [...seen];
  };

  const save = async () => {
    try {
      await updateModules.mutateAsync(
        Object.fromEntries(changes.map((m) => [m.key, switches[m.key]])),
      );
      toast.success("Features updated");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save changes",
      );
    }
  };

  const reset = () => setSwitches(serverSwitches);

  // Modules the platform hasn't released are left out entirely; teasers for
  // features still being built sit at the end of their section.
  const visibleModules = HOSPITAL_MODULES.filter(
    (m) => resolved[m.key].disabledReason !== "hidden",
  );
  const upcoming = data?.upcoming || [];

  return (
    <div>
      <h1 className="font-display tracking-tight text-xl font-bold text-ink-900 mb-1">
        Features
      </h1>
      <p className="text-sm text-ink-500 mb-5">
        Choose which parts of Agam Plus this hospital uses. Turning a feature
        off hides it for everyone here and keeps its data — turn it back on any
        time.
      </p>

      {isLoading ? (
        <div className="bg-surface-paper border border-border rounded-xl flex items-center gap-2 text-sm text-ink-500 py-10 justify-center">
          <Loader2 size={16} className="animate-spin" />
          Loading…
        </div>
      ) : (
        <div className="space-y-6">
          {HOSPITAL_MODULE_GROUPS.map((group) => {
            const groupModules = visibleModules.filter(
              (m) => m.group === group.key,
            );
            const groupUpcoming = upcoming.filter((u) => u.group === group.key);
            if (groupModules.length === 0 && groupUpcoming.length === 0) {
              return null;
            }
            return (
              <div key={group.key}>
                <h2 className="text-xs font-bold uppercase tracking-wide text-ink-500 mb-2.5">
                  {group.label}
                </h2>
                <ul className="bg-surface-paper border border-border rounded-xl divide-y divide-border overflow-hidden">
                  {groupModules.map((info) => {
                    const state = resolved[info.key];
                    const planLocked = isPlatformLocked(state.disabledReason);
                    const comingSoon = state.disabledReason === "coming_soon";
                    const switchedOn = switches[info.key] ?? true;
                    const turningOff =
                      !switchedOn && serverSwitches[info.key] !== false;
                    const cascade = turningOff
                      ? cascadeFor(info.key).filter(
                          (k) => switches[k] !== false,
                        )
                      : [];

                    return (
                      <li
                        key={info.key}
                        className={`flex items-start gap-3 px-4 py-3.5 ${
                          state.enabled ? "" : "bg-surface-canvas"
                        }`}
                      >
                        <div className="pt-0.5">
                          <ToggleSwitch
                            checked={planLocked ? false : switchedOn}
                            disabled={!canEdit || planLocked}
                            ariaLabel={info.label}
                            onChange={(on) =>
                              setSwitches((prev) => ({
                                ...prev,
                                [info.key]: on,
                              }))
                            }
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold text-ink-900">
                              {info.label}
                            </span>
                            {comingSoon && <ComingSoonBadge />}
                            {state.disabledReason === "plan" && (
                              <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold bg-brand-violet-soft text-brand-violet">
                                <Lock size={11} />
                                Not on your plan
                              </span>
                            )}
                            {!planLocked &&
                              switchedOn &&
                              state.disabledReason === "requires" && (
                                <span className="rounded-md px-2 py-0.5 text-[11px] font-semibold bg-status-warning-soft text-status-warning">
                                  Inactive
                                </span>
                              )}
                          </div>
                          <p className="text-xs text-ink-500 mt-0.5 leading-relaxed">
                            {info.description}
                          </p>
                          {!state.enabled && (
                            <p className="text-xs text-ink-700 mt-1.5">
                              {state.disabledReason === "switched_off"
                                ? info.offNote
                                : describeDisabledModule(state)}
                            </p>
                          )}
                          {cascade.length > 0 && !planLocked && (
                            <p className="text-xs text-status-warning mt-1.5">
                              Also turns off{" "}
                              {cascade
                                .map((k) => HOSPITAL_MODULE_BY_KEY[k].label)
                                .join(", ")}
                              .
                            </p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                  {groupUpcoming.map((feature) => (
                    <li
                      key={`upcoming-${feature.key}`}
                      className="flex items-start gap-3 px-4 py-3.5 bg-surface-canvas"
                    >
                      <div className="pt-0.5">
                        <ToggleSwitch
                          checked={false}
                          disabled
                          ariaLabel={feature.label}
                          onChange={() => {}}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-ink-900">
                            {feature.label}
                          </span>
                          <ComingSoonBadge />
                        </div>
                        {feature.description && (
                          <p className="text-xs text-ink-500 mt-0.5 leading-relaxed">
                            {feature.description}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      {canEdit && isDirty && (
        <div className="sticky bottom-4 mt-4 flex gap-2.5 items-center bg-surface-paper border border-border rounded-lg p-3 shadow-md">
          <span className="text-xs text-ink-500 flex-1">
            {changes.length} unsaved change{changes.length > 1 ? "s" : ""}.
          </span>
          <button
            type="button"
            onClick={reset}
            disabled={updateModules.isPending}
            className="px-3.5 py-1.5 rounded-lg border border-border text-xs font-semibold text-ink-700 disabled:opacity-50"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={save}
            disabled={updateModules.isPending}
            className="flex items-center gap-1.5 bg-brand-violet hover:bg-brand-violet-hover text-white text-xs font-semibold rounded-lg px-3.5 py-1.5 transition-colors disabled:opacity-50"
          >
            {updateModules.isPending && (
              <Loader2 size={14} className="animate-spin" />
            )}
            Save changes
          </button>
        </div>
      )}

      {!canEdit && (
        <div className="mt-5 flex gap-2.5 items-start bg-status-warning-soft border border-status-warning/30 rounded-lg p-3 text-xs text-status-warning">
          <AlertTriangle size={16} className="flex-none mt-0.5" />
          <span>Only hospital admins can change features.</span>
        </div>
      )}
    </div>
  );
}

function ComingSoonBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold bg-status-warning-soft text-status-warning">
      <Sparkles size={11} />
      Coming soon
    </span>
  );
}
