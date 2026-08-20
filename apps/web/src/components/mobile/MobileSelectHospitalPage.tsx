'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { Hospital } from '@/types/auth';
import { HospitalMember } from '@/types/doctorNew';
import { ArrowLeft, ArrowRight, Check, Clock, Hospital as HospitalIcon, MapPin, Shield } from 'lucide-react';
import MobileLoadingSpinner from './MobileLoadingSpinner';

export default function MobileSelectHospitalPage() {
  const { user, approvedHospitals, pendingHospitals, switchHospital, getRoleBasedRedirect, currentHospital, getMembership } = useAuth();
  const router = useRouter();
  const [isSwitching, setIsSwitching] = useState(false);
  const [selectedHospitalId, setSelectedHospitalId] = useState<string | null>(null);

  const membership = getMembership?.();
  const hospitalId = currentHospital?.id || membership?.hospitalId || '';

  const handleSelectHospital = async (hospital: Hospital) => {
    try {
      setIsSwitching(true);
      setSelectedHospitalId(hospital.id);
      await switchHospital(hospital.id);
      
      // Get the desktop redirect path and convert to mobile
      const desktopPath = getRoleBasedRedirect(hospital.id);
      const mobilePath = desktopPath.startsWith('/mobile') ? desktopPath : `/mobile${desktopPath}`;
      router.push(mobilePath);
    } catch (error) {
      console.error('Failed to switch hospital:', error);
      setSelectedHospitalId(null);
    } finally {
      setIsSwitching(false);
    }
  };

  const handleBack = () => {
    // Navigate back to profile page
    if (hospitalId) {
      router.push(`/mobile/hospital/${hospitalId}/profile`);
    } else {
      router.back();
    }
  };

  if (!user) {
    return <MobileLoadingSpinner message="Loading your hospitals..." variant="default" size="lg" />;
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
          <h1 className="text-lg font-bold text-ink-900">Switch Hospital</h1>
        </div>
      </div>

      <div className="bg-surface-canvas min-h-screen py-4 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Approved Hospitals Section */}
        {approvedHospitals.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center mb-3 px-1">
              <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-status-open to-status-open-hover rounded-lg mr-2.5 shadow-sm">
                <Check className="text-white w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-ink-900">Your Hospitals</h2>
                <p className="text-xs text-ink-500">{approvedHospitals.length} active</p>
              </div>
            </div>
            <div className="space-y-3">
              {approvedHospitals.map((member) => (
                <MobileHospitalCard
                  key={member.hospitalId}
                  hospital={member.hospital}
                  member={member}
                  onSelect={handleSelectHospital}
                  isSwitching={isSwitching && selectedHospitalId === member.hospital.id}
                  type="approved"
                />
              ))}
            </div>
          </div>
        )}

        {/* Pending Hospitals Section */}
        {pendingHospitals.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center mb-3 px-1">
              <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-status-warning to-status-warning-hover rounded-lg mr-2.5 shadow-sm">
                <Clock className="text-white w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-ink-900">Pending Approval</h2>
                <p className="text-xs text-ink-500">{pendingHospitals.length} request{pendingHospitals.length === 1 ? '' : 's'}</p>
              </div>
            </div>
            <div className="space-y-3">
              {pendingHospitals.map((member) => (
                <MobileHospitalCard
                  key={member.hospitalId}
                  hospital={member.hospital}
                  member={member}
                  type="pending"
                />
              ))}
            </div>
          </div>
        )}

        {/* No Hospitals State */}
        {approvedHospitals.length === 0 && pendingHospitals.length === 0 && (
          <div className="text-center py-12 px-4">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-violet-soft rounded-2xl mb-4">
              <HospitalIcon className="text-brand-violet w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-ink-900 mb-2">
              No Hospital Access Yet
            </h3>
            <p className="text-sm text-ink-500 max-w-xs mx-auto leading-relaxed">
              You don't have access to any hospitals. Use the Request Access option from the profile menu to join a hospital.
            </p>
          </div>
        )}

      </div>
      </div>
    </div>
  );
}

interface MobileHospitalCardProps {
  hospital: Hospital;
  member: HospitalMember;
  onSelect?: (hospital: Hospital) => void;
  isSwitching?: boolean;
  type: 'approved' | 'pending';
}

function MobileHospitalCard({ hospital, member, onSelect, isSwitching, type }: MobileHospitalCardProps) {
  const isApproved = type === 'approved';
  
  return (
    <div 
      className={`
        bg-surface-paper rounded-xl shadow-sm overflow-hidden border border-border
        ${isSwitching ? 'ring-2 ring-brand-violet' : ''}
        transition-all hover:shadow-md
      `}
    >
      <div className="p-4">
        {/* Hospital Info */}
        <div className="flex items-start gap-3 mb-3">
          <div className={`
            w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm
            ${isApproved
              ? 'bg-gradient-to-br from-brand-violet to-brand-violet-hover'
              : 'bg-gradient-to-br from-status-warning to-status-warning-hover'
            }
          `}>
            <HospitalIcon className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-ink-900 mb-1 line-clamp-1">
              {hospital.name}
            </h3>
            <div className="flex items-start text-xs text-ink-500">
              <MapPin className="mt-0.5 mr-1 flex-shrink-0 w-3.5 h-3.5" />
              <p className="line-clamp-2">{hospital.address}</p>
            </div>
          </div>
          
          {/* Status Badge */}
          {isApproved ? (
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-status-open-soft flex-shrink-0">
              <Check className="w-4 h-4 text-status-open" />
            </span>
          ) : (
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-status-warning-soft flex-shrink-0">
              <Clock className="w-4 h-4 text-status-warning" />
            </span>
          )}
        </div>

        {/* Role Badge */}
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-brand-violet-soft text-brand-violet border border-brand-violet/20">
            <Shield className="mr-1.5 w-3.5 h-3.5" />
            <span className="capitalize">{member.role}</span>
          </span>
        </div>

        {/* Action Button */}
        {isApproved && onSelect && (
          <button
            onClick={() => onSelect(hospital)}
            disabled={isSwitching}
            className="w-full flex justify-center items-center py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-brand-violet to-brand-violet-hover hover:from-brand-violet-hover hover:to-brand-violet-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm active:scale-95"
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
          <div className="text-center py-2.5 text-xs font-semibold text-status-warning bg-status-warning-soft rounded-lg border border-status-warning/20">
            <Clock className="inline mr-1.5 w-3.5 h-3.5" />
            Awaiting approval
          </div>
        )}
      </div>
    </div>
  );
}
