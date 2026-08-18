'use client';

import AdminDashboardClient from "@/components/dashboard/AdminDashboard";
import DoctorDashboardClient from "@/components/dashboard/DoctorDashboardClient";
import { useAuth } from "@/hooks/useAuth";
import { useRoleBasedDashboard } from "@/hooks/useDashboardData";

export default function Home() {
  const { getCurrentHospitalRole } = useAuth();

  const userRole = getCurrentHospitalRole() || "doctor";
  const dashboard = useRoleBasedDashboard(userRole);

  if (userRole === 'doctor') {
    return (
      <DoctorDashboardClient
        isLoading={dashboard.isLoading}
        formattedData={dashboard.formattedData}
        quickStats={dashboard.quickStats}
        error={dashboard.error}
        upcomingAppointments={dashboard.upcomingAppointments}
        recentActivity={dashboard.recentActivity}
        nextAppointment={dashboard.nextAppointment}
      />
    );
  }

  return (
    <AdminDashboardClient
      isLoading={dashboard.isLoading}
      formattedData={dashboard.formattedData}
      quickStats={dashboard.quickStats}
      error={dashboard.error}
    />
  );
}
