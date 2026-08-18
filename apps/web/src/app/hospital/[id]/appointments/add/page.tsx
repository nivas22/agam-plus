'use client';

// app/admin/patients/add/page.tsx
import CreateAppointment from '@/components/CreateAppointment';
import { useParams } from 'next/navigation';

export default function AddAppointmentPage() {
  const params = useParams();
  const hospitalId = params.id as string;

  return (
    <CreateAppointment
      userRole="admin"
      canEdit={true}
      hospitalId={hospitalId}
    />
  );
}
