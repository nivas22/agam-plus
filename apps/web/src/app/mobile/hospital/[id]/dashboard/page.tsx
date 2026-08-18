'use client';

import { useParams } from 'next/navigation';
import MobileDoctorDashboard from '@/components/mobile/MobileDoctorDashboard';
import MobileAdminDashboard from '@/components/mobile/MobileAdminDashboard';
import { useAuth } from '@/hooks/useAuth';
import { useRoleBasedDashboard } from '@/hooks/useDashboardData';
import { useCurrentDoctorProfile } from '@/hooks/useNewDoctorApi';
import { ROLE } from '@agam-plus/shared';

export default function MobileDashboardPage() {
  const params = useParams();
  const hospitalId = params.id as string;
  const { getCurrentHospitalRole, user, currentHospital } = useAuth();
  const userRole = getCurrentHospitalRole() || ROLE.DOCTOR;
  const dashboard = useRoleBasedDashboard(userRole);
  const { data: doctorProfile, isLoading: isLoadingProfile } = useCurrentDoctorProfile(user?.id, hospitalId);
  const isAdmin = userRole === ROLE.ADMIN;

  // Render admin dashboard for admin users
  if (isAdmin) {
    return (
      <MobileAdminDashboard
        hospitalId={hospitalId}
        hospitalName={currentHospital?.name || 'Hospital'}
      />
    );
  }

  // Render doctor dashboard for doctor users
  return (
    <MobileDoctorDashboard
      user={user}
      doctorProfile={doctorProfile}
      isLoading={dashboard.isLoading || isLoadingProfile}
      formattedData={dashboard.formattedData}
      quickStats={dashboard.quickStats}
      error={dashboard.error}
      upcomingAppointments={dashboard.upcomingAppointments}
      recentActivity={dashboard.recentActivity}
      nextAppointment={dashboard.nextAppointment}
    />
  );
}
