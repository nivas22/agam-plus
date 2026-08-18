'use client';

import CalendarAppointmentsPage from "@/components/CalendarAppointmentsPage";
import { useAuth } from "@/hooks/useAuth";
import { useParams } from 'next/navigation';

export default function CalendarAppointmentPage() {
  const { id: hospitalId } = useParams<{ id: string }>();
  const { getCurrentHospitalRole, user } = useAuth();

  const userRole = getCurrentHospitalRole();
  const userId = user?.id;

  return (
    <>
      {hospitalId && (
        <CalendarAppointmentsPage
          userRole={userRole}
          canEdit={true}
          hospitalId={hospitalId}
          userId={userId}
        />
      )}
    </>
  );
}
