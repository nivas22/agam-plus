// components/reports/ReportsLayout.tsx
"use client";

import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

interface ReportLink {
  key: string;
  label: string;
  path: string;
  soon?: boolean;
}

const REPORT_LINKS: ReportLink[] = [
  { key: "daily-collection", label: "Daily collection", path: "" },
  { key: "doctor-revenue", label: "Doctor revenue", path: "/doctor-revenue" },
  { key: "dues-aging", label: "Dues aging", path: "/dues-aging" },
  { key: "no-shows", label: "No-shows", path: "/no-shows" },
  {
    key: "package-liability",
    label: "Package liability",
    path: "/package-liability",
    soon: true,
  },
  {
    key: "staff-activity",
    label: "Staff activity",
    path: "/staff-activity",
    soon: true,
  },
];

interface ReportsLayoutProps {
  hospitalId: string;
  children: React.ReactNode;
}

// A doctor only ever sees their own numbers, so hospital-wide cash/AR
// reports (daily collection, dues aging) stay off their nav entirely.
const DOCTOR_REPORT_KEYS = new Set(["doctor-revenue", "no-shows"]);

export default function ReportsLayout({
  hospitalId,
  children,
}: ReportsLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isDoctor } = useAuth();
  const basePath = `/hospital/${hospitalId}/reports`;
  const links = isDoctor
    ? REPORT_LINKS.filter((link) => DOCTOR_REPORT_KEYS.has(link.key))
    : REPORT_LINKS;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[212px_minmax(0,1fr)] gap-4 items-start">
      <div className="bg-surface-paper border border-border rounded-xl overflow-hidden">
        <nav>
          {links.map((link) => {
            const href = `${basePath}${link.path}`;
            const active = pathname === href;

            if (link.soon) {
              return (
                <div
                  key={link.key}
                  className="flex items-center justify-between gap-2 px-3.5 py-2.5 text-sm text-ink-500/50 border-t border-border first:border-t-0 cursor-not-allowed"
                  aria-disabled="true"
                >
                  <span>{link.label}</span>
                  <span className="text-[9px] font-semibold uppercase tracking-wide text-ink-500/60">
                    Soon
                  </span>
                </div>
              );
            }

            return (
              <button
                key={link.key}
                type="button"
                onClick={() => router.push(href)}
                className={`w-full text-left px-3.5 py-2.5 text-sm border-t border-border first:border-t-0 transition-colors ${
                  active
                    ? "bg-brand-violet-soft text-brand-violet font-semibold"
                    : "text-ink-700 hover:bg-surface-canvas"
                }`}
              >
                {link.label}
              </button>
            );
          })}
        </nav>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
