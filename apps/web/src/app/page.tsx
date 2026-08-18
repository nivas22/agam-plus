"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Toaster } from "react-hot-toast";

import LoginPage from "@/components/LoginPage";
import MobileLoginPage from "@/components/mobile/MobileLoginPage";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useAuth } from "@/hooks/useAuth";
import { useDeviceDetect } from "@/hooks/useDeviceDetect";
import SelectHospitalPage from "./select-hospital/page";
import SplashScreen from "@/components/mobile/SplashScreen";


export default function Home() {
  const { user, loading: authLoading, getRoleBasedRedirect } = useAuth();
  const { isMobile } = useDeviceDetect();
  const [showSplash, setShowSplash] = useState(true);
  const router = useRouter();

  // Handle splash screen for mobile
  useEffect(() => {
    if (isMobile && !user) {
      const timer = setTimeout(() => {
        setShowSplash(false);
      }, 5000);
      return () => clearTimeout(timer);
    } else {
      setShowSplash(false);
    }
  }, [isMobile, user]);

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

  // ✅ Show splash screen for mobile on first load
  if (isMobile && showSplash && !user) {
    return <SplashScreen />;
  }

  // ✅ Show login if not authenticated
  if (!user) {
    return isMobile ? <MobileLoginPage /> : <LoginPage />;
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

