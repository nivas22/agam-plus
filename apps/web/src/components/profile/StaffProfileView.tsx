"use client";

import { useAuth } from "@/hooks/useAuth";
import { useMyTeamProfile } from "@/hooks/useTeamApi";
import { GROUP_LABELS, ROLE_LABELS } from "@/types/permissions";
import { SHIFT_OPTIONS } from "@/types/team";
import {
  Card,
  formatJoined,
  KV,
  ProfileHero,
  SecuritySummaryCard,
  SessionsCard,
  Tag,
} from "./ProfileShared";

const STATE_CLASSES: Record<string, string> = {
  allowed: "bg-status-open-soft text-status-open",
  needs_approval: "bg-status-warning-soft text-status-warning",
  blocked: "bg-surface-canvas text-ink-500",
};

const STATE_LABELS: Record<string, string> = {
  allowed: "Allowed",
  needs_approval: "Ask an admin",
  blocked: "Blocked",
};

function shiftLabel(shift?: string | null): string | null {
  if (!shift) return null;
  return SHIFT_OPTIONS.find((s) => s.value === shift)?.label || shift;
}

export default function StaffProfileView() {
  const { user, currentHospital } = useAuth();
  const hospitalId = currentHospital?.id || "";

  const { data: profile, isLoading } = useMyTeamProfile(hospitalId);

  if (isLoading || !profile) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <div className="animate-pulse text-sm text-ink-500">Loading profile…</div>
      </div>
    );
  }

  const attendanceDays = Object.values(profile.attendance || {});
  const attendedCount = attendanceDays.filter(Boolean).length;
  const joined = formatJoined(profile.joinedAt);
  const shift = shiftLabel(profile.shift);

  const grouped = profile.permissions?.catalog?.reduce<Record<string, typeof profile.permissions.catalog>>(
    (acc, item) => {
      (acc[item.group] ||= []).push(item);
      return acc;
    },
    {},
  );

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-4">
      <ProfileHero
        name={profile.name}
        meta={
          <>
            {profile.phone || profile.email} · {profile.employeeId} · {currentHospital?.name}
          </>
        }
        tags={
          <>
            <Tag variant="warn">☺ {(ROLE_LABELS[profile.role] || profile.role).toUpperCase()}</Tag>
            {shift && <Tag variant="quiet">{shift.toUpperCase()}</Tag>}
            {profile.handlesCash && (
              <Tag variant={profile.pinSet ? "ok" : "warn"}>
                CASH DRAWER · {profile.pinSet ? "PIN SET" : "PIN NOT SET"}
              </Tag>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-4 items-start">
        <div className="space-y-4 min-w-0">
          <Card title="Your details" subtitle="Name and shift are set by your admin">
            <KV label="You sign in with" value={profile.phone || profile.email} />
            {profile.phone && profile.email && <KV label="Email" value={profile.email} />}
            <KV label="Employee ID" value={profile.employeeId} />
            {shift && <KV label="Shift" value={shift} />}
            {joined && <KV label="Joined" value={joined} />}
          </Card>

          <Card title="What you can do">
            {grouped &&
              Object.entries(grouped).map(([group, items]) => (
                <div key={group} className="border-t border-border first:border-t-0">
                  <div className="px-4 pt-3 pb-1 text-[11px] font-bold uppercase tracking-wide text-ink-500">
                    {GROUP_LABELS[group] || group}
                  </div>
                  {items.map((item) => (
                    <div key={item.key} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                      <span className="text-ink-700">{item.label}</span>
                      <span className={`text-[11px] font-bold rounded-md px-2 py-0.5 shrink-0 ${STATE_CLASSES[item.state]}`}>
                        {STATE_LABELS[item.state] || item.state}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Your month" subtitle="Only you and your admin see this">
            <div className="grid grid-cols-2 divide-x divide-border">
              <div className="px-3 py-3.5">
                <div className="text-[10px] uppercase tracking-wide text-ink-500 font-bold">Collected</div>
                <div className="text-lg font-bold text-ink-900 font-mono tabular mt-0.5">
                  ₹{profile.stats.collectedThisMonth.toLocaleString("en-IN")}
                </div>
                <div className="text-[11px] text-ink-500">{profile.stats.collectedCount} payments</div>
              </div>
              <div className="px-3 py-3.5">
                <div className="text-[10px] uppercase tracking-wide text-ink-500 font-bold">Drawer variance</div>
                <div
                  className={`text-lg font-bold font-mono tabular mt-0.5 ${
                    profile.stats.drawerVarianceTotal < 0 ? "text-status-warning" : "text-ink-900"
                  }`}
                >
                  ₹{profile.stats.drawerVarianceTotal.toLocaleString("en-IN")}
                </div>
                <div className="text-[11px] text-ink-500">{profile.stats.drawerVarianceDays} day(s) off</div>
              </div>
            </div>
            <div className="px-3 py-3.5 border-t border-border">
              <div className="text-[10px] uppercase tracking-wide text-ink-500 font-bold">Attendance this week</div>
              <div className="text-lg font-bold text-ink-900 font-mono tabular mt-0.5">
                {attendedCount}/{attendanceDays.length || 0}
              </div>
            </div>
          </Card>

          <SecuritySummaryCard hasPassword={user?.hasPassword} lastLogin={user?.lastLogin} hospitalId={hospitalId} />
          <SessionsCard hospitalId={hospitalId} hasPassword={user?.hasPassword} />

          <Card title="Careful with these" tone="danger">
            <div className="px-4 py-3.5 text-xs text-ink-500 leading-relaxed">
              You can&apos;t delete your own account. Ask your admin — they deactivate it from{" "}
              <span className="font-semibold">Settings → Team</span>, and your name stays on the payments you
              took.
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
