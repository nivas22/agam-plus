'use client';

import { useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import MobileCreateAppointment from '@/components/mobile/MobileCreateAppointment';

export default function MobileAddAppointmentPage() {
  const params = useParams();
  const hospitalId = params.id as string;
  const { currentHospitalMembership } = useAuth();

  const userRole = currentHospitalMembership?.role || 'doctor';

  return (
    <MobileCreateAppointment 
      userRole={userRole} 
      hospitalId={hospitalId} 
    />
  );
}
