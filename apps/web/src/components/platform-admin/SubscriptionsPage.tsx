"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  Pencil,
  Settings2,
  Stethoscope,
  ToggleLeft,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { inputClass, ToggleSwitch } from "@/components/common/EditFormControls";
import { useFeatureCatalog } from "@/hooks/useFeatureCatalogApi";
import { apiUrl, fetchWithAuth } from "@/lib/api";
import {
  HOSPITAL_MODULE_BY_KEY,
  HOSPITAL_MODULE_GROUPS,
  HOSPITAL_MODULES,
  type HospitalModuleKey,
} from "@/lib/hospitalModules";

type BillingCycle = "monthly" | "annual";
type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "suspended"
  | "exempt"
  | "cancelled";
type FeatureKey = HospitalModuleKey;

interface SubscriptionRow {
  hospitalId: string;
  hospitalName: string;
  billingCycle: BillingCycle;
  status: SubscriptionStatus;
  doctorCount: number;
  staffCount: number;
  totalAmount: number;
  // Only an explicit false withholds a module; missing means granted.
  features: Partial<Record<FeatureKey, boolean>>;
  pendingInvoice: {
    id: string;
    invoiceNumber: string;
    status: string;
    totalAmount: number;
    paymentReference?: string;
  } | null;
}

interface PlanConfig {
  includedDoctors: number;
  includedStaff: number;
  basePriceMonthly: number;
  basePriceAnnual: number;
  doctorAddonPriceMonthly: number;
  doctorAddonPriceAnnual: number;
  staffAddonPriceMonthly: number;
  staffAddonPriceAnnual: number;
}

const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  trialing: "Trial",
  active: "Active",
  past_due: "Payment due",
  suspended: "Suspended",
  exempt: "Exempt",
  cancelled: "Cancelled",
};

const STATUS_STYLES: Record<SubscriptionStatus, string> = {
  trialing: "bg-brand-violet-soft text-brand-violet",
  active: "bg-status-open-soft text-status-open",
  past_due: "bg-status-warning-soft text-status-warning",
  suspended: "bg-status-danger-soft text-status-danger",
  exempt: "bg-surface-canvas text-ink-700",
  cancelled: "bg-surface-canvas text-ink-500",
};

function money(v: number): string {
  return `₹${Math.round(v).toLocaleString("en-IN")}`;
}

async function fetchSubscriptions(): Promise<SubscriptionRow[]> {
  const response = await fetchWithAuth(apiUrl("/platform-admin/subscriptions"));
  if (!response.ok) throw new Error("Failed to load subscriptions");
  return response.json();
}

async function fetchPlanConfig(): Promise<PlanConfig> {
  const response = await fetchWithAuth(
    apiUrl("/platform-admin/subscription-plan-config"),
  );
  if (!response.ok) throw new Error("Failed to load plan pricing");
  return response.json();
}

async function updatePlanConfig(data: PlanConfig): Promise<void> {
  const response = await fetchWithAuth(
    apiUrl("/platform-admin/subscription-plan-config"),
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
  );
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(
      error?.error || error?.message || "Failed to update plan pricing",
    );
  }
}

async function confirmPayment(invoiceId: string): Promise<void> {
  const response = await fetchWithAuth(
    apiUrl(
      `/platform-admin/subscriptions/invoices/${invoiceId}/confirm-payment`,
    ),
    {
      method: "POST",
    },
  );
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(
      error?.error || error?.message || "Failed to confirm payment",
    );
  }
}

async function setExempt(hospitalId: string, exempt: boolean): Promise<void> {
  const response = await fetchWithAuth(
    apiUrl(`/platform-admin/hospitals/${hospitalId}/subscription/exempt`),
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exempt }),
    },
  );
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(
      error?.error || error?.message || "Failed to update billing exemption",
    );
  }
}

async function setCancelled(
  hospitalId: string,
  cancelled: boolean,
): Promise<void> {
  const response = await fetchWithAuth(
    apiUrl(`/platform-admin/hospitals/${hospitalId}/subscription/cancel`),
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cancelled }),
    },
  );
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(
      error?.error || error?.message || "Failed to update subscription",
    );
  }
}

async function setFeature(
  hospitalId: string,
  feature: FeatureKey,
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

type Tab = "overview" | "pricing" | "features";

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "pricing", label: "Plan pricing" },
  { key: "features", label: "Features" },
];

export default function SubscriptionsPage() {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <div>
      <h1 className="font-display tracking-tight text-xl font-bold text-ink-900 mb-1">
        Subscriptions
      </h1>
      <p className="text-sm text-ink-500 mb-5">
        Billing status across every hospital, plan pricing, and per-hospital
        feature access.
      </p>

      <div className="flex gap-2 mb-5">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key
                ? "bg-brand-violet text-white"
                : "bg-surface-paper border border-border text-ink-700 hover:bg-surface-canvas"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab />}
      {tab === "pricing" && <PricingTab />}
      {tab === "features" && <FeaturesTab />}
    </div>
  );
}

function ConfirmPaymentButton({
  invoice,
  onConfirm,
  disabled,
}: {
  invoice: NonNullable<SubscriptionRow["pendingInvoice"]>;
  onConfirm: (invoiceId: string) => void;
  disabled: boolean;
}) {
  const awaitingSubmission = invoice.status !== "payment_submitted";

  return (
    <button
      type="button"
      onClick={() => onConfirm(invoice.id)}
      disabled={disabled || awaitingSubmission}
      title={
        awaitingSubmission
          ? "Awaiting the hospital to submit a payment reference"
          : undefined
      }
      className="px-3 py-1.5 rounded-lg bg-brand-violet hover:bg-brand-violet-hover text-white text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
    >
      Confirm {money(invoice.totalAmount)}
    </button>
  );
}

function OverviewTab() {
  const queryClient = useQueryClient();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["platform-admin", "subscriptions"],
    queryFn: fetchSubscriptions,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: ["platform-admin", "subscriptions"],
    });

  const confirmMutation = useMutation({
    mutationFn: (invoiceId: string) => confirmPayment(invoiceId),
    onSuccess: () => {
      invalidate();
      toast.success("Payment confirmed");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const exemptMutation = useMutation({
    mutationFn: ({
      hospitalId,
      exempt,
    }: {
      hospitalId: string;
      exempt: boolean;
    }) => setExempt(hospitalId, exempt),
    onSuccess: () => {
      invalidate();
      toast.success("Billing exemption updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const cancelMutation = useMutation({
    mutationFn: ({
      hospitalId,
      cancelled,
    }: {
      hospitalId: string;
      cancelled: boolean;
    }) => setCancelled(hospitalId, cancelled),
    onSuccess: () => {
      invalidate();
      toast.success("Subscription updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-violet/20 border-t-brand-violet" />
      </div>
    );
  }

  return (
    <section className="bg-surface-paper rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-ink-500 uppercase tracking-wide">
              <th className="px-4 py-3 font-semibold">Hospital</th>
              <th className="px-4 py-3 font-semibold">Plan</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Seats</th>
              <th className="px-4 py-3 font-semibold">Next bill</th>
              <th className="px-4 py-3 font-semibold">Pending payment</th>
              <th className="px-4 py-3 font-semibold text-right">Exempt</th>
              <th className="px-4 py-3 font-semibold text-right">Cancelled</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.hospitalId}
                className="border-b border-border last:border-0"
              >
                <td className="px-4 py-3 font-medium text-ink-900">
                  {row.hospitalName}
                </td>
                <td className="px-4 py-3 text-ink-700 capitalize">
                  {row.billingCycle}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_STYLES[row.status]}`}
                  >
                    {STATUS_LABELS[row.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-ink-700 tabular-nums">
                  {row.doctorCount} doctors, {row.staffCount} staff
                </td>
                <td className="px-4 py-3 text-ink-900 font-mono tabular-nums">
                  {money(row.totalAmount)}
                </td>
                <td className="px-4 py-3">
                  {row.pendingInvoice ? (
                    <ConfirmPaymentButton
                      invoice={row.pendingInvoice}
                      onConfirm={(invoiceId) =>
                        confirmMutation.mutate(invoiceId)
                      }
                      disabled={confirmMutation.isPending}
                    />
                  ) : (
                    <span className="text-ink-500 text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <ToggleSwitch
                    checked={row.status === "exempt"}
                    onChange={(value) =>
                      exemptMutation.mutate({
                        hospitalId: row.hospitalId,
                        exempt: value,
                      })
                    }
                    disabled={exemptMutation.isPending}
                  />
                </td>
                <td className="px-4 py-3 text-right">
                  <ToggleSwitch
                    checked={row.status === "cancelled"}
                    onChange={(value) =>
                      cancelMutation.mutate({
                        hospitalId: row.hospitalId,
                        cancelled: value,
                      })
                    }
                    disabled={cancelMutation.isPending}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && (
        <p className="text-sm text-ink-500 italic px-4 py-8 text-center">
          No hospitals yet
        </p>
      )}
    </section>
  );
}

const PRICING_FIELD_GROUPS: {
  title: string;
  fields: { key: keyof PlanConfig; label: string }[];
}[] = [
  {
    title: "Included seats",
    fields: [
      { key: "includedDoctors", label: "Included doctors" },
      { key: "includedStaff", label: "Included staff seats" },
    ],
  },
  {
    title: "Base price",
    fields: [
      { key: "basePriceMonthly", label: "Monthly (₹)" },
      { key: "basePriceAnnual", label: "Annual (₹)" },
    ],
  },
  {
    title: "Extra doctor",
    fields: [
      { key: "doctorAddonPriceMonthly", label: "Monthly (₹)" },
      { key: "doctorAddonPriceAnnual", label: "Annual (₹)" },
    ],
  },
  {
    title: "Extra staff seat",
    fields: [
      { key: "staffAddonPriceMonthly", label: "Monthly (₹)" },
      { key: "staffAddonPriceAnnual", label: "Annual (₹)" },
    ],
  },
];

function PricingTab() {
  const [editing, setEditing] = useState(false);

  const { data: config, isLoading } = useQuery({
    queryKey: ["platform-admin", "subscription-plan-config"],
    queryFn: fetchPlanConfig,
  });

  if (isLoading || !config) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-violet/20 border-t-brand-violet" />
      </div>
    );
  }

  return (
    <section className="bg-surface-paper rounded-xl border border-border shadow-sm p-5 md:p-6">
      <div className="mb-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-ink-900 flex items-center gap-2 font-display tracking-tight">
            <Settings2 className="w-5 h-5 text-brand-violet" />
            Plan pricing
          </h2>
          <p className="text-sm text-ink-500">
            Only affects new hospitals and plan changes from now on — existing
            subscriptions keep the price they were sold at.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="self-start flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-surface-paper hover:bg-surface-canvas text-ink-700 text-sm font-medium transition-colors"
        >
          <Pencil className="w-4 h-4" />
          Edit pricing
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <PlanCard cycle="monthly" config={config} />
        <PlanCard cycle="annual" config={config} />
      </div>

      {editing && (
        <EditPricingModal config={config} onClose={() => setEditing(false)} />
      )}
    </section>
  );
}

function PlanCard({
  cycle,
  config,
}: {
  cycle: BillingCycle;
  config: PlanConfig;
}) {
  const isAnnual = cycle === "annual";
  const per = isAnnual ? "/ year" : "/ month";
  const base = isAnnual ? config.basePriceAnnual : config.basePriceMonthly;
  const doctor = isAnnual
    ? config.doctorAddonPriceAnnual
    : config.doctorAddonPriceMonthly;
  const staff = isAnnual
    ? config.staffAddonPriceAnnual
    : config.staffAddonPriceMonthly;

  const yearlyAtMonthly = config.basePriceMonthly * 12;
  const savings = yearlyAtMonthly - config.basePriceAnnual;
  const savingsPct =
    yearlyAtMonthly > 0 ? Math.round((savings / yearlyAtMonthly) * 100) : 0;

  // Worked example: a hospital two doctors and two staff over the included seats.
  const exampleDoctors = config.includedDoctors + 2;
  const exampleStaff = config.includedStaff + 2;
  const exampleTotal = base + 2 * doctor + 2 * staff;

  return (
    <div
      className={`rounded-xl border p-5 flex flex-col ${
        isAnnual
          ? "border-brand-violet/40 bg-brand-violet-soft/30"
          : "border-border"
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-xs font-bold uppercase tracking-wide text-ink-500">
          {isAnnual ? "Annual plan" : "Monthly plan"}
        </span>
        {isAnnual && savings > 0 && (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-status-open-soft text-status-open">
            Save {savingsPct}% vs monthly
          </span>
        )}
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className="font-display text-3xl font-bold text-ink-900 tabular-nums">
          {money(base)}
        </span>
        <span className="text-sm text-ink-500">{per}</span>
      </div>
      <p className="text-xs text-ink-500 mt-1 tabular-nums">
        {isAnnual ? (
          <>
            ≈ {money(config.basePriceAnnual / 12)} / month
            {savings > 0 && <> · saves {money(savings)} a year</>}
          </>
        ) : (
          <>{money(yearlyAtMonthly)} over a year</>
        )}
      </p>

      <div className="mt-4 pt-4 border-t border-border space-y-2 text-sm">
        <p className="text-xs font-semibold text-ink-500">Includes</p>
        <div className="flex items-center gap-2 text-ink-700">
          <Stethoscope className="w-4 h-4 text-brand-violet" />
          {config.includedDoctors} doctor
          {config.includedDoctors === 1 ? "" : "s"}
        </div>
        <div className="flex items-center gap-2 text-ink-700">
          <Users className="w-4 h-4 text-brand-violet" />
          {config.includedStaff} staff seat
          {config.includedStaff === 1 ? "" : "s"}
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-border space-y-2 text-sm">
        <p className="text-xs font-semibold text-ink-500">Add-ons</p>
        <div className="flex justify-between gap-3 text-ink-700">
          <span>Each extra doctor</span>
          <span className="font-mono tabular-nums text-ink-900">
            + {money(doctor)} {per}
          </span>
        </div>
        <div className="flex justify-between gap-3 text-ink-700">
          <span>Each extra staff seat</span>
          <span className="font-mono tabular-nums text-ink-900">
            + {money(staff)} {per}
          </span>
        </div>
      </div>

      <div className="mt-auto pt-4">
        <div className="rounded-lg bg-surface-canvas px-3 py-2.5 text-xs text-ink-500">
          <p className="mb-1">
            Example — {exampleDoctors} doctors, {exampleStaff} staff
          </p>
          <p className="font-mono tabular-nums text-ink-700">
            {money(base)} + 2 × {money(doctor)} + 2 × {money(staff)} ={" "}
            <span className="font-semibold text-ink-900">
              {money(exampleTotal)}
            </span>{" "}
            {per}
          </p>
        </div>
      </div>
    </div>
  );
}

function EditPricingModal({
  config,
  onClose,
}: {
  config: PlanConfig;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<PlanConfig>(config);

  const dirty = (Object.keys(config) as (keyof PlanConfig)[]).some(
    (key) => form[key] !== config[key],
  );

  const saveMutation = useMutation({
    mutationFn: (payload: PlanConfig) => updatePlanConfig(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["platform-admin", "subscription-plan-config"],
      });
      toast.success(
        "Plan pricing updated — applies to new subscriptions and plan changes from now on",
      );
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const close = () => !saveMutation.isPending && onClose();

  function update<K extends keyof PlanConfig>(key: K, value: number) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div
      className="fixed inset-0 bg-trace-background bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && close()}
      onKeyDown={(e) => e.key === "Escape" && close()}
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-surface-paper rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-start justify-between gap-3 mb-1">
          <h2 className="font-display tracking-tight text-lg font-semibold text-ink-900">
            Edit plan pricing
          </h2>
          <button
            type="button"
            onClick={close}
            className="p-1 rounded-lg text-ink-500 hover:bg-surface-canvas"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-ink-500 mb-5">
          Only affects new hospitals and plan changes from now on — existing
          subscriptions keep the price they were sold at.
        </p>

        <div className="space-y-5">
          {PRICING_FIELD_GROUPS.map((group) => (
            <div key={group.title}>
              <p className="text-xs font-bold uppercase tracking-wide text-ink-500 mb-2">
                {group.title}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {group.fields.map((field) => (
                  <label key={field.key} className="block">
                    <span className="text-xs font-medium text-ink-700 mb-1 block">
                      {field.label}
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={form[field.key]}
                      onChange={(e) =>
                        update(field.key, Number(e.target.value))
                      }
                      className={inputClass}
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={close}
            className="px-5 py-2.5 rounded-lg border border-border text-ink-700 text-sm font-medium hover:bg-surface-canvas transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!dirty || saveMutation.isPending}
            onClick={() => saveMutation.mutate(form)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-violet hover:bg-brand-violet-hover text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saveMutation.isPending && (
              <Loader2 className="w-4 h-4 animate-spin" />
            )}
            Save pricing
          </button>
        </div>
      </div>
    </div>
  );
}

function FeaturesTab() {
  const queryClient = useQueryClient();
  const [hospitalId, setHospitalId] = useState<string>("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["platform-admin", "subscriptions"],
    queryFn: fetchSubscriptions,
  });
  const { data: catalog } = useFeatureCatalog();

  const featureMutation = useMutation({
    mutationFn: ({
      hospitalId,
      feature,
      enabled,
    }: {
      hospitalId: string;
      feature: FeatureKey;
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

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-violet/20 border-t-brand-violet" />
      </div>
    );
  }

  const row = rows.find((r) => r.hospitalId === hospitalId) ?? rows[0];
  const isGranted = (key: FeatureKey) => row?.features?.[key] !== false;
  const withheldCount = row
    ? HOSPITAL_MODULES.filter((m) => !isGranted(m.key)).length
    : 0;

  return (
    <section className="bg-surface-paper rounded-xl border border-border shadow-sm overflow-hidden">
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

      {rows.length === 0 && (
        <p className="text-sm text-ink-500 italic px-4 py-8 text-center">
          No hospitals yet
        </p>
      )}
    </section>
  );
}
