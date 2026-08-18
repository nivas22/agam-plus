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
  Briefcase,
  FileText
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { getDoctorById } from '@/hooks/useNewDoctorApi';
import PersonalInfoSection from '@/components/common/PersonalInfoSection';
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
  
  // Fetch availability data for doctors only
  const membership = getMembership?.();
  const hospitalId = currentHospital?.id || membership?.hospitalId || '';
  const doctorId = user?.id || '';
  
  // Only fetch availability if user is a doctor and we have valid IDs
  const { availability, isLoading: isLoadingAvailability, error: availabilityError } = useAvailabilityApi(
    isDoctor ? hospitalId : '',
    isDoctor ? doctorId : ''
  );
  
  // Debug logging
  useEffect(() => {
    console.log('Profile Debug:', {
      isDoctor,
      hospitalId,
      doctorId,
      availability,
      isLoadingAvailability,
      availabilityError
    });
  }, [isDoctor, hospitalId, doctorId, availability, isLoadingAvailability, availabilityError]);

  // Helper function to format time for display
  const formatTimeForDisplay = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${period}`;
  };

  // Helper function to get availability for a specific day
  const getDayAvailability = (dayName: string): TimeSlot[] => {
    if (!availability?.availability) return [];
    
    // Filter slots by full day name (Monday, Tuesday, etc.)
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

  // Read-only view: no edit handlers

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="absolute inset-0 border-4 border-blue-100 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
          <p className="text-gray-600 font-medium">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="text-center bg-white rounded-lg shadow-sm p-8 max-w-md border border-gray-200">
          <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="text-red-500" size={24} />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Failed to Load Profile</h3>
          <p className="text-sm text-gray-500">Please try refreshing the page</p>
        </div>
      </div>
    );
  }

  // Read-only: removed EditableField component

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/30 overflow-x-hidden">
      <div className="max-w-7xl mx-auto p-3 sm:p-4 md:p-6 lg:p-8 overflow-x-hidden">
        {/* Modern Hero Header - Unified Design */}
        <div className="relative mb-4 sm:mb-6 md:mb-8 overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 shadow-2xl">
          {/* Animated Background Pattern */}
          <div className="absolute inset-0 bg-black/5"></div>
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMS41IiBmaWxsPSJ3aGl0ZSIgZmlsbC1vcGFjaXR5PSIwLjIiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-40"></div>
          
          <div className="relative px-4 py-6 sm:px-6 sm:py-8 md:px-10 md:py-12">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-4 sm:gap-6 md:gap-8">
              {/* Enhanced Profile Picture */}
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-pink-400 to-purple-400 rounded-2xl sm:rounded-3xl blur opacity-75 group-hover:opacity-100 transition duration-300"></div>
                <div className="relative">
                  <div className="w-24 h-24 sm:w-28 sm:h-28 md:w-36 md:h-36 rounded-2xl sm:rounded-3xl bg-white/10 backdrop-blur-2xl border-4 border-white/40 flex items-center justify-center text-white text-3xl sm:text-4xl md:text-5xl font-bold shadow-2xl overflow-hidden ring-4 ring-white/20">
                    {profileData.profileImage ? (
                      <Image 
                        src={profileData.profileImage} 
                        alt="Profile" 
                        width={144}
                        height={144}
                        className="w-full h-full object-cover"
                        priority
                      />
                    ) : (
                      <span className="drop-shadow-lg">{profileData.name.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="absolute -bottom-1 -right-1 sm:-bottom-2 sm:-right-2 w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-gradient-to-br from-green-400 to-emerald-500 rounded-xl sm:rounded-2xl border-3 sm:border-4 border-white shadow-xl flex items-center justify-center animate-pulse">
                    <Check size={16} className="text-white sm:w-5 sm:h-5" />
                  </div>
                </div>
              </div>

              {/* Profile Info */}
              <div className="flex-1 text-center md:text-left">
                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold text-white mb-2 sm:mb-3 md:mb-4 drop-shadow-2xl tracking-tight">
                  {profileData.name}
                </h1>
                
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-3 sm:mb-4">
                  <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-white/25 backdrop-blur-xl border-2 border-white/40 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold text-white shadow-xl hover:bg-white/30 transition-all duration-300">
                    {isDoctor ? (
                      <>
                        <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-white/20 flex items-center justify-center">
                          <Stethoscope size={12} className="sm:w-3.5 sm:h-3.5" />
                        </div>
                        <span>Doctor</span>
                      </>
                    ) : (
                      <>
                        <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-white/20 flex items-center justify-center">
                          <Shield size={12} className="sm:w-3.5 sm:h-3.5" />
                        </div>
                        <span className="capitalize">{profileData.role}</span>
                      </>
                    )}
                  </div>
                  
                  {currentHospital && (
                    <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-white/20 backdrop-blur-xl border-2 border-white/30 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-semibold text-white shadow-lg max-w-[180px] sm:max-w-[250px]">
                      <Building2 size={12} className="sm:w-3.5 sm:h-3.5 flex-shrink-0" />
                      <span className="truncate">{currentHospital.name}</span>
                    </div>
                  )}
                </div>
                
                {'specialization' in profileData && (
                  <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-5 sm:py-2.5 bg-gradient-to-r from-amber-400/90 to-orange-400/90 backdrop-blur-xl rounded-xl sm:rounded-2xl shadow-xl max-w-[280px] sm:max-w-full">
                    <Award size={14} className="text-white sm:w-4 sm:h-4 flex-shrink-0" />
                    <span className="text-sm sm:text-base md:text-lg font-bold text-white truncate">{profileData.specialization}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

      

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Left Column - Quick Info Cards */}
          <div className="hidden lg:block space-y-6">
            {/* Account Security Card */}
            <div className="group relative bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative p-6">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-lg group-hover:scale-110 transition-transform duration-300">
                    <Shield className="text-white" size={24} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 mb-2">Account Security</h3>
                    <p className="text-sm text-gray-600 leading-relaxed mb-4">
                      Your account is protected. Contact administrator for changes.
                    </p>
                    <button className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors group/btn">
                      <span>Contact Admin</span>
                      <span className="group-hover/btn:translate-x-1 transition-transform">→</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Detailed Information */}
          <div className="lg:col-span-2 space-y-6">
          {/* Personal Information */}
          <PersonalInfoSection
            readOnly
            title="Personal Information"
            data={{
              name: profileData.name,
              email: profileData.email,
              phone: 'phone' in profileData ? profileData.phone : undefined,
            }}
            onEdit={() => console.log('Edit Personal Info')}
          />

            {/* Professional Information (Doctor only) */}
            {'specialization' in profileData && (
              <>
                {/* Professional Details Card - Modern Design */}
                <div className="group relative bg-white rounded-2xl sm:rounded-3xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-2xl transition-all duration-300">
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <div className="relative">
                    <div className="bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-3 sm:px-6 sm:py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-white/20 backdrop-blur-xl flex items-center justify-center">
                            <Briefcase className="text-white" size={16} />
                          </div>
                          <h2 className="text-base sm:text-lg font-bold text-white">Professional Details</h2>
                        </div>
                        <button
                          onClick={() => console.log('Edit Professional Details')}
                          className="flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-white/20 hover:bg-white/30 backdrop-blur-xl text-white font-semibold rounded-lg sm:rounded-xl transition-all duration-200 border border-white/30"
                        >
                          <Edit2 size={14} className="sm:w-4 sm:h-4" />
                          <span className="hidden sm:inline">Edit</span>
                        </button>
                      </div>
                    </div>
                    <div className="p-4 sm:p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-purple-600 mb-1">
                            <Award size={14} className="sm:w-4 sm:h-4 flex-shrink-0" />
                            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Specialization</span>
                          </div>
                          <div className="text-sm sm:text-base font-semibold text-gray-900 break-words">
                            {profileData.specialization || <span className="text-gray-400 italic">Not set</span>}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-purple-600 mb-1">
                            <FileText size={14} className="sm:w-4 sm:h-4 flex-shrink-0" />
                            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Qualification</span>
                          </div>
                          <div className="text-sm sm:text-base font-semibold text-gray-900 break-words">
                            {profileData.qualification || <span className="text-gray-400 italic">Not set</span>}
                          </div>
                        </div>
                        {profileData.experience !== undefined && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-purple-600 mb-1">
                              <Clock size={14} className="sm:w-4 sm:h-4 flex-shrink-0" />
                              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Experience</span>
                            </div>
                            <div className="text-sm sm:text-base font-semibold text-gray-900 break-words">
                              {profileData.experience || <span className="text-gray-400 italic">Not set</span>}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Professional Bio Card - Modern Design */}
                <div className="group relative bg-white rounded-2xl sm:rounded-3xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-2xl transition-all duration-300">
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-teal-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <div className="relative">
                    <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3 sm:px-6 sm:py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-white/20 backdrop-blur-xl flex items-center justify-center">
                            <FileText className="text-white" size={16} />
                          </div>
                          <h2 className="text-base sm:text-lg font-bold text-white">Professional Bio</h2>
                        </div>
                        <button
                          onClick={() => console.log('Edit Bio')}
                          className="flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-white/20 hover:bg-white/30 backdrop-blur-xl text-white font-semibold rounded-lg sm:rounded-xl transition-all duration-200 border border-white/30"
                        >
                          <Edit2 size={14} className="sm:w-4 sm:h-4" />
                          <span className="hidden sm:inline">Edit</span>
                        </button>
                      </div>
                    </div>
                    <div className="p-4 sm:p-6">
                      <div className="prose prose-sm max-w-none">
                        <p className="text-sm sm:text-base text-gray-700 leading-relaxed whitespace-pre-wrap">
                          {profileData.bio || (
                            <span className="text-gray-400 italic">
                              No bio provided. Add information about your medical background and expertise.
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Doctor Availability Section - Modern Design */}
                <div className="group relative bg-white rounded-2xl sm:rounded-3xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-2xl transition-all duration-300">
                  <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <div className="relative">
                    <div className="bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-3 sm:px-6 sm:py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-white/20 backdrop-blur-xl flex items-center justify-center">
                            <Clock className="text-white" size={16} />
                          </div>
                          <h2 className="text-base sm:text-lg font-bold text-white">Availability</h2>
                        </div>
                        <button
                          onClick={() => router.push(`/hospital/${currentHospital?.id}/doctors/${user?.id}/add/availability`)}
                          className="flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-white/20 hover:bg-white/30 backdrop-blur-xl text-white font-semibold rounded-lg sm:rounded-xl transition-all duration-200 border border-white/30"
                        >
                          <Edit2 size={14} className="sm:w-4 sm:h-4" />
                          <span className="hidden sm:inline">Edit</span>
                        </button>
                      </div>
                    </div>
                    
                    <div className="p-4 sm:p-6">
                      {isLoadingAvailability ? (
                        <div className="text-center py-6 sm:py-8">
                          <div className="animate-spin rounded-full h-8 w-8 sm:h-10 sm:w-10 border-b-2 border-cyan-600 mx-auto mb-2 sm:mb-3"></div>
                          <p className="text-xs sm:text-sm text-gray-600 font-medium">Loading...</p>
                        </div>
                      ) : !availability || !availability.availability || availability.availability.length === 0 ? (
                        <div className="text-center py-6 sm:py-8">
                          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center mx-auto mb-2 sm:mb-3">
                            <Clock className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" />
                          </div>
                          <p className="text-xs sm:text-sm text-gray-900 font-bold mb-1">No availability configured</p>
                          <p className="text-xs text-gray-500">Click Edit to set your schedule</p>
                        </div>
                      ) : (
                        <div className="space-y-1.5 sm:space-y-2">
                          {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => {
                            const daySlots = getDayAvailability(day);
                            const hasSlots = daySlots.length > 0;
                            
                            return (
                              <div key={day} className="flex items-start sm:items-center justify-between py-2 sm:py-2.5 px-2 sm:px-3 rounded-lg sm:rounded-xl hover:bg-gray-50 transition-colors duration-150 gap-2">
                                <div className="flex items-center gap-2 sm:gap-3 min-w-[60px] sm:min-w-[80px] flex-shrink-0">
                                  <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full flex-shrink-0 ${hasSlots ? 'bg-cyan-500' : 'bg-gray-300'}`}></div>
                                  <span className="text-xs sm:text-sm font-semibold text-gray-900">{day.slice(0, 3)}<span className="hidden sm:inline">{day.slice(3)}</span></span>
                                </div>
                                <div className="text-xs sm:text-sm font-medium text-right flex-1 min-w-0">
                                  {!hasSlots ? (
                                    <span className="text-gray-400 italic text-xs">Closed</span>
                                  ) : (
                                    <div className="flex flex-wrap justify-end gap-1 sm:gap-2">
                                      {daySlots.map((slot, idx) => (
                                        <span key={idx} className="inline-flex items-center gap-0.5 sm:gap-1 px-1.5 py-0.5 sm:px-2.5 sm:py-1 bg-gradient-to-r from-cyan-50 to-blue-50 border border-cyan-200 rounded-md sm:rounded-lg text-[10px] sm:text-xs font-semibold text-gray-700 whitespace-nowrap">
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
                </div>
            </>
          )}

            {/* Delete Account Section - Modern Design */}
            <div className="group relative bg-white rounded-2xl sm:rounded-3xl shadow-lg border-2 border-red-200 overflow-hidden hover:shadow-2xl transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-rose-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative">
                <div className="bg-gradient-to-r from-red-500 to-rose-500 px-4 py-3 sm:px-6 sm:py-4">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-white/20 backdrop-blur-xl flex items-center justify-center">
                      <AlertTriangle className="text-white" size={16} />
                    </div>
                    <h2 className="text-base sm:text-lg font-bold text-white">Danger Zone</h2>
                  </div>
                </div>
                <div className="p-4 sm:p-6">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 sm:gap-4">
                    <div className="flex-1">
                      <h3 className="text-sm sm:text-base font-bold text-gray-900 mb-1.5 sm:mb-2">Delete Account</h3>
                      <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                        Once you delete your account, there is no going back. Please be certain. All your data, appointments, and information will be permanently removed.
                      </p>
                    </div>
                    <button
                      onClick={() => console.log('Delete Account')}
                      className="flex items-center justify-center gap-1.5 sm:gap-2 px-4 py-2 sm:px-6 sm:py-3 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white text-xs sm:text-sm font-bold rounded-lg sm:rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl whitespace-nowrap"
                    >
                      <Trash2 size={16} className="sm:w-4.5 sm:h-4.5" />
                      <span>Delete Account</span>
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
