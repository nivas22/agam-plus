"use client";

import { useState, ChangeEvent } from "react";
import toast from "react-hot-toast";
import PersonalInfoSection, { PersonalInfoData } from "@/components/common/PersonalInfoSection";
import { ArrowLeft, Save, Stethoscope, Loader2 } from "lucide-react";
import { GENDER } from "@agam-plus/shared";

interface AddDoctorPersonalProps {
  initial?: PersonalInfoData;
  onBack?: () => void;
  onSave?: (data: PersonalInfoData) => Promise<void> | void;
}

export default function AddDoctorPersonal({ initial, onBack, onSave }: AddDoctorPersonalProps) {
  const [form, setForm] = useState<PersonalInfoData>({
    name: initial?.name || "",
    email: initial?.email || "",
    phone: initial?.phone || "",
    gender: initial?.gender,
    maritalStatus: initial?.maritalStatus,
  });
  const [isSaving, setIsSaving] = useState(false);

  const genders = [GENDER.MALE, GENDER.FEMALE, GENDER.OTHER];
  const maritalStatuses = ["Single", "Married"];

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (field: keyof PersonalInfoData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!onSave) return;
    
    // Validate required fields
    if (!form.name || !form.email) {
      toast.error("Name and Email are required", {
        duration: 3000,
        position: "top-right",
      });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) {
      toast.error("Please enter a valid email address", {
        duration: 3000,
        position: "top-right",
      });
      return;
    }
    
    setIsSaving(true);
    try {
      await onSave(form);
      toast.success("Doctor saved successfully! Welcome email sent.", {
        duration: 4000,
        position: "top-right",
      });
    } catch (error) {
      console.error("Error saving doctor:", error);
      toast.error("Failed to save doctor. Please try again.", {
        duration: 4000,
        position: "top-right",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-violet-soft via-brand-violet-soft to-brand-violet-soft md:bg-gradient-to-br bg-surface-canvas">
      <div className="max-w-4xl mx-auto px-3 sm:px-4 md:px-6 py-4 md:py-10">
        {/* Mobile Header */}
        <div className="md:hidden mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-gradient-to-br from-brand-violet to-brand-violet rounded-xl shadow-md">
              <Stethoscope className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-ink-900">
                Add New Doctor
              </h1>
              <p className="text-ink-700 text-xs">
                Personal Information
              </p>
            </div>
          </div>
        </div>

        {/* Desktop Header */}
        <div className="hidden md:block mb-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-brand-violet to-brand-violet rounded-2xl blur-lg opacity-30"></div>
              <div className="relative p-4 bg-gradient-to-br from-brand-violet to-brand-violet rounded-2xl shadow-lg">
                <Stethoscope className="w-8 h-8 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-ink-900 mb-1">
                Add New Doctor
              </h1>
              <p className="text-ink-700 text-sm md:text-base">
                Complete the personal information to get started
              </p>
            </div>
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-surface-paper rounded-xl md:rounded-2xl shadow-md md:shadow-xl border border-border md:border-border/50 overflow-hidden md:bg-white/80 md:backdrop-blur-sm">
          {/* Card Header with Actions */}
          <div className="bg-gradient-to-r from-brand-violet/5 via-brand-violet/5 to-brand-violet/5 border-b border-border/50 px-4 sm:px-6 py-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                {onBack && (
                  <button
                    onClick={onBack}
                    disabled={isSaving}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-ink-700 hover:text-ink-900 hover:bg-white/50 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span className="text-sm font-medium hidden sm:inline">Back</span>
                  </button>
                )}
                <div className="hidden md:flex items-center gap-2">
                  <div className="w-1.5 h-6 bg-gradient-to-b from-brand-violet to-brand-violet rounded-full"></div>
                  <div>
                    <h2 className="text-lg font-semibold text-ink-900">Personal Information</h2>
                    <p className="text-xs text-ink-700">Fill in the doctor's basic details</p>
                  </div>
                </div>
              </div>
              
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="relative group inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-brand-violet to-brand-violet hover:from-brand-violet-hover hover:to-brand-violet-hover text-white rounded-lg font-semibold transition-all text-sm shadow-md hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin relative z-10" />
                    <span className="relative z-10">Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 md:w-5 md:h-5 relative z-10" />
                    <span className="relative z-10">Save</span>
                  </>
                )}
              </button>
            </div>
          </div>
          
          <div className="p-4 sm:p-5 md:p-8">
            <PersonalInfoSection
              readOnly={false}
              data={form}
              onInputChange={handleInputChange}
              onSelectChange={handleSelectChange}
              genders={genders}
              maritalStatuses={maritalStatuses}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
