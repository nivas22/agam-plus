// components/team/TeamPage.tsx
"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTeamMembers } from "@/hooks/useTeamApi";
import type { TeamMember } from "@/types/team";
import AddTeamMemberDrawer from "./AddTeamMemberDrawer";
import { ROLE_AVATAR_COLORS, ROLE_BADGE_STYLES, ROLE_LABELS, initials } from "./roleStyles";

interface TeamPageProps {
  hospitalId: string;
}

const STATUS_STYLES: Record<string, string> = {
  active: "text-status-open",
  invited: "text-status-warning",
  suspended: "text-status-warning",
  deactivated: "text-ink-500",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  invited: "Invited",
  suspended: "Suspended",
  deactivated: "Deactivated",
};

export default function TeamPage({ hospitalId }: TeamPageProps) {
  const { data, isLoading } = useTeamMembers(hospitalId);
  const [showAddDrawer, setShowAddDrawer] = useState(false);
  const router = useRouter();
  const members: TeamMember[] = data?.members || [];

  return (
    <div>
      <div className="flex items-end gap-3.5 mb-4">
        <div>
          <h1 className="text-xl font-bold text-ink-900">Team</h1>
          <p className="text-sm text-ink-500 mt-0.5">
            Everyone who signs in. Doctors are managed separately under Doctors.
          </p>
        </div>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setShowAddDrawer(true)}
          className="flex items-center gap-1.5 bg-brand-violet hover:bg-brand-violet-hover text-white text-sm font-semibold rounded-lg px-4 py-2.5 transition-colors"
        >
          <Plus size={16} />
          Add member
        </button>
      </div>

      <div className="bg-surface-paper border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-canvas/60 border-b border-border">
                {["Member", "Role", "Shift", "Handles cash", "Status", ""].map((h) => (
                  <th
                    key={h}
                    className="text-left text-[10.5px] uppercase tracking-wide text-ink-500 font-semibold px-4 py-2.5 whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-ink-500">
                    Loading team…
                  </td>
                </tr>
              )}
              {!isLoading && members.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-ink-500">
                    No team members yet — add your first one.
                  </td>
                </tr>
              )}
              {members.map((m) => (
                <tr
                  key={m.id}
                  className="border-b border-border last:border-0 hover:bg-surface-canvas/40 cursor-pointer"
                  onClick={() => router.push(`/hospital/${hospitalId}/settings/team/${m.id}`)}
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-8 h-8 rounded-lg grid place-items-center text-white text-xs font-bold flex-shrink-0"
                        style={{ background: ROLE_AVATAR_COLORS[m.role] || "#7D849E" }}
                      >
                        {initials(m.name)}
                      </span>
                      <span>
                        <span className="block font-medium text-ink-900">{m.name}</span>
                        <span className="block text-[11px] text-ink-500 font-mono">{m.phone || m.email}</span>
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold ${ROLE_BADGE_STYLES[m.role] || "bg-surface-canvas text-ink-700"}`}
                    >
                      {ROLE_LABELS[m.role] || m.role}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-ink-700 whitespace-nowrap">
                    {m.shift ? m.shift.replace("_", " ") : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-ink-700 whitespace-nowrap">
                    {m.handlesCash ? `Yes${m.pinSet ? " · PIN set" : ""}` : "No"}
                  </td>
                  <td className={`px-4 py-2.5 font-medium whitespace-nowrap ${STATUS_STYLES[m.status]}`}>
                    {STATUS_LABELS[m.status] || m.status}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className="text-xs font-semibold text-brand-violet">Manage</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAddDrawer && (
        <AddTeamMemberDrawer hospitalId={hospitalId} onClose={() => setShowAddDrawer(false)} />
      )}
    </div>
  );
}
