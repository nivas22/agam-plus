"use client";

import { AlertTriangle, ClipboardList, Receipt, ShieldCheck, Users } from "lucide-react";
import { useParams, useRouter } from "next/navigation";

export default function SettingsHubPage() {
  const params = useParams();
  const router = useRouter();
  const hospitalId = params.id as string;

  const tiles = [
    {
      href: `/hospital/${hospitalId}/settings/team`,
      icon: <Users size={20} />,
      title: "Team",
      description: "Everyone who signs in — front desk, nurses, accountants.",
    },
    {
      href: `/hospital/${hospitalId}/settings/roles`,
      icon: <ShieldCheck size={20} />,
      title: "Roles & permissions",
      description: "What each role can do on its own, what needs approval, what it can't touch.",
    },
    {
      href: `/hospital/${hospitalId}/settings/audit`,
      icon: <ClipboardList size={20} />,
      title: "Audit trail",
      description: "Every action that changed money, a booking, or a permission.",
    },
    {
      href: `/hospital/${hospitalId}/settings/charge-catalog`,
      icon: <Receipt size={20} />,
      title: "Charge catalog",
      description: "Everything the front desk can add to a bill, and what it costs today.",
    },
  ];

  return (
    <div>
      <h1 className="text-xl font-bold text-ink-900 mb-1">Settings</h1>
      <p className="text-sm text-ink-500 mb-5">Team, roles &amp; permissions, the audit trail, and the charge catalog.</p>

      <div className="grid sm:grid-cols-3 gap-4">
        {tiles.map((tile) => (
          <button
            key={tile.href}
            type="button"
            onClick={() => router.push(tile.href)}
            className="text-left bg-surface-paper border border-border rounded-xl p-4 hover:border-brand-violet/50 hover:shadow-md transition-all"
          >
            <div className="w-9 h-9 rounded-lg bg-brand-violet-soft text-brand-violet grid place-items-center mb-3">
              {tile.icon}
            </div>
            <div className="text-sm font-bold text-ink-900">{tile.title}</div>
            <div className="text-xs text-ink-500 mt-1 leading-relaxed">{tile.description}</div>
          </button>
        ))}
      </div>

      <div className="mt-5 flex gap-2.5 items-start bg-status-warning-soft border border-status-warning/30 rounded-lg p-3 text-xs text-status-warning">
        <AlertTriangle size={16} className="flex-none mt-0.5" />
        <span>Team members sign in with their email, same as everyone else — a mobile number is stored for records only.</span>
      </div>
    </div>
  );
}
