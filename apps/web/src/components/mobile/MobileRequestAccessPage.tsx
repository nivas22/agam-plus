'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { Hospital } from '@/types/auth';
import { ArrowLeft, Check, CheckCircle, Clock, Hospital as HospitalIcon, MapPin, Search, Send, UserCheck, Users, X } from 'lucide-react';
import MobileLoadingSpinner from './MobileLoadingSpinner';
import { apiUrl, fetchWithAuth } from '@/lib/api';

interface HospitalWithRequestStatus extends Hospital {
  isRequested: boolean;
  isMember: boolean;
}

export default function MobileRequestAccessPage() {
  const { user, hospitals, currentHospital, getMembership } = useAuth();
  const router = useRouter();
  const [availableHospitals, setAvailableHospitals] = useState<HospitalWithRequestStatus[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState<'doctor' | 'staff'>('doctor');
  const [requestMessage, setRequestMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedHospital, setSelectedHospital] = useState<Hospital | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const membership = getMembership?.();
  const hospitalId = currentHospital?.id || membership?.hospitalId || '';

  // Fetch all hospitals and mark requested/joined ones
  useEffect(() => {
    const fetchHospitals = async () => {
      try {
        const response = await fetchWithAuth(apiUrl('/hospitals'));
        if (response.ok) {
          const allHospitals: Hospital[] = await response.json();
          
          const hospitalsWithStatus = allHospitals.map(hospital => {
            const existingMembership = hospitals.find(m => m.hospitalId === hospital.id);
            return {
              ...hospital,
              isRequested: existingMembership?.status === 'pending',
              isMember: existingMembership?.status === 'approved'
            };
          });

          setAvailableHospitals(hospitalsWithStatus);
        }
      } catch (error) {
        console.error('Failed to fetch hospitals:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHospitals();
  }, [hospitals]);

  const filteredHospitals = availableHospitals.filter(hospital =>
    (hospital.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    hospital.address.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleRequestAccess = (hospital: Hospital) => {
    setSelectedHospital(hospital);
  };

  const handleBack = () => {
    // Navigate back to profile page
    if (hospitalId) {
      router.push(`/mobile/hospital/${hospitalId}/profile`);
    } else {
      router.back();
    }
  };

  const submitRequest = async () => {
    if (!selectedHospital) return;

    try {
      setIsSubmitting(true);
      
      const response = await fetchWithAuth(apiUrl('/hospitals/request-access'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          hospitalId: selectedHospital.id,
          role: selectedRole,
          message: requestMessage,
          userId: user?.id,
        }),
      });

      if (response.ok) {
        setShowSuccess(true);
        setSelectedHospital(null);
        setRequestMessage('');
        
        // Update hospital status in the list
        setAvailableHospitals(prev => 
          prev.map(h => h.id === selectedHospital.id ? {...h, isRequested: true} : h)
        );
        
        setTimeout(() => {
          setShowSuccess(false);
        }, 3000);
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to send request');
      }
    } catch (error) {
      console.error('Request failed:', error);
      alert('Failed to send request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <MobileLoadingSpinner message="Loading hospitals..." variant="default" size="lg" />;
  }

  return (
    <div className="min-h-screen bg-surface-canvas">
      {/* Simple Top Header with Back Button - Always Visible */}
      <div className="bg-surface-paper border-b border-border px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="p-2 -ml-2 hover:bg-surface-canvas rounded-lg transition-colors active:scale-95"
            aria-label="Go back"
          >
            <ArrowLeft size={20} className="text-ink-700" />
          </button>
          <h1 className="text-lg font-bold text-ink-900">Request Access</h1>
        </div>
      </div>

      <div className="p-4 pb-6 bg-surface-canvas min-h-screen">
        {/* Search Bar */}
        <div className="mb-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Search className="w-5 h-5 text-ink-500" />
            </div>
            <input
              type="text"
              placeholder="Search hospitals by name or location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-11 pr-4 py-3 border border-border rounded-xl leading-5 bg-surface-paper placeholder-ink-500 focus:outline-none focus:border-brand-violet focus:ring-2 focus:ring-brand-violet/20 transition-all shadow-sm"
            />
          </div>
        </div>

        {/* Hospitals List */}
        {filteredHospitals.length > 0 ? (
          <div className="space-y-3">
            {filteredHospitals.map((hospital) => (
              <HospitalCard
                key={hospital.id}
                hospital={hospital}
                onRequest={handleRequestAccess}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 px-4">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-brand-violet-soft to-brand-violet-soft rounded-2xl mb-4">
              <HospitalIcon className="w-8 h-8 text-brand-violet" />
            </div>
            <h3 className="text-lg font-bold text-ink-900 mb-2">
              No hospitals found
            </h3>
            <p className="text-ink-500 text-sm max-w-xs mx-auto leading-relaxed">
              {searchTerm ? 'Try adjusting your search terms.' : 'No hospitals available for access.'}
            </p>
          </div>
        )}

        {/* Request Modal */}
        {selectedHospital && (
          <div className="fixed inset-0 bg-trace-background/50 backdrop-blur-sm overflow-y-auto h-full w-full flex items-end z-50">
            <div className="bg-surface-paper rounded-t-3xl w-full p-6 animate-slide-up max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-ink-900">
                  Request Access
                </h3>
                <button
                  onClick={() => setSelectedHospital(null)}
                  className="p-2 hover:bg-surface-canvas rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-ink-700" />
                </button>
              </div>

              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-brand-violet to-brand-violet rounded-full mb-3">
                  <HospitalIcon className="w-8 h-8 text-white" />
                </div>
                <p className="text-base font-semibold text-ink-900">{selectedHospital.name}</p>
                <div className="flex items-center justify-center text-sm text-ink-700 mt-1">
                  <MapPin className="w-4 h-4 mr-1" />
                  <span className="line-clamp-1">{selectedHospital.address}</span>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-ink-700 mb-2">
                    Select Your Role
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setSelectedRole('doctor')}
                      className={`flex items-center justify-center px-4 py-3 rounded-xl border-2 transition-all ${
                        selectedRole === 'doctor'
                          ? 'border-brand-violet bg-brand-violet-soft text-brand-violet'
                          : 'border-border hover:border-border text-ink-700'
                      }`}
                    >
                      <UserCheck className="mr-2 w-5 h-5" />
                      Doctor
                    </button>
                    <button
                      onClick={() => setSelectedRole('staff')}
                      className={`flex items-center justify-center px-4 py-3 rounded-xl border-2 transition-all ${
                        selectedRole === 'staff'
                          ? 'border-brand-violet bg-brand-violet-soft text-brand-violet'
                          : 'border-border hover:border-border text-ink-700'
                      }`}
                    >
                      <Users className="mr-2 w-5 h-5" />
                      Staff
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-ink-700 mb-2">
                    Message to Hospital Admin
                    <span className="text-ink-500 font-normal ml-1">(Optional)</span>
                  </label>
                  <textarea
                    value={requestMessage}
                    onChange={(e) => setRequestMessage(e.target.value)}
                    placeholder="Introduce yourself..."
                    rows={4}
                    className="block w-full px-4 py-3 border-2 border-border rounded-xl focus:outline-none focus:border-brand-violet transition-all resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setSelectedHospital(null)}
                  disabled={isSubmitting}
                  className="flex-1 px-6 py-3 text-sm font-semibold text-ink-700 bg-surface-canvas rounded-xl hover:bg-surface-canvas disabled:opacity-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={submitRequest}
                  disabled={isSubmitting}
                  className="flex-1 inline-flex items-center justify-center px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-brand-violet to-brand-violet rounded-xl hover:from-brand-violet-hover hover:to-brand-violet-hover disabled:opacity-50 transition-all shadow-lg"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"></div>
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 w-5 h-5" />
                      Send Request
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Success Toast */}
        {showSuccess && (
          <div className="fixed bottom-6 left-4 right-4 bg-status-open text-white px-4 py-4 rounded-xl shadow-2xl flex items-center gap-3 z-50">
            <CheckCircle className="w-6 h-6 flex-shrink-0" />
            <div>
              <p className="font-semibold text-sm">Request Sent Successfully!</p>
              <p className="text-xs text-status-open-soft">The hospital admin will review your request.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface HospitalCardProps {
  hospital: HospitalWithRequestStatus;
  onRequest: (hospital: Hospital) => void;
}

function HospitalCard({ hospital, onRequest }: HospitalCardProps) {
  return (
    <div className="bg-surface-paper rounded-xl shadow-sm border border-border p-4 transition-all hover:shadow-md">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-12 h-12 bg-gradient-to-br from-brand-violet to-brand-violet rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
          <HospitalIcon className="text-white w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-ink-900 mb-1 line-clamp-1">
            {hospital.name}
          </h3>
          <div className="flex items-start text-xs text-ink-500">
            <MapPin className="mt-0.5 mr-1 flex-shrink-0 w-3.5 h-3.5" />
            <span className="line-clamp-2">{hospital.address}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end pt-3 border-t border-border">
        {hospital.isMember && (
          <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-status-open-soft text-status-open border border-status-open/20">
            <Check className="mr-1.5 w-3.5 h-3.5" />
            Already a member
          </span>
        )}
        {hospital.isRequested && (
          <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-status-warning-soft text-status-warning border border-status-warning/20">
            <Clock className="mr-1.5 w-3.5 h-3.5" />
            Request pending
          </span>
        )}

        {!hospital.isMember && !hospital.isRequested && (
          <button
            onClick={() => onRequest(hospital)}
            className="inline-flex items-center px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-brand-violet to-brand-violet rounded-lg hover:from-brand-violet-hover hover:to-brand-violet-hover transition-all shadow-sm active:scale-95"
          >
            <Send className="mr-2 w-4 h-4" />
            Request Access
          </button>
        )}
      </div>
    </div>
  );
}
