"use client";

import { Building2, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import {
  Card,
  formatJoined,
  ProfileHero,
  SecuritySummaryCard,
  SessionsCard,
  Tag,
} from "./ProfileShared";

export default function PlatformAdminProfile() {
  const router = useRouter();
  const { user } = useAuth();
  const joined = formatJoined(user?.createdAt);

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-4">
      <ProfileHero
        dark
        name={user?.name || "Platform admin"}
        meta={
          <>
            {user?.email}
            {joined && <> · staff since {joined}</>}
          </>
        }
        tags={<Tag variant="plat">⬡ PLATFORM ADMIN</Tag>}
        actions={
          <button
            onClick={() => router.push("/select-hospital")}
            className="px-3.5 py-2 rounded-lg bg-white/15 hover:bg-white/25 text-white text-sm font-semibold"
          >
            Switch to a hospital
          </button>
        }
      />

      <div className="rounded-xl border border-status-danger/25 bg-status-danger-soft px-4 py-3 text-sm text-ink-900">
        <span className="font-bold">You look at customer data when you open a hospital.</span>{" "}
        Everything you open there is recorded in that hospital&apos;s own audit trail, under your name,
        and visible to their admins.
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-4 items-start">
        <div className="space-y-4 min-w-0">
          <Card title="Manage">
            <button
              onClick={() => router.push("/platform-admin/hospitals")}
              className="w-full flex items-center gap-3 px-4 py-3.5 border-t border-border first:border-t-0 text-left hover:bg-surface-canvas transition-colors"
            >
              <span className="w-8 h-8 rounded-lg bg-brand-violet-soft text-brand-violet flex items-center justify-center shrink-0">
                <Building2 size={15} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold text-ink-900">Hospitals</span>
                <span className="block text-xs text-ink-500">Accounts, billing, create and suspend</span>
              </span>
            </button>
            <button
              onClick={() => router.push("/platform-admin/users")}
              className="w-full flex items-center gap-3 px-4 py-3.5 border-t border-border text-left hover:bg-surface-canvas transition-colors"
            >
              <span className="w-8 h-8 rounded-lg bg-brand-violet-soft text-brand-violet flex items-center justify-center shrink-0">
                <Users size={15} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold text-ink-900">Users</span>
                <span className="block text-xs text-ink-500">Platform-wide user accounts</span>
              </span>
            </button>
          </Card>
        </div>

        <div className="space-y-4">
          <SecuritySummaryCard hasPassword={user?.hasPassword} lastLogin={user?.lastLogin} />
          <SessionsCard hasPassword={user?.hasPassword} />
        </div>
      </div>
    </div>
  );
}
