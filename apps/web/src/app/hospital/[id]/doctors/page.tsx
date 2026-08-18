// app/hospital/[id]/doctors/page.tsx
'use client';

import { useState } from 'react';
import DoctorsPage from '@/components/doctors/DoctorsPage';
import { useNewDoctorApi } from '@/hooks/useNewDoctorApi';
import { useParams } from 'next/navigation';

export default function AdminDoctorsPage() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  
  const { 
    doctors, 
    isLoading,
    refetchDoctors,
    pagination
  } = useNewDoctorApi(undefined, { page, limit }); // Automatically uses hospitalId from URL params
  const params = useParams();
  const hospitalId = params.id as string;

  return (
    <DoctorsPage 
      userRole="admin" 
      canEdit={true}
      doctors={doctors}
      isLoading={isLoading}
      refetchDoctors={refetchDoctors}
      hospitalId={hospitalId}
      pagination={pagination}
      onPageChange={setPage}
      onLimitChange={setLimit}
      // Pass additional props that your DoctorsPage might need
      // onCreateDoctor={createDoctor}
      // onDeleteDoctor={deleteDoctor}
      // onUpdateDoctor={updateDoctor}
    />
  );
}