'use client';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePatientApi, useHospitalPatient } from '@/hooks/useNewPatientApi';
import { PatientFormData } from "@/types/patient";
import {
  User,
  Phone,
  Calendar,
  MapPin,
  ArrowLeft,
  Save,
  Mail,
  Loader2,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/hooks/useAuth";
import { GENDER } from "@agam-plus/shared";

interface AddEditPatientProps {
  isNew?: boolean;
  id?: string;
  userRole?: string;
  canEdit?: boolean;
  hospitalId?: string; // Add hospitalId prop
}

export default function AddEditPatient1({ 
  isNew = false, 
  id, 
  userRole = 'admin',
  canEdit = true,
  hospitalId // Get hospitalId from props
}: AddEditPatientProps) {
  console.log(userRole, canEdit);
  const router = useRouter();
  const { navigateToHospitalRoute  } = useAuth();

  // Using TanStack Query hooks with hospitalId
  const { 
    createPatient,
    updatePatient,
    isCreating,
    isUpdating,
  } = usePatientApi(hospitalId, undefined, true); // Pass hospitalId and enable query

  // Use the single patient hook for editing
  const { 
    data: patientData,
    isLoading: patientLoading,
    error: patientError 
  } = useHospitalPatient(id || '', hospitalId);

  const [formData, setFormData] = useState<PatientFormData>({
    name: "",
    phone: "",
    secondaryPhone: "",
    dateOfBirth: "",
    gender: "",
    address: "",
    startDate: "",
    endDate: "",
    notes: "",
    email: ""
  });

  const [formError, setFormError] = useState<string | null>(null);

  const genders = [GENDER.MALE, GENDER.FEMALE, GENDER.OTHER];
  
  // Load patient data for editing - FIXED VERSION
  useEffect(() => {
    if (!isNew && patientData?.patient) {
      const patient = patientData.patient;
      setFormData({
        name: patient.name || "",
        phone: patient.phone || "",
        secondaryPhone: patient.secondaryPhone || "",
        dateOfBirth: patient.dateOfBirth || "",
        gender: patient.gender || "",
        address: patient.address || "",
        notes: patient.notes || "",
        email: patient.email || "",
        // Add other fields as needed
      });
    }
  }, [isNew, patientData]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear form error when user starts typing
    if (formError) setFormError(null);
  };

  const handleGenderSelect = (gender: string) => {
    setFormData((prev) => ({ ...prev, gender }));
  };

  const calculateAge = (dob: string) => {
    if (!dob) return "";
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validation
    if (!formData.name || !formData.dateOfBirth) {
      setFormError("Please fill in required fields: Name and Date of Birth");
      return;
    }

    // Email validation
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setFormError("Please enter a valid email address");
      return;
    }

    try {
      if (isNew) {
        // Create new patient
        await createPatient({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          secondaryPhone: formData.secondaryPhone,
          dateOfBirth: formData.dateOfBirth,
          gender: formData.gender as GENDER, // Convert to lowercase
          address: formData.address,
        });
      } else if (id) {
        // Update existing patient
        await updatePatient(id, {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          secondaryPhone: formData.secondaryPhone,
          dateOfBirth: formData.dateOfBirth,
          gender: formData.gender as GENDER,
          address: formData.address,
        });
      }
      navigateToHospitalRoute(`patients`);
      // Optional: Show success toast here
      toast.success(`Patient ${isNew ? 'created' : 'updated'} successfully`);
    } catch (error) {
      console.error("Error saving patient:", error);
      setFormError(
        error instanceof Error 
          ? error.message 
          : "Error saving patient. Please try again."
      );
      toast.error(`Failed to ${isNew ? 'create' : 'update'} patient`);
    }
  };

  const isSaving = isCreating || isUpdating;
  const isLoading = !isNew && patientLoading;

  // Show loading state only when actually loading patient data for editing
  if (isLoading && !isNew) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-brand-violet" />
        <span className="ml-2 text-ink-700">Loading patient data...</span>
      </div>
    );
  }

  // Show error state
  if (patientError && !isNew) {
    return (
      <div className="max-w-4xl mx-auto px-4 pb-6">
        <div className="flex items-center gap-3 mb-6 pt-4">
          <button
            onClick={() => navigateToHospitalRoute(`patients`)}
            className="flex items-center gap-2 text-ink-700 hover:text-ink-900 transition-colors group"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
            <span className="text-sm font-medium">Back to Patients</span>
          </button>
        </div>
        <div className="bg-status-danger-soft border border-status-danger/20 rounded-lg p-6 text-center">
          <h3 className="text-lg font-semibold text-status-danger mb-2">Error Loading Patient</h3>
          <p className="text-status-danger">{patientError.message}</p>
          <button
            onClick={() => navigateToHospitalRoute(`patients`)}
            className="mt-4 px-4 py-2 bg-status-danger text-white rounded-lg hover:bg-status-danger-hover"
          >
            Return to Patients
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 pb-6">
      {/* Compact Header */}
      <div className="flex items-center gap-3 mb-6 pt-4">
        <button
          onClick={() => navigateToHospitalRoute(`patients`, hospitalId)}
          disabled={isSaving}
          className="flex items-center gap-2 text-ink-700 hover:text-ink-900 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
          <span className="text-sm font-medium">Back to Patients</span>
        </button>
        <div className="h-4 w-px bg-border"></div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-brand-violet" />
            <h1 className="text-xl font-bold text-ink-900 truncate">
              {isNew ? "Add New Patient" : "Edit Patient"}
            </h1>
          </div>
        </div>
      </div>

      {/* Form Error Alert */}
      {formError && (
        <div className="mb-6 p-4 bg-status-danger-soft border border-status-danger/20 rounded-lg">
          <div className="flex items-center gap-2 text-status-danger">
            <div className="w-2 h-2 bg-status-danger rounded-full"></div>
            <p className="text-sm font-medium">{formError}</p>
          </div>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-surface-paper rounded-xl shadow-sm border border-border p-6 space-y-6"
      >
        {/* Personal Information - Single Column Layout */}
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column */}
            <div className="space-y-5">
              <div className="flex items-center gap-2 text-ink-700">
                <div className="w-1.5 h-4 bg-brand-violet rounded-full"></div>
                <h3 className="font-semibold text-ink-900">Personal Information</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-ink-700 mb-2">
                    Full Name *
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-ink-500 w-4 h-4" />
                    <input
                      type="text"
                      name="name"
                      placeholder="John Smith"
                      value={formData.name}
                      onChange={handleChange}
                      disabled={isSaving}
                      className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg focus:ring-2 focus:ring-brand-violet focus:border-brand-violet transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink-700 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-ink-500 w-4 h-4" />
                    <input
                      type="email"
                      name="email"
                      placeholder="patient@example.com"
                      value={formData.email || ""}
                      onChange={handleChange}
                      disabled={isSaving}
                      className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg focus:ring-2 focus:ring-brand-violet focus:border-brand-violet transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink-700 mb-2">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-ink-500 w-4 h-4" />
                    <input
                      type="tel"
                      name="phone"
                      placeholder="+1 (555) 123-4567"
                      value={formData.phone || ""}
                      onChange={handleChange}
                      disabled={isSaving}
                      className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg focus:ring-2 focus:ring-brand-violet focus:border-brand-violet transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink-700 mb-2">
                    Secondary Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-ink-500 w-4 h-4" />
                    <input
                      type="tel"
                      name="secondaryPhone"
                      placeholder="+1 (555) 987-6543"
                      value={formData.secondaryPhone || ""}
                      onChange={handleChange}
                      disabled={isSaving}
                      className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg focus:ring-2 focus:ring-brand-violet focus:border-brand-violet transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-5">
              <div className="flex items-center gap-2 text-ink-700">
                <div className="w-1.5 h-4 bg-status-open rounded-full"></div>
                <h3 className="font-semibold text-ink-900">Additional Details</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-ink-700 mb-2">
                    Date of Birth *
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-ink-500 w-4 h-4" />
                    <input
                      type="date"
                      name="dateOfBirth"
                      value={formData.dateOfBirth || ""}
                      onChange={handleChange}
                      disabled={isSaving}
                      className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg focus:ring-2 focus:ring-brand-violet focus:border-brand-violet transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      required
                    />
                  </div>
                  {formData.dateOfBirth && (
                    <p className="text-xs text-ink-500 mt-1.5 font-medium">
                      Age: {calculateAge(formData.dateOfBirth)} years
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink-700 mb-2">
                    Gender
                  </label>
                  <div className="flex gap-2">
                    {genders.map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => handleGenderSelect(g)}
                        disabled={isSaving}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                          formData.gender === g
                            ? "bg-brand-violet text-white border-brand-violet shadow-sm"
                            : "bg-surface-paper text-ink-700 border-border hover:bg-surface-canvas hover:border-ink-500"
                        }`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink-700 mb-2">
                    Address
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 text-ink-500 w-4 h-4" />
                    <textarea
                      name="address"
                      placeholder="123 Main St, City, State"
                      value={formData.address || ""}
                      onChange={handleChange}
                      disabled={isSaving}
                      rows={2}
                      className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg focus:ring-2 focus:ring-brand-violet focus:border-brand-violet resize-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Notes Section */}
          <div>
            <div className="flex items-center gap-2 text-ink-700 mb-4">
              <div className="w-1.5 h-4 bg-status-open rounded-full"></div>
              <h3 className="font-semibold text-ink-900">Additional Notes</h3>
            </div>
            <textarea
              name="notes"
              placeholder="Any additional information about the patient..."
              value={formData.notes || ""}
              onChange={handleChange}
              disabled={isSaving}
              rows={3}
              className="w-full p-3 border border-border rounded-lg focus:ring-2 focus:ring-brand-violet focus:border-brand-violet resize-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-border">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center justify-center gap-2 bg-brand-violet hover:bg-brand-violet-hover text-white px-6 py-3 rounded-lg transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex-1 sm:flex-none"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {isNew ? "Creating..." : "Updating..."}
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {isNew ? "Add Patient" : "Update Patient"}
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => router.push(`hospital/${hospitalId}/patients`)}
            disabled={isSaving}
            className="px-6 py-3 border border-border text-ink-700 rounded-lg hover:bg-surface-canvas transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex-1 sm:flex-none"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}