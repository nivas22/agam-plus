// components/roles/RolesPermissionsPage.tsx
"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useRolePermissions, useUpdateRolePermissions } from "@/hooks/usePermissionsApi";
import { GROUP_LABELS, ROLE_LABELS, type PermissionState } from "@/types/permissions";

interface RolesPermissionsPageProps {
  hospitalId: string;
}

const STATE_LABELS: Record<PermissionState, string> = {
  allowed: "Allowed",
  needs_approval: "Needs approval",
  blocked: "Blocked",
};

const STATE_ORDER: PermissionState[] = ["allowed", "needs_approval", "blocked"];

export default function RolesPermissionsPage({ hospitalId }: RolesPermissionsPageProps) {
  const { data: roles, isLoading } = useRolePermissions(hospitalId);
  const updatePermissions = useUpdateRolePermissions(hospitalId);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [localOverrides, setLocalOverrides] = useState<Record<string, PermissionState>>({});
  const [discountCap, setDiscountCap] = useState<number | undefined>(undefined);
  const [saved, setSaved] = useState(false);

  const editableRoles = (roles || []).filter((r) => r.editable);
  const fixedRoles = (roles || []).filter((r) => !r.editable);
  const active = (roles || []).find((r) => r.role === (selectedRole || editableRoles[0]?.role));

  useEffect(() => {
    if (!active) return;
    setLocalOverrides(Object.fromEntries(active.catalog.map((a) => [a.key, a.state])));
    setDiscountCap(active.discountCapAmount);
  }, [active?.role]);

  if (isLoading || !active) {
    return <div className="text-sm text-ink-500 py-8 text-center">Loading…</div>;
  }

  const grouped = active.catalog.reduce<Record<string, typeof active.catalog>>((acc, a) => {
    acc[a.group] = acc[a.group] || [];
    acc[a.group].push(a);
    return acc;
  }, {});

  const save = async () => {
    setSaved(false);
    await updatePermissions.mutateAsync({ role: active.role, overrides: localOverrides, discountCapAmount: discountCap });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div>
      <div className="flex items-end gap-3.5 mb-4">
        <div>
          <h1 className="text-xl font-bold text-ink-900">Roles &amp; permissions</h1>
          <p className="text-sm text-ink-500 mt-0.5">
            What each role can do on its own, what needs a second pair of eyes, and what it can&apos;t touch.
          </p>
        </div>
        <div className="flex-1" />
        {active.editable && (
          <button
            type="button"
            onClick={save}
            disabled={updatePermissions.isPending}
            className="px-4 py-2 rounded-lg bg-brand-violet hover:bg-brand-violet-hover text-white text-sm font-semibold disabled:opacity-60 flex items-center gap-1.5"
          >
            {updatePermissions.isPending && <Loader2 size={14} className="animate-spin" />}
            Save changes
          </button>
        )}
      </div>

      {saved && <div className="mb-3 text-sm text-status-open font-medium">Saved.</div>}

      <div className="grid md:grid-cols-[260px_1fr] gap-4 items-start">
        <div className="bg-surface-paper border border-border rounded-xl overflow-hidden">
          {fixedRoles.map((r) => (
            <div key={r.role} className="px-4 py-3 border-b border-border last:border-0 text-sm text-ink-500">
              <span className="font-semibold text-ink-900">{ROLE_LABELS[r.role] || r.role}</span>
              <div className="text-xs mt-0.5">Always full access</div>
            </div>
          ))}
          {editableRoles.map((r) => (
            <button
              key={r.role}
              type="button"
              onClick={() => setSelectedRole(r.role)}
              className={`w-full text-left px-4 py-3 border-b border-border last:border-0 transition-colors ${
                active.role === r.role ? "bg-brand-violet-soft" : "hover:bg-surface-canvas"
              }`}
            >
              <span className={`text-sm font-semibold ${active.role === r.role ? "text-brand-violet" : "text-ink-900"}`}>
                {ROLE_LABELS[r.role] || r.role}
              </span>
              <div className="flex gap-1.5 flex-wrap mt-1.5">
                <span className="text-[10.5px] font-semibold rounded px-1.5 py-0.5 bg-status-open-soft text-status-open">
                  {r.tally.allowed} allowed
                </span>
                <span className="text-[10.5px] font-semibold rounded px-1.5 py-0.5 bg-status-warning-soft text-status-warning">
                  {r.tally.needsApproval} needs approval
                </span>
                <span className="text-[10.5px] font-semibold rounded px-1.5 py-0.5 bg-surface-canvas text-ink-500">
                  {r.tally.blocked} blocked
                </span>
              </div>
            </button>
          ))}
        </div>

        <div className="bg-surface-paper border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-bold text-ink-900">What {ROLE_LABELS[active.role] || active.role} can do</h2>
            <span className="text-[11px] text-ink-500">Changes apply at their next sign-in</span>
          </div>

          {Object.entries(grouped).map(([group, actions]) => (
            <div key={group}>
              <div className="px-4 py-2 text-[10.5px] uppercase tracking-wide text-ink-500 font-semibold bg-surface-canvas/50 border-b border-border">
                {GROUP_LABELS[group] || group}
              </div>
              {actions.map((a) => {
                const state = localOverrides[a.key] ?? a.state;
                return (
                  <div key={a.key} className="px-4 py-3 border-b border-border last:border-0">
                    <div className="flex items-center gap-4 justify-between">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-ink-900">{a.label}</div>
                        <div className="text-xs text-ink-500">{a.description}</div>
                      </div>
                      <div className="flex bg-surface-canvas border border-border rounded-lg p-0.5 gap-0.5 flex-none">
                        {STATE_ORDER.map((s) => (
                          <button
                            key={s}
                            type="button"
                            disabled={!active.editable}
                            onClick={() =>
                              setLocalOverrides((prev) => ({ ...prev, [a.key]: s }))
                            }
                            className={`px-2.5 py-1 rounded-md text-[11.5px] font-medium transition-colors disabled:opacity-60 ${
                              state === s
                                ? s === "allowed"
                                  ? "bg-surface-paper text-status-open shadow-sm font-semibold"
                                  : s === "blocked"
                                    ? "bg-surface-paper text-status-danger shadow-sm font-semibold"
                                    : "bg-surface-paper text-status-warning shadow-sm font-semibold"
                                : "text-ink-500"
                            }`}
                          >
                            {STATE_LABELS[s]}
                          </button>
                        ))}
                      </div>
                    </div>

                    {a.key === "apply_discount" && state === "needs_approval" && (
                      <div className="mt-2.5 flex items-center gap-2 bg-status-warning-soft border border-status-warning/30 rounded-lg px-3 py-2 text-xs text-status-warning">
                        Free up to
                        <input
                          type="number"
                          className="w-20 px-2 py-1 rounded border border-status-warning/40 bg-white font-mono text-xs"
                          value={discountCap ?? ""}
                          onChange={(e) => setDiscountCap(e.target.value ? Number(e.target.value) : undefined)}
                        />
                        — anything larger waits for an admin.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 bg-surface-paper border-l-4 border-brand-violet rounded-lg p-3 text-xs text-ink-700 leading-relaxed">
        <b className="text-ink-900">Why three states instead of a checkbox.</b> If refunds are simply blocked, the desk
        calls an admin who logs in and does it — and the log records the wrong person. &quot;Needs approval&quot; lets
        staff raise it with the patient still there, and records both names: who asked, and who agreed.
      </div>
    </div>
  );
}
