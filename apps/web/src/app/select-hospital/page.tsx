'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { Hospital } from '@/types/auth';
import { HospitalMember } from '@/types/doctorNew';
import { useDeviceDetect } from '@/hooks/useDeviceDetect';
import { ArrowRight, Building2, Check, Clock, LogOut, MapPin, Plus, Shield, Sparkles } from 'lucide-react';

export default function SelectHospitalPage() {
  const { isMobile } = useDeviceDetect();
  const { user, approvedHospitals, pendingHospitals, switchHospital, logout, getRoleBasedRedirect } = useAuth();
  const router = useRouter();
  const [isSwitching, setIsSwitching] = useState(false);
  const [selectedHospitalId, setSelectedHospitalId] = useState<string | null>(null);


  const handleSelectHospital = async (hospital: Hospital) => {
    try {
      setIsSwitching(true);
      setSelectedHospitalId(hospital.id);
      await switchHospital(hospital.id);
      
      const redirectPath = getRoleBasedRedirect(hospital.id, isMobile);
      router.push(redirectPath);
    } catch (error) {
      console.error('Failed to switch hospital:', error);
      setSelectedHospitalId(null);
    } finally {
      setIsSwitching(false);
    }
  };

  const handleRequestAccess = () => {
    router.push('/request-access');
  };

  const handleLogout = async () => {
    await logout();
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-200 border-t-indigo-600 mx-auto"></div>
          <p className="mt-6 text-gray-600 font-medium">Loading your hospitals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header Section */}
        <div className="mb-8 animate-fade-in">
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white">
                  Welcome back, {user.name}
                </h1>
              </div>
            </div>
            <p className="text-sm text-indigo-100 ml-15">
              Select a hospital to continue to your dashboard
            </p>
          </div>
        </div>

        {/* Approved Hospitals Section */}
        {approvedHospitals.length > 0 && (
          <div className="mb-6 animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <div className="flex items-center justify-center w-8 h-8 bg-emerald-100 rounded-lg mr-2">
                  <Check className="text-emerald-600 w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Active Hospitals</h2>
                  <p className="text-xs text-gray-500">{approvedHospitals.length} {approvedHospitals.length === 1 ? 'facility' : 'facilities'}</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {approvedHospitals.map((member, index) => (
                <HospitalCard
                  key={member.hospitalId}
                  hospital={member.hospital}
                  member={member}
                  onSelect={handleSelectHospital}
                  isSwitching={isSwitching && selectedHospitalId === member.hospital.id}
                  type="approved"
                  index={index}
                />
              ))}
            </div>
          </div>
        )}

        {/* Pending Hospitals Section */}
        {pendingHospitals.length > 0 && (
          <div className="mb-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <div className="flex items-center justify-center w-8 h-8 bg-amber-100 rounded-lg mr-2">
                  <Clock className="text-amber-600 w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Pending Approval</h2>
                  <p className="text-xs text-gray-500">{pendingHospitals.length} request{pendingHospitals.length === 1 ? '' : 's'} awaiting review</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pendingHospitals.map((member, index) => (
                <HospitalCard
                  key={member.hospitalId}
                  hospital={member.hospital}
                  member={member}
                  type="pending"
                  index={index}
                />
              ))}
            </div>
          </div>
        )}

        {/* No Hospitals State */}
        {approvedHospitals.length === 0 && pendingHospitals.length === 0 && (
          <div className="text-center py-16 animate-fade-in">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-2xl mb-6">
              <Building2 className="text-indigo-600 w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              No Hospital Access
            </h3>
            <p className="text-sm text-gray-600 mb-8 max-w-md mx-auto">
              Request access to a hospital to get started. You'll be able to access the platform once approved.
            </p>
            <div className="flex flex-col items-center gap-3">
              <button
                onClick={handleRequestAccess}
                className="inline-flex items-center px-6 py-2.5 border border-transparent text-sm font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 shadow-sm hover:shadow transition-all"
              >
                <Plus className="mr-2 w-4 h-4" />
                Request Hospital Access
              </button>
              <button
                onClick={handleLogout}
                className="inline-flex items-center text-sm font-medium text-gray-600 hover:text-gray-900 focus:outline-none transition-colors"
              >
                <LogOut className="mr-2 w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {(approvedHospitals.length > 0 || pendingHospitals.length > 0) && (
          <div className="flex flex-col items-center justify-center mt-6 gap-3 animate-fade-in">
            <button
              onClick={handleRequestAccess}
              className="inline-flex items-center px-5 py-2.5 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all shadow-sm hover:shadow"
            >
              <Plus className="mr-2 w-4 h-4" />
              Request Access to Another Hospital
            </button>
            <button
              onClick={handleLogout}
              className="inline-flex items-center text-sm font-medium text-gray-600 hover:text-gray-900 focus:outline-none transition-colors"
            >
              <LogOut className="mr-2 w-4 h-4" />
              Sign Out
            </button>
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
        .animate-fade-in {
          animation: fade-in 0.5s ease-out;
        }
        .animate-slide-up {
          animation: slide-up 0.6s ease-out;
        }
      `}</style>
    </div>
  );
}

interface HospitalCardProps {
  hospital: Hospital;
  member: HospitalMember;
  onSelect?: (hospital: Hospital) => void;
  isSwitching?: boolean;
  type: 'approved' | 'pending';
  index: number;
}

function HospitalCard({ hospital, member, onSelect, isSwitching, type, index }: HospitalCardProps) {
  const isApproved = type === 'approved';
  
  return (
    <div 
      className={`
        group bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden border border-gray-200
        ${isApproved ? 'hover:border-indigo-300' : 'hover:border-amber-300'}
        ${isSwitching ? 'ring-2 ring-indigo-500 ring-offset-2' : ''}
        animate-slide-up
      `}
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      <div className="p-4">
        {/* Hospital Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-start flex-1 min-w-0">
            <div className={`
              w-10 h-10 rounded-lg flex items-center justify-center mr-3 flex-shrink-0
              ${isApproved ? 'bg-indigo-100' : 'bg-amber-100'}
            `}>
              <Building2 className={`w-5 h-5 ${isApproved ? 'text-indigo-600' : 'text-amber-600'}`} />
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

        {/* Role and Status */}
        <div className="flex items-center justify-between mb-3">
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700">
            <Shield className="mr-1.5 w-3 h-3" />
            <span className="capitalize">{member.role}</span>
          </span>
          
          {isApproved ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700">
              <Check className="w-3 h-3 mr-1" />
              Active
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
              <Clock className="w-3 h-3 mr-1" />
              Pending
            </span>
          )}
        </div>

        {/* Action Button */}
        {isApproved && onSelect && (
          <button
            onClick={() => onSelect(hospital)}
            disabled={isSwitching}
            className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSwitching ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                Switching...
              </>
            ) : (
              <>
                Enter Dashboard
                <ArrowRight className="ml-2 w-4 h-4" />
              </>
            )}
          </button>
        )}

        {!isApproved && (
          <div className="text-center py-2 text-xs font-medium text-amber-700 bg-amber-50 rounded-lg border border-amber-200">
            Awaiting approval
          </div>
        )}
      </div>
    </div>
  );
}
