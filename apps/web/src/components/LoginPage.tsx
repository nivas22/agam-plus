"use client";

import { GoogleLogin } from "@react-oauth/google";
import {
  Building2,
  Calendar,
  Eye,
  EyeOff,
  Lock,
  ShieldCheck,
  User,
  UserCog,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

const USERNAME_FORMAT_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const FEATURES = [
  {
    icon: Building2,
    title: "One account, several hospitals",
    description: "Switch between them without signing out.",
  },
  {
    icon: UserCog,
    title: "You only see what your role allows",
    description: "Front desk takes payments; refunds need an admin.",
  },
  {
    icon: ShieldCheck,
    title: "Every payment and booking is signed",
    description: "Who did it, when, and from which device.",
  },
  {
    icon: Calendar,
    title: "Appointment scheduling, built in",
    description: "Streamlined booking and management for every hospital.",
  },
];

export default function LoginPage() {
  const [tab, setTab] = useState<"google" | "password">("password");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [keepSignedIn, setKeepSignedIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState("");

  const {
    user,
    loading,
    error,
    loginWithGoogle,
    loginWithPassword,
    isLoggingInWithGoogle,
    isLoggingInWithPassword,
    isAuthenticated,
    hospitals,
    approvedHospitals,
    currentHospital,
    handlePostLoginRedirect,
  } = useAuth();

  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from");

  // Redirect if authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      if (from && from !== "/login") {
        router.push(from);
      } else if (approvedHospitals.length > 0) {
        handlePostLoginRedirect(approvedHospitals, router);
      }
    }
  }, [
    isAuthenticated,
    user,
    hospitals,
    approvedHospitals,
    currentHospital,
    from,
    router,
  ]);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError("");

    if (!username || !password) {
      setLocalError("Please enter both username and password");
      return;
    }
    if (!USERNAME_FORMAT_REGEX.test(username)) {
      setLocalError("Username must be in email format (e.g. name@example.com)");
      return;
    }

    try {
      await loginWithPassword({ username, password, keepSignedIn });
    } catch (err: any) {
      setLocalError(err.message || "An unexpected error occurred");
    }
  };

  const handleGoogleLogin = async (credential: string) => {
    setLocalError("");
    try {
      const result = await loginWithGoogle(credential);
      if (!result.success) {
        setLocalError("Google login failed");
      }
    } catch (err: any) {
      setLocalError(err.message || "An unexpected error occurred");
    }
  };

  const isLoading = isLoggingInWithGoogle || isLoggingInWithPassword || loading;
  const displayError = localError || error?.message;

  return (
    <div className="min-h-screen bg-surface-canvas md:grid md:grid-cols-2">
      {/* Left — branding */}
      <div className="relative hidden md:flex flex-col overflow-hidden bg-ink-900 px-8 py-8 text-white">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(740px 440px at 8% -10%, rgba(91,75,219,.55), transparent 62%), radial-gradient(600px 400px at 96% 104%, rgba(154,63,208,.4), transparent 60%)",
          }}
        />
        <div className="relative z-10 flex flex-col h-full">
          <img
            src="/agam-plus-logo.svg"
            alt="Agam Plus"
            className="h-14 w-auto brightness-0 invert"
          />

          <div className="mt-10">
            <h1 className="font-display tracking-tight text-4xl font-bold leading-tight max-w-md">
              The front desk, the doctors and the money — on one screen.
            </h1>
            <p className="mt-3 text-white/65 max-w-sm">
              Sign in to the hospitals you&apos;ve been given access to.
            </p>

            <div className="mt-8 max-w-md">
              {FEATURES.map((f, i) => (
                <div
                  key={f.title}
                  className={`flex gap-3 items-start py-3.5 border-white/10 ${i === 0 ? "" : "border-t"} ${i === FEATURES.length - 1 ? "border-b" : ""}`}
                >
                  <span className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                    <f.icon className="w-3.5 h-3.5" />
                  </span>
                  <div>
                    <div className="text-sm font-semibold">{f.title}</div>
                    <div className="text-xs text-white/60 mt-0.5 leading-relaxed">
                      {f.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 text-xs text-white/40 flex gap-4">
            <span>© {new Date().getFullYear()} Agam Plus</span>
          </div>
        </div>
      </div>

      {/* Right — sign in */}
      <div className="flex items-center justify-center px-8 py-14">
        <div className="w-full max-w-md">
          <h2 className="font-display tracking-tight text-4xl font-bold text-ink-900">
            Sign in
          </h2>
          <p className="text-sm text-ink-500 mt-1.5">
            Two ways in, depending on your role at the hospital.
          </p>

          <div className="flex gap-2 bg-surface-canvas border border-border rounded-xl p-1 mt-10">
            <button
              type="button"
              onClick={() => setTab("google")}
              className={`flex-1 rounded-lg py-4 text-center transition-colors ${
                tab === "google"
                  ? "bg-surface-paper shadow-sm"
                  : "hover:bg-surface-paper/60"
              }`}
            >
              <div
                className={`text-xs font-semibold ${tab === "google" ? "text-brand-violet" : "text-ink-700"}`}
              >
                Social Login
              </div>
              {/* <div className="text-[11px] text-ink-500 mt-0.5">
                Google account
              </div> */}
            </button>
            <button
              type="button"
              onClick={() => setTab("password")}
              className={`flex-1 rounded-lg py-2.5 text-center transition-colors ${
                tab === "password"
                  ? "bg-surface-paper shadow-sm"
                  : "hover:bg-surface-paper/60"
              }`}
            >
              <div
                className={`text-xs font-semibold ${tab === "password" ? "text-brand-violet" : "text-ink-700"}`}
              >
                Username &amp; password
              </div>
              {/* <div className="text-[11px] text-ink-500 mt-0.5">
                Username &amp; password
              </div> */}
            </button>
          </div>

          {displayError && (
            <div className="mt-5 rounded-xl border border-status-danger/30 bg-status-danger-soft px-3.5 py-3 text-sm text-status-danger leading-relaxed">
              {displayError}
            </div>
          )}

          {tab === "google" ? (
            <div className="mt-6">
              <div className="flex justify-center">
                <GoogleLogin
                  onSuccess={(credentialResponse) => {
                    if (credentialResponse.credential) {
                      handleGoogleLogin(credentialResponse.credential);
                    }
                  }}
                  onError={() => setLocalError("Google login failed")}
                  theme="outline"
                  shape="pill"
                  size="large"
                  text="continue_with"
                  width="384"
                />
              </div>
              <p className="text-xs text-ink-500 text-center mt-4">
                Request access to hospitals you work with — a hospital admin
                approves you, then you can switch between hospitals anytime.
              </p>
            </div>
          ) : (
            <form className="mt-6 space-y-4" onSubmit={handlePasswordLogin}>
              <div>
                <label
                  htmlFor="username"
                  className="block text-xs font-semibold text-ink-700 mb-1.5"
                >
                  Username
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-4 w-4 text-ink-500" />
                  </div>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={isLoading}
                    className="w-full pl-9 pr-3 py-2.5 border border-border rounded-xl bg-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-brand-violet focus:border-transparent disabled:bg-surface-canvas disabled:cursor-not-allowed transition-colors"
                    placeholder="name@example.com"
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="password" className="block text-xs font-semibold text-ink-700">
                    Password
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-xs text-brand-violet hover:text-brand-violet-hover font-medium"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-ink-500" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    className="w-full pl-9 pr-10 py-2.5 border border-border rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-violet focus:border-transparent disabled:bg-surface-canvas disabled:cursor-not-allowed transition-colors"
                    placeholder="Enter your password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    disabled={isLoading}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-ink-500 hover:text-ink-700 disabled:opacity-50"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <label className="flex items-start gap-2 text-xs text-ink-700">
                <input
                  type="checkbox"
                  checked={keepSignedIn}
                  onChange={(e) => setKeepSignedIn(e.target.checked)}
                  disabled={isLoading}
                  className="mt-0.5"
                />
                <span>
                  Keep me signed in
                  <span className="block text-[11px] text-ink-500">
                    Don&apos;t tick this on the front-desk terminal
                  </span>
                </span>
              </label>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 bg-brand-violet text-white rounded-xl text-sm font-semibold hover:bg-brand-violet-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoggingInWithPassword ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Signing in...
                  </span>
                ) : (
                  "Sign in"
                )}
              </button>

              <div className="flex items-center gap-3 py-1">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[11px] text-ink-500">
                  or, if you&apos;re an admin or doctor
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <div className="flex justify-center">
                <GoogleLogin
                  onSuccess={(credentialResponse) => {
                    if (credentialResponse.credential) {
                      handleGoogleLogin(credentialResponse.credential);
                    }
                  }}
                  onError={() => setLocalError("Google login failed")}
                  theme="outline"
                  shape="pill"
                  size="medium"
                  text="continue_with"
                  width="320"
                />
              </div>
            </form>
          )}

          <div className="mt-6 text-center">
            <p className="text-sm text-ink-700">
              Don&apos;t have an account?{" "}
              <Link
                href="/register"
                className="text-brand-violet hover:text-brand-violet-hover font-medium"
              >
                Request Access
              </Link>
            </p>
          </div>

          <p className="mt-6 text-[11px] text-ink-500 text-center leading-relaxed">
            By signing in you agree to our{" "}
            <Link href="/terms" className="text-ink-700 underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-ink-700 underline">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
