'use client';

import { useState } from 'react';
import { useHospitalPatients } from '@/hooks/useNewPatientApi';
import PatientsPage from '@/components/patients/PatientsPage';
import { useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

export default function AdminPatientsPage() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  
  const { data, isLoading, refetch } = useHospitalPatients(undefined, { page, limit });
  const { getCurrentHospitalRole } = useAuth();
  const params = useParams();
  const hospitalId = params.id as string;
  
  const patientsArray = Array.isArray(data) ? data : data?.patients || [];
  const pagination = data?.pagination;
  const userRole = getCurrentHospitalRole();

  return (
    <PatientsPage 
      userRole={userRole} 
      canEdit={true}
      patients={patientsArray || []}
      isLoading={isLoading}
      refetchPatients={refetch}
      hospitalId={hospitalId}
      pagination={pagination}
      onPageChange={setPage}
      onLimitChange={setLimit}
    />
  );
}
