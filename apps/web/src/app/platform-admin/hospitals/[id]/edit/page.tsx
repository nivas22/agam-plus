'use client';

import { useParams } from 'next/navigation';
import AddEditHospital from '@/components/hospitals/AddEditHospital';

export default function EditHospitalPage() {
  const params = useParams();
  const id = params.id as string;

  return <AddEditHospital id={id} />;
}
