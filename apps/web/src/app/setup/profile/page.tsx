'use client';
import { useState, ChangeEvent } from "react";
import { User, Mail, Phone, Save, CheckCircle2 } from "lucide-react";
import { GENDER } from "../../../constants";

interface CreateDoctorData {
  fullName?: string;
  email?: string;
  phone?: string;
  gender?: string;
  maritalStatus?: string;
}

export default function SetupProfile() {
  const [formData, setFormData] = useState<Partial<CreateDoctorData>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (
    field: keyof CreateDoctorData,
    value: string
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    setIsSaving(false);
    setSaveSuccess(true);
    
    // Hide success message after 3 seconds
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const genders = [GENDER.MALE, GENDER.FEMALE, GENDER.OTHER];
  const isFormValid = formData.fullName && formData.email;

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-violet-soft via-surface-paper to-brand-violet-soft p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-brand-violet to-brand-violet rounded-full mb-4 shadow-lg">
            <User className="w-8 h-8 text-white" />
          </div>
          <h1 className="font-display tracking-tight text-3xl font-bold text-ink-900 mb-2">Setup Your Profile</h1>
          <p className="text-ink-700">Complete your professional information</p>
        </div>

        {/* Success Message */}
        {saveSuccess && (
          <div className="mb-6 bg-status-open-soft border border-status-open/20 rounded-xl p-4 flex items-center gap-3 animate-fadeIn">
            <CheckCircle2 className="w-5 h-5 text-status-open" />
            <span className="text-status-open font-medium">Profile saved successfully!</span>
          </div>
        )}

        {/* Form Card */}
        <div className="bg-surface-paper rounded-2xl shadow-xl p-6 md:p-8 border border-border">
          {/* Personal Info Section */}
          <div className="mb-8">
            <h2 className="font-display tracking-tight text-xl font-semibold text-ink-900 mb-6 flex items-center gap-2">
              <div className="w-1 h-6 bg-gradient-to-b from-brand-violet to-brand-violet rounded-full"></div>
              Personal Information
            </h2>

            <div className="space-y-5">
              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-2">
                  Full Name <span className="text-status-danger">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-ink-500" />
                  <input
                    type="text"
                    name="fullName"
                    value={formData.fullName || ""}
                    onChange={handleInputChange}
                    placeholder="Dr. John Doe"
                    className="w-full pl-11 pr-4 py-3 border border-border rounded-xl focus:ring-2 focus:ring-brand-violet focus:border-transparent transition-all outline-none"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-2">
                  Email Address <span className="text-status-danger">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-ink-500" />
                  <input
                    type="email"
                    name="email"
                    value={formData.email || ""}
                    onChange={handleInputChange}
                    placeholder="doctor@hospital.com"
                    className="w-full pl-11 pr-4 py-3 border border-border rounded-xl focus:ring-2 focus:ring-brand-violet focus:border-transparent transition-all outline-none"
                  />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-2">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-ink-500" />
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone || ""}
                    onChange={handleInputChange}
                    placeholder="+1 (555) 000-0000"
                    className="w-full pl-11 pr-4 py-3 border border-border rounded-xl focus:ring-2 focus:ring-brand-violet focus:border-transparent transition-all outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Gender Section */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-ink-700 mb-3">
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
                      ? "bg-gradient-to-r from-brand-violet to-brand-violet text-white border-brand-violet shadow-lg shadow-brand-violet-soft scale-105"
                      : "bg-surface-paper text-ink-700 border-border hover:border-brand-violet hover:shadow-md"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* Save Button */}
          <div className="pt-6 border-t border-border">
            <button
              onClick={handleSave}
              disabled={!isFormValid || isSaving}
              className={`w-full py-3.5 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2 ${
                !isFormValid || isSaving
                  ? "bg-border cursor-not-allowed"
                  : "bg-gradient-to-r from-brand-violet via-brand-violet-hover to-brand-violet hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
              }`}
            >
              {isSaving ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Save Profile
                </>
              )}
            </button>
            {!isFormValid && (
              <p className="text-sm text-ink-500 text-center mt-3">
                Please fill in all required fields (*)
              </p>
            )}
          </div>
        </div>

        {/* Footer Note */}
        <p className="text-center text-ink-500 text-sm mt-6">
          Your information is secure and will only be used for professional purposes
        </p>
      </div>
    </div>
  );
}