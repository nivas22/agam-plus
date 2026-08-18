'use client';

import { useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import MobileDoctorsPage from '@/components/mobile/MobileDoctorsPage';

export default function MobileDoctorsRoute() {
  const { getCurrentHospitalRole } = useAuth();
  const params = useParams();
  const hospitalId = params.id as string;
  const userRole = getCurrentHospitalRole();

  return (
    <MobileDoctorsPage 
      userRole={userRole} 
      canEdit={true}
      hospitalId={hospitalId}
    />
  );
}
