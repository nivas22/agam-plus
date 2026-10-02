"use client";

import { AlertTriangle, ArrowLeft, CheckCircle2, KeyRound, Mail, MessageCircle, Smartphone } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { apiUrl } from "@/lib/api";

const USERNAME_FORMAT_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_COOLDOWN_SECONDS = 60;

type Step = "request" | "verify" | "set";
type Channel = "whatsapp" | "sms" | "email";

async function parseError(response: Response): Promise<string> {
  const data = await response.json().catch(() => ({}));
  return data.error || "Something went wrong";
}

function PasswordRule({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-2 text-xs ${ok ? "text-status-open" : "text-ink-500"}`}>
      <span
        className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] ${
          ok ? "bg-status-open text-white" : "border border-border"
        }`}
      >
        {ok && "✓"}
      </span>
      {label}
    </div>
  );
}

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("request");
  const [username, setUsername] = useState("");
  const [channel, setChannel] = useState<Channel>("whatsapp");
  const [maskedContact, setMaskedContact] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const requestOtp = async () => {
    setError("");
    if (!USERNAME_FORMAT_REGEX.test(username.trim())) {
      setError("Enter your username in email format (e.g. name@example.com)");
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch(apiUrl("/auth/password-otp/request"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), channel }),
      });
      if (!response.ok) throw new Error(await parseError(response));
      const data = await response.json();
      setMaskedContact(data.maskedContact);
      setOtp(["", "", "", "", "", ""]);
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setStep("verify");
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    setOtp((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
    if (digit && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const verifyOtp = async () => {
    setError("");
    const code = otp.join("");
    if (code.length !== 6) {
      setError("Enter the 6-digit code");
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch(apiUrl("/auth/password-otp/verify"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), otp: code }),
      });
      if (!response.ok) throw new Error(await parseError(response));
      const data = await response.json();
      setResetToken(data.resetToken);
      setStep("set");
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const rules = {
    length: newPassword.length >= 8,
    numberOrSymbol: /[0-9!@#$%^&*_\-]/.test(newPassword),
    notUsername: newPassword.length > 0 && newPassword.toLowerCase() !== username.trim().toLowerCase(),
    match: newPassword.length > 0 && newPassword === confirmPassword,
  };

  const setPassword = async () => {
    setError("");
    if (!rules.length || !rules.numberOrSymbol || !rules.notUsername) {
      setError("Please meet all password requirements below");
      return;
    }
    if (!rules.match) {
      setError("Passwords don't match");
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch(apiUrl("/auth/reset-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: resetToken, newPassword }),
      });
      if (!response.ok) throw new Error(await parseError(response));
      router.push("/login");
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-canvas px-4 py-10">
      <div className="w-full max-w-md bg-surface-paper border border-border rounded-2xl shadow-sm p-7">
        {step === "request" && (
          <>
            <Link href="/login" className="text-xs font-semibold text-brand-violet flex items-center gap-1 mb-4">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
            </Link>
            <div className="w-11 h-11 rounded-xl bg-brand-violet flex items-center justify-center mb-4">
              <KeyRound className="w-5 h-5 text-white" />
            </div>
            <h1 className="font-display tracking-tight text-xl font-bold text-ink-900">
              Reset your password
            </h1>
            <p className="text-sm text-ink-500 mt-1.5 mb-5 leading-relaxed">
              Tell us your username and we&apos;ll send a code to the phone number or email your hospital
              registered you with.
            </p>

            {error && <div className="text-sm text-status-danger mb-4">{error}</div>}

            <label htmlFor="username" className="block text-xs font-semibold text-ink-700 mb-1.5">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={submitting}
              placeholder="name@example.com"
              className="w-full px-3 py-2.5 border border-border rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-brand-violet focus:border-transparent disabled:bg-surface-canvas mb-4"
            />

            <div className="text-xs font-semibold text-ink-700 mb-2">Send the code to</div>
            <div className="space-y-2 mb-5">
              <button
                type="button"
                onClick={() => setChannel("whatsapp")}
                className={`w-full flex items-center gap-3 border rounded-xl p-3 text-left transition-colors ${
                  channel === "whatsapp" ? "border-brand-violet bg-brand-violet-soft" : "border-border"
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full border flex-none ${channel === "whatsapp" ? "border-[5px] border-brand-violet bg-white" : "border-border"}`}
                />
                <MessageCircle className="w-4 h-4 text-ink-500 flex-none" />
                <span className="flex-1">
                  <span className="block text-sm font-semibold text-ink-900">WhatsApp</span>
                  <span className="block text-xs text-ink-500">Usually arrives in a few seconds.</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setChannel("sms")}
                className={`w-full flex items-center gap-3 border rounded-xl p-3 text-left transition-colors ${
                  channel === "sms" ? "border-brand-violet bg-brand-violet-soft" : "border-border"
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full border flex-none ${channel === "sms" ? "border-[5px] border-brand-violet bg-white" : "border-border"}`}
                />
                <Smartphone className="w-4 h-4 text-ink-500 flex-none" />
                <span className="flex-1">
                  <span className="block text-sm font-semibold text-ink-900">SMS</span>
                  <span className="block text-xs text-ink-500">Use this if WhatsApp isn&apos;t working.</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setChannel("email")}
                className={`w-full flex items-center gap-3 border rounded-xl p-3 text-left transition-colors ${
                  channel === "email" ? "border-brand-violet bg-brand-violet-soft" : "border-border"
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full border flex-none ${channel === "email" ? "border-[5px] border-brand-violet bg-white" : "border-border"}`}
                />
                <Mail className="w-4 h-4 text-ink-500 flex-none" />
                <span className="flex-1">
                  <span className="block text-sm font-semibold text-ink-900">Email</span>
                  <span className="block text-xs text-ink-500">Send the code to your registered email instead.</span>
                </span>
              </button>
            </div>

            <button
              type="button"
              onClick={requestOtp}
              disabled={submitting}
              className="w-full py-2.5 px-4 bg-brand-violet text-white rounded-xl text-sm font-semibold hover:bg-brand-violet-hover disabled:opacity-50"
            >
              {submitting ? "Sending..." : "Send the code"}
            </button>
            <p className="text-[11px] text-ink-500 mt-3 leading-relaxed">
              Can&apos;t get to any of these any more? Your hospital admin can reset your password directly
              from the Team screen — no code needed.
            </p>
          </>
        )}

        {step === "verify" && (
          <>
            <button
              type="button"
              onClick={() => setStep("request")}
              className="text-xs font-semibold text-brand-violet flex items-center gap-1 mb-4"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Use a different option
            </button>
            <div className="w-11 h-11 rounded-xl bg-brand-violet flex items-center justify-center mb-4">
              <KeyRound className="w-5 h-5 text-white" />
            </div>
            <h1 className="font-display tracking-tight text-xl font-bold text-ink-900">Enter the code</h1>
            <p className="text-sm text-ink-500 mt-1.5 mb-5 leading-relaxed">
              We sent six digits to <span className="font-mono text-ink-900">{maskedContact}</span>. It expires
              in 5 minutes.
            </p>

            {error && <div className="text-sm text-status-danger mb-4">{error}</div>}

            <div className="flex gap-2 mb-4">
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => {
                    otpRefs.current[i] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  disabled={submitting}
                  className="flex-1 h-14 text-center text-xl font-mono font-semibold border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-violet focus:border-transparent"
                />
              ))}
            </div>

            <div className="flex items-center gap-2 text-xs text-ink-500 mb-5">
              <span>Didn&apos;t arrive?</span>
              <span className="flex-1" />
              {cooldown > 0 ? (
                <span>
                  Resend in <span className="font-mono text-ink-700">0:{String(cooldown).padStart(2, "0")}</span>
                </span>
              ) : (
                <button type="button" onClick={requestOtp} className="text-brand-violet font-semibold">
                  Resend code
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={verifyOtp}
              disabled={submitting}
              className="w-full py-2.5 px-4 bg-brand-violet text-white rounded-xl text-sm font-semibold hover:bg-brand-violet-hover disabled:opacity-50"
            >
              {submitting ? "Verifying..." : "Verify"}
            </button>

            <div className="mt-5 flex gap-2 rounded-xl bg-status-warning-soft border border-status-warning/30 p-3">
              <AlertTriangle className="w-4 h-4 text-status-warning flex-none mt-0.5" />
              <p className="text-xs text-status-warning leading-relaxed">
                Nobody from Agam Plus will ever ask you for this code. If someone calls asking for it, hang up
                and tell your admin.
              </p>
            </div>
          </>
        )}

        {step === "set" && (
          <>
            <div className="w-11 h-11 rounded-xl bg-brand-violet flex items-center justify-center mb-4">
              <KeyRound className="w-5 h-5 text-white" />
            </div>
            <h1 className="font-display tracking-tight text-xl font-bold text-ink-900">
              Choose a new password
            </h1>
            <p className="text-sm text-ink-500 mt-1.5 mb-5 leading-relaxed">
              This replaces your old password everywhere you were signed in.
            </p>

            {error && <div className="text-sm text-status-danger mb-4">{error}</div>}

            <label htmlFor="newPassword" className="block text-xs font-semibold text-ink-700 mb-1.5">
              New password
            </label>
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={submitting}
              className="w-full px-3 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-violet focus:border-transparent mb-2"
            />
            <div className="flex gap-1 mb-3">
              {[rules.length, rules.numberOrSymbol, rules.notUsername].map((ok, i) => (
                <span key={i} className={`h-1 flex-1 rounded-full ${ok ? "bg-status-open" : "bg-border"}`} />
              ))}
            </div>
            <div className="space-y-1.5 mb-4">
              <PasswordRule ok={rules.length} label="At least 8 characters" />
              <PasswordRule ok={rules.numberOrSymbol} label="A number or symbol" />
              <PasswordRule ok={rules.notUsername} label="Not your username" />
            </div>

            <label htmlFor="confirmPassword" className="block text-xs font-semibold text-ink-700 mb-1.5">
              Type it again
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={submitting}
              className="w-full px-3 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-violet focus:border-transparent mb-5"
            />

            <button
              type="button"
              onClick={setPassword}
              disabled={submitting}
              className="w-full py-2.5 px-4 bg-brand-violet text-white rounded-xl text-sm font-semibold hover:bg-brand-violet-hover disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting && <CheckCircle2 className="w-4 h-4 animate-pulse" />}
              {submitting ? "Saving..." : "Save and sign in"}
            </button>
            <p className="text-[11px] text-ink-500 mt-3 text-center leading-relaxed">
              Saving this signs you out of every other device — including the front-desk terminal if you left
              yourself signed in there.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
