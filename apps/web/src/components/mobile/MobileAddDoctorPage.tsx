'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Loader2, User, Mail, Phone, DollarSign, Check } from 'lucide-react';
import { MEDICAL_SPECIALIZATIONS } from '@agam-plus/shared';
import MobileLoadingSpinner from './MobileLoadingSpinner';
import { apiUrl, fetchWithAuth } from '@/lib/api';

interface MobileAddDoctorPageProps {
  hospitalId: string;
  hospitalSpecializations?: string[];
  doctorId?: string;
  isEdit?: boolean;
}

export default function MobileAddDoctorPage({ hospitalId, hospitalSpecializations = [], doctorId, isEdit = false }: MobileAddDoctorPageProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    specialization: '',
    consultationFee: ''
  });

  // Fetch doctor data if editing
  useEffect(() => {
    if (isEdit && doctorId) {
      const fetchDoctorData = async () => {
        try {
          const response = await fetchWithAuth(apiUrl(`/hospitals/${hospitalId}/doctors/${doctorId}`));
          if (response.ok) {
            const doctor = await response.json();
            console.log('Fetched doctor data:', doctor);
            setFormData({
              name: doctor.name || doctor.user?.name || '',
              email: doctor.email || doctor.user?.email || '',
              phone: doctor.phone || '',
              specialization: doctor.specialization || '',
              consultationFee: doctor.consultationFee?.toString() || ''
            });
          } else {
            console.error('Failed to fetch doctor:', await response.text());
          }
        } catch (error) {
          console.error('Failed to fetch doctor data:', error);
        } finally {
          setLoading(false);
        }
      };
      fetchDoctorData();
    }
  }, [isEdit, doctorId, hospitalId]);

  // Filter specializations based on hospital's specializations
  const availableSpecializations = hospitalSpecializations.length > 0
    ? MEDICAL_SPECIALIZATIONS.filter(spec => hospitalSpecializations.includes(spec))
    : MEDICAL_SPECIALIZATIONS;

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

    if (!formData.specialization) {
      alert('Please select a specialization');
      return;
    }

    if (!formData.consultationFee || parseFloat(formData.consultationFee) <= 0) {
      alert('Please enter a valid consultation fee');
      return;
    }

    try {
      setSaving(true);

      if (isEdit && doctorId) {
        // Update existing doctor
        const payload = {
          phone: formData.phone,
          specialization: formData.specialization,
          consultationFee: parseFloat(formData.consultationFee)
        };

        const response = await fetchWithAuth(apiUrl(`/hospitals/${hospitalId}/doctors/${doctorId}`), {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          router.push(`/mobile/hospital/${hospitalId}/doctors`);
        } else {
          const error = await response.json();
          alert(error.error || 'Failed to update doctor');
        }
      } else {
        // Create new doctor
        const payload = {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          hospitalId: hospitalId,
          specialization: formData.specialization,
          consultationFee: parseFloat(formData.consultationFee)
        };

        const response = await fetchWithAuth(apiUrl(`/hospitals/${hospitalId}/doctors`), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          router.push(`/mobile/hospital/${hospitalId}/doctors`);
        } else {
          const error = await response.json();
          alert(error.error || 'Failed to add doctor');
        }
      }
    } catch (error) {
      console.error(`Failed to ${isEdit ? 'update' : 'add'} doctor:`, error);
      alert(`Failed to ${isEdit ? 'update' : 'add'} doctor. Please try again.`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-canvas">
      {/* Header */}
      <div className="bg-surface-paper border-b border-border px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(`/mobile/hospital/${hospitalId}/doctors`)}
              className="p-2 -ml-2 hover:bg-surface-canvas rounded-lg transition-colors active:scale-95"
              aria-label="Go back"
            >
              <ArrowLeft size={20} className="text-ink-700" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-ink-900">{isEdit ? 'Edit Doctor' : 'Add Doctor'}</h1>
              <p className="text-xs text-ink-500">{isEdit ? 'Update doctor details' : 'Fill in doctor details'}</p>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="flex items-center gap-2 px-4 py-2 bg-brand-violet text-white rounded-lg font-semibold text-sm hover:bg-brand-violet-hover active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
        <MobileLoadingSpinner message="Loading doctor details..." variant="admin" size="md" fullScreen={false} />
      ) : (
        /* Form Content */
        <div className="px-4 py-4 space-y-4">
        {/* Personal Information */}
        <div className="bg-surface-paper rounded-2xl overflow-hidden shadow-sm">
          <div className="px-4 py-3 bg-surface-canvas border-b border-border">
            <h3 className="text-sm font-bold text-ink-900">Personal Information</h3>
          </div>
          
          <div className="p-4 space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-semibold text-ink-700 mb-2">
                Full Name *
              </label>
              <div className="relative">
                <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Dr. John Doe"
                  disabled={isEdit}
                  className={`w-full pl-10 pr-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-status-open focus:border-transparent ${isEdit ? 'bg-surface-canvas text-ink-500 cursor-not-allowed' : ''}`}
                />
              </div>
              {isEdit && <p className="mt-1 text-xs text-ink-500">Name cannot be changed</p>}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-ink-700 mb-2">
                Email Address *
              </label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="doctor@example.com"
                  disabled={isEdit}
                  className={`w-full pl-10 pr-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-status-open focus:border-transparent ${isEdit ? 'bg-surface-canvas text-ink-500 cursor-not-allowed' : ''}`}
                />
              </div>
              {isEdit && <p className="mt-1 text-xs text-ink-500">Email cannot be changed</p>}
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-semibold text-ink-700 mb-2">
                Phone Number *
              </label>
              <div className="relative">
                <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="w-full pl-10 pr-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-status-open focus:border-transparent"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Professional Information */}
        <div className="bg-surface-paper rounded-2xl overflow-hidden shadow-sm">
          <div className="px-4 py-3 bg-surface-canvas border-b border-border">
            <h3 className="text-sm font-bold text-ink-900">Professional Details</h3>
          </div>
          
          <div className="p-4 space-y-4">
            {/* Specialization */}
            <div>
              <label className="block text-sm font-semibold text-ink-700 mb-3">
                Specialization *
              </label>
              <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto">
                {availableSpecializations.map((specialization) => (
                  <button
                    key={specialization}
                    type="button"
                    onClick={() => handleInputChange('specialization', specialization)}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-lg border-2 transition-all text-left ${
                      formData.specialization === specialization
                        ? 'border-status-open bg-status-open-soft'
                        : 'border-border bg-surface-paper hover:border-border'
                    }`}
                  >
                    <span className={`text-sm font-medium ${
                      formData.specialization === specialization
                        ? 'text-status-open'
                        : 'text-ink-700'
                    }`}>
                      {specialization}
                    </span>
                    {formData.specialization === specialization && (
                      <div className="w-5 h-5 rounded-full bg-status-open flex items-center justify-center">
                        <Check size={14} className="text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
              {hospitalSpecializations.length > 0 && (
                <p className="mt-2 text-xs text-ink-500">
                  Showing specializations available at this hospital
                </p>
              )}
            </div>

            {/* Consultation Fee */}
            <div>
              <label className="block text-sm font-semibold text-ink-700 mb-2">
                Consultation Fee *
              </label>
              <div className="relative">
                <DollarSign size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
                <input
                  type="number"
                  value={formData.consultationFee}
                  onChange={(e) => handleInputChange('consultationFee', e.target.value)}
                  placeholder="500"
                  min="0"
                  step="50"
                  className="w-full pl-10 pr-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-status-open focus:border-transparent"
                />
              </div>
              <p className="mt-2 text-xs text-ink-500">
                Enter the consultation fee amount
              </p>
            </div>
          </div>
        </div>

        {/* Save Button (Mobile Bottom) */}
        <div className="pb-6">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-brand-violet text-white rounded-xl font-semibold text-sm hover:bg-brand-violet-hover active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {saving ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                {isEdit ? 'Updating Doctor...' : 'Adding Doctor...'}
              </>
            ) : (
              <>
                <Save size={18} />
                {isEdit ? 'Update Doctor' : 'Add Doctor'}
              </>
            )}
          </button>
        </div>
        </div>
      )}
    </div>
  );
}
