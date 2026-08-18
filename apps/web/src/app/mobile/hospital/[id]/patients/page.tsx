'use client';

import { useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import MobilePatientsPage from '@/components/mobile/MobilePatientsPage';

export default function MobilePatientsRoute() {
  const { getCurrentHospitalRole } = useAuth();
  const params = useParams();
  const hospitalId = params.id as string;
  const userRole = getCurrentHospitalRole();

  return (
    <MobilePatientsPage 
      userRole={userRole} 
      canEdit={true}
      hospitalId={hospitalId}
    />
  );
}
