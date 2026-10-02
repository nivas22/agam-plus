"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CreditCard, Loader2 } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { inputClass } from "@/components/common/EditFormControls";
import { apiUrl, fetchWithAuth } from "@/lib/api";

interface BillingSettingsPageProps {
  hospitalId: string;
}

interface Subscription {
  id: string;
  billingCycle: "monthly" | "annual";
  status:
    | "trialing"
    | "active"
    | "past_due"
    | "suspended"
    | "exempt"
    | "cancelled";
  doctorCount: number;
  staffCount: number;
  includedDoctors: number;
  includedStaff: number;
  trialEndsAt?: string;
  currentPeriodEnd: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  billingCycle: "monthly" | "annual";
  baseAmount: number;
  doctorOverageAmount: number;
  staffOverageAmount: number;
  totalAmount: number;
  status: "due" | "payment_submitted" | "paid" | "failed";
  periodStart: string;
  periodEnd: string;
  createdAt: string;
}

interface BillingSummary {
  subscription: Subscription;
  amounts: {
    baseAmount: number;
    doctorOverageAmount: number;
    staffOverageAmount: number;
    totalAmount: number;
  };
  invoices: Invoice[];
}

const STATUS_LABELS: Record<Subscription["status"], string> = {
  trialing: "Trial",
  active: "Active",
  past_due: "Payment due",
  suspended: "Suspended",
  exempt: "Exempt",
  cancelled: "Cancelled",
};

const STATUS_STYLES: Record<Subscription["status"], string> = {
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

function formatDate(date: string | undefined): string {
  if (!date) return "—";
  try {
    return format(new Date(date), "d MMM yyyy");
  } catch {
    return "—";
  }
}

async function fetchBillingSummary(
  hospitalId: string,
): Promise<BillingSummary> {
  const response = await fetchWithAuth(
    apiUrl(`/hospitals/${hospitalId}/subscription`),
  );
  if (!response.ok) throw new Error("Failed to load billing details");
  return response.json();
}

async function changePlan(
  hospitalId: string,
  billingCycle: "monthly" | "annual",
): Promise<void> {
  const response = await fetchWithAuth(
    apiUrl(`/hospitals/${hospitalId}/subscription/plan`),
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ billingCycle }),
    },
  );
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.error || error?.message || "Failed to change plan");
  }
}

async function submitPayment(
  hospitalId: string,
  invoiceId: string,
  reference: string,
): Promise<void> {
  const response = await fetchWithAuth(
    apiUrl(
      `/hospitals/${hospitalId}/subscription/invoices/${invoiceId}/submit-payment`,
    ),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reference }),
    },
  );
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(
      error?.error || error?.message || "Failed to submit payment",
    );
  }
}

export default function BillingSettingsPage({
  hospitalId,
}: BillingSettingsPageProps) {
  const queryClient = useQueryClient();
  const [reference, setReference] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["hospital", hospitalId, "subscription"],
    queryFn: () => fetchBillingSummary(hospitalId),
  });

  const planMutation = useMutation({
    mutationFn: (billingCycle: "monthly" | "annual") =>
      changePlan(hospitalId, billingCycle),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["hospital", hospitalId, "subscription"],
      });
      toast.success("Plan updated — takes effect next renewal");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const paymentMutation = useMutation({
    mutationFn: (invoiceId: string) =>
      submitPayment(hospitalId, invoiceId, reference),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["hospital", hospitalId, "subscription"],
      });
      toast.success("Payment submitted — awaiting confirmation");
      setReference("");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-violet/20 border-t-brand-violet" />
      </div>
    );
  }

  const { subscription, amounts, invoices } = data;
  const dueInvoice = invoices.find((inv) => inv.status === "due");
  const submittedInvoice = invoices.find(
    (inv) => inv.status === "payment_submitted",
  );

  return (
    <div>
      <h1 className="font-display tracking-tight text-xl font-bold text-ink-900 mb-1">
        Billing
      </h1>
      <p className="text-sm text-ink-500 mb-5">
        Your subscription plan, seat usage, and payment history.
      </p>

      <section className="bg-surface-paper rounded-xl border border-border shadow-sm p-5 md:p-6 mb-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-ink-900 font-display tracking-tight capitalize">
                {subscription.billingCycle} plan
              </h2>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_STYLES[subscription.status]}`}
              >
                {STATUS_LABELS[subscription.status]}
              </span>
            </div>
            <p className="text-sm text-ink-500 mt-0.5">
              {subscription.status === "trialing"
                ? `Trial ends ${formatDate(subscription.trialEndsAt)}`
                : `Next renewal ${formatDate(subscription.currentPeriodEnd)}`}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={
                subscription.billingCycle === "monthly" ||
                planMutation.isPending
              }
              onClick={() => planMutation.mutate("monthly")}
              className="px-3.5 py-2 rounded-lg border border-border text-sm font-medium text-ink-700 hover:bg-surface-canvas disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Switch to monthly
            </button>
            <button
              type="button"
              disabled={
                subscription.billingCycle === "annual" || planMutation.isPending
              }
              onClick={() => planMutation.mutate("annual")}
              className="px-3.5 py-2 rounded-lg border border-border text-sm font-medium text-ink-700 hover:bg-surface-canvas disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Switch to annual
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-4">
          <div className="bg-surface-canvas rounded-lg p-3">
            <div className="text-ink-500 text-xs">Doctors</div>
            <div className="font-bold text-ink-900 tabular-nums">
              {subscription.doctorCount} / {subscription.includedDoctors}{" "}
              included
            </div>
          </div>
          <div className="bg-surface-canvas rounded-lg p-3">
            <div className="text-ink-500 text-xs">Staff seats</div>
            <div className="font-bold text-ink-900 tabular-nums">
              {subscription.staffCount} / {subscription.includedStaff} included
            </div>
          </div>
        </div>

        <div className="border-t border-border pt-3 text-sm space-y-1.5">
          <div className="flex justify-between">
            <span className="text-ink-500">Base plan</span>
            <span className="text-ink-900 tabular-nums">
              {money(amounts.baseAmount)}
            </span>
          </div>
          {amounts.doctorOverageAmount > 0 && (
            <div className="flex justify-between">
              <span className="text-ink-500">Extra doctors</span>
              <span className="text-ink-900 tabular-nums">
                {money(amounts.doctorOverageAmount)}
              </span>
            </div>
          )}
          {amounts.staffOverageAmount > 0 && (
            <div className="flex justify-between">
              <span className="text-ink-500">Extra staff seats</span>
              <span className="text-ink-900 tabular-nums">
                {money(amounts.staffOverageAmount)}
              </span>
            </div>
          )}
          <div className="flex justify-between font-bold pt-1.5 border-t border-border">
            <span className="text-ink-900">Next bill</span>
            <span className="text-ink-900 tabular-nums">
              {money(amounts.totalAmount)}
            </span>
          </div>
        </div>
      </section>

      {(dueInvoice || submittedInvoice) && (
        <section className="bg-surface-paper rounded-xl border border-border shadow-sm p-5 md:p-6 mb-5">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-ink-900 flex items-center gap-2 font-display tracking-tight">
              <CreditCard className="w-5 h-5 text-brand-violet" />
              {submittedInvoice ? "Payment submitted" : "Payment due"}
            </h2>
            <p className="text-sm text-ink-500">
              Invoice {(submittedInvoice || dueInvoice)!.invoiceNumber} ·{" "}
              {money((submittedInvoice || dueInvoice)!.totalAmount)}
            </p>
          </div>

          {submittedInvoice ? (
            <p className="text-sm text-ink-500 italic">
              Awaiting confirmation from the platform team.
            </p>
          ) : (
            <div className="flex gap-2">
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="UPI / bank transaction reference"
                className={inputClass}
              />
              <button
                type="button"
                disabled={!reference.trim() || paymentMutation.isPending}
                onClick={() =>
                  dueInvoice && paymentMutation.mutate(dueInvoice.id)
                }
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-violet hover:bg-brand-violet-hover text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                {paymentMutation.isPending && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                I&apos;ve paid
              </button>
            </div>
          )}
        </section>
      )}

      <section className="bg-surface-paper rounded-xl border border-border shadow-sm p-5 md:p-6">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-ink-900 font-display tracking-tight">
            Invoice history
          </h2>
        </div>
        {invoices.length > 0 ? (
          <div className="space-y-2">
            {invoices.map((invoice) => (
              <div
                key={invoice.id}
                className="flex items-center gap-3 bg-surface-canvas rounded-xl p-3 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-ink-900">
                    {invoice.invoiceNumber}
                  </div>
                  <div className="text-xs text-ink-500">
                    {formatDate(invoice.periodStart)} –{" "}
                    {formatDate(invoice.periodEnd)}
                  </div>
                </div>
                <div className="font-mono tabular-nums text-ink-900">
                  {money(invoice.totalAmount)}
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-semibold shrink-0 ${
                    invoice.status === "paid"
                      ? "bg-status-open-soft text-status-open"
                      : invoice.status === "payment_submitted"
                        ? "bg-brand-violet-soft text-brand-violet"
                        : invoice.status === "failed"
                          ? "bg-status-danger-soft text-status-danger"
                          : "bg-status-warning-soft text-status-warning"
                  }`}
                >
                  {invoice.status.replace("_", " ")}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-500 italic">No invoices yet</p>
        )}
      </section>
    </div>
  );
}
