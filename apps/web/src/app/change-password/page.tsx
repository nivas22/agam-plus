"use client";

import { KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { apiUrl, fetchWithAuth } from "@/lib/api";

export default function ChangePasswordPage() {
  const router = useRouter();
  const { isAuthenticated, approvedHospitals, handlePostLoginRedirect } =
    useAuth();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [signOutOthers, setSignOutOthers] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
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
      handlePostLoginRedirect(approvedHospitals, router);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAuthenticated) {
    router.push("/login");
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-canvas px-4">
      <div className="w-full max-w-md bg-surface-paper border border-border rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-brand-violet-soft flex items-center justify-center">
            <KeyRound className="w-5 h-5 text-brand-violet" />
          </div>
          <h1 className="font-display tracking-tight text-lg font-bold text-ink-900">
            Change your password
          </h1>
        </div>
        <p className="text-sm text-ink-500 mb-5">
          You&apos;re signing in with a temporary password. Set a new one to
          continue.
        </p>

        <form className="space-y-4" onSubmit={submit}>
          {error && <div className="text-sm text-status-danger">{error}</div>}
          <div>
            <label
              htmlFor="currentPassword"
              className="block text-sm font-medium text-ink-700 mb-1"
            >
              Temporary password
            </label>
            <input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={submitting}
              className="w-full px-3 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-violet focus:border-transparent disabled:bg-surface-canvas disabled:cursor-not-allowed"
              required
            />
          </div>
          <div>
            <label
              htmlFor="newPassword"
              className="block text-sm font-medium text-ink-700 mb-1"
            >
              New password
            </label>
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={submitting}
              placeholder="At least 8 characters"
              className="w-full px-3 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-violet focus:border-transparent disabled:bg-surface-canvas disabled:cursor-not-allowed"
              required
            />
          </div>
          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-ink-700 mb-1"
            >
              Confirm new password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={submitting}
              className="w-full px-3 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-violet focus:border-transparent disabled:bg-surface-canvas disabled:cursor-not-allowed"
              required
            />
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
              <span className="text-ink-500">Recommended if you're not sure who else might be signed in.</span>
            </span>
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 px-4 bg-brand-violet text-white rounded-lg font-medium hover:bg-brand-violet-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Saving..." : "Change password"}
          </button>
        </form>
      </div>
    </div>
  );
}
