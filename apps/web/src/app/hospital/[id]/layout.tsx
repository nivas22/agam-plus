// app/hospital/[id]/layout.tsx
'use client';

import { useAuth } from '@/hooks/useAuth';
import { useParams } from 'next/navigation';
import { useDeviceDetect } from '@/hooks/useDeviceDetect';
import AdminHospitalLayout from './AdminHospitalLayout';
import DoctorHospitalLayout from './DoctorHospitalLayout';
import MobileAdminHospitalLayout from '@/app/mobile/hospital/[id]/AdminHospitalLayout';
import MobileDoctorHospitalLayout from '@/app/mobile/hospital/[id]/DoctorHospitalLayout';

interface HospitalLayoutProps {
  children: React.ReactNode;
}

export default function HospitalLayout({ children }: HospitalLayoutProps) {
  const { getCurrentHospitalRole } = useAuth();
  const params = useParams();
  const hospitalId = params.id as string;
  const { isMobile } = useDeviceDetect();
  
  // Debug logging
  console.log('🔍 Layout Debug:', { 
    isMobile, 
    screenWidth: typeof window !== 'undefined' ? window.innerWidth : 'SSR',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent.substring(0, 50) : 'SSR'
  });
  
  const userRole = getCurrentHospitalRole();
  
  // Mobile layouts
  if (isMobile) {
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
  
  // Desktop layouts
  if (userRole === 'doctor') {
    return (
      <DoctorHospitalLayout hospitalId={hospitalId}>
        {children}
      </DoctorHospitalLayout>
    );
  }

  return (
    <AdminHospitalLayout hospitalId={hospitalId}>
      {children}
    </AdminHospitalLayout>
  );
}
