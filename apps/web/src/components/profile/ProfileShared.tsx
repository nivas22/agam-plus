"use client";

import { format } from "date-fns";
import { Laptop, Smartphone } from "lucide-react";
import type { ReactNode } from "react";
import { paletteFor } from "@/lib/avatarPalette";
import { useSessions } from "@/hooks/useSessionsApi";

export function getInitials(name?: string): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function ProfileAvatar({ name, size = 62 }: { name: string; size?: number }) {
  const [c1, c2] = paletteFor(name || "U");
  return (
    <div
      className="rounded-2xl flex items-center justify-center text-white font-bold shrink-0 shadow-sm font-display tracking-tight"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: `linear-gradient(150deg, ${c1}, ${c2})`,
      }}
    >
      {getInitials(name)}
    </div>
  );
}

type TagVariant = "role" | "ok" | "warn" | "quiet" | "plat";

const TAG_CLASSES: Record<TagVariant, string> = {
  role: "bg-brand-violet-soft text-brand-violet",
  ok: "bg-status-open-soft text-status-open",
  warn: "bg-status-warning-soft text-status-warning",
  quiet: "bg-surface-canvas text-ink-700",
  plat: "bg-white/15 text-white",
};

export function Tag({ children, variant = "quiet" }: { children: ReactNode; variant?: TagVariant }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold ${TAG_CLASSES[variant]}`}>
      {children}
    </span>
  );
}

export function ProfileHero({
  name,
  meta,
  tags,
  actions,
  dark = false,
}: {
  name: string;
  meta: ReactNode;
  tags: ReactNode;
  actions?: ReactNode;
  dark?: boolean;
}) {
  return (
    <div
      className={`flex flex-col sm:flex-row gap-4 sm:items-start rounded-xl border p-5 shadow-sm ${
        dark
          ? "bg-gradient-to-br from-ink-900 to-brand-violet border-ink-900 text-white"
          : "bg-surface-paper border-border"
      }`}
    >
      <ProfileAvatar name={name} />
      <div className="flex-1 min-w-0">
        <h1 className={`text-xl font-bold font-display tracking-tight ${dark ? "text-white" : "text-ink-900"}`}>
          {name}
        </h1>
        <div className={`text-sm mt-0.5 ${dark ? "text-white/60" : "text-ink-500"}`}>{meta}</div>
        <div className="flex flex-wrap gap-2 mt-3">{tags}</div>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export function Card({
  title,
  subtitle,
  right,
  children,
  tone = "default",
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  tone?: "default" | "danger";
}) {
  return (
    <div
      className={`bg-surface-paper rounded-xl border overflow-hidden ${
        tone === "danger" ? "border-status-danger/25" : "border-border"
      }`}
    >
      <div
        className={`px-4 py-3 border-b flex items-center gap-2 ${
          tone === "danger" ? "border-status-danger/20 bg-status-danger-soft" : "border-border"
        }`}
      >
        <h3
          className={`text-sm font-bold font-display tracking-tight ${
            tone === "danger" ? "text-status-danger" : "text-ink-900"
          }`}
        >
          {title}
        </h3>
        {subtitle && <span className="text-xs text-ink-500">{subtitle}</span>}
        <span className="flex-1" />
        {right}
      </div>
      {children}
    </div>
  );
}

export function KV({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3 border-t border-border first:border-t-0 text-sm">
      <span className="text-ink-500 shrink-0">{label}</span>
      <span className="text-right font-medium text-ink-900">
        {value}
        {hint && <span className="block text-xs font-normal text-ink-500 mt-0.5">{hint}</span>}
      </span>
    </div>
  );
}

export function formatJoined(date: any): string | null {
  if (!date) return null;
  try {
    const d = typeof date === "string" || date instanceof Date ? new Date(date) : new Date(date.seconds ? date.seconds * 1000 : date);
    if (isNaN(d.getTime())) return null;
    return format(d, "d MMM yyyy");
  } catch {
    return null;
  }
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// Compact read-only session list for the profile page. Full manage/revoke
// UI lives on SecurityPage — this just orients the viewer and links there.
export function SessionsCard({ hospitalId, hasPassword }: { hospitalId?: string; hasPassword?: boolean }) {
  const { data: sessions, isLoading } = useSessions(!!hasPassword);

  if (!hasPassword) return null;

  return (
    <Card
      title="Where you're signed in"
      right={
        hospitalId ? (
          <a href={`/hospital/${hospitalId}/profile/security`} className="text-xs font-medium text-brand-violet hover:underline">
            Manage
          </a>
        ) : undefined
      }
    >
      {isLoading ? (
        <div className="px-4 py-4 text-sm text-ink-500">Loading…</div>
      ) : !sessions?.length ? (
        <div className="px-4 py-4 text-sm text-ink-500">No active sessions found.</div>
      ) : (
        sessions.slice(0, 3).map((s) => (
          <div key={s.id} className="flex items-center gap-3 px-4 py-3 border-t border-border first:border-t-0">
            <span className="w-8 h-8 rounded-lg bg-surface-canvas flex items-center justify-center shrink-0">
              {/mobile|android|iphone/i.test(s.device) ? (
                <Smartphone size={14} className="text-ink-700" />
              ) : (
                <Laptop size={14} className="text-ink-700" />
              )}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-ink-900 truncate">{s.device}</div>
              <div className="text-[11px] text-ink-500 font-mono truncate">
                {s.ip ? `${s.ip} · ` : ""}
                {s.current ? "this device, now" : `last used ${timeAgo(s.lastUsedAt)}`}
              </div>
            </div>
            {s.current && (
              <span className="text-[10px] font-bold bg-status-open-soft text-status-open rounded-md px-2 py-0.5 shrink-0">
                NOW
              </span>
            )}
          </div>
        ))
      )}
    </Card>
  );
}

// Sign-in method + last sign-in — real fields only (no fabricated 2FA/IP
// allowlist rows since neither exists in this app yet).
export function SecuritySummaryCard({
  hasPassword,
  lastLogin,
  hospitalId,
}: {
  hasPassword?: boolean;
  lastLogin?: any;
  hospitalId?: string;
}) {
  const lastLoginStr = formatJoined(lastLogin);
  return (
    <Card
      title="Sign-in & security"
      right={
        hospitalId ? (
          <a href={`/hospital/${hospitalId}/profile/security`} className="text-xs font-medium text-brand-violet hover:underline">
            {hasPassword ? "Manage" : "Details"}
          </a>
        ) : undefined
      }
    >
      <KV
        label="Signs in with"
        value={hasPassword ? "Username & password" : "Google"}
        hint={hasPassword ? "Change it from Manage" : "Password is managed there"}
      />
      {lastLoginStr && <KV label="Last sign-in" value={lastLoginStr} />}
    </Card>
  );
}
