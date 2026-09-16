"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { usePendingApprovals } from "@/hooks/useApprovalsApi";
import { ROLE_LABELS } from "@/types/permissions";
import { MEMBERSHIP_STATUS } from "../../constants";
import {
  Card,
  formatJoined,
  ProfileHero,
  SecuritySummaryCard,
  SessionsCard,
  Tag,
} from "./ProfileShared";

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diffMs / 3600000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export default function HospitalAdminProfile() {
  const router = useRouter();
  const { user, currentHospital, hospitals, currentHospitalMembership, switchHospital, isSwitchingHospital } =
    useAuth();
  const hospitalId = currentHospital?.id || "";

  const { data: pendingApprovals } = usePendingApprovals(hospitalId);

  const approvedHospitals = hospitals.filter((h) => h.status === MEMBERSHIP_STATUS.APPROVED);
  const joined = formatJoined(currentHospitalMembership?.joinedAt);

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-4">
      <ProfileHero
        name={user?.name || "Admin"}
        meta={
          <>
            {user?.email}
            {joined && <> · joined {joined}</>}
          </>
        }
        tags={
          <>
            <Tag variant="role">◉ {ROLE_LABELS.admin?.toUpperCase() || "HOSPITAL ADMIN"}</Tag>
            <Tag variant={user?.hasPassword ? "quiet" : "ok"}>
              {user?.hasPassword ? "USERNAME SIGN-IN" : "GOOGLE SIGN-IN"}
            </Tag>
            {approvedHospitals.length === 1 && <Tag variant="warn">ONLY HOSPITAL: {currentHospital?.name}</Tag>}
          </>
        }
        actions={
          <button
            onClick={() => router.push(`/hospital/${hospitalId}/settings/team`)}
            className="px-3.5 py-2 rounded-lg bg-brand-violet hover:bg-brand-violet-hover text-white text-sm font-semibold"
          >
            Team
          </button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-4 items-start">
        <div className="space-y-4 min-w-0">
          <Card
            title="Hospitals you can access"
            right={
              <button
                onClick={() => router.push("/select-hospital")}
                className="text-xs font-medium text-brand-violet hover:underline"
              >
                Switch
              </button>
            }
          >
            {approvedHospitals.map((h) => (
              <div
                key={h.hospitalId}
                className="flex items-center gap-3 px-4 py-3 border-t border-border first:border-t-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-ink-900 truncate">{h.hospital?.name}</div>
                  <div className="text-xs text-ink-500 truncate">
                    {ROLE_LABELS[h.role] || h.role}
                    {h.hospitalId === hospitalId && " · your current hospital"}
                  </div>
                </div>
                {h.hospitalId === hospitalId ? (
                  <span className="text-[10px] font-bold bg-status-open-soft text-status-open rounded-md px-2 py-0.5 shrink-0">
                    CURRENT
                  </span>
                ) : (
                  <button
                    onClick={() => switchHospital(h.hospitalId)}
                    disabled={isSwitchingHospital}
                    className="px-2.5 py-1 rounded-lg border border-border text-xs font-semibold text-ink-700 hover:bg-surface-canvas shrink-0 disabled:opacity-50"
                  >
                    Switch
                  </button>
                )}
              </div>
            ))}
          </Card>

          <Card
            title="What you can do here"
            right={
              <button
                onClick={() => router.push(`/hospital/${hospitalId}/settings/roles`)}
                className="text-xs font-medium text-brand-violet hover:underline"
              >
                Roles &amp; permissions
              </button>
            }
          >
            <div className="px-4 py-3.5 text-sm text-ink-700">
              As hospital admin you have full access to appointments, money, doctors, charge catalog, roles and
              the audit trail. Open <span className="font-semibold">Roles &amp; permissions</span> to see or change
              what front desk, nurses and accountants can do.
            </div>
          </Card>

          <Card title="Waiting on you" subtitle="Pending approvals across your hospital">
            {!pendingApprovals?.length ? (
              <div className="px-4 py-4 text-sm text-ink-500">Nothing waiting on you right now.</div>
            ) : (
              pendingApprovals.slice(0, 5).map((a) => (
                <div key={a.id} className="flex items-start gap-3 px-4 py-3 border-t border-border first:border-t-0 text-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-status-danger mt-1.5 shrink-0" />
                  <span className="flex-1 text-ink-700">
                    <span className="font-semibold text-ink-900">
                      {a.action === "issue_refund" ? "Refund request" : a.action.replace(/_/g, " ")}
                    </span>{" "}
                    raised by {a.requestedBy?.name}
                  </span>
                  <span className="text-xs text-ink-500 font-mono shrink-0">{timeAgo(a.requestedAt)}</span>
                </div>
              ))
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <SecuritySummaryCard hasPassword={user?.hasPassword} lastLogin={user?.lastLogin} hospitalId={hospitalId} />
          <SessionsCard hospitalId={hospitalId} hasPassword={user?.hasPassword} />

          <Card title="Careful with these" tone="danger">
            <div className="px-4 py-3.5 text-xs text-ink-500 leading-relaxed">
              There&apos;s no &quot;delete account&quot; here. Your name is attached to payments, refunds and
              bookings you&apos;ve made — removing it would leave those pointing at nobody. Another admin can
              deactivate you from <span className="font-semibold">Settings → Team</span> if you leave the
              hospital.
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
