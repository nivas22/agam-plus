// app/hospital/[id]/layout.tsx
'use client';

import { useAuth } from '@/hooks/useAuth';
import { useParams } from 'next/navigation';
import AdminHospitalLayout from './AdminHospitalLayout';
import DoctorHospitalLayout from './DoctorHospitalLayout';

interface HospitalLayoutProps {
  children: React.ReactNode;
}

export default function HospitalLayout({ children }: HospitalLayoutProps) {
  const { getCurrentHospitalRole } = useAuth();
  const params = useParams();
  const hospitalId = params.id as string;

  const userRole = getCurrentHospitalRole();

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
