// components/team/EditTeamMemberPage.tsx
"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  useResetTeamMemberPin,
  useTeamMember,
  useUpdateTeamMember,
  useUpdateTeamMemberStatus,
} from "@/hooks/useTeamApi";
import { useRolePermissions } from "@/hooks/usePermissionsApi";
import { Field, inputClass, ToggleSwitch } from "@/components/common/EditFormControls";
import { SHIFT_OPTIONS, TEAM_ROLE_OPTIONS, type TeamRole } from "@/types/team";

interface EditTeamMemberPageProps {
  hospitalId: string;
  memberId: string;
}

export default function EditTeamMemberPage({ hospitalId, memberId }: EditTeamMemberPageProps) {
  const router = useRouter();
  const { data: member, isLoading } = useTeamMember(memberId, hospitalId);
  const { data: roleSummaries } = useRolePermissions(hospitalId);
  const updateMember = useUpdateTeamMember(hospitalId);
  const updateStatus = useUpdateTeamMemberStatus(hospitalId);
  const resetPin = useResetTeamMemberPin(hospitalId);

  const [name, setName] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [shift, setShift] = useState<string | null>(null);
  const [handlesCash, setHandlesCash] = useState<boolean | null>(null);
  const [role, setRole] = useState<TeamRole | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (isLoading || !member) {
    return <div className="text-sm text-ink-500 py-8 text-center">Loading…</div>;
  }

  const effectiveRole = role ?? member.role;
  const currentSummary = roleSummaries?.find((r) => r.role === member.role);
  const targetSummary = roleSummaries?.find((r) => r.role === effectiveRole);

  const diff =
    effectiveRole !== member.role && currentSummary && targetSummary
      ? (() => {
          const gains = targetSummary.catalog.filter((a) => {
            const before = currentSummary.catalog.find((c) => c.key === a.key);
            return a.state === "allowed" && before?.state !== "allowed";
          });
          const loses = currentSummary.catalog.filter((a) => {
            const after = targetSummary.catalog.find((c) => c.key === a.key);
            return a.state === "allowed" && after?.state !== "allowed";
          });
          return { gains, loses };
        })()
      : null;

  const save = async () => {
    setError(null);
    try {
      await updateMember.mutateAsync({
        memberId,
        updates: {
          ...(name !== null ? { name } : {}),
          ...(phone !== null ? { phone } : {}),
          ...(email !== null ? { email } : {}),
          ...(shift !== null ? { shift } : {}),
          ...(handlesCash !== null ? { handlesCash } : {}),
          ...(role !== null && role !== member.role ? { role } : {}),
        },
      });
      router.push(`/hospital/${hospitalId}/settings/team/${memberId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save changes");
    }
  };

  return (
    <div>
      <div className="flex items-end gap-3.5 mb-4">
        <div>
          <h1 className="text-xl font-bold text-ink-900 font-display tracking-tight">Edit member</h1>
          <p className="text-sm text-ink-500 mt-0.5">
            {member.name} · <span className="font-mono">{member.employeeId}</span>
          </p>
        </div>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => router.push(`/hospital/${hospitalId}/settings/team/${memberId}`)}
          className="px-4 py-2 rounded-lg border border-border text-sm font-semibold text-ink-700"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={updateMember.isPending}
          onClick={save}
          className="px-4 py-2 rounded-lg bg-brand-violet hover:bg-brand-violet-hover text-white text-sm font-semibold disabled:opacity-60 flex items-center gap-1.5"
        >
          {updateMember.isPending && <Loader2 size={14} className="animate-spin" />}
          Save changes
        </button>
      </div>

      {error && <div className="text-sm text-status-danger mb-3">{error}</div>}

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-surface-paper border border-border rounded-xl p-4 space-y-4 h-fit">
          <h2 className="text-sm font-bold text-ink-900 font-display tracking-tight">Details</h2>
          <Field label="Full name">
            <input className={inputClass} defaultValue={member.name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Mobile number">
            <input className={`${inputClass} font-mono`} defaultValue={member.phone || ""} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field label="Email">
            <input className={inputClass} defaultValue={member.email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Shift">
            <select className={inputClass} defaultValue={member.shift || ""} onChange={(e) => setShift(e.target.value)}>
              <option value="">Not set</option>
              {SHIFT_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="space-y-4">
          <div className="bg-surface-paper border border-border rounded-xl p-4">
            <h2 className="text-sm font-bold text-ink-900 mb-3 font-display tracking-tight">Role</h2>
            <div className="grid gap-2">
              {TEAM_ROLE_OPTIONS.map((opt) => {
                const active = effectiveRole === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setRole(opt.value)}
                    className={`text-left border rounded-lg px-3 py-2.5 flex gap-2.5 items-start transition-colors ${
                      active ? "border-brand-violet bg-brand-violet-soft" : "border-border bg-surface-paper hover:border-brand-violet/50"
                    }`}
                  >
                    <span
                      className={`mt-0.5 w-4 h-4 rounded-full border flex-none ${active ? "border-[5px] border-brand-violet bg-white" : "border-border"}`}
                    />
                    <span>
                      <span className={`block text-sm font-semibold ${active ? "text-brand-violet" : "text-ink-900"}`}>{opt.label}</span>
                      <span className="block text-xs text-ink-500 mt-0.5 leading-snug">
                        {opt.value === member.role ? "Current role" : opt.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            {diff && (
              <div className="mt-3 bg-brand-violet-soft border border-brand-violet/30 rounded-lg p-3 text-xs text-brand-violet">
                <div className="font-semibold mb-2">
                  Moving {member.name.split(" ")[0]} from {member.role.replace("_", " ")} to {effectiveRole.replace("_", " ")}
                </div>
                {diff.gains.length > 0 && (
                  <div className="mb-1.5">
                    <b>Gains</b> — {diff.gains.map((a) => a.label).join(", ")}
                  </div>
                )}
                {diff.loses.length > 0 && (
                  <div>
                    <b>Loses</b> — {diff.loses.map((a) => a.label).join(", ")}
                  </div>
                )}
                {diff.gains.length === 0 && diff.loses.length === 0 && <div>No change in what they can do.</div>}
                <div className="mt-2 text-brand-violet/80">Takes effect the next time they sign in.</div>
              </div>
            )}
          </div>

          <div className="bg-surface-paper border border-border rounded-xl p-4">
            <h2 className="text-sm font-bold text-ink-900 mb-3 font-display tracking-tight">Cash handling</h2>
            <div className="border border-border rounded-lg p-3 flex gap-2.5 items-start bg-surface-canvas/40">
              <ToggleSwitch checked={handlesCash ?? member.handlesCash} onChange={setHandlesCash} />
              <div>
                <div className="text-sm font-semibold text-ink-900">Handles the cash drawer</div>
                <div className="text-xs text-ink-500 mt-0.5 leading-snug">
                  {member.pinSet ? "PIN set. Resetting it signs them out and asks for a new one." : "No PIN set yet."}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-surface-paper border border-status-danger/30 rounded-xl overflow-hidden">
            <h2 className="text-sm font-bold text-status-danger px-4 py-3 border-b border-status-danger/20 font-display tracking-tight">Careful with these</h2>
            <DangerRow
              title="Reset PIN"
              description="They'll set a new one at next sign-in."
              actionLabel="Reset PIN"
              disabled={!member.pinSet || resetPin.isPending}
              onClick={() => resetPin.mutate(memberId)}
            />
            <DangerRow
              title="Suspend access"
              description="Signs them out and blocks sign-in. Everything is kept."
              actionLabel="Suspend"
              disabled={member.status === "suspended" || updateStatus.isPending}
              onClick={() => updateStatus.mutate({ memberId, status: "suspended" })}
            />
            <DangerRow
              title="Deactivate member"
              description="For someone who has left. Their name stays on every past entry."
              actionLabel="Deactivate"
              disabled={member.status === "deactivated" || updateStatus.isPending}
              onClick={() => updateStatus.mutate({ memberId, status: "deactivated" })}
            />
            <div className="bg-surface-canvas/60 border-t border-status-danger/20 px-4 py-2.5 text-[11px] text-ink-500 flex gap-2">
              <AlertTriangle size={14} className="flex-none mt-0.5" />
              Members can&apos;t be deleted — every payment, refund and booking carries their name.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DangerRow({
  title,
  description,
  actionLabel,
  disabled,
  onClick,
}: {
  title: string;
  description: string;
  actionLabel: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <div className="flex gap-3 items-center px-4 py-3 border-t border-status-danger/20 first:border-t-0">
      <div className="flex-1">
        <div className="text-sm font-semibold text-ink-900">{title}</div>
        <div className="text-xs text-ink-500 mt-0.5">{description}</div>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className="px-3 py-1.5 rounded-lg border border-status-danger/40 text-status-danger text-xs font-semibold disabled:opacity-40"
      >
        {actionLabel}
      </button>
    </div>
  );
}
