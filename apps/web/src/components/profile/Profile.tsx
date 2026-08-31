'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { 
  Shield, 
  X, 
  Award,
  Check,
  Stethoscope,
  Building2,
  Edit2,
  Trash2,
  AlertTriangle,
  Clock,
  FileText,
  Mail,
  Phone,
  Calendar,
  CheckCircle2
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { getDoctorById } from '@/hooks/useNewDoctorApi';
import { useAvailabilityApi } from '@/hooks/useAvailability';
import { TimeSlot } from '@/types/appointment';

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

export default function ProfilePage() {
  const { user, currentHospital, isDoctor, getMembership } = useAuth();
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface-canvas">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="absolute inset-0 border-4 border-brand-violet-soft rounded-full"></div>
            <div className="absolute inset-0 border-4 border-t-brand-violet rounded-full animate-spin"></div>
          </div>
          <p className="text-ink-700 font-medium">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface-canvas">
        <div className="text-center bg-surface-paper rounded-lg shadow-sm p-8 max-w-md border border-border">
          <div className="w-12 h-12 bg-status-danger-soft rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="text-status-danger" size={24} />
          </div>
          <h3 className="text-lg font-semibold text-ink-900 mb-2 font-display tracking-tight">Failed to Load Profile</h3>
          <p className="text-sm text-ink-500">Please try refreshing the page</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-canvas overflow-x-hidden">
      <div className="max-w-7xl mx-auto">
        {/* Professional Header Bar */}
        <div className="bg-surface-paper/80 backdrop-blur-sm border-b border-border px-4 sm:px-6 lg:px-8 py-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-ink-900 font-display tracking-tight">Profile</h1>
              <p className="text-sm text-ink-500 mt-0.5">Manage your professional information</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 bg-status-open-soft text-status-open text-xs font-semibold rounded-full border border-status-open/20">
                <CheckCircle2 size={14} />
                Verified
              </span>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6 lg:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Sidebar - Profile Card */}
            <div className="lg:col-span-1">
              <div className="bg-surface-paper rounded-xl shadow-lg border border-border overflow-hidden sticky top-6">
                {/* Profile Header with Gradient */}
                <div className="relative h-24 sm:h-32 bg-brand-violet">
                  <div className="absolute inset-0 bg-black/10"></div>
                </div>
                
                {/* Profile Picture */}
                <div className="relative px-6 pb-6">
                  <div className="flex flex-col items-center -mt-16 sm:-mt-20">
                    <div className="relative">
                      <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl bg-surface-paper border-4 border-white shadow-xl flex items-center justify-center text-4xl sm:text-5xl font-bold text-ink-700 overflow-hidden">
                        {profileData.profileImage ? (
                          <Image 
                            src={profileData.profileImage} 
                            alt="Profile" 
                            width={128}
                            height={128}
                            className="w-full h-full object-cover"
                            priority
                          />
                        ) : (
                          <span>{profileData.name.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-status-open rounded-full border-4 border-white shadow-lg flex items-center justify-center">
                        <Check size={14} className="text-white" />
                      </div>
                    </div>

                    <h2 className="mt-4 text-xl sm:text-2xl font-bold text-ink-900 text-center font-display tracking-tight">{profileData.name}</h2>

                    <div className="mt-2 flex items-center gap-2">
                      {isDoctor ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-brand-violet-soft text-brand-violet text-xs font-semibold rounded-full border border-brand-violet/20">
                          <Stethoscope size={12} />
                          Doctor
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-brand-violet-soft text-brand-violet text-xs font-semibold rounded-full border border-brand-violet/20">
                          <Shield size={12} />
                          {profileData.role}
                        </span>
                      )}
                    </div>

                    {'specialization' in profileData && (
                      <p className="mt-2 text-sm font-medium text-ink-700 text-center">{profileData.specialization}</p>
                    )}
                  </div>
                  
                  {/* Quick Contact Info */}
                  <div className="mt-6 space-y-3 pt-6 border-t border-border">
                    <div className="flex items-center gap-3 text-sm">
                      <div className="w-8 h-8 rounded-lg bg-surface-canvas flex items-center justify-center flex-shrink-0">
                        <Mail size={14} className="text-ink-700" />
                      </div>
                      <span className="text-ink-700 truncate">{profileData.email}</span>
                    </div>

                    {profileData.phone && (
                      <div className="flex items-center gap-3 text-sm">
                        <div className="w-8 h-8 rounded-lg bg-surface-canvas flex items-center justify-center flex-shrink-0">
                          <Phone size={14} className="text-ink-700" />
                        </div>
                        <span className="text-ink-700 font-mono tabular">{profileData.phone}</span>
                      </div>
                    )}

                    {currentHospital && (
                      <div className="flex items-center gap-3 text-sm">
                        <div className="w-8 h-8 rounded-lg bg-surface-canvas flex items-center justify-center flex-shrink-0">
                          <Building2 size={14} className="text-ink-700" />
                        </div>
                        <span className="text-ink-700 truncate">{currentHospital.name}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Content Area */}
            <div className="lg:col-span-2 space-y-6">
              {/* Professional Information for Doctors */}
              {'specialization' in profileData && (
                <>
                  {/* Credentials Card */}
                  <div className="bg-surface-paper rounded-xl shadow-md border border-border overflow-hidden hover:shadow-lg transition-shadow duration-300">
                    <div className="px-6 py-4 bg-brand-violet-soft border-b border-brand-violet/20 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Award className="text-brand-violet" size={20} />
                        <h3 className="text-lg font-bold text-ink-900 font-display tracking-tight">Professional Credentials</h3>
                      </div>
                      <button
                        onClick={() => router.push('/setup/doctor-profile')}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-brand-violet hover:bg-brand-violet-soft rounded-lg transition-colors"
                      >
                        <Edit2 size={14} />
                        <span className="hidden sm:inline">Edit</span>
                      </button>
                    </div>
                    <div className="p-6">
                      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                          <dt className="text-xs font-semibold text-ink-500 uppercase tracking-wider mb-2">Specialization</dt>
                          <dd className="text-base font-semibold text-ink-900">{profileData.specialization}</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-semibold text-ink-500 uppercase tracking-wider mb-2">Qualification</dt>
                          <dd className="text-base font-semibold text-ink-900">{profileData.qualification}</dd>
                        </div>
                        {profileData.experience && (
                          <div>
                            <dt className="text-xs font-semibold text-ink-500 uppercase tracking-wider mb-2">Experience</dt>
                            <dd className="text-base font-semibold text-ink-900">{profileData.experience}</dd>
                          </div>
                        )}
                      </dl>
                    </div>
                  </div>

                  {/* Bio Card */}
                  <div className="bg-surface-paper rounded-xl shadow-md border border-border overflow-hidden hover:shadow-lg transition-shadow duration-300">
                    <div className="px-6 py-4 bg-status-open-soft border-b border-status-open/20 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="text-status-open" size={20} />
                        <h3 className="text-lg font-bold text-ink-900 font-display tracking-tight">About</h3>
                      </div>
                      <button
                        onClick={() => router.push('/setup/doctor-profile')}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-status-open hover:bg-status-open-soft rounded-lg transition-colors"
                      >
                        <Edit2 size={14} />
                        <span className="hidden sm:inline">Edit</span>
                      </button>
                    </div>
                    <div className="p-6">
                      <p className="text-sm text-ink-700 leading-relaxed whitespace-pre-wrap">
                        {profileData.bio || (
                          <span className="text-ink-500 italic">
                            No bio provided. Add information about your medical background and expertise.
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Availability Card */}
                  <div className="bg-surface-paper rounded-xl shadow-md border border-border overflow-hidden hover:shadow-lg transition-shadow duration-300">
                    <div className="px-6 py-4 bg-brand-violet-soft border-b border-brand-violet/20 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="text-brand-violet" size={20} />
                        <h3 className="text-lg font-bold text-ink-900 font-display tracking-tight">Weekly Schedule</h3>
                      </div>
                      <button
                        onClick={() => router.push(`/hospital/${currentHospital?.id}/doctors/${user?.id}/add/availability`)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-brand-violet hover:bg-brand-violet-soft rounded-lg transition-colors"
                      >
                        <Edit2 size={14} />
                        <span className="hidden sm:inline">Edit</span>
                      </button>
                    </div>
                    <div className="p-6">
                      {isLoadingAvailability ? (
                        <div className="text-center py-8">
                          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-violet mx-auto mb-3"></div>
                          <p className="text-sm text-ink-700">Loading schedule...</p>
                        </div>
                      ) : !availability || !availability.availability || availability.availability.length === 0 ? (
                        <div className="text-center py-8">
                          <Clock className="w-12 h-12 text-border mx-auto mb-3" />
                          <p className="text-sm text-ink-700 font-medium mb-1">No schedule configured</p>
                          <p className="text-xs text-ink-500">Click Edit to set your availability</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => {
                            const daySlots = getDayAvailability(day);
                            const hasSlots = daySlots.length > 0;

                            return (
                              <div key={day} className="flex items-center justify-between py-3 px-4 rounded-lg hover:bg-surface-canvas transition-colors">
                                <div className="flex items-center gap-3">
                                  <div className={`w-2 h-2 rounded-full ${hasSlots ? 'bg-status-open' : 'bg-border'}`}></div>
                                  <span className="text-sm font-semibold text-ink-900 min-w-[80px]">{day}</span>
                                </div>
                                <div className="text-sm font-medium text-right">
                                  {!hasSlots ? (
                                    <span className="text-ink-500">Unavailable</span>
                                  ) : (
                                    <div className="flex flex-wrap justify-end gap-2">
                                      {daySlots.map((slot, idx) => (
                                        <span key={idx} className="inline-block px-2.5 py-1 bg-brand-violet-soft text-brand-violet text-xs font-medium rounded-md border border-brand-violet/20 font-mono tabular">
                                          {formatTimeForDisplay(slot.startTime)} - {formatTimeForDisplay(slot.endTime)}
                                        </span>
                                      ))}
                                    </div>
                                  )}
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

              {/* Account Settings Card */}
              <div className="bg-surface-paper rounded-xl shadow-md border border-border overflow-hidden hover:shadow-lg transition-shadow duration-300">
                <div className="px-6 py-4 bg-brand-violet-soft border-b border-brand-violet/20 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="text-brand-violet" size={20} />
                    <h3 className="text-lg font-bold text-ink-900 font-display tracking-tight">Account Settings</h3>
                  </div>
                  <button
                    onClick={() => router.push('/setup/profile')}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-brand-violet hover:bg-brand-violet-soft rounded-lg transition-colors"
                  >
                    <Edit2 size={14} />
                    <span className="hidden sm:inline">Edit</span>
                  </button>
                </div>
                <div className="p-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between py-3 px-4 bg-brand-violet-soft rounded-lg border border-brand-violet/20">
                      <div>
                        <p className="text-sm font-semibold text-ink-900">Password &amp; security</p>
                        <p className="text-xs text-ink-500 mt-0.5">
                          {user?.hasPassword ? "Change your password, manage sign-in sessions" : "Your account is protected"}
                        </p>
                      </div>
                      <button
                        onClick={() => router.push(`/hospital/${currentHospital?.id}/profile/security`)}
                        className="text-sm font-medium text-brand-violet hover:text-brand-violet-hover"
                      >
                        Manage
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Danger Zone */}
              <div className="bg-surface-paper rounded-xl shadow-md border border-status-danger/20 overflow-hidden hover:shadow-lg transition-shadow duration-300">
                <div className="px-6 py-4 border-b border-status-danger/20 bg-status-danger-soft">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="text-status-danger" size={20} />
                    <h3 className="text-lg font-bold text-ink-900 font-display tracking-tight">Danger Zone</h3>
                  </div>
                </div>
                <div className="p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <h4 className="text-sm font-semibold text-ink-900 mb-1">Delete Account</h4>
                      <p className="text-xs text-ink-700">
                        Permanently delete your account and all associated data.
                      </p>
                    </div>
                    <button
                      onClick={() => console.log('Delete Account')}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-status-danger hover:bg-status-danger-hover text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
                    >
                      <Trash2 size={16} />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
