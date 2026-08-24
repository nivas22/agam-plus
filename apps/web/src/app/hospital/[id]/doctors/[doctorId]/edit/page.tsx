'use client';

// app/admin/patients/add/page.tsx
import AddEditDoctor from '@/components/doctors/AddEditDoctor';
import { useParams } from 'next/navigation';

export default function AddPatientPage() {
  const params = useParams();
  const hospitalId = params.id as string;
  const doctorId = params.doctorId as string;

  return (
    <AddEditDoctor
      isNew={false}
      userRole="admin"
      canEdit={true}
      hospitalId={hospitalId}
      id={doctorId}
    />
  );
}
