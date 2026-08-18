'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Loader2, User, Mail, Phone, Briefcase, FileText } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import MobileLoadingSpinner from './MobileLoadingSpinner';
import { apiUrl, fetchWithAuth } from '@/lib/api';

export default function MobileProfileEditPage() {
  const router = useRouter();
  const { user, currentHospital, isDoctor, isAdmin, getMembership } = useAuth();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    specialization: '',
    qualification: '',
    bio: '',
    experience: ''
  });

  const membership = getMembership?.();
  const hospitalId = currentHospital?.id || membership?.hospitalId || '';
  const userId = user?.id || '';

  // Fetch current profile data
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        
        if (isDoctor && hospitalId && userId) {
          // Fetch doctor profile
          const response = await fetchWithAuth(apiUrl(`/hospitals/${hospitalId}/doctors/${userId}`));
          if (response.ok) {
            const data = await response.json();
            setFormData({
              name: data.name || data.user?.name || '',
              email: data.email || data.user?.email || '',
              phone: data.phone || '',
              specialization: data.specialization || '',
              qualification: data.qualification || '',
              bio: data.bio || '',
              experience: data.experience || ''
            });
          }
        } else if (isAdmin) {
          // For admin, use user data
          setFormData({
            name: user?.name || '',
            email: user?.email || '',
            phone: user?.phone || '',
            specialization: '',
            qualification: '',
            bio: '',
            experience: ''
          });
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
  }, [user, isDoctor, isAdmin, hospitalId, userId]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    // Validation
    if (!formData.name) {
      alert('Please enter your name');
      return;
    }

    if (!formData.phone) {
      alert('Please enter your phone number');
      return;
    }

    if (isDoctor) {
      if (!formData.specialization) {
        alert('Please enter your specialization');
        return;
      }
      if (!formData.qualification) {
        alert('Please enter your qualification');
        return;
      }
    }

    try {
      setSaving(true);

      if (isDoctor && hospitalId && userId) {
        // Update doctor profile
        const payload = {
          name: formData.name,
          phone: formData.phone,
          specialization: formData.specialization,
          qualification: formData.qualification,
          bio: formData.bio,
          experience: formData.experience
        };

        const response = await fetchWithAuth(apiUrl(`/hospitals/${hospitalId}/doctors/${userId}`), {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          router.push(`/mobile/hospital/${hospitalId}/profile`);
        } else {
          const error = await response.json();
          alert(error.error || 'Failed to update profile');
        }
      } else if (isAdmin) {
        // Update admin/user profile
        const response = await fetchWithAuth(apiUrl(`/users/${userId}`), {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: formData.name,
            phone: formData.phone
          }),
        });

        if (response.ok) {
          router.push(`/mobile/hospital/${hospitalId}/profile`);
        } else {
          const error = await response.json();
          alert(error.error || 'Failed to update profile');
        }
      }
    } catch (error) {
      console.error('Failed to update profile:', error);
      alert('Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(`/mobile/hospital/${hospitalId}/profile`)}
              className="p-2 -ml-2 hover:bg-gray-100 rounded-lg transition-colors active:scale-95"
              aria-label="Go back"
            >
              <ArrowLeft size={20} className="text-gray-700" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Edit Profile</h1>
              <p className="text-xs text-gray-500">Update your information</p>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold text-sm hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save size={16} />
                Save
              </>
            )}
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <MobileLoadingSpinner message="Loading profile..." variant="default" size="md" fullScreen={false} />
      ) : (
        /* Form Content */
        <div className="px-4 py-4 space-y-4">
          {/* Basic Information */}
          <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900">Basic Information</h3>
            </div>
            
            <div className="p-4 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Full Name *
                </label>
                <div className="relative">
                  <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="John Doe"
                    className="w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Email (Read-only) */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    value={formData.email}
                    disabled
                    className="w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">Email cannot be changed</p>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Phone Number *
                </label>
                <div className="relative">
                  <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className="w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Professional Information (Doctors Only) */}
          {isDoctor && (
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                <h3 className="text-sm font-bold text-gray-900">Professional Information</h3>
              </div>
              
              <div className="p-4 space-y-4">
                {/* Specialization */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Specialization *
                  </label>
                  <div className="relative">
                    <Briefcase size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={formData.specialization}
                      onChange={(e) => handleInputChange('specialization', e.target.value)}
                      placeholder="Cardiology"
                      className="w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Qualification */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Qualification *
                  </label>
                  <div className="relative">
                    <FileText size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={formData.qualification}
                      onChange={(e) => handleInputChange('qualification', e.target.value)}
                      placeholder="MBBS, MD"
                      className="w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Experience */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Experience
                  </label>
                  <input
                    type="text"
                    value={formData.experience}
                    onChange={(e) => handleInputChange('experience', e.target.value)}
                    placeholder="10 years"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Bio */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Bio
                  </label>
                  <textarea
                    value={formData.bio}
                    onChange={(e) => handleInputChange('bio', e.target.value)}
                    placeholder="Brief description about yourself..."
                    rows={4}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Save Button (Mobile Bottom) */}
          <div className="pb-6">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              {saving ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Updating Profile...
                </>
              ) : (
                <>
                  <Save size={18} />
                  Update Profile
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
