"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Toaster } from "react-hot-toast";

import LoginPage from "@/components/LoginPage";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useAuth } from "@/hooks/useAuth";
import SelectHospitalPage from "./select-hospital/page";


export default function Home() {
  const { user, loading: authLoading, getRoleBasedRedirect } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && !authLoading) {
      const redirectPath = getRoleBasedRedirect();
      router.push(redirectPath);
    }
  }, [user, authLoading, router, getRoleBasedRedirect]);

  // ✅ Show loading while checking authentication
  if (authLoading) {
    return <LoadingSpinner />;
  }

  // ✅ Show login if not authenticated
  if (!user) {
    return <LoginPage />;
  }

  // ✅ If doctor is pending → show pending page
  if (user.role === "doctor" && user.status === "pending") {
    return (
      <>
        <Toaster position="top-right" />
        <SelectHospitalPage />
      </>
    );
  }

  // ✅ Fallback spinner while redirecting
  return (
    <>
      <Toaster position="top-right" />
      <LoadingSpinner message="Redirecting to your dashboard..." />
    </>
  );
}
