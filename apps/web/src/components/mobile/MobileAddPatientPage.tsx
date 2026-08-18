'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Loader2, User, Mail, Phone, Calendar, MapPin, Droplet, Check } from 'lucide-react';
import { MEDICAL_SPECIALIZATIONS } from '@/constants';
import MobileLoadingSpinner from './MobileLoadingSpinner';
import { apiUrl, fetchWithAuth } from '@/lib/api';

interface MobileAddPatientPageProps {
  hospitalId: string;
  hospitalSpecializations?: string[];
  patientId?: string;
  isEdit?: boolean;
}

export default function MobileAddPatientPage({ hospitalId, hospitalSpecializations = [], patientId, isEdit = false }: MobileAddPatientPageProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    secondaryPhone: '',
    dateOfBirth: '',
    gender: '',
    bloodGroup: '',
    address: '',
    lookingForSpecialization: ''
  });

  // Fetch patient data if editing
  useEffect(() => {
    if (isEdit && patientId) {
      const fetchPatientData = async () => {
        try {
          const response = await fetchWithAuth(apiUrl(`/hospitals/${hospitalId}/patients/${patientId}`));
          if (response.ok) {
            const data = await response.json();
            const patient = data.patient || data;
            console.log('Fetched patient data:', patient);
            setFormData({
              name: patient.name || '',
              email: patient.email || '',
              phone: patient.phone || '',
              secondaryPhone: patient.secondaryPhone || '',
              dateOfBirth: patient.dateOfBirth || '',
              gender: patient.gender || '',
              bloodGroup: patient.bloodGroup || '',
              address: patient.address || '',
              lookingForSpecialization: patient.lookingForSpecialization || ''
            });
          } else {
            console.error('Failed to fetch patient:', await response.text());
          }
        } catch (error) {
          console.error('Failed to fetch patient data:', error);
        } finally {
          setLoading(false);
        }
      };
      fetchPatientData();
    }
  }, [isEdit, patientId, hospitalId]);

  // Filter specializations based on hospital's specializations
  const availableSpecializations = hospitalSpecializations.length > 0
    ? MEDICAL_SPECIALIZATIONS.filter(spec => hospitalSpecializations.includes(spec))
    : MEDICAL_SPECIALIZATIONS;

  const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  const genders = ['Male', 'Female', 'Other'];

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    // Validation
    if (!formData.name || !formData.email || !formData.phone) {
      alert('Please fill in all required fields (Name, Email, Phone)');
      return;
    }

    // Email validation (skip for edit mode)
    if (!isEdit) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        alert('Please enter a valid email address');
        return;
      }
    }

    // Phone validation
    if (formData.phone.length < 10) {
      alert('Please enter a valid phone number');
      return;
    }

    if (!formData.dateOfBirth) {
      alert('Please select date of birth');
      return;
    }

    if (!formData.gender) {
      alert('Please select gender');
      return;
    }

    if (!formData.address) {
      alert('Please enter address');
      return;
    }

    try {
      setSaving(true);

      if (isEdit && patientId) {
        // Update existing patient
        const payload = {
          name: formData.name,
          phone: formData.phone,
          secondaryPhone: formData.secondaryPhone,
          dateOfBirth: formData.dateOfBirth,
          gender: formData.gender,
          bloodGroup: formData.bloodGroup,
          address: formData.address,
          lookingForSpecialization: formData.lookingForSpecialization
        };

        const response = await fetchWithAuth(apiUrl(`/hospitals/${hospitalId}/patients/${patientId}`), {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          router.push(`/mobile/hospital/${hospitalId}/patients`);
        } else {
          const error = await response.json();
          alert(error.error || 'Failed to update patient');
        }
      } else {
        // Create new patient
        const payload = {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          secondaryPhone: formData.secondaryPhone,
          dateOfBirth: formData.dateOfBirth,
          gender: formData.gender,
          bloodGroup: formData.bloodGroup,
          address: formData.address,
          hospitalId: hospitalId,
          lookingForSpecialization: formData.lookingForSpecialization
        };

        const response = await fetchWithAuth(apiUrl(`/hospitals/${hospitalId}/patients`), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          router.push(`/mobile/hospital/${hospitalId}/patients`);
        } else {
          const error = await response.json();
          alert(error.error || 'Failed to add patient');
        }
      }
    } catch (error) {
      console.error(`Failed to ${isEdit ? 'update' : 'add'} patient:`, error);
      alert(`Failed to ${isEdit ? 'update' : 'add'} patient. Please try again.`);
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
              onClick={() => router.push(`/mobile/hospital/${hospitalId}/patients`)}
              className="p-2 -ml-2 hover:bg-gray-100 rounded-lg transition-colors active:scale-95"
              aria-label="Go back"
            >
              <ArrowLeft size={20} className="text-gray-700" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-900">{isEdit ? 'Edit Patient' : 'Add Patient'}</h1>
              <p className="text-xs text-gray-500">{isEdit ? 'Update patient details' : 'Fill in patient details'}</p>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold text-sm hover:bg-purple-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
        <MobileLoadingSpinner message="Loading patient details..." variant="admin" size="md" fullScreen={false} />
      ) : (
        /* Form Content */
        <div className="px-4 py-4 space-y-4">
        {/* Personal Information */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-900">Personal Information</h3>
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
                  disabled={isEdit}
                  className={`w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent ${isEdit ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
                />
              </div>
              {isEdit && <p className="mt-1 text-xs text-gray-500">Name cannot be changed</p>}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Email Address *
              </label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="patient@example.com"
                  disabled={isEdit}
                  className={`w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent ${isEdit ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
                />
              </div>
              {isEdit && <p className="mt-1 text-xs text-gray-500">Email cannot be changed</p>}
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
                  className="w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Secondary Phone */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Secondary Phone
              </label>
              <div className="relative">
                <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="tel"
                  value={formData.secondaryPhone}
                  onChange={(e) => handleInputChange('secondaryPhone', e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Date of Birth */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Date of Birth *
              </label>
              <div className="relative">
                <Calendar size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Gender */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Gender *
              </label>
              <div className="grid grid-cols-3 gap-2">
                {genders.map((gender) => (
                  <button
                    key={gender}
                    type="button"
                    onClick={() => handleInputChange('gender', gender)}
                    className={`px-3 py-2.5 rounded-lg border-2 transition-all text-sm font-medium ${
                      formData.gender === gender
                        ? 'border-purple-500 bg-purple-50 text-purple-900'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {gender}
                  </button>
                ))}
              </div>
            </div>

            {/* Blood Group */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Blood Group
              </label>
              <div className="relative">
                <Droplet size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <select
                  value={formData.bloodGroup}
                  onChange={(e) => handleInputChange('bloodGroup', e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent appearance-none bg-white"
                >
                  <option value="">Select Blood Group</option>
                  {bloodGroups.map((group) => (
                    <option key={group} value={group}>{group}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Address */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Address *
              </label>
              <div className="relative">
                <MapPin size={18} className="absolute left-3 top-3 text-gray-400" />
                <textarea
                  value={formData.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  placeholder="Enter full address"
                  rows={3}
                  className="w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Medical Preferences */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-900">Medical Preferences</h3>
          </div>
          
          <div className="p-4 space-y-4">
            {/* Looking For Specialization */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Looking For Doctor Specialization
              </label>
              <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto">
                {availableSpecializations.map((specialization) => (
                  <button
                    key={specialization}
                    type="button"
                    onClick={() => handleInputChange('lookingForSpecialization', specialization)}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-lg border-2 transition-all text-left ${
                      formData.lookingForSpecialization === specialization
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <span className={`text-sm font-medium ${
                      formData.lookingForSpecialization === specialization
                        ? 'text-purple-900'
                        : 'text-gray-700'
                    }`}>
                      {specialization}
                    </span>
                    {formData.lookingForSpecialization === specialization && (
                      <div className="w-5 h-5 rounded-full bg-purple-600 flex items-center justify-center">
                        <Check size={14} className="text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
              {hospitalSpecializations.length > 0 && (
                <p className="mt-2 text-xs text-gray-500">
                  Showing specializations available at this hospital
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Save Button (Mobile Bottom) */}
        <div className="pb-6">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-purple-600 text-white rounded-xl font-semibold text-sm hover:bg-purple-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {saving ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                {isEdit ? 'Updating Patient...' : 'Adding Patient...'}
              </>
            ) : (
              <>
                <Save size={18} />
                {isEdit ? 'Update Patient' : 'Add Patient'}
              </>
            )}
          </button>
        </div>
        </div>
      )}
    </div>
  );
}
