'use client';

import { Suspense } from "react";
import LoginPage from "@/components/LoginPage";

export default function Login() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-brand-violet-soft via-brand-violet-soft to-brand-violet-soft">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-violet"></div>
      </div>
    }>
      <LoginPage />
    </Suspense>
  );
}
