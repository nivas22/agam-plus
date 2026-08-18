'use client';
import { useState, useEffect, ChangeEvent } from "react";
import { User, Mail, Phone, Save, CheckCircle2, GraduationCap, Briefcase, MapPin, Award, ArrowRight, ArrowLeft, Check } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNewDoctorApi } from "@/hooks/useNewDoctorApi";
import { useRouter } from "next/navigation";
import { GENDER } from "@/constants";

interface CreateDoctorData {
  // Personal Info
  fullName?: string;
  email?: string;
  phone?: string;
  gender?: string;
  maritalStatus?: string;
  // Professional Info
  specialization?: string;
  experience?: number;
  address?: string;
  qualification?: string;
  licenseNumber?: string;
}

interface StepStatus {
  personalInfoComplete: boolean;
  professionalInfoComplete: boolean;
}

export default function DoctorProfileStepper() {
  const { user, getMembership, loading, error } = useAuth();
  const currentMembership = getMembership();
  const hospitalId = currentMembership?.hospitalId;
  
  const { updateDoctor } = useNewDoctorApi(hospitalId, undefined, true);
  const router = useRouter();

  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<Partial<CreateDoctorData>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [stepStatus, setStepStatus] = useState<StepStatus>({
    personalInfoComplete: false,
    professionalInfoComplete: false,
  });

  // Load saved data and step status from storage on mount
  useEffect(() => {
    const membershipProfileUpdated = !!currentMembership?.isProfileUpdated;
    const membershipExperienceUpdated = !!currentMembership?.isExperienceUpdated;

    const status = {
      personalInfoComplete: membershipProfileUpdated,
      professionalInfoComplete: membershipExperienceUpdated,
    } as StepStatus;

    setStepStatus(status);

    // If step 1 is complete and step 2 is not, go to step 2
    if (status.personalInfoComplete && !status.professionalInfoComplete) {
      setCurrentStep(2);
    } else if (status.professionalInfoComplete) {
      setCurrentStep(2); // Both complete, show step 2
    }
  }, [user, currentMembership]);

  // Prefill from authenticated user where available
  useEffect(() => {
    if (!user) return;
    setFormData((prev) => ({
      ...prev,
      fullName: prev.fullName || (user as any).name || (user as any).displayName || prev.fullName,
      email: prev.email || (user as any).email || prev.email,
    }));
  }, [user]);

  // Save doctor profile to backend (update existing doctor details)
  const saveDoctor = async (updatedStatus: StepStatus) => {
    if (!formData.fullName || !formData.email) {
      alert("Name and Email are required");
      return;
    }

    setIsSaving(true);
    try {
      // Build payload as requested (includes broader fields)
      const payload = {
        name: formData.fullName ?? "",
        email: formData.email ?? "",
        phone: formData.phone ?? "",
        specialization: formData.specialization ?? "",
        experience: String(formData.experience ?? "0"),
        location: formData.address ?? "",
        gender: formData.gender ?? "",
        maritalStatus: formData.maritalStatus ?? "",
        status: "pending" as const,
        availability: (formData as any).availability ?? [],
        appointmentDuration: (formData as any).appointmentDuration ?? 30,
        address: formData.address ?? "",
        hospitalId: (formData as any).hospitalId ?? hospitalId ?? "",
        isProfileUpdated: updatedStatus.personalInfoComplete,
        isExperienceUpdated: updatedStatus.professionalInfoComplete,
      };

      const id = user?.id;
      if (!id) {
        return;
      }

      // Update only fields supported by updateDoctor (subset of payload)
      await updateDoctor(id, {
        specialization: payload.specialization || undefined,
        qualification: formData.qualification || undefined,
        experience: payload.experience,
        phone: payload.phone || undefined,
        status: payload.status,
        availability: payload.availability,
        isProfileUpdated: updatedStatus.personalInfoComplete,
        isExperienceUpdated: updatedStatus.professionalInfoComplete
      });

      if (hospitalId && updatedStatus.personalInfoComplete && updatedStatus.professionalInfoComplete) {
        router.push(`/hospital/${hospitalId}/dashboard`);
      }
    } catch (err) {
      console.error("Error saving doctor:", err);
      alert("Failed to save doctor. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ 
      ...prev, 
      [name]: name === 'experience' ? Number(value) : value 
    }));
  };

  const handleSelectChange = (field: keyof CreateDoctorData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveStep = async (step: number) => {
    setIsSaving(true);
    setSaveSuccess(false);
    
    const newStatus = { ...stepStatus };
    if (step === 1) {
      newStatus.personalInfoComplete = true;
    } else if (step === 2) {
      newStatus.professionalInfoComplete = true;
    }
    
    setStepStatus(newStatus);
    
    setIsSaving(false);
    setSaveSuccess(true);
    await saveDoctor(newStatus);
    
    // Move to next step after saving step 1
    if (step === 1) {
      setCurrentStep(2);
    }
    
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const genders = [GENDER.MALE, GENDER.FEMALE, GENDER.OTHER];
  const specializations = [
    'Cardiology', 'Dermatology', 'Neurology', 'Orthopedics', 'Pediatrics',
    'Psychiatry', 'Radiology', 'General Surgery', 'Internal Medicine', 'Oncology',
    'Ophthalmology', 'ENT (Otorhinolaryngology)', 'Gynecology', 'Urology', 'Anesthesiology'
  ];

  const isStep1Valid = formData.fullName && formData.email && formData.phone;
  const isStep2Valid = formData.specialization;

  const steps = [
    { number: 1, title: 'Personal Info', icon: User, complete: stepStatus.personalInfoComplete },
    { number: 2, title: 'Professional Info', icon: GraduationCap, complete: stepStatus.professionalInfoComplete },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4">
        <div className="flex items-center gap-3 text-gray-700">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span>Loading your profile...</span>
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 via-rose-50 to-orange-50 p-4">
        <div className="max-w-md w-full bg-white border border-red-200 text-red-700 rounded-xl p-6 shadow">
          <h2 className="text-lg font-semibold mb-2">Unable to load your account</h2>
          <p className="text-sm mb-4">Please sign in again or try refreshing the page.</p>
          <pre className="text-xs text-red-500 overflow-auto">{String((error as any)?.message || '')}</pre>
        </div>
      </div>
    );
  }

  if (!currentMembership) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-yellow-50 via-amber-50 to-orange-50 p-4">
        <div className="max-w-md w-full bg-white border border-amber-200 text-amber-800 rounded-xl p-6 shadow">
          <h2 className="text-lg font-semibold mb-2">No hospital context</h2>
          <p className="text-sm">We couldn't find your current hospital membership. Please select a hospital and try again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Complete Your Profile</h1>
          <p className="text-gray-600">Step {currentStep} of 2</p>
        </div>

        {/* Stepper */}
        <div className="mb-8">
          <div className="flex items-center justify-center">
            {steps.map((step, index) => (
              <div key={step.number} className="flex items-center">
                {/* Step Circle */}
                <div
                  onClick={() => step.complete && setCurrentStep(step.number)}
                  className={`relative flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all cursor-pointer ${
                    step.complete
                      ? 'bg-green-500 border-green-500'
                      : currentStep === step.number
                      ? 'bg-indigo-500 border-indigo-500'
                      : 'bg-white border-gray-300'
                  }`}
                >
                  {step.complete ? (
                    <Check className="w-6 h-6 text-white" />
                  ) : (
                    <step.icon
                      className={`w-6 h-6 ${
                        currentStep === step.number ? 'text-white' : 'text-gray-400'
                      }`}
                    />
                  )}
                  
                  {/* Step Label */}
                  <div className="absolute -bottom-8 whitespace-nowrap">
                    <p className={`text-sm font-medium ${
                      currentStep === step.number ? 'text-indigo-600' : step.complete ? 'text-green-600' : 'text-gray-500'
                    }`}>
                      {step.title}
                    </p>
                  </div>
                </div>

                {/* Connector Line */}
                {index < steps.length - 1 && (
                  <div
                    className={`w-24 md:w-32 h-1 mx-2 transition-all ${
                      step.complete ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Success Message */}
        {saveSuccess && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3 animate-fadeIn">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <span className="text-green-800 font-medium">
              {currentStep === 1 ? 'Personal information saved!' : 'Professional information saved!'}
            </span>
          </div>
        )}

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8 border border-gray-100">
          {/* Step 1: Personal Info */}
          {currentStep === 1 && (
            <div>
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-gray-800 mb-6 flex items-center gap-2">
                  <div className="w-1 h-6 bg-gradient-to-b from-indigo-500 to-purple-600 rounded-full"></div>
                  Personal Information
                </h2>

                <div className="space-y-5">
                  {/* Full Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        name="fullName"
                        value={formData.fullName || ""}
                        onChange={handleInputChange}
                        placeholder="Dr. John Doe"
                        className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="email"
                        name="email"
                        value={formData.email || ""}
                        onChange={handleInputChange}
                        placeholder="doctor@hospital.com"
                        className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                      />
                    </div>
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone || ""}
                        onChange={handleInputChange}
                        placeholder="+1 (555) 000-0000"
                        required
                        className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                      />
                    </div>
                  </div>

                  {/* Gender */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Gender
                    </label>
                    <div className="flex flex-wrap gap-3">
                      {genders.map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => handleSelectChange("gender", g)}
                          className={`px-5 py-2.5 rounded-xl border-2 font-medium transition-all ${
                            formData.gender === g
                              ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-purple-600 shadow-lg shadow-indigo-200 scale-105"
                              : "bg-white text-gray-700 border-gray-300 hover:border-blue-300 hover:shadow-md"
                          }`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Professional Info */}
          {currentStep === 2 && (
            <div>
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-gray-800 mb-6 flex items-center gap-2">
                  <div className="w-1 h-6 bg-gradient-to-b from-indigo-500 to-purple-600 rounded-full"></div>
                  Professional Information
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Specialization */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Specialization <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Award className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none z-10" />
                      <select
                        name="specialization"
                        value={formData.specialization || ""}
                        onChange={handleInputChange}
                        className="w-full pl-11 pr-10 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none appearance-none bg-white"
                      >
                        <option value="">Select your specialization</option>
                        {specializations.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Years of Experience */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Years of Experience
                    </label>
                    <div className="relative">
                      <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="number"
                        name="experience"
                        value={formData.experience || ""}
                        onChange={handleInputChange}
                        placeholder="e.g., 5"
                        min="0"
                        max="50"
                        className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
                      />
                    </div>
                  </div>

                  {/* Qualification */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Highest Qualification
                    </label>
                    <div className="relative">
                      <GraduationCap className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        name="qualification"
                        value={formData.qualification || ""}
                        onChange={handleInputChange}
                        placeholder="e.g., MD, MBBS"
                        className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
                      />
                    </div>
                  </div>

                  {/* License Number */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Medical License Number
                    </label>
                    <div className="relative">
                      <Award className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        name="licenseNumber"
                        value={formData.licenseNumber || ""}
                        onChange={handleInputChange}
                        placeholder="e.g., MED-123456"
                        className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
                      />
                    </div>
                  </div>

                  {/* Address */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Practice Address
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                      <textarea
                        name="address"
                        value={formData.address || ""}
                        onChange={handleInputChange}
                        placeholder="Enter your clinic or hospital address"
                        rows={3}
                        className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none resize-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="pt-6 border-t border-gray-200 flex gap-4">
            {currentStep > 1 && (
              <button
                onClick={() => setCurrentStep(currentStep - 1)}
                className="px-6 py-3.5 rounded-xl font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all flex items-center gap-2"
              >
                <ArrowLeft className="w-5 h-5" />
                Previous
              </button>
            )}

            <button
              onClick={() => handleSaveStep(currentStep)}
              disabled={(currentStep === 1 && !isStep1Valid) || (currentStep === 2 && !isStep2Valid) || isSaving}
              className={`flex-1 py-3.5 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2 ${
                ((currentStep === 1 && !isStep1Valid) || (currentStep === 2 && !isStep2Valid) || isSaving)
                  ? "bg-gray-300 cursor-not-allowed"
                  : currentStep === 1
                  ? "bg-gradient-to-r from-indigo-600 to-purple-600 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
                  : "bg-gradient-to-r from-indigo-600 to-purple-600 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
              }`}
            >
              {isSaving ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Saving...
                </>
              ) : currentStep < 2 ? (
                <>
                  Save & Continue
                  <ArrowRight className="w-5 h-5" />
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Complete Profile
                </>
              )}
            </button>
          </div>

          {((currentStep === 1 && !isStep1Valid) || (currentStep === 2 && !isStep2Valid)) && (
            <p className="text-sm text-gray-500 text-center mt-3">
              Please fill in all required fields (*) to continue
            </p>
          )}
        </div>
      </div>
    </div>
  );
}