'use client';

// app/admin/patients/add/page.tsx
import AddEditPatient from '@/components/patients/AddEditPatient1';
import { useParams } from 'next/navigation';

export default function AddPatientPage() {
  const params = useParams();
  const hospitalId = params.id as string;
  const patientId = params.patientId as string;
  
  return (
    <AddEditPatient 
      isNew={false}
      userRole="admin"
      canEdit={true}
      hospitalId={hospitalId}
      id={patientId}
    />
  );
}
