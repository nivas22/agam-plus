// components/settings/PackageSettingsPage.tsx
"use client";

import { AlertTriangle, Loader2, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { inputClass, ToggleSwitch } from "@/components/common/EditFormControls";
import {
  computePackagePricePerVisit,
  DEFAULT_PACKAGE_SETTINGS,
  type PackageSettings,
} from "@/constants";
import {
  useHospitalPackageSettings,
  useUpdateHospitalPackageSettings,
} from "@/hooks/useHospitalPackageSettingsApi";

interface PackageSettingsPageProps {
  hospitalId: string;
  canEdit: boolean;
}

const MAX_TIERS = 6;
const MAX_VISITS = 60;
// Example fee for the preview row — just to show what the discount does.
const SAMPLE_FEE = 600;

function money(v: number): string {
  return `₹${Math.round(v).toLocaleString("en-IN")}`;
}

export default function PackageSettingsPage({
  hospitalId,
  canEdit,
}: PackageSettingsPageProps) {
  const { data, isLoading } = useHospitalPackageSettings(hospitalId);
  const updateSettings = useUpdateHospitalPackageSettings(hospitalId);

  const [form, setForm] = useState<PackageSettings>(DEFAULT_PACKAGE_SETTINGS);
  const [draftTier, setDraftTier] = useState("");

  useEffect(() => {
    if (data) setForm(data.settings);
  }, [data]);

  const isDirty =
    !!data && JSON.stringify(form) !== JSON.stringify(data.settings);

  const patch = (p: Partial<PackageSettings>) =>
    setForm((prev) => ({ ...prev, ...p }));

  const addTier = () => {
    const n = Number(draftTier);
    if (!Number.isInteger(n) || n < 1 || n > MAX_VISITS) {
      toast.error(`Enter a whole number between 1 and ${MAX_VISITS}`);
      return;
    }
    if (form.visitTiers.includes(n)) {
      toast.error("That package size is already offered");
      return;
    }
    patch({ visitTiers: [...form.visitTiers, n].sort((a, b) => a - b) });
    setDraftTier("");
  };

  const removeTier = (n: number) =>
    patch({ visitTiers: form.visitTiers.filter((t) => t !== n) });

  const save = async () => {
    if (form.visitTiers.length === 0) {
      toast.error("Offer at least one package size");
      return;
    }
    if (
      form.discountEnabled &&
      !(form.discountPercent >= 0 && form.discountPercent <= 90)
    ) {
      toast.error("Discount must be between 0% and 90%");
      return;
    }
    try {
      await updateSettings.mutateAsync(form);
      toast.success("Package settings updated");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save changes",
      );
    }
  };

  const reset = () => data && setForm(data.settings);

  const samplePrice = computePackagePricePerVisit(SAMPLE_FEE, form);

  return (
    <div>
      <h1 className="font-display tracking-tight text-xl font-bold text-ink-900 mb-1">
        Packages
      </h1>
      <p className="text-sm text-ink-500 mb-5">
        How prepaid visit packages are priced and how long they last. Changes
        apply to packages sold from now on — packages already sold keep their
        price and expiry.
      </p>

      {isLoading ? (
        <div className="bg-surface-paper border border-border rounded-xl flex items-center gap-2 text-sm text-ink-500 py-10 justify-center">
          <Loader2 size={16} className="animate-spin" />
          Loading…
        </div>
      ) : (
        <div className="space-y-4">
          {/* discount */}
          <div className="bg-surface-paper border border-border rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <div className="text-sm font-bold text-ink-900">
                  Package discount
                </div>
                <p className="text-xs text-ink-500 mt-0.5">
                  Take a percentage off the doctor&apos;s consultation fee for
                  every visit in a package. Turn off to sell packages at the
                  full fee.
                </p>
              </div>
              <ToggleSwitch
                checked={form.discountEnabled}
                disabled={!canEdit}
                onChange={(discountEnabled) => patch({ discountEnabled })}
                ariaLabel="Apply package discount"
              />
            </div>

            {form.discountEnabled && (
              <div className="mt-3 flex items-center gap-2">
                <label
                  htmlFor="package-discount"
                  className="text-xs font-semibold text-ink-700"
                >
                  Discount
                </label>
                <div className="relative w-32">
                  <input
                    id="package-discount"
                    type="number"
                    min={0}
                    max={90}
                    step={0.01}
                    value={Number.isFinite(form.discountPercent) ? form.discountPercent : ""}
                    disabled={!canEdit}
                    onChange={(e) =>
                      patch({ discountPercent: parseFloat(e.target.value) })
                    }
                    className={`${inputClass} pr-8`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-500">
                    %
                  </span>
                </div>
              </div>
            )}

            <div className="mt-3 text-xs text-ink-500 bg-surface-canvas rounded-lg px-3 py-2">
              Example: a {money(SAMPLE_FEE)} consultation is sold at{" "}
              <b className="font-mono text-ink-900">{money(samplePrice)}</b>{" "}
              per package visit
              {samplePrice < SAMPLE_FEE &&
                ` (saves ${money(SAMPLE_FEE - samplePrice)})`}
              . Prices round to the nearest ₹5.
            </div>
          </div>

          {/* sizes */}
          <div className="bg-surface-paper border border-border rounded-xl p-4">
            <div className="text-sm font-bold text-ink-900">Package sizes</div>
            <p className="text-xs text-ink-500 mt-0.5 mb-3">
              The visit counts staff can pick from when selling a package.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {form.visitTiers.map((n) => (
                <span
                  key={n}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-brand-violet/30 bg-brand-violet-soft text-brand-violet text-sm font-semibold pl-3 pr-1.5 py-1"
                >
                  {n} visits
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => removeTier(n)}
                      className="rounded p-0.5 hover:bg-brand-violet/10"
                      aria-label={`Remove ${n}-visit package`}
                    >
                      <X size={13} />
                    </button>
                  )}
                </span>
              ))}
              {canEdit && form.visitTiers.length < MAX_TIERS && (
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={1}
                    max={MAX_VISITS}
                    value={draftTier}
                    onChange={(e) => setDraftTier(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTier();
                      }
                    }}
                    placeholder="e.g. 15"
                    className={`${inputClass} w-24 py-1.5`}
                    aria-label="New package size"
                  />
                  <button
                    type="button"
                    onClick={addTier}
                    disabled={!draftTier}
                    className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-ink-700 hover:border-brand-violet hover:text-brand-violet disabled:opacity-50"
                  >
                    <Plus size={14} />
                    Add
                  </button>
                </div>
              )}
            </div>
            {form.visitTiers.length === 0 && (
              <p className="text-xs text-status-danger mt-2">
                Offer at least one package size.
              </p>
            )}
          </div>

          {/* validity */}
          <div className="bg-surface-paper border border-border rounded-xl p-4">
            <div className="text-sm font-bold text-ink-900">Validity</div>
            <p className="text-xs text-ink-500 mt-0.5 mb-3">
              How long a package stays redeemable after it&apos;s sold.
            </p>
            <select
              value={form.validityMonths}
              disabled={!canEdit}
              onChange={(e) =>
                patch({ validityMonths: Number(e.target.value) })
              }
              className={`${inputClass} w-40`}
              aria-label="Validity in months"
            >
              {Array.from({ length: 24 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {m} {m === 1 ? "month" : "months"}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {canEdit && isDirty && (
        <div className="mt-4 flex gap-2.5 items-center bg-surface-paper border border-border rounded-lg p-3">
          <span className="text-xs text-ink-500 flex-1">
            You have unsaved changes.
          </span>
          <button
            type="button"
            onClick={reset}
            disabled={updateSettings.isPending}
            className="px-3.5 py-1.5 rounded-lg border border-border text-xs font-semibold text-ink-700 disabled:opacity-50"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={save}
            disabled={updateSettings.isPending}
            className="flex items-center gap-1.5 bg-brand-violet hover:bg-brand-violet-hover text-white text-xs font-semibold rounded-lg px-3.5 py-1.5 transition-colors disabled:opacity-50"
          >
            {updateSettings.isPending && (
              <Loader2 size={14} className="animate-spin" />
            )}
            Save changes
          </button>
        </div>
      )}

      {!canEdit && (
        <div className="mt-5 flex gap-2.5 items-start bg-status-warning-soft border border-status-warning/30 rounded-lg p-3 text-xs text-status-warning">
          <AlertTriangle size={16} className="flex-none mt-0.5" />
          <span>Only hospital admins can change package settings.</span>
        </div>
      )}
    </div>
  );
}
