"use client";

import { Laptop, Lock, Smartphone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiUrl, fetchWithAuth } from "@/lib/api";

interface Session {
  id: string;
  device: string;
  ip: string | null;
  createdAt: string;
  lastUsedAt: string;
  current: boolean;
}

const NAV_ITEMS = [
  { key: "profile", label: "Profile", enabled: true },
  { key: "security", label: "Password & security", enabled: true },
  { key: "notifications", label: "Notifications", enabled: false },
  { key: "hospitals", label: "Hospitals you can access", enabled: false },
];

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

export default function SecurityPage({ hospitalId }: { hospitalId: string }) {
  const router = useRouter();
  const { user } = useAuth();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [signOutOthers, setSignOutOthers] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState(true);

  const loadSessions = async () => {
    setSessionsLoading(true);
    try {
      const response = await fetchWithAuth(apiUrl("/auth/sessions"));
      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions || []);
      }
    } finally {
      setSessionsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.hasPassword) loadSessions();
  }, [user?.hasPassword]);

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!currentPassword || !newPassword) {
      setError("Please fill in both fields");
      return;
    }
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetchWithAuth(apiUrl("/auth/change-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, signOutOthers }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Something went wrong");
      }
      toast.success("Password updated");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      loadSessions();
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const revokeSession = async (sessionId: string) => {
    await fetchWithAuth(apiUrl(`/auth/sessions/${sessionId}/revoke`), { method: "POST" });
    loadSessions();
  };

  const revokeOtherSessions = async () => {
    await fetchWithAuth(apiUrl("/auth/sessions/revoke-others"), { method: "POST" });
    toast.success("Signed out of every other device");
    loadSessions();
  };

  return (
    <div className="min-h-screen bg-surface-canvas">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="text-sm text-ink-500 mb-4">
          Settings / <span className="font-semibold text-ink-900">Your account</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)] gap-4 items-start">
          <nav className="bg-surface-paper border border-border rounded-xl p-1.5">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.key}
                type="button"
                disabled={!item.enabled}
                onClick={() => {
                  if (item.key === "profile") router.push(`/hospital/${hospitalId}/profile`);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium mb-0.5 last:mb-0 transition-colors ${
                  item.key === "security"
                    ? "bg-brand-violet-soft text-brand-violet font-semibold"
                    : item.enabled
                      ? "text-ink-700 hover:bg-surface-canvas"
                      : "text-ink-500/50 cursor-not-allowed"
                }`}
              >
                {item.label}
                {!item.enabled && <span className="block text-[10px] text-ink-500/60">Coming soon</span>}
              </button>
            ))}
          </nav>

          <div className="space-y-4 min-w-0">
            {user?.hasPassword ? (
              <>
                <div className="bg-surface-paper border border-border rounded-xl overflow-hidden">
                  <h3 className="font-display tracking-tight text-sm font-bold text-ink-900 px-5 py-4 border-b border-border">
                    Change your password
                  </h3>
                  <form className="p-5 space-y-4" onSubmit={changePassword}>
                    {error && <div className="text-sm text-status-danger">{error}</div>}
                    <div className="max-w-sm">
                      <label className="block text-xs font-semibold text-ink-700 mb-1.5">Current password</label>
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        disabled={submitting}
                        className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-violet focus:border-transparent"
                      />
                      <p className="text-[11px] text-ink-500 mt-1.5">
                        We ask for this so a password can&apos;t be changed on a terminal someone left signed in.
                      </p>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4 max-w-xl">
                      <div>
                        <label className="block text-xs font-semibold text-ink-700 mb-1.5">New password</label>
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          disabled={submitting}
                          placeholder="At least 8 characters"
                          className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-violet focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-ink-700 mb-1.5">Type it again</label>
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          disabled={submitting}
                          className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-violet focus:border-transparent"
                        />
                      </div>
                    </div>
                    <label className="flex items-start gap-2 text-xs text-ink-700">
                      <input
                        type="checkbox"
                        checked={signOutOthers}
                        onChange={(e) => setSignOutOthers(e.target.checked)}
                        disabled={submitting}
                        className="mt-0.5"
                      />
                      <span>
                        Sign out of my other devices.{" "}
                        <span className="text-ink-500">
                          Recommended
                          {sessions && sessions.filter((s) => !s.current).length > 0
                            ? ` — you're signed in on ${sessions.filter((s) => !s.current).length} other device${sessions.filter((s) => !s.current).length > 1 ? "s" : ""}.`
                            : "."}
                        </span>
                      </span>
                    </label>
                    <div className="pt-2 flex items-center gap-3">
                      <button
                        type="submit"
                        disabled={submitting}
                        className="px-4 py-2 rounded-lg bg-brand-violet hover:bg-brand-violet-hover text-white text-sm font-semibold disabled:opacity-50"
                      >
                        {submitting ? "Saving..." : "Update password"}
                      </button>
                      <span className="text-[11px] text-ink-500">
                        Changing your password is recorded in the audit trail, without the password itself.
                      </span>
                    </div>
                  </form>
                </div>

                <div className="bg-surface-paper border border-border rounded-xl overflow-hidden">
                  <h3 className="font-display tracking-tight text-sm font-bold text-ink-900 px-5 py-4 border-b border-border">
                    Where you&apos;re signed in
                  </h3>
                  {sessionsLoading ? (
                    <div className="p-5 text-sm text-ink-500">Loading…</div>
                  ) : !sessions?.length ? (
                    <div className="p-5 text-sm text-ink-500">No active sessions found.</div>
                  ) : (
                    <>
                      {sessions.map((s) => (
                        <div key={s.id} className="flex items-center gap-3 px-5 py-3 border-t border-border first:border-t-0">
                          <span className="w-8 h-8 rounded-lg bg-surface-canvas flex items-center justify-center shrink-0">
                            {/mobile|android|iphone/i.test(s.device) ? (
                              <Smartphone size={14} className="text-ink-700" />
                            ) : (
                              <Laptop size={14} className="text-ink-700" />
                            )}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-ink-900">{s.device}</div>
                            <div className="text-[11px] text-ink-500 font-mono">
                              {s.ip ? `${s.ip} · ` : ""}
                              {s.current ? "this device, now" : `last used ${timeAgo(s.lastUsedAt)}`}
                            </div>
                          </div>
                          {s.current ? (
                            <span className="text-[10px] font-bold bg-status-open-soft text-status-open rounded-md px-2 py-0.5">
                              NOW
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => revokeSession(s.id)}
                              className="px-2.5 py-1 rounded-lg border border-border text-xs font-semibold text-ink-700 hover:bg-surface-canvas"
                            >
                              Sign out
                            </button>
                          )}
                        </div>
                      ))}
                      {sessions.some((s) => !s.current) && (
                        <div className="flex items-center gap-3 px-5 py-3 border-t border-border bg-surface-canvas/40">
                          <span className="text-[11px] text-ink-500 flex-1">
                            On a shared terminal, sign out at the end of your shift.
                          </span>
                          <button
                            type="button"
                            onClick={revokeOtherSessions}
                            className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-ink-700 hover:bg-surface-canvas"
                          >
                            Sign out everywhere
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="bg-surface-paper border border-border rounded-xl p-5">
                <div className="flex items-start gap-3">
                  <span className="w-9 h-9 rounded-lg bg-surface-canvas flex items-center justify-center shrink-0">
                    <Lock size={16} className="text-ink-700" />
                  </span>
                  <div className="text-sm text-ink-700 leading-relaxed">
                    You sign in with Google, so there&apos;s no password here to change — manage it in your
                    Google account. <span className="font-semibold">Front desk and nursing staff</span> use a
                    username and password, and an admin can reset theirs from{" "}
                    <span className="font-semibold">Settings → Team</span> without needing the old one.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
