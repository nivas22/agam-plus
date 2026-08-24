"use client";

import { useParams } from "next/navigation";
import AdminDashboardClient from "@/components/dashboard/AdminDashboard";
import DoctorDashboardPage from "@/components/dashboard/DoctorDashboardPage";
import { useAuth } from "@/hooks/useAuth";

export default function Home() {
  const { id: hospitalId } = useParams<{ id: string }>();
  const { getCurrentHospitalRole, user } = useAuth();

  const userRole = getCurrentHospitalRole() || "doctor";

  if (userRole === "doctor") {
    if (!hospitalId || !user?.id) return null;
    return <DoctorDashboardPage hospitalId={hospitalId} doctorId={user.id} />;
  }

  return <AdminDashboardClient />;
}
