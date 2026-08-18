// app/mobile/hospital/[id]/layout.tsx
'use client';

import { useAuth } from '@/hooks/useAuth';
import { useParams } from 'next/navigation';
import MobileAdminHospitalLayout from './AdminHospitalLayout';
import MobileDoctorHospitalLayout from './DoctorHospitalLayout';

interface HospitalLayoutProps {
  children: React.ReactNode;
}

export default function MobileHospitalLayout({ children }: HospitalLayoutProps) {
  const { getCurrentHospitalRole } = useAuth();
  const params = useParams();
  const hospitalId = params.id as string;
  
  const userRole = getCurrentHospitalRole();
  if (userRole === 'doctor') {
    return (
      <MobileDoctorHospitalLayout hospitalId={hospitalId}>
        {children}
      </MobileDoctorHospitalLayout>
    );
  }

  return (
    <MobileAdminHospitalLayout hospitalId={hospitalId}>
      {children}
    </MobileAdminHospitalLayout>
  );
}
