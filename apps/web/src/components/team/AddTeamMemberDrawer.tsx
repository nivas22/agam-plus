// components/team/AddTeamMemberDrawer.tsx
"use client";

import { Loader2, X } from "lucide-react";
import { useState } from "react";
import { ApiRequestError } from "@/lib/api";
import { useCreateTeamMember } from "@/hooks/useTeamApi";
import { useRolePermissions } from "@/hooks/usePermissionsApi";
import { Field, inputClass, ToggleSwitch } from "@/components/common/EditFormControls";
import DuplicateWarningModal, { type DuplicateMatch } from "@/components/common/DuplicateWarningModal";
import { SHIFT_OPTIONS, TEAM_ROLE_OPTIONS, type TeamRole } from "@/types/team";

interface AddTeamMemberDrawerProps {
  hospitalId: string;
  onClose: () => void;
}

export default function AddTeamMemberDrawer({ hospitalId, onClose }: AddTeamMemberDrawerProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamRole>("front_desk");
  const [shift, setShift] = useState("");
  const [startDate, setStartDate] = useState("");
  const [handlesCash, setHandlesCash] = useState(false);
  const [invitedVia, setInvitedVia] = useState<"whatsapp" | "sms" | "email">("email");
  const [error, setError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateMatch[] | null>(null);

  const createMember = useCreateTeamMember(hospitalId);
  const { data: roleSummaries } = useRolePermissions(hospitalId);
  const summary = roleSummaries?.find((r) => r.role === role);

  const submit = async (confirmDuplicate = false) => {
    setError(null);
    if (!name.trim() || !phone.trim() || !email.trim()) {
      setError("Name, mobile number and email are required");
      return;
    }
    try {
      await createMember.mutateAsync({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        role,
        shift: shift || undefined,
        startDate: startDate || undefined,
        handlesCash,
        invitedVia,
        confirmDuplicate,
      });
      onClose();
    } catch (err) {
      if (err instanceof ApiRequestError && err.details?.duplicates) {
        setDuplicates(err.details.duplicates);
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to add team member");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-ink-900/35" onClick={onClose} />
      <div className="relative w-full max-w-[498px] h-full bg-surface-paper shadow-2xl flex flex-col">
        <div className="px-6 pt-5 pb-4 border-b border-border flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-ink-900 font-display tracking-tight">Add a team member</h2>
            <p className="text-xs text-ink-500 mt-1">They&apos;ll get an invite and set their own password on first sign-in.</p>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-surface-canvas text-ink-500">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {error && <div className="text-sm text-status-danger">{error}</div>}

          <Field label="Full name" required>
            <input type="text" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>

          <Field label="Mobile number" hint="Must be unique. Staff sign in with their email — this is for records and duplicate checks.">
            <div className="flex">
              <span className="grid place-items-center px-3 border border-r-0 border-border rounded-l-lg bg-surface-canvas text-sm font-mono text-ink-700">
                +91
              </span>
              <input
                type="tel"
                className={`${inputClass} rounded-l-none font-mono`}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </Field>

          <Field label="Email" required hint="Used to sign in — an invite link is sent here.">
            <input type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@cityhospital.in" />
          </Field>

          <Field label="Role">
            <div className="grid gap-2">
              {TEAM_ROLE_OPTIONS.map((opt) => {
                const active = role === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setRole(opt.value)}
                    className={`text-left border rounded-lg px-3 py-3 flex gap-3 items-start transition-colors ${
                      active ? "border-brand-violet bg-brand-violet-soft" : "border-border bg-surface-paper hover:border-brand-violet/50"
                    }`}
                  >
                    <span
                      className={`mt-0.5 w-4 h-4 rounded-full border flex-none ${active ? "border-[5px] border-brand-violet bg-white" : "border-border"}`}
                    />
                    <span>
                      <span className={`block text-sm font-semibold ${active ? "text-brand-violet" : "text-ink-900"}`}>{opt.label}</span>
                      <span className="block text-xs text-ink-500 mt-0.5 leading-snug">{opt.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            {summary && (
              <div className="mt-3 bg-surface-canvas/60 border border-border rounded-lg p-3">
                <div className="text-[11px] uppercase tracking-wide text-ink-500 font-semibold">
                  What a {TEAM_ROLE_OPTIONS.find((r) => r.value === role)?.label} will be able to do
                </div>
                <div className="flex gap-1.5 flex-wrap mt-2">
                  <span className="text-[11px] font-semibold rounded-md px-2 py-0.5 bg-status-open-soft text-status-open">
                    {summary.tally.allowed} allowed
                  </span>
                  <span className="text-[11px] font-semibold rounded-md px-2 py-0.5 bg-status-warning-soft text-status-warning">
                    {summary.tally.needsApproval} need approval
                  </span>
                  <span className="text-[11px] font-semibold rounded-md px-2 py-0.5 bg-surface-canvas text-ink-500">
                    {summary.tally.blocked} blocked
                  </span>
                </div>
              </div>
            )}
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Shift" optional>
              <select className={inputClass} value={shift} onChange={(e) => setShift(e.target.value)}>
                <option value="">Not set</option>
                {SHIFT_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Start date">
              <input type="date" className={inputClass} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Field>
          </div>

          <Field label="Cash handling">
            <div className="border border-border rounded-lg p-3 flex gap-3 items-start bg-surface-canvas/40">
              <ToggleSwitch checked={handlesCash} onChange={setHandlesCash} />
              <div>
                <div className="text-sm font-semibold text-ink-900">Handles the cash drawer</div>
                <div className="text-xs text-ink-500 mt-0.5 leading-snug">
                  Turn on only for people who take money at the desk. They&apos;ll set a 4-digit PIN on first sign-in, asked
                  again on every refund and day close.
                </div>
              </div>
            </div>
          </Field>

          <Field label="Send the invite by">
            <div className="flex gap-2 flex-wrap">
              {(["email", "whatsapp", "sms"] as const).map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => setInvitedVia(ch)}
                  className={`px-3 py-1.5 rounded-lg border text-sm font-medium capitalize ${
                    invitedVia === ch
                      ? "border-status-open bg-status-open-soft text-status-open"
                      : "border-border bg-surface-paper text-ink-700"
                  }`}
                >
                  {ch}
                </button>
              ))}
            </div>
          </Field>
        </div>

        <div className="px-6 py-4 border-t border-border flex items-center gap-3">
          <span className="text-[11px] text-ink-500">Employee ID assigned automatically</span>
          <div className="flex-1" />
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm font-semibold text-ink-700">
            Cancel
          </button>
          <button
            type="button"
            disabled={createMember.isPending}
            onClick={() => submit(false)}
            className="px-4 py-2 rounded-lg bg-brand-violet hover:bg-brand-violet-hover text-white text-sm font-semibold disabled:opacity-60 flex items-center gap-1.5"
          >
            {createMember.isPending && <Loader2 size={14} className="animate-spin" />}
            Send invite
          </button>
        </div>
      </div>

      {duplicates && (
        <DuplicateWarningModal
          entityLabel="team member"
          phone={phone}
          matches={duplicates}
          isSubmitting={createMember.isPending}
          onCancel={() => setDuplicates(null)}
          onConfirm={() => submit(true)}
        />
      )}
    </div>
  );
}
