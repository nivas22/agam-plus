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
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
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
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50/30 to-purple-50/50 overflow-x-hidden">
      <div className="max-w-7xl mx-auto">
        {/* Professional Header Bar */}
        <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200 px-4 sm:px-6 lg:px-8 py-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Profile</h1>
              <p className="text-sm text-gray-500 mt-0.5">Manage your professional information</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 text-xs font-semibold rounded-full border border-green-200">
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
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden sticky top-6">
                {/* Profile Header with Gradient */}
                <div className="relative h-24 sm:h-32 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600">
                  <div className="absolute inset-0 bg-black/10"></div>
                </div>
                
                {/* Profile Picture */}
                <div className="relative px-6 pb-6">
                  <div className="flex flex-col items-center -mt-16 sm:-mt-20">
                    <div className="relative">
                      <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl bg-white border-4 border-white shadow-xl flex items-center justify-center text-4xl sm:text-5xl font-bold text-gray-700 overflow-hidden">
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
                      <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-green-500 rounded-full border-4 border-white shadow-lg flex items-center justify-center">
                        <Check size={14} className="text-white" />
                      </div>
                    </div>
                    
                    <h2 className="mt-4 text-xl sm:text-2xl font-bold text-gray-900 text-center">{profileData.name}</h2>
                    
                    <div className="mt-2 flex items-center gap-2">
                      {isDoctor ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full border border-blue-200">
                          <Stethoscope size={12} />
                          Doctor
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-50 text-purple-700 text-xs font-semibold rounded-full border border-purple-200">
                          <Shield size={12} />
                          {profileData.role}
                        </span>
                      )}
                    </div>
                    
                    {'specialization' in profileData && (
                      <p className="mt-2 text-sm font-medium text-gray-600 text-center">{profileData.specialization}</p>
                    )}
                  </div>
                  
                  {/* Quick Contact Info */}
                  <div className="mt-6 space-y-3 pt-6 border-t border-gray-100">
                    <div className="flex items-center gap-3 text-sm">
                      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <Mail size={14} className="text-gray-600" />
                      </div>
                      <span className="text-gray-700 truncate">{profileData.email}</span>
                    </div>
                    
                    {profileData.phone && (
                      <div className="flex items-center gap-3 text-sm">
                        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <Phone size={14} className="text-gray-600" />
                        </div>
                        <span className="text-gray-700">{profileData.phone}</span>
                      </div>
                    )}
                    
                    {currentHospital && (
                      <div className="flex items-center gap-3 text-sm">
                        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <Building2 size={14} className="text-gray-600" />
                        </div>
                        <span className="text-gray-700 truncate">{currentHospital.name}</span>
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
                  <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden hover:shadow-lg transition-shadow duration-300">
                    <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Award className="text-blue-600" size={20} />
                        <h3 className="text-lg font-bold text-gray-900">Professional Credentials</h3>
                      </div>
                      <button
                        onClick={() => router.push('/setup/doctor-profile')}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Edit2 size={14} />
                        <span className="hidden sm:inline">Edit</span>
                      </button>
                    </div>
                    <div className="p-6">
                      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                          <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Specialization</dt>
                          <dd className="text-base font-semibold text-gray-900">{profileData.specialization}</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Qualification</dt>
                          <dd className="text-base font-semibold text-gray-900">{profileData.qualification}</dd>
                        </div>
                        {profileData.experience && (
                          <div>
                            <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Experience</dt>
                            <dd className="text-base font-semibold text-gray-900">{profileData.experience}</dd>
                          </div>
                        )}
                      </dl>
                    </div>
                  </div>

                  {/* Bio Card */}
                  <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden hover:shadow-lg transition-shadow duration-300">
                    <div className="px-6 py-4 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="text-emerald-600" size={20} />
                        <h3 className="text-lg font-bold text-gray-900">About</h3>
                      </div>
                      <button
                        onClick={() => router.push('/setup/doctor-profile')}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                      >
                        <Edit2 size={14} />
                        <span className="hidden sm:inline">Edit</span>
                      </button>
                    </div>
                    <div className="p-6">
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                        {profileData.bio || (
                          <span className="text-gray-400 italic">
                            No bio provided. Add information about your medical background and expertise.
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Availability Card */}
                  <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden hover:shadow-lg transition-shadow duration-300">
                    <div className="px-6 py-4 bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="text-purple-600" size={20} />
                        <h3 className="text-lg font-bold text-gray-900">Weekly Schedule</h3>
                      </div>
                      <button
                        onClick={() => router.push(`/hospital/${currentHospital?.id}/doctors/${user?.id}/add/availability`)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                      >
                        <Edit2 size={14} />
                        <span className="hidden sm:inline">Edit</span>
                      </button>
                    </div>
                    <div className="p-6">
                      {isLoadingAvailability ? (
                        <div className="text-center py-8">
                          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600 mx-auto mb-3"></div>
                          <p className="text-sm text-gray-600">Loading schedule...</p>
                        </div>
                      ) : !availability || !availability.availability || availability.availability.length === 0 ? (
                        <div className="text-center py-8">
                          <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                          <p className="text-sm text-gray-600 font-medium mb-1">No schedule configured</p>
                          <p className="text-xs text-gray-500">Click Edit to set your availability</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => {
                            const daySlots = getDayAvailability(day);
                            const hasSlots = daySlots.length > 0;
                            
                            return (
                              <div key={day} className="flex items-center justify-between py-3 px-4 rounded-lg hover:bg-gray-50 transition-colors">
                                <div className="flex items-center gap-3">
                                  <div className={`w-2 h-2 rounded-full ${hasSlots ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                                  <span className="text-sm font-semibold text-gray-900 min-w-[80px]">{day}</span>
                                </div>
                                <div className="text-sm font-medium text-right">
                                  {!hasSlots ? (
                                    <span className="text-gray-400">Unavailable</span>
                                  ) : (
                                    <div className="flex flex-wrap justify-end gap-2">
                                      {daySlots.map((slot, idx) => (
                                        <span key={idx} className="inline-block px-2.5 py-1 bg-gradient-to-r from-purple-50 to-pink-50 text-purple-700 text-xs font-medium rounded-md border border-purple-200">
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
              <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden hover:shadow-lg transition-shadow duration-300">
                <div className="px-6 py-4 bg-gradient-to-r from-cyan-50 to-blue-50 border-b border-cyan-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="text-cyan-600" size={20} />
                    <h3 className="text-lg font-bold text-gray-900">Account Settings</h3>
                  </div>
                  <button
                    onClick={() => router.push('/setup/profile')}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors"
                  >
                    <Edit2 size={14} />
                    <span className="hidden sm:inline">Edit</span>
                  </button>
                </div>
                <div className="p-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between py-3 px-4 bg-gradient-to-r from-cyan-50 to-blue-50 rounded-lg border border-cyan-100">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">Security</p>
                        <p className="text-xs text-gray-500 mt-0.5">Your account is protected</p>
                      </div>
                      <button className="text-sm font-medium text-cyan-600 hover:text-cyan-700">
                        Contact Admin
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Danger Zone */}
              <div className="bg-white rounded-xl shadow-md border border-red-200 overflow-hidden hover:shadow-lg transition-shadow duration-300">
                <div className="px-6 py-4 border-b border-red-100 bg-red-50">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="text-red-600" size={20} />
                    <h3 className="text-lg font-bold text-gray-900">Danger Zone</h3>
                  </div>
                </div>
                <div className="p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 mb-1">Delete Account</h4>
                      <p className="text-xs text-gray-600">
                        Permanently delete your account and all associated data.
                      </p>
                    </div>
                    <button
                      onClick={() => console.log('Delete Account')}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
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
