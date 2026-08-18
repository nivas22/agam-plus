'use client';
import { useState, useEffect, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { User, Mail, Phone, Save, CheckCircle2, Award, FileText, Briefcase, ArrowLeft } from "lucide-react";
import { GENDER } from "@/constants";
import { useAuth } from "@/hooks/useAuth";
import { getDoctorById, useUpdateHospitalDoctor } from "@/hooks/useNewDoctorApi";

interface DoctorProfileData {
  fullName?: string;
  email?: string;
  phone?: string;
  gender?: string;
  maritalStatus?: string;
  specialization?: string;
  qualification?: string;
  experience?: string;
  bio?: string;
}

export default function SetupDoctorProfile() {
  const router = useRouter();
  const { user, currentHospital, isDoctor, getMembership } = useAuth();
  const [formData, setFormData] = useState<Partial<DoctorProfileData>>({});
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const membership = getMembership?.();
  const hospitalId = currentHospital?.id || membership?.hospitalId || '';
  
  const updateDoctorMutation = useUpdateHospitalDoctor(hospitalId);

  useEffect(() => {
    const fetchDoctorData = async () => {
      try {
        setLoading(true);
        if (user && isDoctor && hospitalId) {
          const doctor = await getDoctorById(hospitalId, user.id);
          setFormData({
            fullName: doctor.name,
            email: doctor.email,
            phone: doctor.phone,
            specialization: doctor.specialization,
            qualification: doctor.qualification,
            experience: doctor.experience,
            bio: doctor.bio,
          });
        }
      } catch (error) {
        console.error('Failed to fetch doctor data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (user && isDoctor) {
      fetchDoctorData();
    } else {
      setLoading(false);
    }
  }, [user, isDoctor, hospitalId]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (
    field: keyof DoctorProfileData,
    value: string
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!user?.id || !hospitalId) {
      setSaveError('Missing user or hospital information');
      return;
    }

    try {
      setSaveSuccess(false);
      setSaveError(null);
      
      // Prepare update data - only include fields that can be updated via API
      const updateData = {
        specialization: formData.specialization,
        qualification: formData.qualification,
        experience: formData.experience,
        bio: formData.bio,
        phone: formData.phone,
      };
      
      await updateDoctorMutation.mutateAsync({
        doctorId: user.id,
        updates: updateData,
      });
      
      setSaveSuccess(true);
      
      // Hide success message after 3 seconds and navigate back
      setTimeout(() => {
        setSaveSuccess(false);
        router.back();
      }, 2000);
    } catch (error) {
      console.error('Failed to update profile:', error);
      setSaveError(error instanceof Error ? error.message : 'Failed to update profile');
      
      // Hide error message after 5 seconds
      setTimeout(() => setSaveError(null), 5000);
    }
  };

  const genders = [GENDER.MALE, GENDER.FEMALE, GENDER.OTHER];
  const isFormValid = formData.fullName && formData.email && formData.specialization && formData.qualification;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-3 border-gray-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-gray-600 text-sm font-medium">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header with Back Button */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors mb-4"
          >
            <ArrowLeft size={20} />
            <span className="text-sm font-medium">Back</span>
          </button>
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full mb-4 shadow-lg">
              <Award className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Edit Doctor Profile</h1>
            <p className="text-gray-600">Update your professional information</p>
          </div>
        </div>

        {/* Success Message */}
        {saveSuccess && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3 animate-fadeIn">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <span className="text-green-800 font-medium">Profile updated successfully!</span>
          </div>
        )}

        {/* Error Message */}
        {saveError && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 animate-fadeIn">
            <div className="w-5 h-5 rounded-full bg-red-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">!</span>
            </div>
            <span className="text-red-800 font-medium">{saveError}</span>
          </div>
        )}

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8 border border-gray-100">
          {/* Personal Info Section */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-6 flex items-center gap-2">
              <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-purple-600 rounded-full"></div>
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
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone || ""}
                    onChange={handleInputChange}
                    placeholder="+1 (555) 000-0000"
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
                          ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white border-blue-600 shadow-lg shadow-blue-200 scale-105"
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

          {/* Professional Info Section */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-6 flex items-center gap-2">
              <div className="w-1 h-6 bg-gradient-to-b from-purple-500 to-pink-600 rounded-full"></div>
              Professional Information
            </h2>

            <div className="space-y-5">
              {/* Specialization */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Specialization <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Award className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    name="specialization"
                    value={formData.specialization || ""}
                    onChange={handleInputChange}
                    placeholder="e.g., Cardiology, Neurology"
                    className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                  />
                </div>
              </div>

              {/* Qualification */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Qualification <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Award className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    name="qualification"
                    value={formData.qualification || ""}
                    onChange={handleInputChange}
                    placeholder="e.g., MBBS, MD"
                    className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                  />
                </div>
              </div>

              {/* Experience */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Years of Experience
                </label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    name="experience"
                    value={formData.experience || ""}
                    onChange={handleInputChange}
                    placeholder="e.g., 10+ years"
                    className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                  />
                </div>
              </div>

              {/* Bio */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Professional Bio
                </label>
                <div className="relative">
                  <FileText className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <textarea
                    name="bio"
                    value={formData.bio || ""}
                    onChange={handleInputChange}
                    placeholder="Tell us about your medical background, expertise, and approach to patient care..."
                    rows={5}
                    className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none resize-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="pt-6 border-t border-gray-200">
            <button
              onClick={handleSave}
              disabled={!isFormValid || updateDoctorMutation.isPending}
              className={`w-full py-3.5 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2 ${
                !isFormValid || updateDoctorMutation.isPending
                  ? "bg-gray-300 cursor-not-allowed"
                  : "bg-gradient-to-r from-blue-500 via-blue-600 to-purple-600 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
              }`}
            >
              {updateDoctorMutation.isPending ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Save Changes
                </>
              )}
            </button>
            {!isFormValid && (
              <p className="text-sm text-gray-500 text-center mt-3">
                Please fill in all required fields (*)
              </p>
            )}
          </div>
        </div>

        {/* Footer Note */}
        <p className="text-center text-gray-500 text-sm mt-6">
          Your information is secure and will only be used for professional purposes
        </p>
      </div>
    </div>
  );
}
