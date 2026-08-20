'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Building2, Mail, Phone, MapPin, Save, Loader2, Image as ImageIcon, Check } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { MEDICAL_SPECIALIZATIONS } from '../../constants';
import MobileLoadingSpinner from './MobileLoadingSpinner';
import { apiUrl, fetchWithAuth } from '@/lib/api';

export default function MobileHospitalEditPage() {
  const router = useRouter();
  const { currentHospital, isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    email: '',
    phone: '',
    secondaryNumber: '',
    city: '',
    location: '',
    logo: ''
  });
  const [selectedSpecializations, setSelectedSpecializations] = useState<string[]>([]);

  useEffect(() => {
    if (!isAdmin) {
      router.push(`/mobile/hospital/${currentHospital?.id}/profile`);
      return;
    }

    const fetchHospitalData = async () => {
      if (!currentHospital?.id) return;

      try {
        setLoading(true);
        const response = await fetchWithAuth(apiUrl(`/hospitals/${currentHospital.id}`));

        if (response.ok) {
          const data = await response.json();
          setFormData({
            name: data.name || '',
            address: data.address || '',
            email: data.email || '',
            phone: data.phone || '',
            secondaryNumber: data.secondaryNumber || '',
            city: data.city || '',
            location: data.location || '',
            logo: data.logo || ''
          });
          
          // Set selected specializations
          if (Array.isArray(data.specializations)) {
            setSelectedSpecializations(data.specializations);
          } else if (typeof data.specializations === 'string') {
            setSelectedSpecializations(data.specializations.split(',').map((s: string) => s.trim()).filter((s: string) => s));
          }
        }
      } catch (error) {
        console.error('Failed to fetch hospital data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHospitalData();
  }, [currentHospital?.id, isAdmin, router]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const toggleSpecialization = (specialization: string) => {
    setSelectedSpecializations(prev => {
      if (prev.includes(specialization)) {
        return prev.filter(s => s !== specialization);
      } else {
        return [...prev, specialization];
      }
    });
  };

  const handleSave = async () => {
    if (!currentHospital?.id) return;

    try {
      setSaving(true);

      const updateData = {
        name: formData.name,
        address: formData.address,
        email: formData.email,
        phone: formData.phone,
        secondaryNumber: formData.secondaryNumber,
        specializations: selectedSpecializations,
        city: formData.city,
        location: formData.location,
        logo: formData.logo
      };

      const response = await fetchWithAuth(apiUrl(`/hospitals/${currentHospital.id}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (response.ok) {
        router.push(`/mobile/hospital/${currentHospital.id}/profile`);
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to update hospital details');
      }
    } catch (error) {
      console.error('Failed to save hospital data:', error);
      alert('Failed to save hospital details. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <MobileLoadingSpinner message="Loading hospital details..." variant="admin" size="lg" />;
  }

  return (
    <div className="min-h-screen bg-surface-canvas">
      {/* Header */}
      <div className="bg-surface-paper border-b border-border px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(`/mobile/hospital/${currentHospital?.id}/profile`)}
              className="p-2 -ml-2 hover:bg-surface-canvas rounded-lg transition-colors active:scale-95"
              aria-label="Go back"
            >
              <ArrowLeft size={20} className="text-ink-700" />
            </button>
            <h1 className="text-lg font-bold text-ink-900">Edit Hospital</h1>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
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

      {/* Form Content */}
      <div className="px-4 py-4 space-y-4">
        {/* Hospital Logo */}
        <div className="bg-surface-paper rounded-2xl p-4 shadow-sm">
          <label className="block text-sm font-semibold text-ink-700 mb-3">
            Hospital Logo URL
          </label>
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-xl bg-brand-violet-soft flex items-center justify-center overflow-hidden">
              {formData.logo ? (
                <img src={formData.logo} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <ImageIcon size={24} className="text-brand-violet" />
              )}
            </div>
            <input
              type="text"
              value={formData.logo}
              onChange={(e) => handleInputChange('logo', e.target.value)}
              placeholder="Enter logo URL"
              className="flex-1 px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-violet focus:border-transparent"
            />
          </div>
        </div>

        {/* Basic Information */}
        <div className="bg-surface-paper rounded-2xl overflow-hidden shadow-sm">
          <div className="px-4 py-3 bg-surface-canvas border-b border-border">
            <h3 className="text-sm font-bold text-ink-900">Basic Information</h3>
          </div>

          <div className="p-4 space-y-4">
            {/* Hospital Name */}
            <div>
              <label className="block text-sm font-semibold text-ink-700 mb-2">
                Hospital Name *
              </label>
              <div className="relative">
                <Building2 size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Enter hospital name"
                  className="w-full pl-10 pr-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-violet focus:border-transparent"
                />
              </div>
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
                  placeholder="hospital@example.com"
                  className="w-full pl-10 pr-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-violet focus:border-transparent"
                />
              </div>
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
                  className="w-full pl-10 pr-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-violet focus:border-transparent"
                />
              </div>
            </div>

            {/* Secondary Number */}
            <div>
              <label className="block text-sm font-semibold text-ink-700 mb-2">
                Secondary Number
              </label>
              <div className="relative">
                <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
                <input
                  type="tel"
                  value={formData.secondaryNumber}
                  onChange={(e) => handleInputChange('secondaryNumber', e.target.value)}
                  placeholder="+1 (555) 000-0001"
                  className="w-full pl-10 pr-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-violet focus:border-transparent"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Location Information */}
        <div className="bg-surface-paper rounded-2xl overflow-hidden shadow-sm">
          <div className="px-4 py-3 bg-surface-canvas border-b border-border">
            <h3 className="text-sm font-bold text-ink-900">Location Details</h3>
          </div>

          <div className="p-4 space-y-4">
            {/* Address */}
            <div>
              <label className="block text-sm font-semibold text-ink-700 mb-2">
                Address *
              </label>
              <div className="relative">
                <MapPin size={18} className="absolute left-3 top-3 text-ink-500" />
                <textarea
                  value={formData.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  placeholder="Enter full address"
                  rows={3}
                  className="w-full pl-10 pr-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-violet focus:border-transparent resize-none"
                />
              </div>
            </div>

            {/* City */}
            <div>
              <label className="block text-sm font-semibold text-ink-700 mb-2">
                City
              </label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => handleInputChange('city', e.target.value)}
                placeholder="Enter city"
                className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-violet focus:border-transparent"
              />
            </div>

            {/* Location/Region */}
            <div>
              <label className="block text-sm font-semibold text-ink-700 mb-2">
                Location/Region
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => handleInputChange('location', e.target.value)}
                placeholder="Enter location or region"
                className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-violet focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Specializations */}
        <div className="bg-surface-paper rounded-2xl overflow-hidden shadow-sm">
          <div className="px-4 py-3 bg-surface-canvas border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-bold text-ink-900">Specializations</h3>
            <span className="text-xs text-brand-violet font-semibold">
              {selectedSpecializations.length} selected
            </span>
          </div>

          <div className="p-4">
            <label className="block text-sm font-semibold text-ink-700 mb-3">
              Select Medical Specializations
            </label>
            <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto">
              {MEDICAL_SPECIALIZATIONS.map((specialization) => (
                <button
                  key={specialization}
                  type="button"
                  onClick={() => toggleSpecialization(specialization)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg border-2 transition-all text-left ${
                    selectedSpecializations.includes(specialization)
                      ? 'border-brand-violet bg-brand-violet-soft'
                      : 'border-border bg-surface-paper hover:border-ink-500'
                  }`}
                >
                  <span className={`text-sm font-medium ${
                    selectedSpecializations.includes(specialization)
                      ? 'text-brand-violet-hover'
                      : 'text-ink-700'
                  }`}>
                    {specialization}
                  </span>
                  {selectedSpecializations.includes(specialization) && (
                    <div className="w-5 h-5 rounded-full bg-brand-violet flex items-center justify-center">
                      <Check size={14} className="text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-ink-500">
              Tap to select or deselect specializations
            </p>
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
                Saving Changes...
              </>
            ) : (
              <>
                <Save size={18} />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
