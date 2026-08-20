'use client';

import { Suspense } from "react";
import LoginPage from "@/components/LoginPage";
import MobileLoginPage from "@/components/mobile/MobileLoginPage";
import { useDeviceDetect } from "@/hooks/useDeviceDetect";

function LoginPageWrapper() {
  const { isMobile } = useDeviceDetect();
  return isMobile ? <MobileLoginPage /> : <LoginPage />;
}

export default function Login() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-brand-violet-soft via-brand-violet-soft to-brand-violet-soft">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-violet"></div>
      </div>
    }>
      <LoginPageWrapper />
    </Suspense>
  );
}