'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Hospital } from '@/types/auth';
import { ArrowLeft, Building2, CheckCircle, MapPin, Search, Send, UserCheck, Users, X } from 'lucide-react';
import { apiUrl, fetchWithAuth } from '@/lib/api';

interface HospitalWithRequestStatus extends Hospital {
  isRequested: boolean;
  isMember: boolean;
}

export default function RequestAccessPage() {
  const { user, hospitals } = useAuth();
  const [availableHospitals, setAvailableHospitals] = useState<HospitalWithRequestStatus[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState<'doctor' | 'staff'>('doctor');
  const [requestMessage, setRequestMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedHospital, setSelectedHospital] = useState<Hospital | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

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
    window.history.back();
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
          window.location.href = '/select-hospital?message=request_sent';
        }, 2000);
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
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-200 border-t-indigo-600 mx-auto"></div>
          <p className="mt-6 text-gray-600 font-medium">Loading hospitals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header with back button */}
        <div className="mb-6 animate-fade-in">
          <button
            onClick={handleBack}
            className="group inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-700 mb-4 transition-colors"
          >
            <ArrowLeft className="mr-2 w-4 h-4 transition-transform group-hover:-translate-x-1" />
            Back to Hospital Selection
          </button>
          
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 shadow-lg">
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
              Request Hospital Access
            </h1>
            <p className="text-sm text-indigo-100">
              Search and connect with healthcare facilities
            </p>
          </div>
        </div>

        {/* Search Card */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6 border border-gray-200 animate-slide-up">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="w-4 h-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search hospitals by name or location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm bg-white placeholder-gray-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
            />
          </div>
        </div>

        {/* Hospitals Grid */}
        {filteredHospitals.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {filteredHospitals.map((hospital, index) => (
              <HospitalCard
                key={hospital.id}
                hospital={hospital}
                onRequest={handleRequestAccess}
                index={index}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 animate-fade-in">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-2xl mb-6">
              <Building2 className="w-8 h-8 text-indigo-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              No hospitals found
            </h3>
            <p className="text-sm text-gray-600">
              {searchTerm ? 'Try adjusting your search terms.' : 'No hospitals available for access.'}
            </p>
          </div>
        )}

        {/* Request Modal */}
        {selectedHospital && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm overflow-y-auto h-full w-full flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-auto p-8 animate-scale-in">
              <button
                onClick={() => setSelectedHospital(null)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
              
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-100 rounded-xl mb-4">
                  <Building2 className="w-7 h-7 text-indigo-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">
                  Request Access
                </h3>
                <p className="text-sm text-gray-600">{selectedHospital.name}</p>
              </div>
              
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Select Your Role
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setSelectedRole('doctor')}
                      className={`flex items-center justify-center px-4 py-3 rounded-xl border-2 transition-all duration-200 ${
                        selectedRole === 'doctor'
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-gray-200 hover:border-gray-300 text-gray-700'
                      }`}
                    >
                      <UserCheck className="mr-2 w-5 h-5" />
                      Doctor
                    </button>
                    <button
                      onClick={() => setSelectedRole('staff')}
                      className={`flex items-center justify-center px-4 py-3 rounded-xl border-2 transition-all duration-200 ${
                        selectedRole === 'staff'
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-gray-200 hover:border-gray-300 text-gray-700'
                      }`}
                    >
                      <Users className="mr-2 w-5 h-5" />
                      Staff
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Message to Hospital Admin
                    <span className="text-gray-400 font-normal ml-1">(Optional)</span>
                  </label>
                  <textarea
                    value={requestMessage}
                    onChange={(e) => setRequestMessage(e.target.value)}
                    placeholder="Introduce yourself and explain why you'd like to join this hospital..."
                    rows={4}
                    className="block w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all duration-200 resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <button
                  onClick={() => setSelectedHospital(null)}
                  disabled={isSubmitting}
                  className="flex-1 px-6 py-3 text-sm font-semibold text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-300 disabled:opacity-50 transition-all duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={submitRequest}
                  disabled={isSubmitting}
                  className="flex-1 inline-flex items-center justify-center px-6 py-3 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors shadow-sm">
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 w-4 h-4" />
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
          <div className="fixed bottom-6 right-6 bg-emerald-500 text-white px-5 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-slide-up z-50">
            <CheckCircle className="w-5 h-5" />
            <div>
              <p className="font-semibold text-sm">Request Sent Successfully!</p>
              <p className="text-xs text-emerald-100">The hospital admin will review your request.</p>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes scale-in {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.5s ease-out;
        }
        .animate-slide-up {
          animation: slide-up 0.6s ease-out;
        }
        .animate-scale-in {
          animation: scale-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}

interface HospitalCardProps {
  hospital: HospitalWithRequestStatus;
  onRequest: (hospital: Hospital) => void;
  index: number;
}

function HospitalCard({ hospital, onRequest, index }: HospitalCardProps) {
  return (
    <div 
      className="group bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden border border-gray-200 hover:border-indigo-300 animate-slide-up"
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      <div className="p-4">
        {/* Hospital Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-start flex-1 min-w-0">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center mr-3 flex-shrink-0 bg-indigo-100">
              <Building2 className="w-5 h-5 text-indigo-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-gray-900 truncate mb-0.5">
                {hospital.name}
              </h3>
              <div className="flex items-center text-xs text-gray-500">
                <MapPin className="w-3 h-3 mr-1 flex-shrink-0" />
                <p className="truncate">{hospital.address}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Status and Action */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500">
            {hospital.isMember && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700">
                Member
              </span>
            )}
            {hospital.isRequested && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                Pending
              </span>
            )}
          </div>

          {!hospital.isMember && !hospital.isRequested && (
            <button
              onClick={() => onRequest(hospital)}
              className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
            >
              <Send className="mr-1.5 w-3 h-3" />
              Request
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
