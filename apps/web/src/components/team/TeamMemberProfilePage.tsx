// components/team/TeamMemberProfilePage.tsx
"use client";

import { useRouter } from "next/navigation";
import { useTeamMember } from "@/hooks/useTeamApi";
import { ROLE_AVATAR_COLORS, ROLE_BADGE_STYLES, ROLE_LABELS, initials } from "./roleStyles";

interface TeamMemberProfilePageProps {
  hospitalId: string;
  memberId: string;
}

const DAY_LABELS = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
];

function money(v: number): string {
  return `₹${Math.round(Math.abs(v)).toLocaleString("en-IN")}`;
}

export default function TeamMemberProfilePage({ hospitalId, memberId }: TeamMemberProfilePageProps) {
  const { data: member, isLoading } = useTeamMember(memberId, hospitalId);
  const router = useRouter();

  if (isLoading || !member) {
    return <div className="text-sm text-ink-500 py-8 text-center">Loading…</div>;
  }

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-ink-500 mb-4">
        <button onClick={() => router.push(`/hospital/${hospitalId}/settings/team`)} className="hover:underline">
          Team
        </button>
        <span>/</span>
        <span className="text-ink-900 font-semibold">{member.name}</span>
      </div>

      <div className="bg-surface-paper border border-border rounded-2xl p-5 flex gap-4 items-start">
        <span
          className="w-14 h-14 rounded-2xl grid place-items-center text-white text-lg font-bold flex-none"
          style={{ background: ROLE_AVATAR_COLORS[member.role] || "#7D849E" }}
        >
          {initials(member.name)}
        </span>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-ink-900 font-display tracking-tight">{member.name}</h1>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-sm text-ink-500">
            <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${ROLE_BADGE_STYLES[member.role]}`}>
              {ROLE_LABELS[member.role] || member.role}
            </span>
            <span>·</span>
            <span className="font-mono">{member.employeeId}</span>
            {member.phone && (
              <>
                <span>·</span>
                <span className="font-mono">{member.phone}</span>
              </>
            )}
            {member.shift && (
              <>
                <span>·</span>
                <span className="capitalize">{member.shift.replace("_", " ")} shift</span>
              </>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => router.push(`/hospital/${hospitalId}/settings/team/${memberId}/edit`)}
          className="px-4 py-2 rounded-lg bg-brand-violet hover:bg-brand-violet-hover text-white text-sm font-semibold flex-none"
        >
          Edit member
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
        <StatCard label="Collected this month" value={money(member.stats.collectedThisMonth)} sub={`${member.stats.collectedCount} payments`} />
        <StatCard label="Refunds requested" value={String(member.stats.refundsRequested)} />
        <StatCard
          label="Drawer variance"
          value={`${member.stats.drawerVarianceTotal < 0 ? "−" : ""}${money(member.stats.drawerVarianceTotal)}`}
          warn={member.stats.drawerVarianceTotal !== 0}
          sub={`across ${member.stats.drawerVarianceDays} day(s) closed`}
        />
        <StatCard label="Status" value={member.status} />
      </div>

      <div className="grid md:grid-cols-2 gap-4 mt-4">
        <div className="bg-surface-paper border border-border rounded-xl p-4">
          <h2 className="text-sm font-bold text-ink-900 mb-3 font-display tracking-tight">Details</h2>
          <dl className="text-sm divide-y divide-border">
            <Row label="Email" value={member.email} />
            <Row label="Phone" value={member.phone || "—"} mono />
            <Row label="Employee ID" value={member.employeeId} mono />
            <Row label="Cash drawer" value={member.handlesCash ? (member.pinSet ? "Yes · PIN set" : "Yes · PIN not set yet") : "No"} />
          </dl>
        </div>

        <div className="bg-surface-paper border border-border rounded-xl p-4">
          <h2 className="text-sm font-bold text-ink-900 mb-3 font-display tracking-tight">What they can do</h2>
          <div className="space-y-2">
            {Object.entries(
              member.permissions.catalog.reduce<Record<string, { allowed: number; needsApproval: number; blocked: number }>>(
                (acc, a) => {
                  acc[a.group] = acc[a.group] || { allowed: 0, needsApproval: 0, blocked: 0 };
                  if (a.state === "allowed") acc[a.group].allowed++;
                  else if (a.state === "needs_approval") acc[a.group].needsApproval++;
                  else acc[a.group].blocked++;
                  return acc;
                },
                {},
              ),
            ).map(([group, tally]) => (
              <div key={group} className="flex items-center justify-between text-sm">
                <span className="text-ink-700 capitalize">{group.replace("_", " ")}</span>
                <span className="flex gap-1.5">
                  <span className="text-[11px] font-semibold rounded-md px-1.5 py-0.5 bg-status-open-soft text-status-open">
                    {tally.allowed} allowed
                  </span>
                  {tally.needsApproval > 0 && (
                    <span className="text-[11px] font-semibold rounded-md px-1.5 py-0.5 bg-status-warning-soft text-status-warning">
                      {tally.needsApproval} needs approval
                    </span>
                  )}
                  {tally.blocked > 0 && (
                    <span className="text-[11px] font-semibold rounded-md px-1.5 py-0.5 bg-surface-canvas text-ink-500">
                      {tally.blocked} blocked
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-surface-paper border border-border rounded-xl p-4 mt-4">
        <h2 className="text-sm font-bold text-ink-900 mb-3 font-display tracking-tight">This week&apos;s attendance</h2>
        <p className="text-xs text-ink-500 mb-3">Based on sign-in activity — not a time clock.</p>
        <div className="grid grid-cols-7 gap-1.5">
          {DAY_LABELS.map((d) => {
            const present = member.attendance?.[d.key];
            return (
              <div
                key={d.key}
                className={`border rounded-lg py-2 text-center ${
                  present ? "bg-status-open-soft border-status-open/30 text-status-open" : "bg-surface-canvas/60 border-border text-ink-500"
                }`}
              >
                <div className="text-[10px] uppercase">{d.label}</div>
                <div className="text-xs font-mono mt-0.5">{present ? "In" : "—"}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className="bg-surface-paper border border-border rounded-xl p-3.5">
      <div className="text-[10.5px] uppercase tracking-wide text-ink-500 font-semibold">{label}</div>
      <div className={`text-xl font-bold mt-1 ${warn ? "text-status-warning" : "text-ink-900"}`}>{value}</div>
      {sub && <div className="text-xs text-ink-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between py-2 first:pt-0">
      <span className="text-ink-500">{label}</span>
      <span className={`font-medium text-ink-900 ${mono ? "font-mono tabular" : ""}`}>{value}</span>
    </div>
  );
}
