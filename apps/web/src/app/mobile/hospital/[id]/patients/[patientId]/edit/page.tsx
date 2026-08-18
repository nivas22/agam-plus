'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import MobileAddPatientPage from '@/components/mobile/MobileAddPatientPage';
import { apiUrl, fetchWithAuth } from '@/lib/api';

export default function EditPatientMobilePage() {
  const params = useParams();
  const hospitalId = params.id as string;
  const patientId = params.patientId as string;
  const [hospitalSpecializations, setHospitalSpecializations] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHospitalData = async () => {
      try {
        const response = await fetchWithAuth(apiUrl(`/hospitals/${hospitalId}`));
        if (response.ok) {
          const data = await response.json();
          setHospitalSpecializations(data.specializations || []);
        }
      } catch (error) {
        console.error('Failed to fetch hospital data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (hospitalId) {
      fetchHospitalData();
    }
  }, [hospitalId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-gray-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-gray-600 text-sm font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <MobileAddPatientPage 
      hospitalId={hospitalId} 
      patientId={patientId}
      hospitalSpecializations={hospitalSpecializations}
      isEdit={true}
    />
  );
}
