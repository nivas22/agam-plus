'use client';

import { useParams } from 'next/navigation';
import AddEditDoctor from '@/components/doctors/AddEditDoctor';

export default function AddDoctorPage() {
  const params = useParams();
  const hospitalId = params.id as string;

  return <AddEditDoctor isNew userRole="admin" canEdit={true} hospitalId={hospitalId} />;
}
