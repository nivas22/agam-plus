'use client';

import AppointmentsPage from "@/components/AdminAppointmentsPage";
import { useAuth } from "@/hooks/useAuth";
import { useParams } from 'next/navigation';
import { useDeviceDetect } from '@/hooks/useDeviceDetect';

export default function AppointmentPage() {
  const { id: hospitalId } = useParams<{ id: string }>();
  const { getCurrentHospitalRole, user } = useAuth();
  const { isMobile } = useDeviceDetect();

  const userRole = getCurrentHospitalRole();
  const userId = user?.id;

  return (
    <>
      {hospitalId && (
        <AppointmentsPage
          userRole={userRole}
          canEdit={true}
          hospitalId={hospitalId}
          userId={userId}
          isMobile={isMobile}
        />
      )}
    </>
  );
}
