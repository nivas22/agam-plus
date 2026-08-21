// app/hospital/[id]/attendance/page.tsx
'use client';

import AttendancePage from '@/components/AttendancePage';
import { usePatientApi } from '@/hooks/useNewPatientApi';
import { useNewDoctorApi } from '@/hooks/useNewDoctorApi';
import { useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

export default function AdminDoctorsPage() {
  const { doctors } = useNewDoctorApi();
  const { patients } = usePatientApi();
  const { getCurrentHospitalRole, user } = useAuth();

  const userRole = getCurrentHospitalRole();
  const userId = user?.id;


  const { id: hospitalId } = useParams<{ id: string }>();

  return (
    <AttendancePage
      userRole={userRole}
      userId={userId}
      canEdit={true}
      doctors={doctors || []}
      patients={patients || []}
      hospitalId={hospitalId}
    />
  );
}
