'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { 
  Award,
  Check,
  Building2,
  ChevronRight,
  AlertTriangle,
  Clock,
  Mail,
  Phone,
  LogOut,
  HelpCircle,
  ShieldQuestion,
  ArrowLeft,
  Users,
  Edit2,
  Stethoscope,
  RefreshCw,
  UserPlus
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { getDoctorById } from '@/hooks/useNewDoctorApi';
import { useAvailabilityApi } from '@/hooks/useAvailability';
import { TimeSlot } from '@/types/appointment';
import MobileLoadingSpinner from './MobileLoadingSpinner';

interface AdminProfile {
  name: string;
  email: string;
  phone?: string;
  role: string;
  profileImage?: string;
}

interface DoctorProfile {
  name: string;
  email: string;
  specialization: string;
  qualification: string;
  bio: string;
  experience?: string;
  phone?: string;
  profileImage?: string;
  role?: string;
}

type ProfileData = AdminProfile | DoctorProfile;

export default function MobileProfilePage() {
  const { user, currentHospital, isDoctor, isAdmin, getMembership, logout } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  
  const membership = getMembership?.();
  const hospitalId = currentHospital?.id || membership?.hospitalId || '';
  const doctorId = user?.id || '';
  
  const { availability, isLoading: isLoadingAvailability } = useAvailabilityApi(
    isDoctor ? hospitalId : '',
    isDoctor ? doctorId : ''
  );

  // Fetch patients list
  // const { data: patientsData, isLoading: isLoadingPatients } = useHospitalPatients(
  //   hospitalId,
  //   { status: 'active', limit: 10 },
  //   !!hospitalId
  // );

  // // Fetch doctors list (for admin only)
  // const { data: doctorsData, isLoading: isLoadingDoctors } = useHospitalDoctors(
  //   hospitalId,
  //   { status: 'active', limit: 10 },
  //   !!hospitalId && isAdmin
  // );

  const formatTimeForDisplay = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${period}`;
  };

  const getDayAvailability = (dayName: string): TimeSlot[] => {
    if (!availability?.availability) return [];
    return availability.availability.filter(slot => slot.day === dayName);
  };

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const membership = getMembership?.();
        const hospitalId = currentHospital?.id || membership?.hospitalId;

        if (user && isDoctor && hospitalId) {
          const doctor = await getDoctorById(hospitalId, user.id);
          const data: ProfileData = {
            name: doctor.name,
            email: doctor.email,
            specialization: doctor.specialization,
            qualification: doctor.qualification,
            bio: doctor.bio,
            experience: doctor.experience,
            phone: doctor.phone,
            profileImage: undefined,
            role: membership?.role || 'doctor',
          };
          setProfileData(data);
        } else if (user) {
          const adminData: ProfileData = {
            name: user.name || 'User',
            email: user.email || '',
            phone: '',
            role: user.role || 'admin',
            profileImage: undefined,
          };
          setProfileData(adminData);
        }
      } catch (error) {
        console.error('Failed to fetch profile:', error);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchProfile();
    }
  }, [user, isDoctor, currentHospital?.id]);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-surface-canvas">
      {/* Simple Top Header with Back Button - Always Visible */}
      <div className="bg-surface-paper border-b border-border px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/mobile/hospital/${hospitalId}/dashboard`)}
            className="p-2 -ml-2 hover:bg-surface-canvas rounded-lg transition-colors active:scale-95"
            aria-label="Go back"
          >
            <ArrowLeft size={20} className="text-ink-700" />
          </button>
          <h1 className="text-lg font-bold text-ink-900">Settings</h1>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <MobileLoadingSpinner message="Loading profile..." variant="default" size="md" fullScreen={false} />
      )}

      {/* Error State */}
      {!loading && !profileData && (
        <div className="flex items-center justify-center py-20 px-4">
          <div className="text-center">
            <AlertTriangle className="text-status-danger mx-auto mb-3" size={32} />
            <h3 className="text-lg font-semibold text-ink-900 mb-2">Profile Not Found</h3>
            <p className="text-sm text-ink-500">Please try again</p>
          </div>
        </div>
      )}

      {/* Profile Content - Only show when loaded and data exists */}
      {!loading && profileData && (
      <>
      {/* Profile Header Card */}
      <div className="px-4 pt-4 pb-3">
        <div className="bg-gradient-to-br from-brand-violet to-brand-violet-hover rounded-2xl p-4 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-surface-paper flex items-center justify-center text-2xl font-bold text-brand-violet overflow-hidden">
                {profileData.profileImage ? (
                  <Image 
                    src={profileData.profileImage} 
                    alt="Profile" 
                    width={64}
                    height={64}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  profileData.name.charAt(0).toUpperCase()
                )}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-status-open rounded-full border-2 border-white"></div>
            </div>
            
            <div className="flex-1">
              <h2 className="text-xl font-bold text-white">{profileData.name}</h2>
              <p className="text-brand-violet-soft text-sm">{profileData.email}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 pb-6 space-y-3">
        {/* Quick Stats - Doctor Experience */}
        {'specialization' in profileData && (
          <div className="bg-surface-paper rounded-2xl p-4 shadow-sm">
            <div className="grid grid-cols-2 divide-x divide-border">
              <div className="text-center">
                <Award className="w-5 h-5 text-brand-violet mx-auto mb-1" />
                <p className="text-lg font-bold text-ink-900">{profileData.experience || 'N/A'}</p>
                <p className="text-xs text-ink-500">Experience</p>
              </div>
              <div className="text-center">
                <Check className="w-5 h-5 text-status-open mx-auto mb-1" />
                <p className="text-lg font-bold text-ink-900">500+</p>
                <p className="text-xs text-ink-500">Patients</p>
              </div>
            </div>
          </div>
        )}

        {/* Account Section */}
        <div className="bg-surface-paper rounded-2xl overflow-hidden shadow-sm">
          <div className="px-4 py-3 bg-surface-canvas border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-bold text-ink-900">Account</h3>
            <button
              onClick={() => router.push(`/mobile/hospital/${hospitalId}/profile/edit`)}
              className="p-1.5 hover:bg-border rounded-lg transition-colors active:scale-95"
              aria-label="Edit account"
            >
              <Edit2 size={16} className="text-ink-700" />
            </button>
          </div>
          
          <button className="w-full flex items-center justify-between px-4 py-3.5 border-b border-border active:bg-surface-canvas transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-brand-violet-soft flex items-center justify-center">
                <Mail size={18} className="text-brand-violet" />
              </div>
              <div className="text-left">
                <p className="text-xs text-ink-500">Email Address</p>
                <p className="text-sm font-semibold text-ink-900">{profileData.email}</p>
              </div>
            </div>
            <ChevronRight size={18} className="text-ink-500" />
          </button>

          {profileData.phone && (
            <button className="w-full flex items-center justify-between px-4 py-3.5 border-b border-border active:bg-surface-canvas transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-status-open-soft flex items-center justify-center">
                  <Phone size={18} className="text-status-open" />
                </div>
                <div className="text-left">
                  <p className="text-xs text-ink-500">Phone Number</p>
                  <p className="text-sm font-semibold text-ink-900">{profileData.phone}</p>
                </div>
              </div>
              <ChevronRight size={18} className="text-ink-500" />
            </button>
          )}

          {currentHospital && (
            <button 
              onClick={() => isAdmin ? router.push('/mobile/hospital/edit') : null}
              className={`w-full flex items-center justify-between px-4 py-3.5 transition-colors ${isAdmin ? 'active:bg-surface-canvas' : 'cursor-default'}`}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-brand-violet-soft flex items-center justify-center">
                  <Building2 size={18} className="text-brand-violet" />
                </div>
                <div className="text-left">
                  <p className="text-xs text-ink-500">Hospital</p>
                  <p className="text-sm font-semibold text-ink-900">{currentHospital.name}</p>
                </div>
              </div>
              {isAdmin && <ChevronRight size={18} className="text-ink-500" />}
            </button>
          )}
        </div>

        {/* Users Section - Patients Page Link */}
        <div className="bg-surface-paper rounded-2xl overflow-hidden shadow-sm">
          <div className="px-4 py-3 bg-surface-canvas border-b border-border">
            <h3 className="text-sm font-bold text-ink-900">Users</h3>
          </div>
          
          <button
            onClick={() => router.push(`/mobile/hospital/${hospitalId}/patients`)}
            className="w-full flex items-center justify-between px-4 py-3.5 border-b border-border active:bg-surface-canvas transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-brand-violet-soft flex items-center justify-center">
                <Users size={18} className="text-brand-violet" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-ink-900">Patients</p>
              </div>
            </div>
            <ChevronRight size={18} className="text-ink-500" />
          </button>

          {/* Doctors Section - Admin Only */}
          {isAdmin && (
            <button
              onClick={() => router.push(`/mobile/hospital/${hospitalId}/doctors`)}
              className="w-full flex items-center justify-between px-4 py-3.5 active:bg-surface-canvas transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-brand-violet-soft flex items-center justify-center">
                  <Stethoscope size={18} className="text-brand-violet" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-ink-900">Doctors</p>
                </div>
              </div>
              <ChevronRight size={18} className="text-ink-500" />
            </button>
          )}
        </div>

        {/* Hospital Management Section */}
        <div className="bg-surface-paper rounded-2xl overflow-hidden shadow-sm">
          <div className="px-4 py-3 bg-surface-canvas border-b border-border">
            <h3 className="text-sm font-bold text-ink-900">Hospital Management</h3>
          </div>
          
          <button
            onClick={() => router.push(`/mobile/hospital/${hospitalId}/profile/select-hospital`)}
            className="w-full flex items-center justify-between px-4 py-3.5 border-b border-border active:bg-surface-canvas transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-brand-violet-soft flex items-center justify-center">
                <RefreshCw size={18} className="text-brand-violet" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-ink-900">Switch Hospital</p>
                <p className="text-xs text-ink-500">Change to another hospital</p>
              </div>
            </div>
            <ChevronRight size={18} className="text-ink-500" />
          </button>

          <button
            onClick={() => router.push(`/mobile/hospital/${hospitalId}/profile/request-access`)}
            className="w-full flex items-center justify-between px-4 py-3.5 active:bg-surface-canvas transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-status-open-soft flex items-center justify-center">
                <UserPlus size={18} className="text-status-open" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-ink-900">Request Access</p>
                <p className="text-xs text-ink-500">Join another hospital</p>
              </div>
            </div>
            <ChevronRight size={18} className="text-ink-500" />
          </button>
        </div>

        {/* Professional Info - Doctor Only */}
        {'specialization' in profileData && (
          <>
            <div className="bg-surface-paper rounded-2xl overflow-hidden shadow-sm">
              <div className="px-4 py-3 bg-surface-canvas border-b border-border flex items-center justify-between">
                <h3 className="text-sm font-bold text-ink-900">Professional Info</h3>
                <button
                  onClick={() => router.push(`/mobile/hospital/${hospitalId}/profile/edit`)}
                  className="p-1.5 hover:bg-border rounded-lg transition-colors active:scale-95"
                  aria-label="Edit professional info"
                >
                  <Edit2 size={16} className="text-ink-700" />
                </button>
              </div>
              
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <span className="text-sm text-ink-500">Specialization</span>
                  <span className="text-sm font-semibold text-ink-900 text-right max-w-[60%]">{profileData.specialization}</span>
                </div>
                <div className="flex items-start justify-between">
                  <span className="text-sm text-ink-500">Qualification</span>
                  <span className="text-sm font-semibold text-ink-900 text-right max-w-[60%]">{profileData.qualification}</span>
                </div>
                {profileData.experience && (
                  <div className="flex items-start justify-between">
                    <span className="text-sm text-ink-500">Experience</span>
                    <span className="text-sm font-semibold text-ink-900">{profileData.experience}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Bio Section */}
            {profileData.bio && (
              <div className="bg-surface-paper rounded-2xl overflow-hidden shadow-sm">
                <div className="px-4 py-3 bg-surface-canvas border-b border-border">
                  <h3 className="text-sm font-bold text-ink-900">About Me</h3>
                </div>
                <div className="p-4">
                  <p className="text-sm text-ink-700 leading-relaxed">{profileData.bio}</p>
                </div>
              </div>
            )}

            {/* Schedule */}
            <div className="bg-surface-paper rounded-2xl overflow-hidden shadow-sm">
              <button 
                onClick={() => router.push(`/hospital/${currentHospital?.id}/doctors/${user?.id}/add/availability`)}
                className="w-full flex items-center justify-between px-4 py-3 bg-surface-canvas border-b border-border active:bg-surface-canvas transition-colors"
              >
                <h3 className="text-sm font-bold text-ink-900">Availability</h3>
                <Edit2 size={16} className="text-ink-700" />
              </button>
              
              <div className="p-4">
                {isLoadingAvailability ? (
                  <MobileLoadingSpinner message="Loading availability..." variant="default" size="sm" fullScreen={false} />
                ) : !availability || !availability.availability || availability.availability.length === 0 ? (
                  <div className="text-center py-6">
                    <Clock className="w-10 h-10 text-border mx-auto mb-2" />
                    <p className="text-sm text-ink-500">No schedule set</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => {
                      const daySlots = getDayAvailability(day);
                      const hasSlots = daySlots.length > 0;
                      
                      // Only render days that have available slots
                      if (!hasSlots) return null;
                      
                      return (
                        <div key={day} className="flex items-center justify-between py-2">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-status-open"></div>
                            <span className="text-sm font-medium text-ink-700 w-20">{day.slice(0, 3)}</span>
                          </div>
                          <div className="flex flex-wrap gap-1 justify-end">
                            {daySlots.map((slot, idx) => (
                              <span key={idx} className="px-2 py-1 bg-brand-violet-soft text-brand-violet rounded-lg text-xs font-medium">
                                {formatTimeForDisplay(slot.startTime)}-{formatTimeForDisplay(slot.endTime)}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Settings Section */}
        <div className="bg-surface-paper rounded-2xl overflow-hidden shadow-sm">
          <div className="px-4 py-3 bg-surface-canvas border-b border-border">
            <h3 className="text-sm font-bold text-ink-900">Support</h3>
          </div>
          
          {/* <button className="w-full flex items-center justify-between px-4 py-3.5 border-b border-border active:bg-surface-canvas transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-surface-canvas flex items-center justify-center">
                <User size={18} className="text-ink-700" />
              </div>
              <span className="text-sm font-medium text-ink-900">Edit Profile</span>
            </div>
            <ChevronRight size={18} className="text-ink-500" />
          </button> */}

          <button 
            onClick={() => router.push('/mobile/faq')}
            className="w-full flex items-center justify-between px-4 py-3.5 border-b border-border active:bg-surface-canvas transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-surface-canvas flex items-center justify-center">
                <ShieldQuestion size={18} className="text-ink-700" />
              </div>
              <span className="text-sm font-medium text-ink-900">FAQ</span>
            </div>
            <ChevronRight size={18} className="text-ink-500" />
          </button>

          <button className="w-full flex items-center justify-between px-4 py-3.5 active:bg-surface-canvas transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-surface-canvas flex items-center justify-center">
                <HelpCircle size={18} className="text-ink-700" />
              </div>
              <span className="text-sm font-medium text-ink-900">Help & Support</span>
            </div>
            <ChevronRight size={18} className="text-ink-500" />
          </button>
        </div>

        {/* Logout Button - Zepto Style */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-surface-paper rounded-2xl shadow-sm active:bg-surface-canvas transition-colors border border-status-danger/20"
        >
          <LogOut size={18} className="text-status-danger" />
          <span className="text-sm font-semibold text-status-danger">Sign Out</span>
        </button>

        {/* Version */}
        <p className="text-center text-xs text-ink-500 py-2">Version 1.0.0</p>
      </div>
      </>
      )}
    </div>
  );
}
