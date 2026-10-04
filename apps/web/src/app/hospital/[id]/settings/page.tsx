"use client";

import {
  AlertTriangle,
  CalendarOff,
  ClipboardList,
  CreditCard,
  Layers,
  MessageCircle,
  Pill,
  Receipt,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

export default function SettingsHubPage() {
  const params = useParams();
  const router = useRouter();
  const hospitalId = params.id as string;
  const { isDoctor } = useAuth();

  const categories = [
    {
      title: "Access control",
      tiles: [
        {
          href: `/hospital/${hospitalId}/settings/roles`,
          icon: <ShieldCheck size={20} />,
          title: "Roles & permissions",
          description:
            "What each role can do on its own, what needs approval, what it can't touch.",
          adminOnly: true,
        },
      ],
    },
    {
      title: "Clinical setup",
      tiles: [
        {
          href: `/hospital/${hospitalId}/settings/medicines`,
          icon: <Pill size={20} />,
          title: "Medicines",
          description: isDoctor
            ? "Browse the catalog you prescribe from, including allergy class tags."
            : "The catalog doctors prescribe from, including allergy class tags.",
          adminOnly: false,
        },
        {
          href: `/hospital/${hospitalId}/settings/medicine-packs`,
          icon: <Layers size={20} />,
          title: "Medicine packs",
          description: isDoctor
            ? "Treatment templates you can apply in one click — Fever pack, URI pack."
            : "Named bundles of medicines with preset doses for the prescription writer.",
          adminOnly: false,
        },
        {
          href: `/hospital/${hospitalId}/settings/specializations`,
          icon: <Stethoscope size={20} />,
          title: "Specializations",
          description:
            "The options offered in each doctor's specialization dropdown.",
          adminOnly: false,
        },
        {
          href: `/hospital/${hospitalId}/settings/patient-fields`,
          icon: <ClipboardList size={20} />,
          title: "Patient fields",
          description:
            "Choose what the patient form's Notes section collects, and add your own fields.",
          adminOnly: false,
        },
      ],
    },
    {
      title: "Billing & charges",
      tiles: [
        {
          href: `/hospital/${hospitalId}/settings/charge-catalog`,
          icon: <Receipt size={20} />,
          title: "Charge catalog",
          description:
            "Everything the front desk can add to a bill, and what it costs today.",
          adminOnly: true,
        },
        {
          href: `/hospital/${hospitalId}/settings/billing`,
          icon: <CreditCard size={20} />,
          title: "Billing",
          description:
            "Your subscription plan, seat usage, and payment history.",
          adminOnly: true,
        },
      ],
    },
    {
      title: "Operations",
      tiles: [
        {
          href: `/hospital/${hospitalId}/settings/hospital-holidays`,
          icon: <CalendarOff size={20} />,
          title: "Hospital holidays",
          description:
            "Set once, applies to every doctor. Individual leave stays on each doctor's own schedule.",
          adminOnly: true,
        },
        {
          href: `/hospital/${hospitalId}/settings/whatsapp`,
          icon: <MessageCircle size={20} />,
          title: "WhatsApp",
          description:
            "Let patients book and ask questions from WhatsApp. Bookings arrive as pending.",
          adminOnly: true,
        },
      ],
    },
  ]
    .map((category) => ({
      ...category,
      tiles: category.tiles.filter((tile) => !isDoctor || !tile.adminOnly),
    }))
    .filter((category) => category.tiles.length > 0);

  return (
    <div>
      <h1 className="font-display tracking-tight text-xl font-bold text-ink-900 mb-1">
        Settings
      </h1>
      <p className="text-sm text-ink-500 mb-5">
        {isDoctor
          ? "Reference material for your day-to-day work."
          : "Team, roles & permissions, the audit trail, the charge catalog, medicines, and hospital holidays."}
      </p>

      <div className="space-y-6">
        {categories.map((category) => (
          <div key={category.title}>
            <h2 className="text-xs font-bold uppercase tracking-wide text-ink-400 mb-2.5">
              {category.title}
            </h2>
            <div className="grid sm:grid-cols-3 gap-4">
              {category.tiles.map((tile) => (
                <button
                  key={tile.href}
                  type="button"
                  onClick={() => router.push(tile.href)}
                  className="text-left bg-surface-paper border border-border rounded-xl p-4 hover:border-brand-violet/50 hover:shadow-md transition-all"
                >
                  <div className="w-9 h-9 rounded-lg bg-brand-violet-soft text-brand-violet grid place-items-center mb-3">
                    {tile.icon}
                  </div>
                  <div className="text-sm font-bold text-ink-900">
                    {tile.title}
                  </div>
                  <div className="text-xs text-ink-500 mt-1 leading-relaxed">
                    {tile.description}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {!isDoctor && (
        <div className="mt-5 flex gap-2.5 items-start bg-status-warning-soft border border-status-warning/30 rounded-lg p-3 text-xs text-status-warning">
          <AlertTriangle size={16} className="flex-none mt-0.5" />
          <span>
            Team members sign in with their email, same as everyone else — a
            mobile number is stored for records only.
          </span>
        </div>
      )}
    </div>
  );
}
