'use client';

import { useParams, useRouter } from 'next/navigation';
import AddDoctorPersonal from '@/components/doctors/AddDoctorPersonal';
import { useNewDoctorApi } from '@/hooks/useNewDoctorApi';
import { CreateDoctorData } from '@/types/doctorNew';

export default function AddDoctorPage() {
  const params = useParams();
  const router = useRouter();
  const hospitalId = params.id as string;
  const { createDoctor } = useNewDoctorApi(hospitalId, undefined, true);

  return (
    // <div className="min-h-screen bg-gray-50 py-4 md:py-8">
      <AddDoctorPersonal
          onBack={() => router.push(`/hospital/${hospitalId}/doctors`)}
          onSave={(data) => {
            const payload: CreateDoctorData = {
              name: data.name ?? "",
              email: data.email ?? "",
              phone: data.phone ?? "",
              hospitalId: hospitalId,
            };

            createDoctor(payload);
          }}
        />
    // </div>
  );
}
