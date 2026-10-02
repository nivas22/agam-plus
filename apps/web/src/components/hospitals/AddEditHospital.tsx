"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ArrowLeft,
  Building2,
  CreditCard,
  Loader2,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";
import {
  Field,
  inputClass,
  ToggleSwitch,
} from "@/components/common/EditFormControls";
import { apiUrl, fetchWithAuth } from "@/lib/api";
import type { Hospital } from "@/types/auth";

interface AddEditHospitalProps {
  isNew?: boolean;
  id?: string;
}

interface HospitalMember {
  membershipId: string;
  userId: string;
  name: string | null;
  email: string | null;
  role: string;
  status: string;
  joinedAt?: string;
}

type FormState = {
  name: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  description: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  address: "",
  phone: "",
  email: "",
  website: "",
  description: "",
};

type BillingCycle = "monthly" | "annual";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function fetchHospital(id: string): Promise<Hospital> {
  const response = await fetchWithAuth(apiUrl(`/hospitals/${id}`));
  if (!response.ok) throw new Error("Failed to load hospital");
  return response.json();
}

async function createHospital(
  payload: FormState & {
    adminEmails: string[];
    billingCycle: BillingCycle;
    trialDays: number;
  },
): Promise<Hospital> {
  const body: Record<string, unknown> = {
    name: payload.name,
    address: payload.address,
    adminEmails: payload.adminEmails,
    billingCycle: payload.billingCycle,
    trialDays: payload.trialDays,
  };
  if (payload.phone) body.phone = payload.phone;
  if (payload.email) body.email = payload.email;
  if (payload.website) body.website = payload.website;
  if (payload.description) body.description = payload.description;

  const response = await fetchWithAuth(apiUrl("/hospitals"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    const detailMessage = Array.isArray(error?.details)
      ? error.details.map((d: any) => d.message).join(", ")
      : null;
    throw new Error(
      detailMessage || error?.message || "Failed to create hospital",
    );
  }

  return response.json();
}

async function updateHospital(
  id: string,
  payload: FormState,
): Promise<Hospital> {
  const response = await fetchWithAuth(apiUrl(`/hospitals/${id}`), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message || "Failed to update hospital");
  }

  return response.json();
}

async function fetchHospitalMembers(id: string): Promise<HospitalMember[]> {
  const response = await fetchWithAuth(
    apiUrl(`/platform-admin/hospitals/${id}/members`),
  );
  if (!response.ok) throw new Error("Failed to load hospital members");
  return response.json();
}

async function addHospitalMember(id: string, email: string): Promise<void> {
  const response = await fetchWithAuth(
    apiUrl(`/platform-admin/hospitals/${id}/members`),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    },
  );
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message || "Failed to add member");
  }
}

async function removeHospitalMember(
  id: string,
  membershipId: string,
): Promise<void> {
  const response = await fetchWithAuth(
    apiUrl(`/platform-admin/hospitals/${id}/members/${membershipId}`),
    {
      method: "DELETE",
    },
  );
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message || "Failed to remove member");
  }
}

async function deleteHospital(id: string): Promise<void> {
  const response = await fetchWithAuth(apiUrl(`/hospitals/${id}`), {
    method: "DELETE",
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message || "Failed to delete hospital");
  }
}

interface SubscriptionSummary {
  subscription: {
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
  };
  amounts: { totalAmount: number };
  invoices: {
    id: string;
    invoiceNumber: string;
    status: string;
    totalAmount: number;
    paymentReference?: string;
  }[];
}

async function fetchSubscriptionSummary(
  id: string,
): Promise<SubscriptionSummary> {
  const response = await fetchWithAuth(
    apiUrl(`/platform-admin/hospitals/${id}/subscription`),
  );
  if (!response.ok) throw new Error("Failed to load subscription");
  return response.json();
}

async function confirmSubscriptionPayment(invoiceId: string): Promise<void> {
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

async function setSubscriptionExempt(
  id: string,
  exempt: boolean,
): Promise<void> {
  const response = await fetchWithAuth(
    apiUrl(`/platform-admin/hospitals/${id}/subscription/exempt`),
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

function money(v: number): string {
  return `₹${Math.round(v).toLocaleString("en-IN")}`;
}

function formatAdded(createdAt: any): string {
  if (!createdAt) return "—";
  try {
    const date = new Date(createdAt);
    if (isNaN(date.getTime())) return "—";
    return format(date, "d MMM yyyy");
  } catch {
    return "—";
  }
}

export default function AddEditHospital({
  isNew = false,
  id,
}: AddEditHospitalProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<FormState>(EMPTY_FORM);
  const [initialData, setInitialData] = useState<FormState>(EMPTY_FORM);
  const [adminEmails, setAdminEmails] = useState<string[]>([]);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [trialDays, setTrialDays] = useState(14);
  const [adminEmailInput, setAdminEmailInput] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [memberEmailInput, setMemberEmailInput] = useState("");
  const [memberFormError, setMemberFormError] = useState<string | null>(null);
  const [confirmRemoveMember, setConfirmRemoveMember] =
    useState<HospitalMember | null>(null);

  const { data: hospital, isLoading: isHospitalLoading } = useQuery({
    queryKey: ["platform-admin", "hospitals", id],
    queryFn: () => fetchHospital(id as string),
    enabled: !isNew && !!id,
  });

  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ["platform-admin", "hospitals", id, "members"],
    queryFn: () => fetchHospitalMembers(id as string),
    enabled: !isNew && !!id,
  });

  const { data: subscription } = useQuery({
    queryKey: ["platform-admin", "hospitals", id, "subscription"],
    queryFn: () => fetchSubscriptionSummary(id as string),
    enabled: !isNew && !!id,
  });

  useEffect(() => {
    if (!isNew && hospital) {
      const next: FormState = {
        name: hospital.name || "",
        address: hospital.address || "",
        phone: hospital.phone || "",
        email: hospital.email || "",
        website: hospital.website || "",
        description: hospital.description || "",
      };
      setFormData(next);
      setInitialData(next);
    }
  }, [isNew, hospital]);

  const isDirty = useMemo(
    () => JSON.stringify(formData) !== JSON.stringify(initialData),
    [formData, initialData],
  );

  const createMutation = useMutation({
    mutationFn: createHospital,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["platform-admin", "hospitals"],
      });
      toast.success("Hospital added successfully!");
      router.push("/platform-admin/hospitals");
    },
    onError: (error: Error) => {
      setFormError(error.message);
      toast.error(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: FormState) => updateHospital(id as string, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["platform-admin", "hospitals"],
      });
      queryClient.invalidateQueries({
        queryKey: ["platform-admin", "hospitals", id],
      });
      toast.success("Hospital updated successfully!");
      setInitialData(formData);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteHospital(id as string),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["platform-admin", "hospitals"],
      });
      toast.success("Hospital removed");
      router.push("/platform-admin/hospitals");
    },
    onError: (error: Error) => toast.error(error.message),
    onSettled: () => setConfirmDelete(false),
  });

  const addMemberMutation = useMutation({
    mutationFn: (email: string) => addHospitalMember(id as string, email),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["platform-admin", "hospitals", id, "members"],
      });
      toast.success("Member added");
      setMemberEmailInput("");
      setMemberFormError(null);
    },
    onError: (error: Error) => setMemberFormError(error.message),
  });

  const removeMemberMutation = useMutation({
    mutationFn: (membershipId: string) =>
      removeHospitalMember(id as string, membershipId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["platform-admin", "hospitals", id, "members"],
      });
      toast.success("Member removed");
    },
    onError: (error: Error) => toast.error(error.message),
    onSettled: () => setConfirmRemoveMember(null),
  });

  const confirmPaymentMutation = useMutation({
    mutationFn: (invoiceId: string) => confirmSubscriptionPayment(invoiceId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["platform-admin", "hospitals", id, "subscription"],
      });
      toast.success("Payment confirmed");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const exemptMutation = useMutation({
    mutationFn: (exempt: boolean) =>
      setSubscriptionExempt(id as string, exempt),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["platform-admin", "hospitals", id, "subscription"],
      });
      toast.success("Billing exemption updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  function discardChanges() {
    setFormData(initialData);
  }

  function addAdminEmail() {
    const email = adminEmailInput.trim().toLowerCase();
    if (!email) return;

    if (!EMAIL_REGEX.test(email)) {
      setFormError(`"${email}" is not a valid email address`);
      return;
    }
    if (adminEmails.includes(email)) {
      setAdminEmailInput("");
      return;
    }

    setAdminEmails([...adminEmails, email]);
    setAdminEmailInput("");
    setFormError(null);
  }

  function removeAdminEmail(email: string) {
    setAdminEmails(adminEmails.filter((e) => e !== email));
  }

  function handleEmailInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addAdminEmail();
    }
  }

  function handleAddMember() {
    const email = memberEmailInput.trim().toLowerCase();
    if (!email) return;

    if (!EMAIL_REGEX.test(email)) {
      setMemberFormError(`"${email}" is not a valid email address`);
      return;
    }

    setMemberFormError(null);
    addMemberMutation.mutate(email);
  }

  function handleMemberEmailInputKeyDown(
    e: React.KeyboardEvent<HTMLInputElement>,
  ) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddMember();
    }
  }

  function handleSave() {
    setFormError(null);

    if (!formData.name.trim() || !formData.address.trim()) {
      toast.error("Please fill in Name and Address");
      return;
    }

    if (isNew) {
      if (adminEmails.length === 0) {
        setFormError("Add at least one hospital admin email");
        return;
      }
      createMutation.mutate({
        ...formData,
        adminEmails,
        billingCycle,
        trialDays,
      });
    } else {
      updateMutation.mutate(formData);
    }
  }

  const saving = createMutation.isPending || updateMutation.isPending;

  if (!isNew && isHospitalLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-canvas">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-violet mx-auto mb-4"></div>
          <p className="text-ink-700">Loading hospital information...</p>
        </div>
      </div>
    );
  }

  const displayName = formData.name || (isNew ? "New hospital" : "Hospital");

  return (
    <div className="min-h-screen bg-surface-canvas pb-28">
      <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
        <button
          onClick={() => router.push("/platform-admin/hospitals")}
          className="flex items-center gap-2 p-2 -ml-2 rounded-lg text-ink-700 hover:bg-surface-paper transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <span className="text-ink-500 text-sm">Hospitals</span>
        <span className="text-ink-500 text-sm">/</span>
        <span className="font-semibold text-ink-900 text-sm truncate">
          {displayName}
        </span>
      </div>

      <div className="max-w-4xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 items-start">
        {/* Sidebar */}
        <aside className="space-y-4 lg:sticky lg:top-4">
          <div className="bg-surface-paper rounded-xl border border-border shadow-sm p-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 bg-brand-violet-soft">
                <Building2 className="w-5 h-5 text-brand-violet" />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-ink-900 truncate">
                  {displayName}
                </div>
                <div className="text-xs text-ink-500 truncate">
                  {formData.address || "No address set"}
                </div>
              </div>
            </div>

            {!isNew && (
              <div className="mt-4 pt-4 border-t border-border space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-ink-500">Added</span>
                  <span className="text-ink-900 font-mono tabular">
                    {formatAdded(hospital?.createdAt)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {!isNew && (
            <div className="px-1 text-xs text-ink-500 space-y-2">
              <p>Changes go live as soon as you save.</p>
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="text-status-danger hover:underline font-medium"
              >
                Remove this hospital
              </button>
            </div>
          )}
        </aside>

        {/* Main content */}
        <div className="space-y-6 min-w-0">
          <section className="bg-surface-paper rounded-xl border border-border shadow-sm p-5 md:p-6">
            <div className="mb-5">
              <h2 className="text-lg font-bold text-ink-900 font-display tracking-tight">
                Hospital details
              </h2>
              <p className="text-sm text-ink-500">
                Basic information shown across the platform
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label="Name" required>
                <input
                  value={formData.name}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder="City Care Hospital"
                  className={inputClass}
                />
              </Field>
              <Field label="Address" required>
                <input
                  value={formData.address}
                  onChange={(e) => update("address", e.target.value)}
                  placeholder="Block, street, area, city"
                  className={inputClass}
                />
              </Field>
              <Field label="Phone" optional>
                <input
                  value={formData.phone}
                  onChange={(e) => update("phone", e.target.value)}
                  placeholder="98765 43210"
                  className={inputClass}
                />
              </Field>
              <Field label="Email" optional>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => update("email", e.target.value)}
                  placeholder="contact@hospital.com"
                  className={inputClass}
                />
              </Field>
              <Field label="Website" optional>
                <input
                  value={formData.website}
                  onChange={(e) => update("website", e.target.value)}
                  placeholder="https://hospital.com"
                  className={inputClass}
                />
              </Field>
              <div className="md:col-span-2">
                <Field label="Description" optional>
                  <textarea
                    value={formData.description}
                    onChange={(e) => update("description", e.target.value)}
                    rows={3}
                    placeholder="A short description of this hospital"
                    className={`${inputClass} resize-none`}
                  />
                </Field>
              </div>
            </div>
          </section>

          {!isNew && subscription && (
            <section className="bg-surface-paper rounded-xl border border-border shadow-sm p-5 md:p-6">
              <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                <div>
                  <h2 className="text-lg font-bold text-ink-900 flex items-center gap-2 font-display tracking-tight">
                    <CreditCard className="w-5 h-5 text-brand-violet" />
                    Subscription
                  </h2>
                  <p className="text-sm text-ink-500 capitalize">
                    {subscription.subscription.billingCycle} plan ·{" "}
                    {subscription.subscription.status.replace("_", " ")} ·{" "}
                    {money(subscription.amounts.totalAmount)}/
                    {subscription.subscription.billingCycle === "annual"
                      ? "yr"
                      : "mo"}{" "}
                    · {subscription.subscription.doctorCount} doctors,{" "}
                    {subscription.subscription.staffCount} staff
                  </p>
                </div>
                <div className="flex items-center gap-2 text-sm text-ink-700">
                  <span id="exempt-from-billing-label">
                    Exempt from billing
                  </span>
                  <ToggleSwitch
                    checked={subscription.subscription.status === "exempt"}
                    onChange={(value) => exemptMutation.mutate(value)}
                    disabled={exemptMutation.isPending}
                  />
                </div>
              </div>

              {subscription.invoices.some(
                (inv) => inv.status === "payment_submitted",
              ) && (
                <div className="space-y-2">
                  {subscription.invoices
                    .filter((inv) => inv.status === "payment_submitted")
                    .map((inv) => (
                      <div
                        key={inv.id}
                        className="flex items-center gap-3 bg-surface-canvas rounded-xl p-3 text-sm"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-ink-900">
                            {inv.invoiceNumber}
                          </div>
                          <div className="text-xs text-ink-500">
                            Ref: {inv.paymentReference || "—"}
                          </div>
                        </div>
                        <div className="font-mono tabular-nums text-ink-900">
                          {money(inv.totalAmount)}
                        </div>
                        <button
                          type="button"
                          onClick={() => confirmPaymentMutation.mutate(inv.id)}
                          disabled={confirmPaymentMutation.isPending}
                          className="px-3 py-1.5 rounded-lg bg-brand-violet hover:bg-brand-violet-hover text-white text-xs font-medium shrink-0 disabled:opacity-50"
                        >
                          Confirm payment
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </section>
          )}

          {!isNew && (
            <section className="bg-surface-paper rounded-xl border border-border shadow-sm p-5 md:p-6">
              <div className="mb-4">
                <h2 className="text-lg font-bold text-ink-900 flex items-center gap-2 font-display tracking-tight">
                  <Users className="w-5 h-5 text-brand-violet" />
                  Hospital members
                </h2>
                <p className="text-sm text-ink-500">
                  Everyone with a role at this hospital
                </p>
              </div>

              {membersLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-violet/20 border-t-brand-violet" />
                </div>
              ) : members.length > 0 ? (
                <div className="space-y-2">
                  {members.map((member) => (
                    <div
                      key={member.membershipId}
                      className="flex items-center gap-3 bg-surface-canvas rounded-xl p-3"
                    >
                      <div className="w-9 h-9 rounded-full bg-brand-violet-soft flex items-center justify-center flex-shrink-0">
                        <ShieldCheck className="w-4 h-4 text-brand-violet" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-ink-900 truncate">
                          {member.name || member.email || "Unnamed user"}
                        </div>
                        {member.name && member.email && (
                          <div className="text-xs text-ink-500 truncate">
                            {member.email}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-brand-violet capitalize">
                          {member.role}
                        </span>
                        <span
                          className={`text-[10px] font-medium capitalize ${
                            member.status === "approved"
                              ? "text-status-open"
                              : "text-status-warning"
                          }`}
                        >
                          {member.status}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setConfirmRemoveMember(member)}
                        className="p-2 rounded-lg text-ink-500 hover:text-status-danger hover:bg-status-danger-soft transition-colors shrink-0"
                        aria-label={`Remove ${member.name || member.email}`}
                        title="Remove member"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-ink-500 italic">No members yet</p>
              )}

              <div className="mt-4 pt-4 border-t border-border">
                <label className="flex items-center gap-1.5 text-xs font-medium text-ink-700 mb-1.5">
                  <UserPlus className="w-3.5 h-3.5 text-brand-violet" />
                  Add a hospital admin
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={memberEmailInput}
                    onChange={(e) => setMemberEmailInput(e.target.value)}
                    onKeyDown={handleMemberEmailInputKeyDown}
                    placeholder="newadmin@hospital.com"
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={handleAddMember}
                    disabled={addMemberMutation.isPending}
                    className="px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-brand-violet hover:bg-brand-violet-hover transition-all shrink-0 disabled:opacity-50"
                  >
                    {addMemberMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Add"
                    )}
                  </button>
                </div>
                {memberFormError && (
                  <p className="text-xs text-status-danger mt-2">
                    {memberFormError}
                  </p>
                )}
              </div>
            </section>
          )}

          {isNew && (
            <section className="bg-surface-paper rounded-xl border border-border shadow-sm p-5 md:p-6">
              <div className="mb-4">
                <h2 className="text-lg font-bold text-ink-900 font-display tracking-tight">
                  Subscription plan
                </h2>
                <p className="text-sm text-ink-500">
                  Includes up to 5 doctors + 1 staff seat, unlimited patients
                  &amp; appointments. Extra seats are billed as add-ons. The
                  hospital&apos;s own admin pays from Settings &gt; Billing
                  {trialDays > 0
                    ? ` after a ${trialDays}-day trial.`
                    : ", starting immediately (no trial)."}
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setBillingCycle("monthly")}
                  className={`text-left rounded-xl border p-4 transition-colors ${
                    billingCycle === "monthly"
                      ? "border-brand-violet bg-brand-violet-soft"
                      : "border-border hover:bg-surface-canvas"
                  }`}
                >
                  <div className="text-sm font-bold text-ink-900">Monthly</div>
                  <div className="text-xl font-bold text-ink-900 font-display mt-1">
                    ₹799
                    <span className="text-xs font-medium text-ink-500">
                      /month
                    </span>
                  </div>
                  <div className="text-xs text-ink-500 mt-1">
                    +₹299/extra doctor · +₹149/extra staff seat
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle("annual")}
                  className={`text-left rounded-xl border p-4 transition-colors ${
                    billingCycle === "annual"
                      ? "border-brand-violet bg-brand-violet-soft"
                      : "border-border hover:bg-surface-canvas"
                  }`}
                >
                  <div className="text-sm font-bold text-ink-900">Annual</div>
                  <div className="text-xl font-bold text-ink-900 font-display mt-1">
                    ₹7,990
                    <span className="text-xs font-medium text-ink-500">
                      /year
                    </span>
                  </div>
                  <div className="text-xs text-ink-500 mt-1">
                    +₹2,990/extra doctor · +₹1,490/extra staff seat
                  </div>
                </button>
              </div>

              <div className="mt-4">
                <Field label="Trial period (days)" optional>
                  <input
                    type="number"
                    min={0}
                    max={365}
                    value={trialDays}
                    onChange={(e) => {
                      const next = Number(e.target.value);
                      setTrialDays(
                        Number.isFinite(next)
                          ? Math.min(365, Math.max(0, next))
                          : 0,
                      );
                    }}
                    className={inputClass}
                  />
                </Field>
                <p className="text-xs text-ink-500 mt-1.5">
                  Set to 0 to skip the trial and start billing right away.
                </p>
              </div>
            </section>
          )}

          {isNew && (
            <section className="bg-surface-paper rounded-xl border border-border shadow-sm p-5 md:p-6">
              <div className="mb-4">
                <h2 className="text-lg font-bold text-ink-900 flex items-center gap-2 font-display tracking-tight">
                  <ShieldCheck className="w-5 h-5 text-brand-violet" />
                  Hospital admin email(s)
                </h2>
                <p className="text-sm text-ink-500">
                  These people become admins of this hospital. If they
                  don&apos;t have an account yet, one is created for them.
                </p>
              </div>

              <div className="flex gap-2">
                <input
                  type="email"
                  value={adminEmailInput}
                  onChange={(e) => setAdminEmailInput(e.target.value)}
                  onKeyDown={handleEmailInputKeyDown}
                  placeholder="admin@hospital.com"
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={addAdminEmail}
                  className="px-4 py-2 border border-border rounded-lg text-sm font-medium text-ink-700 hover:bg-surface-canvas transition-all shrink-0"
                >
                  Add
                </button>
              </div>

              {adminEmails.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {adminEmails.map((email) => (
                    <span
                      key={email}
                      className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-xs font-medium bg-brand-violet-soft text-brand-violet"
                    >
                      {email}
                      <button
                        type="button"
                        onClick={() => removeAdminEmail(email)}
                        className="hover:bg-brand-violet/20 rounded-full p-0.5"
                        aria-label={`Remove ${email}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {formError && (
                <p className="text-xs text-status-danger mt-3">{formError}</p>
              )}
            </section>
          )}
        </div>
      </div>

      {/* Sticky footer */}
      <div className="fixed bottom-0 inset-x-0 bg-surface-paper border-t border-border shadow-[0_-2px_8px_rgba(0,0,0,0.04)] z-30">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <span className="text-sm text-ink-500">
            {isDirty
              ? "Unsaved changes"
              : isNew
                ? "Fill in the required fields to add this hospital"
                : "No changes yet"}
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={discardChanges}
              disabled={!isDirty || saving}
              className="px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-ink-700 hover:bg-surface-canvas transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isNew ? "Clear form" : "Discard changes"}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={(!isNew && !isDirty) || saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-violet hover:bg-brand-violet-hover text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isNew ? "Add hospital" : "Save changes"}
            </button>
          </div>
        </div>
      </div>

      {confirmDelete && (
        <ConfirmDeleteModal
          data={confirmDelete}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => deleteMutation.mutate()}
          isDeleting={deleteMutation.isPending}
          title="Remove this hospital?"
          message={`This will permanently remove ${displayName} and all hospital memberships tied to it.`}
          confirmText="Remove hospital"
        />
      )}

      {confirmRemoveMember && (
        <ConfirmDeleteModal
          data={confirmRemoveMember}
          onCancel={() => setConfirmRemoveMember(null)}
          onConfirm={() =>
            removeMemberMutation.mutate(confirmRemoveMember.membershipId)
          }
          isDeleting={removeMemberMutation.isPending}
          title="Remove this member?"
          message={`This will remove ${confirmRemoveMember.name || confirmRemoveMember.email} (${confirmRemoveMember.role}) from ${displayName}.`}
          confirmText="Remove member"
        />
      )}
    </div>
  );
}
